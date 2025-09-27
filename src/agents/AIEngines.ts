/**
 * AI Engine Implementations
 * Provides integrations with various AI providers
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { IAIEngine } from '../core/interfaces';
import { 
  Message,
  ConversationContext,
  AgentPersona 
} from '../core/types';
import { Logger } from '../utils/Logger';

/**
 * OpenAI GPT Engine
 */
export class OpenAIEngine implements IAIEngine {
  private client: OpenAI;
  private model: string;
  
  constructor(
    config: {
      apiKey: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    private logger: Logger
  ) {
    this.client = new OpenAI({
      apiKey: config.apiKey
    });
    
    this.model = config.model || 'gpt-4';
  }

  async generateResponse(
    message: Message,
    conversationHistory: Message[],
    context: {
      persona?: AgentPersona;
      conversationContext?: ConversationContext;
      customPrompt?: string;
    }
  ): Promise<string> {
    try {
      const messages = this.formatMessages(message, conversationHistory, context);
      
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 500
      });
      
      const response = completion.choices[0]?.message?.content || '';
      
      this.logger.debug(`OpenAI response generated for conversation ${context.conversationContext?.conversationId}`);
      
      return response;
      
    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      throw error;
    }
  }

  private formatMessages(
    message: Message,
    history: Message[],
    context: any
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    // Add system message with persona
    if (context.persona) {
      messages.push({
        role: 'system',
        content: this.buildSystemPrompt(context.persona)
      });
    }
    
    // Add conversation history (last 10 messages for context)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.from === context.conversationContext?.botNumber ? 'assistant' : 'user',
        content: msg.content
      });
    }
    
    return messages;
  }

  private buildSystemPrompt(persona: AgentPersona): string {
    let prompt = `You are ${persona.name}, a ${persona.role}.\n`;
    prompt += `Personality: ${persona.personality}\n`;
    prompt += `Instructions: ${persona.instructions}\n`;
    
    if (persona.knowledge && persona.knowledge.length > 0) {
      prompt += `Knowledge areas: ${persona.knowledge.join(', ')}\n`;
    }
    
    if (persona.constraints && persona.constraints.length > 0) {
      prompt += `Constraints: ${persona.constraints.join(', ')}\n`;
    }
    
    if (persona.responseStyle) {
      prompt += `Response style: ${persona.responseStyle.tone} tone`;
      if (persona.responseStyle.useEmojis) {
        prompt += ', use emojis when appropriate';
      }
      if (persona.responseStyle.maxLength) {
        prompt += `, keep responses under ${persona.responseStyle.maxLength} characters`;
      }
    }
    
    return prompt;
  }

  getCapabilities() {
    return {
      supportsStreaming: true,
      maxContextLength: 8192,
      supportsFunctionCalling: true,
      supportsVision: this.model.includes('vision')
    };
  }

  getName(): string {
    return `OpenAI-${this.model}`;
  }
}

/**
 * Claude AI Engine
 */
export class ClaudeEngine implements IAIEngine {
  private client: Anthropic;
  private model: string;
  
  constructor(
    config: {
      apiKey: string;
      model?: string;
    },
    private logger: Logger
  ) {
    this.client = new Anthropic({
      apiKey: config.apiKey
    });
    
    this.model = config.model || 'claude-3-opus-20240229';
  }

  async generateResponse(
    message: Message,
    conversationHistory: Message[],
    context: {
      persona?: AgentPersona;
      conversationContext?: ConversationContext;
      customPrompt?: string;
    }
  ): Promise<string> {
    try {
      const systemPrompt = context.persona ? this.buildSystemPrompt(context.persona) : '';
      const userMessage = this.formatConversation(message, conversationHistory, context);
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      });
      
      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';
      
      this.logger.debug(`Claude response generated for conversation ${context.conversationContext?.conversationId}`);
      
      return responseText;
      
    } catch (error) {
      this.logger.error('Claude API error:', error);
      throw error;
    }
  }

  private formatConversation(
    message: Message,
    history: Message[],
    context: any
  ): string {
    let conversation = 'Previous conversation:\n';
    
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      const role = msg.from === context.conversationContext?.botNumber ? 'Assistant' : 'User';
      conversation += `${role}: ${msg.content}\n`;
    }
    
    return conversation;
  }

  private buildSystemPrompt(persona: AgentPersona): string {
    // Similar to OpenAI implementation
    let prompt = `You are ${persona.name}, a ${persona.role}.\n`;
    prompt += `Personality: ${persona.personality}\n`;
    prompt += `Instructions: ${persona.instructions}\n`;
    
    if (persona.knowledge && persona.knowledge.length > 0) {
      prompt += `Knowledge areas: ${persona.knowledge.join(', ')}\n`;
    }
    
    if (persona.constraints && persona.constraints.length > 0) {
      prompt += `Constraints: ${persona.constraints.join(', ')}\n`;
    }
    
    return prompt;
  }

  getCapabilities() {
    return {
      supportsStreaming: true,
      maxContextLength: 200000,
      supportsFunctionCalling: false,
      supportsVision: true
    };
  }

  getName(): string {
    return `Claude-${this.model}`;
  }
}

/**
 * Mock AI Engine for testing
 */
export class MockAIEngine implements IAIEngine {
  private responses: Map<string, string> = new Map();
  
  constructor(
    config?: {
      responses?: Record<string, string>;
    },
    private logger?: Logger
  ) {
    if (config?.responses) {
      Object.entries(config.responses).forEach(([key, value]) => {
        this.responses.set(key.toLowerCase(), value);
      });
    }
    
    // Add default responses
    this.responses.set('hello', 'Hello! How can I help you today?');
    this.responses.set('help', 'I\'m here to assist you. What do you need help with?');
    this.responses.set('bye', 'Goodbye! Have a great day!');
  }

  async generateResponse(
    message: Message,
    conversationHistory: Message[],
    context: {
      persona?: AgentPersona;
      conversationContext?: ConversationContext;
      customPrompt?: string;
    }
  ): Promise<string> {
    const content = message.content.toLowerCase();
    
    // Check for matching responses
    for (const [key, response] of this.responses.entries()) {
      if (content.includes(key)) {
        return response;
      }
    }
    
    // Generate contextual response
    if (context.persona) {
      return `[${context.persona.name}]: I understand your message "${message.content}". How can I assist you further?`;
    }
    
    return `I received your message: "${message.content}". This is a mock response for testing.`;
  }

  getCapabilities() {
    return {
      supportsStreaming: false,
      maxContextLength: 4096,
      supportsFunctionCalling: false,
      supportsVision: false
    };
  }

  getName(): string {
    return 'MockAI';
  }

  // Helper method for testing
  addResponse(trigger: string, response: string): void {
    this.responses.set(trigger.toLowerCase(), response);
  }
}

/**
 * Engine factory for creating AI engines
 */
export class AIEngineFactory {
  static createEngine(
    type: 'openai' | 'claude' | 'mock',
    config: any,
    logger: Logger
  ): IAIEngine {
    switch (type) {
      case 'openai':
        return new OpenAIEngine(config, logger);
      
      case 'claude':
        return new ClaudeEngine(config, logger);
      
      case 'mock':
        return new MockAIEngine(config, logger);
      
      default:
        throw new Error(`Unknown engine type: ${type}`);
    }
  }
}