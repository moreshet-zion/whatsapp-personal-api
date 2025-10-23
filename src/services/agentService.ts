import OpenAI from 'openai';
import pino from 'pino';
import { InboundMessage } from '../dto/messages.js';

export interface AgentConfig {
  enabled: boolean;
  openaiApiKey?: string | undefined;
  model: string;
  persona: string;
  temperature: number;
  maxTokens: number;
  autoReply: boolean;
  whitelistedNumbers: string[]; // Only respond to these numbers (empty = all)
  conversationContextLimit: number; // Number of messages to keep in context
}

export interface ConversationContext {
  chatId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  lastActivity: number;
}

export class AgentService {
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private client: OpenAI | null = null;
  private conversations = new Map<string, ConversationContext>();
  private readonly contextTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(private config: AgentConfig) {
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
      this.client = null;
      return;
    }

    try {
      this.client = new OpenAI({ apiKey });
      this.logger.info('OpenAI client initialized');
    } catch (err) {
      this.logger.error({ err }, 'Failed to initialize OpenAI client');
      this.client = null;
    }
  }

  public updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Re-initialize client if API key changed
    if (config.openaiApiKey !== undefined) {
      this.initializeClient();
    }
    
    this.logger.info({ config: this.config }, 'Agent configuration updated');
  }

  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  public isEnabled(): boolean {
    return this.config.enabled && this.client !== null;
  }

  private isWhitelisted(from: string): boolean {
    // If whitelist is empty, allow all
    if (this.config.whitelistedNumbers.length === 0) {
      return true;
    }
    
    // Check if the sender is in the whitelist
    const normalizedFrom = from.replace(/[^0-9]/g, '');
    return this.config.whitelistedNumbers.some(number => {
      const normalized = number.replace(/[^0-9]/g, '');
      return normalizedFrom.includes(normalized) || normalized.includes(normalizedFrom);
    });
  }

  private getOrCreateContext(chatId: string): ConversationContext {
    let context = this.conversations.get(chatId);
    
    if (!context) {
      context = {
        chatId,
        messages: [],
        lastActivity: Date.now()
      };
      this.conversations.set(chatId, context);
    }
    
    return context;
  }

  private cleanupOldContexts(): void {
    const now = Date.now();
    for (const [chatId, context] of this.conversations.entries()) {
      if (now - context.lastActivity > this.contextTimeout) {
        this.conversations.delete(chatId);
        this.logger.info({ chatId }, 'Cleaned up old conversation context');
      }
    }
  }

  public async processMessage(message: InboundMessage): Promise<string | null> {
    // Check if agent is enabled
    if (!this.isEnabled()) {
      this.logger.debug('Agent is disabled, skipping message');
      return null;
    }

    // Check if message is from a whitelisted number
    if (!this.isWhitelisted(message.from)) {
      this.logger.debug({ from: message.from }, 'Message from non-whitelisted number, skipping');
      return null;
    }

    // Only respond to text messages
    if (message.type !== 'text' || !message.text) {
      this.logger.debug({ type: message.type }, 'Non-text message, skipping');
      return null;
    }

    // Skip messages sent by us (fromMe)
    if (message.metadata?.fromMe) {
      this.logger.debug('Message from me, skipping');
      return null;
    }

    try {
      // Get or create conversation context
      const context = this.getOrCreateContext(message.chatId);
      
      // Add user message to context
      context.messages.push({
        role: 'user',
        content: message.text,
        timestamp: message.ts
      });
      
      // Keep only the last N messages for context
      if (context.messages.length > this.config.conversationContextLimit) {
        context.messages = context.messages.slice(-this.config.conversationContextLimit);
      }
      
      // Update last activity
      context.lastActivity = Date.now();
      
      // Clean up old contexts periodically
      this.cleanupOldContexts();
      
      // Build messages for OpenAI API
      const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.config.persona
        },
        ...context.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];
      
      this.logger.info({ 
        chatId: message.chatId, 
        from: message.from,
        messageCount: context.messages.length 
      }, 'Processing message with OpenAI');
      
      // Call OpenAI API
      const response = await this.client!.chat.completions.create({
        model: this.config.model,
        messages: apiMessages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });
      
      const assistantMessage = response.choices[0]?.message?.content;
      
      if (!assistantMessage) {
        this.logger.warn('OpenAI returned empty response');
        return null;
      }
      
      // Add assistant response to context
      context.messages.push({
        role: 'assistant',
        content: assistantMessage,
        timestamp: Date.now()
      });
      
      this.logger.info({ 
        chatId: message.chatId,
        responseLength: assistantMessage.length,
        tokensUsed: response.usage?.total_tokens 
      }, 'Generated AI response');
      
      return assistantMessage;
    } catch (err) {
      this.logger.error({ err, messageId: message.id }, 'Failed to process message with OpenAI');
      return null;
    }
  }

  public clearContext(chatId: string): boolean {
    return this.conversations.delete(chatId);
  }

  public clearAllContexts(): void {
    this.conversations.clear();
    this.logger.info('Cleared all conversation contexts');
  }

  public getContextCount(): number {
    return this.conversations.size;
  }

  public getConversationHistory(chatId: string): ConversationContext | null {
    return this.conversations.get(chatId) || null;
  }
}
