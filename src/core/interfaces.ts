/**
 * Core interfaces for the message interception system
 */

import { 
  Message, 
  WhatsAppMessage, 
  RoutingDecision, 
  ConversationContext,
  AgentPersona,
  AIEngineConfig,
  ConversationInitiationRequest
} from './types';

/**
 * Interface for message routing logic
 */
export interface IMessageRouter {
  route(message: Message): Promise<RoutingDecision>;
  registerRule(name: string, rule: RoutingRule): void;
  removeRule(name: string): void;
  setDefaultAction(action: RoutingDecision): void;
}

/**
 * Routing rule definition
 */
export interface RoutingRule {
  name: string;
  priority: number;
  condition: (message: Message) => boolean | Promise<boolean>;
  action: (message: Message) => RoutingDecision | Promise<RoutingDecision>;
  enabled?: boolean;
}

/**
 * Interface for conversation management
 */
export interface IConversationManager {
  createConversation(
    phoneNumber: string,
    initialMessage?: Message,
    metadata?: Record<string, any>
  ): Promise<ConversationContext>;
  
  getConversation(conversationId: string): Promise<ConversationContext | null>;
  
  getActiveConversationByPhone(phoneNumber: string): Promise<ConversationContext | null>;
  
  updateConversation(
    conversationId: string,
    message: Message
  ): Promise<void>;
  
  closeConversation(conversationId: string): Promise<void>;
  
  listActiveConversations(filters?: {
    agentId?: string;
    phoneNumber?: string;
    state?: string;
  }): Promise<ConversationContext[]>;
  
  getConversationHistory(
    conversationId: string,
    limit?: number,
    offset?: number
  ): Promise<Message[]>;
}

/**
 * Interface for storage backend
 */
export interface IStorageBackend {
  // Key-value operations
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  
  // List operations
  listPush<T = any>(key: string, value: T): Promise<void>;
  listRange<T = any>(key: string, start: number, stop: number): Promise<T[]>;
  listLength(key: string): Promise<number>;
  
  // Set operations
  setAdd(key: string, member: string): Promise<void>;
  setMembers(key: string): Promise<string[]>;
  setRemove(key: string, member: string): Promise<void>;
  
  // Hash operations
  hashSet(key: string, field: string, value: any): Promise<void>;
  hashGet(key: string, field: string): Promise<any>;
  hashGetAll(key: string): Promise<Record<string, any>>;
  
  // Pattern operations
  keys(pattern: string): Promise<string[]>;
  
  // Transactions
  multi(): IStorageTransaction;
}

/**
 * Storage transaction interface
 */
export interface IStorageTransaction {
  get(key: string): IStorageTransaction;
  set(key: string, value: any, ttl?: number): IStorageTransaction;
  delete(key: string): IStorageTransaction;
  exec(): Promise<any[]>;
  discard(): void;
}

/**
 * Interface for AI engines
 */
export interface IAIEngine {
  generateResponse(
    message: Message,
    conversationHistory: Message[],
    context: {
      persona?: AgentPersona;
      conversationContext?: ConversationContext;
      customPrompt?: string;
    }
  ): Promise<string>;
  
  getCapabilities(): {
    supportsStreaming: boolean;
    maxContextLength: number;
    supportsFunctionCalling: boolean;
    supportsVision: boolean;
  };
  
  getName(): string;
}

/**
 * Interface for AI agents
 */
export interface IAgent {
  id: string;
  persona: AgentPersona;
  
  processMessage(
    message: Message,
    conversation: ConversationContext
  ): Promise<Message>;
  
  setEngine(engine: IAIEngine): void;
  getEngine(): IAIEngine | null;
  
  canHandle(message: Message): boolean;
}

/**
 * Interface for message interceptor
 */
export interface IMessageInterceptor {
  intercept(message: WhatsAppMessage): Promise<Message | null>;
  
  registerPreProcessor(processor: MessageProcessor): void;
  registerPostProcessor(processor: MessageProcessor): void;
  
  registerAgent(agent: IAgent): void;
  getAgent(agentId: string): IAgent | undefined;
  
  startProcessing(): Promise<void>;
  stopProcessing(): Promise<void>;
}

/**
 * Message processor function type
 */
export type MessageProcessor = (message: Message) => Promise<Message> | Message;

/**
 * WhatsApp API interface for sending messages
 */
export interface IWhatsAppAPI {
  sendMessage(
    to: string,
    message: string,
    options?: {
      replyTo?: string;
      buttons?: Array<{ id: string; title: string }>;
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'document';
    }
  ): Promise<{ messageId: string; status: string }>;
  
  markAsRead(messageId: string): Promise<void>;
  
  getMessageStatus(messageId: string): Promise<string>;
}

/**
 * Pub/Sub extension for conversation initiation
 */
export interface IPubSubExtension {
  publishToTopic(
    topicId: string,
    message: string,
    options?: {
      initiateConversation?: boolean;
      conversationConfig?: Partial<ConversationInitiationRequest>;
    }
  ): Promise<void>;
  
  getTopicSubscribers(topicId: string): Promise<string[]>;
  
  initiateConversations(
    request: ConversationInitiationRequest
  ): Promise<{ 
    initiated: string[]; 
    failed: Array<{ phoneNumber: string; error: string }> 
  }>;
}