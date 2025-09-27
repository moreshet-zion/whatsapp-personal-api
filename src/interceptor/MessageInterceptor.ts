/**
 * Message Interceptor
 * Main entry point for processing incoming WhatsApp messages
 */

import { EventEmitter } from 'eventemitter3';
import { 
  IMessageInterceptor,
  IMessageRouter,
  IConversationManager,
  IAgent,
  MessageProcessor,
  IWhatsAppAPI
} from '../core/interfaces';
import { 
  WhatsAppMessage,
  Message,
  MessageStatus,
  ConversationState
} from '../core/types';
import { Logger } from '../utils/Logger';
import { v4 as uuidv4 } from 'uuid';

export class MessageInterceptor extends EventEmitter implements IMessageInterceptor {
  private agents: Map<string, IAgent> = new Map();
  private preProcessors: MessageProcessor[] = [];
  private postProcessors: MessageProcessor[] = [];
  private processing: boolean = false;
  private messageQueue: Message[] = [];
  
  constructor(
    private router: IMessageRouter,
    private conversationManager: IConversationManager,
    private whatsappAPI: IWhatsAppAPI,
    private logger: Logger,
    private config: {
      maxQueueSize?: number;
      processingBatchSize?: number;
      defaultAgentId?: string;
    } = {}
  ) {
    super();
  }

  public async intercept(whatsappMessage: WhatsAppMessage): Promise<Message | null> {
    try {
      // Convert WhatsApp message to internal Message format
      let message: Message = {
        ...whatsappMessage,
        id: whatsappMessage.id || uuidv4(),
        status: MessageStatus.RECEIVED,
        processingMetadata: {
          receivedAt: new Date()
        }
      };

      // Run pre-processors
      for (const processor of this.preProcessors) {
        message = await Promise.resolve(processor(message));
      }

      // Update status
      message.status = MessageStatus.QUEUED;
      this.emit('message:queued', message);

      // Route the message
      const routingDecision = await this.router.route(message);
      
      this.logger.info(`Message ${message.id} routing decision:`, {
        decision: routingDecision.action,
        shouldProcess: routingDecision.shouldProcess
      });

      if (!routingDecision.shouldProcess) {
        message.status = MessageStatus.IGNORED;
        this.logger.info(`Message ${message.id} ignored: ${routingDecision.reason}`);
        this.emit('message:ignored', message);
        return null;
      }

      // Handle conversation context
      let conversationContext;
      
      if (routingDecision.createNewConversation) {
        // Create new conversation
        conversationContext = await this.conversationManager.createConversation(
          message.from,
          message,
          {
            agentId: routingDecision.agentId,
            ...routingDecision.metadata
          }
        );
        message.conversationId = conversationContext.conversationId;
        message.agentId = routingDecision.agentId;
        
        this.logger.info(`Created new conversation ${conversationContext.conversationId} for ${message.from}`);
        
      } else if (routingDecision.conversationId) {
        // Continue existing conversation
        conversationContext = await this.conversationManager.getConversation(
          routingDecision.conversationId
        );
        
        if (!conversationContext) {
          this.logger.error(`Conversation ${routingDecision.conversationId} not found`);
          message.status = MessageStatus.FAILED;
          return null;
        }
        
        message.conversationId = conversationContext.conversationId;
        message.agentId = conversationContext.agentId;
        
      } else {
        this.logger.error('No conversation context available');
        message.status = MessageStatus.FAILED;
        return null;
      }

      // Update message status
      message.status = MessageStatus.PROCESSING;
      this.emit('message:processing', message);

      // Select and process with agent
      const agent = this.selectAgent(message, conversationContext);
      
      if (!agent) {
        this.logger.error(`No agent available for message ${message.id}`);
        message.status = MessageStatus.FAILED;
        
        // Send fallback message
        await this.whatsappAPI.sendMessage(
          message.from,
          "I'm sorry, but I'm unable to process your message at the moment. Please try again later."
        );
        
        return null;
      }

      // Process message with agent
      const response = await agent.processMessage(message, conversationContext);
      
      // Update conversation with both messages
      await this.conversationManager.updateConversation(
        conversationContext.conversationId,
        message
      );
      
      if (response) {
        await this.conversationManager.updateConversation(
          conversationContext.conversationId,
          response
        );
        
        // Send response via WhatsApp
        await this.sendWhatsAppResponse(response);
      }

      // Update processing metadata
      message.processingMetadata!.processedAt = new Date();
      message.processingMetadata!.processingTime = 
        message.processingMetadata!.processedAt.getTime() - 
        message.processingMetadata!.receivedAt.getTime();
      
      // Update message status
      message.status = MessageStatus.PROCESSED;
      
      // Run post-processors
      if (response) {
        let processedResponse = response;
        for (const processor of this.postProcessors) {
          processedResponse = await Promise.resolve(processor(processedResponse));
        }
      }

      this.emit('message:processed', { message, response });
      
      return response;
      
    } catch (error) {
      this.logger.error(`Error processing message:`, error);
      this.emit('message:error', { message: whatsappMessage, error });
      return null;
    }
  }

  private selectAgent(message: Message, conversationContext: any): IAgent | undefined {
    // Try to get specific agent
    if (message.agentId) {
      const agent = this.agents.get(message.agentId);
      if (agent) return agent;
    }
    
    // Try conversation's agent
    if (conversationContext.agentId) {
      const agent = this.agents.get(conversationContext.agentId);
      if (agent) return agent;
    }
    
    // Try to find an agent that can handle this message
    for (const agent of this.agents.values()) {
      if (agent.canHandle(message)) {
        return agent;
      }
    }
    
    // Use default agent if configured
    if (this.config.defaultAgentId) {
      return this.agents.get(this.config.defaultAgentId);
    }
    
    // Return first available agent
    return this.agents.values().next().value;
  }

  private async sendWhatsAppResponse(response: Message): Promise<void> {
    try {
      const result = await this.whatsappAPI.sendMessage(
        response.to,
        response.content,
        {
          replyTo: response.replyTo,
          mediaUrl: response.mediaUrl
        }
      );
      
      this.logger.info(`Sent WhatsApp response: ${result.messageId}`);
      
    } catch (error) {
      this.logger.error('Failed to send WhatsApp response:', error);
      throw error;
    }
  }

  public registerPreProcessor(processor: MessageProcessor): void {
    this.preProcessors.push(processor);
    this.logger.debug('Registered pre-processor');
  }

  public registerPostProcessor(processor: MessageProcessor): void {
    this.postProcessors.push(processor);
    this.logger.debug('Registered post-processor');
  }

  public registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
    this.logger.info(`Registered agent: ${agent.id}`);
    this.emit('agent:registered', agent);
  }

  public getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  public async startProcessing(): Promise<void> {
    if (this.processing) {
      this.logger.warn('Processing already started');
      return;
    }
    
    this.processing = true;
    this.logger.info('Message processing started');
    this.emit('processing:started');
    
    // Start processing loop
    this.processQueue();
  }

  public async stopProcessing(): Promise<void> {
    this.processing = false;
    this.logger.info('Message processing stopped');
    this.emit('processing:stopped');
  }

  private async processQueue(): Promise<void> {
    while (this.processing) {
      if (this.messageQueue.length > 0) {
        const batchSize = this.config.processingBatchSize || 10;
        const batch = this.messageQueue.splice(0, batchSize);
        
        // Process batch in parallel
        await Promise.all(
          batch.map(message => this.processQueuedMessage(message))
        );
      }
      
      // Wait before checking queue again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async processQueuedMessage(message: Message): Promise<void> {
    try {
      // Process the message (simplified version, actual implementation would be more complex)
      this.logger.debug(`Processing queued message ${message.id}`);
      // ... processing logic
    } catch (error) {
      this.logger.error(`Error processing queued message ${message.id}:`, error);
    }
  }

  public queueMessage(message: Message): void {
    const maxQueueSize = this.config.maxQueueSize || 1000;
    
    if (this.messageQueue.length >= maxQueueSize) {
      this.logger.warn('Message queue is full, dropping oldest message');
      this.messageQueue.shift();
    }
    
    this.messageQueue.push(message);
    this.emit('message:queued', message);
  }
}