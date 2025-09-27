/**
 * Core types and interfaces for the message interception system
 */

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
  LOCATION = 'location',
  STICKER = 'sticker',
  SYSTEM = 'system'
}

export enum MessageStatus {
  RECEIVED = 'received',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  IGNORED = 'ignored'
}

export enum ConversationState {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CLOSED = 'closed',
  ARCHIVED = 'archived'
}

export interface WhatsAppMessage {
  id: string;
  from: string;  // WhatsApp phone number
  to: string;    // Bot's WhatsApp number
  content: string;
  type: MessageType;
  timestamp: Date;
  metadata?: Record<string, any>;
  mediaUrl?: string;
  replyTo?: string;  // Message ID being replied to
}

export interface Message extends WhatsAppMessage {
  status: MessageStatus;
  conversationId?: string;
  agentId?: string;
  processingMetadata?: {
    receivedAt: Date;
    processedAt?: Date;
    processingTime?: number;
    error?: string;
  };
}

export interface ConversationContext {
  conversationId: string;
  phoneNumber: string;  // WhatsApp user's phone number
  botNumber: string;    // Bot's WhatsApp number
  state: ConversationState;
  agentId?: string;
  agentPersona?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  tags?: string[];
}

export interface RoutingDecision {
  shouldProcess: boolean;
  action: 'start_conversation' | 'continue_conversation' | 'ignore' | 'forward';
  conversationId?: string;
  createNewConversation?: boolean;
  agentId?: string;
  reason: string;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  personality: string;
  instructions: string;
  knowledge?: string[];
  constraints?: string[];
  capabilities?: string[];
  maxHistorySize?: number;
  responseStyle?: {
    tone?: 'formal' | 'casual' | 'friendly' | 'professional';
    useEmojis?: boolean;
    maxLength?: number;
  };
}

export interface AIEngineConfig {
  type: 'openai' | 'claude' | 'gemini' | 'custom';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  endpoint?: string;  // For custom endpoints
}

export interface ConversationInitiationRequest {
  phoneNumbers: string[];  // List of WhatsApp numbers
  message: string;
  conversationType: 'support' | 'sales' | 'notification' | 'survey' | 'custom';
  agentId?: string;
  metadata?: Record<string, any>;
  config?: {
    allowUserResponse?: boolean;
    autoCloseAfter?: number;  // minutes
    maxMessages?: number;
    escalationRules?: any;
  };
}

export interface PubSubMessage {
  topicId: string;
  message: string;
  initiateConversation?: boolean;
  conversationConfig?: ConversationInitiationRequest;
}