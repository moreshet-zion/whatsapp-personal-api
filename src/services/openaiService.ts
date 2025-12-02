import OpenAI from 'openai';
import pino from 'pino';
import { InboundMessage } from '../dto/messages.js';
import { MessageRecordingService } from './messageRecordingService.js';

export interface OpenAIConfig {
  apiKey?: string | undefined;
  keyword?: string | undefined;
  enabled?: boolean | undefined;
  model?: string | undefined;
}

export class OpenAIService {
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private config: OpenAIConfig;
  private client: OpenAI | null = null;
  private messageRecordingService: MessageRecordingService | null = null;
  
  // Environment variables for context configuration
  private readonly maxDays = parseInt(process.env.OPENAI_CONTEXT_MAX_DAYS || '3', 10);
  private readonly maxMessages = parseInt(process.env.OPENAI_CONTEXT_MAX_MESSAGES || '50', 10);

  constructor(config: OpenAIConfig = {}, messageRecordingService?: MessageRecordingService) {
    this.config = {
      enabled: false,
      model: 'gpt-3.5-turbo',
      ...config
    };
    this.messageRecordingService = messageRecordingService || null;
    this.initializeClient();
  }

  public setMessageRecordingService(service: MessageRecordingService): void {
    this.messageRecordingService = service;
  }

  private initializeClient(): void {
    if (this.config.apiKey && this.config.enabled) {
      try {
        this.client = new OpenAI({
          apiKey: this.config.apiKey
        });
        this.logger.info('OpenAI client initialized');
      } catch (err) {
        this.logger.error({ err }, 'Failed to initialize OpenAI client');
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  public updateConfig(config: Partial<OpenAIConfig>): void {
    this.config = { ...this.config, ...config };
    this.initializeClient();
    this.logger.info({ enabled: this.config.enabled, hasApiKey: !!this.config.apiKey, keyword: this.config.keyword }, 'OpenAI config updated');
  }

  public getConfig(): OpenAIConfig {
    return { ...this.config };
  }

  public isEnabled(): boolean {
    return this.config.enabled === true && !!this.config.apiKey && !!this.config.keyword;
  }

  public shouldProcessMessage(message: InboundMessage): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    // Only process text messages
    if (message.type !== 'text' || !message.text) {
      return false;
    }

    // Check if message contains the keyword
    const keyword = this.config.keyword || '';
    return message.text.includes(keyword);
  }

  public async processMessage(message: InboundMessage): Promise<string | null> {
    if (!this.shouldProcessMessage(message)) {
      return null;
    }

    if (!this.client) {
      this.logger.warn('OpenAI client not initialized');
      return null;
    }

    try {
      const keyword = this.config.keyword || '';
      // Remove the keyword from the message before sending to OpenAI
      const query = message.text!.replace(keyword, '').trim();

      if (!query) {
        return null;
      }

      // Build messages array with conversation history
      const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

      // Fetch conversation history if messageRecordingService is available
      if (this.messageRecordingService && message.conversationKey) {
        try {
          // Calculate cutoff timestamp (maxDays ago)
          const cutoffTimestamp = Date.now() - (this.maxDays * 24 * 60 * 60 * 1000);
          
          // Get conversation history (excluding current message)
          const history = await this.messageRecordingService.getConversationHistory(
            message.conversationKey,
            message.ts, // Get messages before current message
            this.maxMessages
          );

          // Filter history by time window and format for OpenAI
          for (const histMessage of history) {
            // Skip the current message itself (by ID)
            if (histMessage.id === message.id) {
              continue;
            }
            // Only include messages within the time window
            if (histMessage.ts < cutoffTimestamp) {
              continue;
            }

            // Only include text messages
            if (histMessage.type !== 'text' || !histMessage.text) {
              continue;
            }

            // Determine role based on message direction
            // If fromMe is true, it's an assistant message (our response)
            // Otherwise it's a user message
            const role = histMessage.metadata?.fromMe ? 'assistant' : 'user';
            
            // Remove keyword from historical messages if present
            let content = histMessage.text;
            if (content.includes(keyword)) {
              content = content.replace(keyword, '').trim();
            }

            if (content) {
              messages.push({ role, content });
            }
          }

          this.logger.info({ 
            messageId: message.id, 
            historyCount: messages.length,
            conversationKey: message.conversationKey 
          }, 'Retrieved conversation history for OpenAI context');
        } catch (err) {
          this.logger.warn({ err, messageId: message.id }, 'Failed to retrieve conversation history, proceeding without context');
        }
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: query
      });

      this.logger.info({ 
        messageId: message.id, 
        query, 
        contextMessages: messages.length - 1 
      }, 'Processing message with OpenAI');

      const completion = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        this.logger.info({ 
          messageId: message.id, 
          responseLength: response.length,
          contextMessages: messages.length - 1
        }, 'OpenAI response received');
        return response;
      }

      return null;
    } catch (err) {
      this.logger.error({ err, messageId: message.id }, 'Failed to process message with OpenAI');
      return null;
    }
  }
}
