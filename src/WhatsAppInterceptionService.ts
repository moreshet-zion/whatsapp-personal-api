/**
 * WhatsApp Message Interception Service
 * Main integration point for adding message interception to existing WhatsApp API
 */

import { EventEmitter } from 'eventemitter3';
import { MessageInterceptor } from './interceptor/MessageInterceptor';
import { MessageRouter, DepartmentRouter } from './routing/MessageRouter';
import { ConversationManager } from './conversation/ConversationManager';
import { ConversationPublisher } from './pubsub/ConversationPublisher';
import { LocalFileStorage, RedisStorage } from './storage/StorageBackend';
import { Agent, SupportAgent, SalesAgent } from './agents/Agent';
import { AIEngineFactory } from './agents/AIEngines';
import { Logger } from './utils/Logger';
import { 
  IWhatsAppAPI,
  IStorageBackend,
  IMessageInterceptor,
  IConversationManager,
  IPubSubExtension
} from './core/interfaces';
import { 
  WhatsAppMessage,
  Message,
  ConversationInitiationRequest
} from './core/types';

/**
 * Configuration for the WhatsApp Interception Service
 */
export interface ServiceConfig {
  storage?: {
    type: 'local' | 'redis';
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
    localPath?: string;
  };
  whatsapp: {
    botPhoneNumber: string;
    api: IWhatsAppAPI;
  };
  ai?: {
    defaultEngine?: 'openai' | 'claude' | 'mock';
    openai?: {
      apiKey: string;
      model?: string;
    };
    claude?: {
      apiKey: string;
      model?: string;
    };
  };
  routing?: {
    departments?: Array<{
      name: string;
      keywords: string[];
      agentId: string;
    }>;
    customRules?: Array<{
      name: string;
      pattern: string;
      action: 'start' | 'continue' | 'ignore';
      agentId?: string;
    }>;
  };
  conversation?: {
    timeoutMinutes?: number;
    maxHistorySize?: number;
    autoArchiveAfterDays?: number;
  };
}

/**
 * Main WhatsApp Interception Service
 */
export class WhatsAppInterceptionService extends EventEmitter {
  private logger: Logger;
  private storage: IStorageBackend;
  private router: MessageRouter;
  private conversationManager: IConversationManager;
  private messageInterceptor: IMessageInterceptor;
  private conversationPublisher: IPubSubExtension;
  private agents: Map<string, Agent> = new Map();
  private isRunning: boolean = false;

  constructor(private config: ServiceConfig) {
    super();
    this.logger = new Logger('WhatsAppInterception');
    this.initialize();
  }

  private initialize(): void {
    // Initialize storage
    this.initializeStorage();
    
    // Initialize conversation manager
    this.conversationManager = new ConversationManager(
      this.storage,
      this.logger,
      {
        conversationTimeout: (this.config.conversation?.timeoutMinutes || 30) * 60 * 1000,
        maxHistorySize: this.config.conversation?.maxHistorySize || 100,
        autoArchiveAfterDays: this.config.conversation?.autoArchiveAfterDays || 30
      }
    );
    
    // Initialize router
    this.initializeRouter();
    
    // Initialize message interceptor
    this.messageInterceptor = new MessageInterceptor(
      this.router,
      this.conversationManager,
      this.config.whatsapp.api,
      this.logger,
      {
        defaultAgentId: 'default-agent'
      }
    );
    
    // Initialize conversation publisher for pub/sub
    this.conversationPublisher = new ConversationPublisher(
      this.conversationManager,
      this.messageInterceptor,
      this.config.whatsapp.api,
      this.storage,
      this.logger,
      {
        botPhoneNumber: this.config.whatsapp.botPhoneNumber,
        maxConcurrentConversations: 10
      }
    );
    
    // Initialize AI agents
    this.initializeAgents();
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.logger.info('WhatsApp Interception Service initialized');
  }

  private initializeStorage(): void {
    if (this.config.storage?.type === 'redis' && this.config.storage.redis) {
      this.storage = new RedisStorage(this.config.storage.redis, this.logger);
    } else {
      this.storage = new LocalFileStorage(
        this.config.storage?.localPath || './data/storage',
        this.logger
      );
    }
  }

  private initializeRouter(): void {
    if (this.config.routing?.departments) {
      // Use department router if departments are configured
      const deptRouter = new DepartmentRouter(
        this.storage,
        this.conversationManager,
        this.logger
      );
      
      // Add departments
      for (const dept of this.config.routing.departments) {
        deptRouter.addDepartment(dept.name, {
          keywords: dept.keywords,
          agentId: dept.agentId
        });
      }
      
      this.router = deptRouter;
    } else {
      this.router = new MessageRouter(
        this.storage,
        this.conversationManager,
        this.logger
      );
    }
    
    // Add custom rules if configured
    if (this.config.routing?.customRules) {
      for (const rule of this.config.routing.customRules) {
        this.router.addPatternRule(
          rule.name,
          new RegExp(rule.pattern),
          {
            shouldProcess: rule.action !== 'ignore',
            action: rule.action === 'start' ? 'start_conversation' : 'continue_conversation',
            createNewConversation: rule.action === 'start',
            agentId: rule.agentId,
            reason: `Custom rule: ${rule.name}`
          }
        );
      }
    }
  }

  private initializeAgents(): void {
    // Create AI engine
    let engine;
    
    if (this.config.ai?.defaultEngine === 'openai' && this.config.ai.openai) {
      engine = AIEngineFactory.createEngine('openai', this.config.ai.openai, this.logger);
    } else if (this.config.ai?.defaultEngine === 'claude' && this.config.ai.claude) {
      engine = AIEngineFactory.createEngine('claude', this.config.ai.claude, this.logger);
    } else {
      // Use mock engine by default
      engine = AIEngineFactory.createEngine('mock', {
        responses: {
          'hello': 'Hello! Welcome to our WhatsApp service. How can I help you?',
          'help': 'I can assist you with various queries. Just let me know what you need!',
          'support': 'I\'ll connect you with our support team right away.',
          'sales': 'Our sales team would be happy to help you. What product are you interested in?'
        }
      }, this.logger);
    }
    
    // Create default agent
    const defaultAgent = new Agent(
      'default-agent',
      {
        id: 'default',
        name: 'Assistant',
        role: 'General Assistant',
        personality: 'Helpful and friendly',
        instructions: 'Assist users with their queries',
        responseStyle: {
          tone: 'friendly',
          useEmojis: true,
          maxLength: 500
        }
      },
      this.logger,
      engine
    );
    
    this.agents.set('default-agent', defaultAgent);
    this.messageInterceptor.registerAgent(defaultAgent);
    
    // Create specialized agents
    const supportAgent = new SupportAgent('support-agent', this.logger, engine);
    this.agents.set('support-agent', supportAgent);
    this.messageInterceptor.registerAgent(supportAgent);
    
    const salesAgent = new SalesAgent('sales-agent', this.logger, engine);
    this.agents.set('sales-agent', salesAgent);
    this.messageInterceptor.registerAgent(salesAgent);
  }

  private setupEventListeners(): void {
    // Forward events from sub-components
    this.messageInterceptor.on('message:processed', (data) => {
      this.emit('message:processed', data);
    });
    
    this.conversationManager.on('conversation:created', (data) => {
      this.emit('conversation:created', data);
    });
    
    this.conversationPublisher.on('conversation:initiated', (data) => {
      this.emit('conversation:initiated', data);
    });
  }

  /**
   * Process an incoming WhatsApp message
   */
  public async processIncomingMessage(message: WhatsAppMessage): Promise<Message | null> {
    try {
      return await this.messageInterceptor.intercept(message);
    } catch (error) {
      this.logger.error('Error processing incoming message:', error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Publish a message to a topic (pub/sub)
   */
  public async publishToTopic(
    topicId: string,
    message: string,
    initiateConversation: boolean = false,
    conversationConfig?: Partial<ConversationInitiationRequest>
  ): Promise<void> {
    await this.conversationPublisher.publishToTopic(
      topicId,
      message,
      {
        initiateConversation,
        conversationConfig
      }
    );
  }

  /**
   * Subscribe a phone number to a topic
   */
  public async subscribeToTopic(topicId: string, phoneNumber: string): Promise<void> {
    await this.conversationPublisher.subscribeToTopic(topicId, phoneNumber);
  }

  /**
   * Initiate conversations with multiple users
   */
  public async initiateConversations(
    request: ConversationInitiationRequest
  ): Promise<{ initiated: string[]; failed: Array<{ phoneNumber: string; error: string }> }> {
    return await this.conversationPublisher.initiateConversations(request);
  }

  /**
   * Add a custom routing rule
   */
  public addRoutingRule(
    name: string,
    condition: (message: Message) => boolean,
    action: (message: Message) => any
  ): void {
    this.router.registerRule(name, {
      name,
      priority: 50,
      condition,
      action
    });
  }

  /**
   * Get conversation statistics
   */
  public async getConversationStats(conversationId: string): Promise<any> {
    return await this.conversationManager.getConversationStats(conversationId);
  }

  /**
   * List active conversations
   */
  public async listActiveConversations(filters?: any): Promise<any[]> {
    return await this.conversationManager.listActiveConversations(filters);
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Service is already running');
      return;
    }
    
    await this.messageInterceptor.startProcessing();
    this.isRunning = true;
    
    this.logger.info('WhatsApp Interception Service started');
    this.emit('service:started');
  }

  /**
   * Stop the service
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Service is not running');
      return;
    }
    
    await this.messageInterceptor.stopProcessing();
    this.isRunning = false;
    
    this.logger.info('WhatsApp Interception Service stopped');
    this.emit('service:stopped');
  }

  /**
   * Get service status
   */
  public getStatus(): {
    running: boolean;
    agents: string[];
    activeConversations?: number;
  } {
    return {
      running: this.isRunning,
      agents: Array.from(this.agents.keys())
    };
  }
}

// Export all necessary types and interfaces
export * from './core/types';
export * from './core/interfaces';
export { Logger } from './utils/Logger';