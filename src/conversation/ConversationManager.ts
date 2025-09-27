/**
 * Conversation Manager
 * Manages conversation lifecycle for WhatsApp interactions
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import { 
  IConversationManager, 
  IStorageBackend 
} from '../core/interfaces';
import { 
  Message, 
  ConversationContext,
  ConversationState 
} from '../core/types';
import { Logger } from '../utils/Logger';

export class ConversationManager extends EventEmitter implements IConversationManager {
  private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly CONVERSATION_PREFIX = 'conversation:';
  private readonly ACTIVE_CONV_PREFIX = 'active_conv:';
  private readonly HISTORY_PREFIX = 'history:';
  
  constructor(
    private storage: IStorageBackend,
    private logger: Logger,
    private config: {
      conversationTimeout?: number;
      maxHistorySize?: number;
      autoArchiveAfterDays?: number;
    } = {}
  ) {
    super();
  }

  public async createConversation(
    phoneNumber: string,
    initialMessage?: Message,
    metadata: Record<string, any> = {}
  ): Promise<ConversationContext> {
    const conversationId = uuidv4();
    const now = new Date();
    
    const context: ConversationContext = {
      conversationId,
      phoneNumber,
      botNumber: initialMessage?.to || '',
      state: ConversationState.ACTIVE,
      metadata,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: initialMessage ? 1 : 0,
      tags: []
    };

    // Store conversation context
    await this.storage.set(
      `${this.CONVERSATION_PREFIX}${conversationId}`,
      context
    );

    // Map phone number to active conversation
    await this.storage.set(
      `${this.ACTIVE_CONV_PREFIX}${phoneNumber}`,
      conversationId,
      this.config.conversationTimeout || this.CONVERSATION_TIMEOUT
    );

    // Store initial message if provided
    if (initialMessage) {
      await this.addMessageToHistory(conversationId, initialMessage);
    }

    this.logger.info(`Created conversation ${conversationId} for ${phoneNumber}`);
    this.emit('conversation:created', context);

    return context;
  }

  public async getConversation(conversationId: string): Promise<ConversationContext | null> {
    const context = await this.storage.get<ConversationContext>(
      `${this.CONVERSATION_PREFIX}${conversationId}`
    );

    if (!context) {
      return null;
    }

    // Check if conversation has timed out
    if (await this.isConversationTimedOut(context)) {
      await this.closeConversation(conversationId);
      return null;
    }

    return context;
  }

  public async getActiveConversationByPhone(phoneNumber: string): Promise<ConversationContext | null> {
    const conversationId = await this.storage.get<string>(
      `${this.ACTIVE_CONV_PREFIX}${phoneNumber}`
    );

    if (!conversationId) {
      return null;
    }

    return this.getConversation(conversationId);
  }

  public async updateConversation(
    conversationId: string,
    message: Message
  ): Promise<void> {
    const context = await this.getConversation(conversationId);
    
    if (!context) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Update conversation context
    context.updatedAt = new Date();
    context.lastMessageAt = new Date();
    context.messageCount++;

    await this.storage.set(
      `${this.CONVERSATION_PREFIX}${conversationId}`,
      context
    );

    // Refresh TTL for active conversation mapping
    await this.storage.set(
      `${this.ACTIVE_CONV_PREFIX}${context.phoneNumber}`,
      conversationId,
      this.config.conversationTimeout || this.CONVERSATION_TIMEOUT
    );

    // Add message to history
    await this.addMessageToHistory(conversationId, message);

    this.logger.debug(`Updated conversation ${conversationId} with message ${message.id}`);
    this.emit('conversation:updated', { context, message });
  }

  public async closeConversation(conversationId: string): Promise<void> {
    const context = await this.getConversation(conversationId);
    
    if (!context) {
      return;
    }

    // Update state
    context.state = ConversationState.CLOSED;
    context.updatedAt = new Date();

    await this.storage.set(
      `${this.CONVERSATION_PREFIX}${conversationId}`,
      context
    );

    // Remove active conversation mapping
    await this.storage.delete(
      `${this.ACTIVE_CONV_PREFIX}${context.phoneNumber}`
    );

    this.logger.info(`Closed conversation ${conversationId}`);
    this.emit('conversation:closed', context);
  }

  public async listActiveConversations(filters?: {
    agentId?: string;
    phoneNumber?: string;
    state?: string;
  }): Promise<ConversationContext[]> {
    const pattern = `${this.CONVERSATION_PREFIX}*`;
    const keys = await this.storage.keys(pattern);
    
    const conversations: ConversationContext[] = [];
    
    for (const key of keys) {
      const context = await this.storage.get<ConversationContext>(key);
      
      if (!context) continue;
      
      // Apply filters
      if (filters) {
        if (filters.agentId && context.agentId !== filters.agentId) continue;
        if (filters.phoneNumber && context.phoneNumber !== filters.phoneNumber) continue;
        if (filters.state && context.state !== filters.state) continue;
      }
      
      // Only include active conversations by default
      if (!filters?.state && context.state !== ConversationState.ACTIVE) continue;
      
      conversations.push(context);
    }
    
    // Sort by last message time (most recent first)
    return conversations.sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }

  public async getConversationHistory(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    const messages = await this.storage.listRange<Message>(
      `${this.HISTORY_PREFIX}${conversationId}`,
      offset,
      offset + limit - 1
    );
    
    return messages;
  }

  // Helper methods

  private async addMessageToHistory(conversationId: string, message: Message): Promise<void> {
    const historyKey = `${this.HISTORY_PREFIX}${conversationId}`;
    
    await this.storage.listPush(historyKey, message);
    
    // Trim history if needed
    const maxSize = this.config.maxHistorySize || 1000;
    const currentSize = await this.storage.listLength(historyKey);
    
    if (currentSize > maxSize) {
      // Keep only the most recent messages
      const messages = await this.storage.listRange<Message>(
        historyKey,
        -maxSize,
        -1
      );
      
      // Clear and repopulate with trimmed history
      await this.storage.delete(historyKey);
      for (const msg of messages) {
        await this.storage.listPush(historyKey, msg);
      }
    }
  }

  private async isConversationTimedOut(context: ConversationContext): Promise<boolean> {
    const timeout = this.config.conversationTimeout || this.CONVERSATION_TIMEOUT;
    const timeSinceLastMessage = Date.now() - new Date(context.lastMessageAt).getTime();
    
    return timeSinceLastMessage > timeout;
  }

  // Analytics methods

  public async getConversationStats(conversationId: string): Promise<{
    duration: number;
    messageCount: number;
    avgResponseTime?: number;
    tags: string[];
  }> {
    const context = await this.getConversation(conversationId);
    
    if (!context) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const history = await this.getConversationHistory(conversationId);
    
    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (let i = 1; i < history.length; i++) {
      if (history[i].from !== history[i - 1].from) {
        const responseTime = new Date(history[i].timestamp).getTime() - 
                           new Date(history[i - 1].timestamp).getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }
    }
    
    return {
      duration: new Date(context.updatedAt).getTime() - new Date(context.createdAt).getTime(),
      messageCount: context.messageCount,
      avgResponseTime: responseCount > 0 ? totalResponseTime / responseCount : undefined,
      tags: context.tags || []
    };
  }

  public async tagConversation(conversationId: string, tags: string[]): Promise<void> {
    const context = await this.getConversation(conversationId);
    
    if (!context) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    context.tags = [...new Set([...(context.tags || []), ...tags])];
    
    await this.storage.set(
      `${this.CONVERSATION_PREFIX}${conversationId}`,
      context
    );
  }

  // Cleanup methods

  public async archiveOldConversations(): Promise<number> {
    const daysToKeep = this.config.autoArchiveAfterDays || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const conversations = await this.listActiveConversations();
    let archivedCount = 0;
    
    for (const context of conversations) {
      if (new Date(context.lastMessageAt) < cutoffDate) {
        context.state = ConversationState.ARCHIVED;
        await this.storage.set(
          `${this.CONVERSATION_PREFIX}${context.conversationId}`,
          context
        );
        archivedCount++;
      }
    }
    
    this.logger.info(`Archived ${archivedCount} old conversations`);
    return archivedCount;
  }
}