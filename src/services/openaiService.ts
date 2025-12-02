import OpenAI from 'openai';
import pino from 'pino';
import { InboundMessage } from '../dto/messages.js';

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

  constructor(config: OpenAIConfig = {}) {
    this.config = {
      enabled: false,
      model: 'gpt-3.5-turbo',
      ...config
    };
    this.initializeClient();
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

      this.logger.info({ messageId: message.id, query }, 'Processing message with OpenAI');

      const completion = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        this.logger.info({ messageId: message.id, responseLength: response.length }, 'OpenAI response received');
        return response;
      }

      return null;
    } catch (err) {
      this.logger.error({ err, messageId: message.id }, 'Failed to process message with OpenAI');
      return null;
    }
  }
}
