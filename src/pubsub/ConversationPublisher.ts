/**
 * Conversation Publisher Extension for Pub/Sub
 * Extends pub/sub functionality to initiate conversations with topic subscribers
 */

import { EventEmitter } from 'eventemitter3';
import { 
  IPubSubExtension,
  IConversationManager,
  IMessageInterceptor,
  IWhatsAppAPI,
  IStorageBackend
} from '../core/interfaces';
import { 
  ConversationInitiationRequest,
  Message,
  MessageType,
  WhatsAppMessage
} from '../core/types';
import { Logger } from '../utils/Logger';
import { v4 as uuidv4 } from 'uuid';

export class ConversationPublisher extends EventEmitter implements IPubSubExtension {
  private readonly TOPIC_PREFIX = 'topic:';
  private readonly SUBSCRIBER_PREFIX = 'subscribers:';
  
  constructor(
    private conversationManager: IConversationManager,
    private messageInterceptor: IMessageInterceptor,
    private whatsappAPI: IWhatsAppAPI,
    private storage: IStorageBackend,
    private logger: Logger,
    private config: {
      botPhoneNumber: string;
      maxConcurrentConversations?: number;
      retryAttempts?: number;
      retryDelay?: number;
    }
  ) {
    super();
  }

  /**
   * Publish a message to a topic with optional conversation initiation
   */
  public async publishToTopic(
    topicId: string,
    message: string,
    options?: {
      initiateConversation?: boolean;
      conversationConfig?: Partial<ConversationInitiationRequest>;
    }
  ): Promise<void> {
    try {
      const subscribers = await this.getTopicSubscribers(topicId);
      
      if (subscribers.length === 0) {
        this.logger.warn(`No subscribers for topic ${topicId}`);
        return;
      }

      this.logger.info(`Publishing to topic ${topicId} with ${subscribers.length} subscribers`);

      if (options?.initiateConversation) {
        // Initiate conversations with all subscribers
        const request: ConversationInitiationRequest = {
          phoneNumbers: subscribers,
          message,
          conversationType: options.conversationConfig?.conversationType || 'notification',
          agentId: options.conversationConfig?.agentId,
          metadata: {
            topicId,
            ...options.conversationConfig?.metadata
          },
          config: options.conversationConfig?.config
        };

        await this.initiateConversations(request);
        
      } else {
        // Send simple broadcast message (no conversation)
        await this.broadcastMessage(subscribers, message);
      }

      this.emit('topic:published', { topicId, subscribers: subscribers.length });
      
    } catch (error) {
      this.logger.error(`Error publishing to topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Get all subscribers for a topic
   */
  public async getTopicSubscribers(topicId: string): Promise<string[]> {
    const key = `${this.SUBSCRIBER_PREFIX}${topicId}`;
    return await this.storage.setMembers(key);
  }

  /**
   * Subscribe a phone number to a topic
   */
  public async subscribeToTopic(topicId: string, phoneNumber: string): Promise<void> {
    const key = `${this.SUBSCRIBER_PREFIX}${topicId}`;
    await this.storage.setAdd(key, phoneNumber);
    
    this.logger.info(`Subscribed ${phoneNumber} to topic ${topicId}`);
    this.emit('topic:subscribed', { topicId, phoneNumber });
  }

  /**
   * Unsubscribe a phone number from a topic
   */
  public async unsubscribeFromTopic(topicId: string, phoneNumber: string): Promise<void> {
    const key = `${this.SUBSCRIBER_PREFIX}${topicId}`;
    await this.storage.setRemove(key, phoneNumber);
    
    this.logger.info(`Unsubscribed ${phoneNumber} from topic ${topicId}`);
    this.emit('topic:unsubscribed', { topicId, phoneNumber });
  }

  /**
   * Initiate conversations with multiple recipients
   */
  public async initiateConversations(
    request: ConversationInitiationRequest
  ): Promise<{ 
    initiated: string[]; 
    failed: Array<{ phoneNumber: string; error: string }> 
  }> {
    const initiated: string[] = [];
    const failed: Array<{ phoneNumber: string; error: string }> = [];
    
    // Process in batches to avoid overwhelming the system
    const batchSize = this.config.maxConcurrentConversations || 10;
    
    for (let i = 0; i < request.phoneNumbers.length; i += batchSize) {
      const batch = request.phoneNumbers.slice(i, i + batchSize);
      
      const promises = batch.map(async (phoneNumber) => {
        try {
          await this.initiateConversation(phoneNumber, request);
          initiated.push(phoneNumber);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failed.push({ phoneNumber, error: errorMessage });
          this.logger.error(`Failed to initiate conversation with ${phoneNumber}:`, error);
        }
      });
      
      await Promise.all(promises);
      
      // Add delay between batches
      if (i + batchSize < request.phoneNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.logger.info(`Initiated ${initiated.length} conversations, ${failed.length} failed`);
    
    return { initiated, failed };
  }

  /**
   * Initiate a single conversation
   */
  private async initiateConversation(
    phoneNumber: string,
    request: ConversationInitiationRequest
  ): Promise<void> {
    // Create conversation context
    const conversation = await this.conversationManager.createConversation(
      phoneNumber,
      undefined,
      {
        initiatedBy: 'system',
        conversationType: request.conversationType,
        agentId: request.agentId,
        ...request.metadata
      }
    );

    // Send initial message
    const result = await this.whatsappAPI.sendMessage(
      phoneNumber,
      request.message
    );

    // Create WhatsApp message object for interception
    const whatsappMessage: WhatsAppMessage = {
      id: result.messageId,
      from: this.config.botPhoneNumber,
      to: phoneNumber,
      content: request.message,
      type: MessageType.TEXT,
      timestamp: new Date(),
      metadata: {
        conversationId: conversation.conversationId,
        initiated: true,
        ...request.metadata
      }
    };

    // Store as outgoing message in conversation history
    const message: Message = {
      ...whatsappMessage,
      status: 'processed',
      conversationId: conversation.conversationId,
      agentId: request.agentId
    };
    
    await this.conversationManager.updateConversation(
      conversation.conversationId,
      message
    );

    // If conversation allows user responses, set up listener
    if (request.config?.allowUserResponse !== false) {
      this.setupConversationListener(conversation.conversationId, request.config);
    }

    this.emit('conversation:initiated', { 
      phoneNumber, 
      conversationId: conversation.conversationId 
    });
  }

  /**
   * Broadcast a simple message without initiating conversations
   */
  private async broadcastMessage(phoneNumbers: string[], message: string): Promise<void> {
    const promises = phoneNumbers.map(async (phoneNumber) => {
      try {
        await this.whatsappAPI.sendMessage(phoneNumber, message);
        this.logger.debug(`Sent broadcast message to ${phoneNumber}`);
      } catch (error) {
        this.logger.error(`Failed to send broadcast to ${phoneNumber}:`, error);
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Set up conversation listener for auto-close and other features
   */
  private setupConversationListener(
    conversationId: string, 
    config?: ConversationInitiationRequest['config']
  ): void {
    if (config?.autoCloseAfter) {
      setTimeout(async () => {
        await this.conversationManager.closeConversation(conversationId);
        this.logger.info(`Auto-closed conversation ${conversationId}`);
      }, config.autoCloseAfter * 60 * 1000);
    }

    // Additional listener setup for max messages, escalation, etc.
    if (config?.maxMessages) {
      this.monitorMessageCount(conversationId, config.maxMessages);
    }
  }

  /**
   * Monitor message count and close conversation if limit reached
   */
  private async monitorMessageCount(conversationId: string, maxMessages: number): Promise<void> {
    const checkMessageCount = async () => {
      const conversation = await this.conversationManager.getConversation(conversationId);
      
      if (conversation && conversation.messageCount >= maxMessages) {
        await this.conversationManager.closeConversation(conversationId);
        this.logger.info(`Closed conversation ${conversationId} - message limit reached`);
      }
    };

    // Set up periodic check
    const interval = setInterval(async () => {
      const conversation = await this.conversationManager.getConversation(conversationId);
      
      if (!conversation || conversation.state !== 'active') {
        clearInterval(interval);
        return;
      }
      
      await checkMessageCount();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Create a topic-based campaign
   */
  public async createCampaign(config: {
    name: string;
    topicId: string;
    message: string;
    conversationType: ConversationInitiationRequest['conversationType'];
    agentId?: string;
    schedule?: Date;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const campaignId = uuidv4();
    
    const campaign = {
      id: campaignId,
      ...config,
      createdAt: new Date(),
      status: 'scheduled'
    };
    
    await this.storage.set(`campaign:${campaignId}`, campaign);
    
    if (config.schedule) {
      // Schedule the campaign
      const delay = config.schedule.getTime() - Date.now();
      
      if (delay > 0) {
        setTimeout(async () => {
          await this.executeCampaign(campaignId);
        }, delay);
      } else {
        // Execute immediately if schedule is in the past
        await this.executeCampaign(campaignId);
      }
    }
    
    this.logger.info(`Created campaign ${campaignId}`);
    return campaignId;
  }

  /**
   * Execute a campaign
   */
  private async executeCampaign(campaignId: string): Promise<void> {
    const campaign = await this.storage.get<any>(`campaign:${campaignId}`);
    
    if (!campaign) {
      this.logger.error(`Campaign ${campaignId} not found`);
      return;
    }
    
    campaign.status = 'executing';
    await this.storage.set(`campaign:${campaignId}`, campaign);
    
    await this.publishToTopic(
      campaign.topicId,
      campaign.message,
      {
        initiateConversation: true,
        conversationConfig: {
          conversationType: campaign.conversationType,
          agentId: campaign.agentId,
          metadata: {
            campaignId,
            campaignName: campaign.name,
            ...campaign.metadata
          }
        }
      }
    );
    
    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await this.storage.set(`campaign:${campaignId}`, campaign);
    
    this.logger.info(`Executed campaign ${campaignId}`);
    this.emit('campaign:executed', campaign);
  }
}