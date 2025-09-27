/**
 * AI Agent Implementation
 * Handles message processing with AI engines
 */

import { 
  IAgent,
  IAIEngine,
  IConversationManager
} from '../core/interfaces';
import { 
  Message,
  ConversationContext,
  AgentPersona,
  MessageStatus,
  MessageType
} from '../core/types';
import { Logger } from '../utils/Logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Base Agent implementation
 */
export class Agent implements IAgent {
  public id: string;
  public persona: AgentPersona;
  private engine: IAIEngine | null = null;
  private conversationMemory: Map<string, Message[]> = new Map();
  
  constructor(
    id: string,
    persona: AgentPersona,
    private logger: Logger,
    engine?: IAIEngine
  ) {
    this.id = id;
    this.persona = persona;
    if (engine) {
      this.setEngine(engine);
    }
  }

  public async processMessage(
    message: Message,
    conversation: ConversationContext
  ): Promise<Message> {
    if (!this.engine) {
      throw new Error(`No AI engine configured for agent ${this.id}`);
    }

    try {
      // Get conversation history
      const history = this.getConversationMemory(conversation.conversationId);
      
      // Add current message to history
      history.push(message);
      
      // Trim history to max size
      const maxSize = this.persona.maxHistorySize || 50;
      if (history.length > maxSize) {
        history.splice(0, history.length - maxSize);
      }
      
      // Generate response using AI engine
      const responseContent = await this.engine.generateResponse(
        message,
        history,
        {
          persona: this.persona,
          conversationContext: conversation
        }
      );
      
      // Create response message
      const response: Message = {
        id: uuidv4(),
        from: conversation.botNumber,
        to: message.from,
        content: this.formatResponse(responseContent),
        type: MessageType.TEXT,
        timestamp: new Date(),
        status: MessageStatus.PROCESSED,
        conversationId: conversation.conversationId,
        agentId: this.id,
        replyTo: message.id,
        metadata: {
          agentId: this.id,
          personaName: this.persona.name,
          engineUsed: this.engine.getName()
        }
      };
      
      // Add response to history
      history.push(response);
      this.updateConversationMemory(conversation.conversationId, history);
      
      this.logger.info(`Agent ${this.id} processed message in conversation ${conversation.conversationId}`);
      
      return response;
      
    } catch (error) {
      this.logger.error(`Error processing message with agent ${this.id}:`, error);
      
      // Return error response
      return {
        id: uuidv4(),
        from: conversation.botNumber,
        to: message.from,
        content: this.getErrorResponse(),
        type: MessageType.TEXT,
        timestamp: new Date(),
        status: MessageStatus.FAILED,
        conversationId: conversation.conversationId,
        agentId: this.id,
        replyTo: message.id,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  public setEngine(engine: IAIEngine): void {
    this.engine = engine;
    this.logger.info(`Agent ${this.id} configured with engine: ${engine.getName()}`);
  }

  public getEngine(): IAIEngine | null {
    return this.engine;
  }

  public canHandle(message: Message): boolean {
    // Override in subclasses for custom logic
    // Default: can handle any text message
    return message.type === MessageType.TEXT;
  }

  private formatResponse(content: string): string {
    // Apply persona response style
    if (this.persona.responseStyle) {
      const style = this.persona.responseStyle;
      
      // Add emojis if configured
      if (style.useEmojis) {
        content = this.addEmojis(content);
      }
      
      // Truncate if too long
      if (style.maxLength && content.length > style.maxLength) {
        content = content.substring(0, style.maxLength - 3) + '...';
      }
    }
    
    return content;
  }

  private addEmojis(content: string): string {
    // Simple emoji addition based on content
    const emojiMap: Record<string, string> = {
      'hello': '👋',
      'thanks': '🙏',
      'sorry': '😔',
      'help': '🤝',
      'yes': '✅',
      'no': '❌',
      'great': '🎉',
      'question': '❓'
    };
    
    let result = content;
    for (const [keyword, emoji] of Object.entries(emojiMap)) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(result)) {
        result = result.replace(regex, `${keyword} ${emoji}`);
      }
    }
    
    return result;
  }

  private getErrorResponse(): string {
    const errorResponses = [
      "I apologize, but I'm having trouble processing your request right now.",
      "Sorry, I encountered an issue. Please try again in a moment.",
      "I'm experiencing technical difficulties. Please bear with me.",
      "Something went wrong on my end. Let me try to help you differently."
    ];
    
    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
  }

  private getConversationMemory(conversationId: string): Message[] {
    if (!this.conversationMemory.has(conversationId)) {
      this.conversationMemory.set(conversationId, []);
    }
    return this.conversationMemory.get(conversationId)!;
  }

  private updateConversationMemory(conversationId: string, history: Message[]): void {
    this.conversationMemory.set(conversationId, history);
    
    // Clean up old conversations to prevent memory leaks
    if (this.conversationMemory.size > 100) {
      const entries = Array.from(this.conversationMemory.entries());
      // Remove oldest conversations
      entries.slice(0, 50).forEach(([id]) => {
        this.conversationMemory.delete(id);
      });
    }
  }
}

/**
 * Specialized Support Agent
 */
export class SupportAgent extends Agent {
  constructor(
    id: string,
    logger: Logger,
    engine?: IAIEngine
  ) {
    const persona: AgentPersona = {
      id,
      name: 'Support Assistant',
      role: 'Customer Support Specialist',
      personality: 'Helpful, patient, and professional',
      instructions: `You are a customer support specialist. Your goal is to help users resolve their issues quickly and efficiently. 
                    Always be polite, empathetic, and solution-oriented. If you cannot resolve an issue, offer to escalate it.`,
      knowledge: [
        'Product documentation',
        'Common troubleshooting steps',
        'Company policies'
      ],
      constraints: [
        'Do not share sensitive information',
        'Always verify user identity for account-related queries',
        'Escalate complex technical issues'
      ],
      capabilities: [
        'Answer product questions',
        'Troubleshoot common issues',
        'Process returns and refunds',
        'Escalate to human agents'
      ],
      responseStyle: {
        tone: 'professional',
        useEmojis: true,
        maxLength: 500
      }
    };
    
    super(id, persona, logger, engine);
  }

  public canHandle(message: Message): boolean {
    // Handle support-related keywords
    const supportKeywords = /\b(help|support|issue|problem|error|broken|fix)\b/i;
    return super.canHandle(message) && supportKeywords.test(message.content);
  }
}

/**
 * Specialized Sales Agent
 */
export class SalesAgent extends Agent {
  constructor(
    id: string,
    logger: Logger,
    engine?: IAIEngine
  ) {
    const persona: AgentPersona = {
      id,
      name: 'Sales Assistant',
      role: 'Sales Representative',
      personality: 'Friendly, enthusiastic, and knowledgeable about products',
      instructions: `You are a sales representative. Help customers find the right products, answer pricing questions, 
                    and guide them through the purchase process. Be helpful but not pushy.`,
      knowledge: [
        'Product catalog',
        'Pricing and promotions',
        'Payment options',
        'Shipping information'
      ],
      constraints: [
        'Do not offer unauthorized discounts',
        'Provide accurate product information',
        'Do not pressure customers'
      ],
      capabilities: [
        'Product recommendations',
        'Price quotes',
        'Order processing',
        'Promotion information'
      ],
      responseStyle: {
        tone: 'friendly',
        useEmojis: true,
        maxLength: 400
      }
    };
    
    super(id, persona, logger, engine);
  }

  public canHandle(message: Message): boolean {
    // Handle sales-related keywords
    const salesKeywords = /\b(buy|purchase|price|cost|product|order|discount|sale)\b/i;
    return super.canHandle(message) && salesKeywords.test(message.content);
  }
}

/**
 * Multi-purpose agent that can switch between different personas
 */
export class MultiPersonaAgent extends Agent {
  private personas: Map<string, AgentPersona> = new Map();
  private currentPersonaId: string;
  
  constructor(
    id: string,
    initialPersona: AgentPersona,
    logger: Logger,
    engine?: IAIEngine
  ) {
    super(id, initialPersona, logger, engine);
    this.currentPersonaId = initialPersona.id;
    this.personas.set(initialPersona.id, initialPersona);
  }

  public addPersona(persona: AgentPersona): void {
    this.personas.set(persona.id, persona);
    this.logger.info(`Added persona ${persona.id} to agent ${this.id}`);
  }

  public switchPersona(personaId: string): void {
    const persona = this.personas.get(personaId);
    
    if (!persona) {
      throw new Error(`Persona ${personaId} not found`);
    }
    
    this.persona = persona;
    this.currentPersonaId = personaId;
    this.logger.info(`Agent ${this.id} switched to persona ${personaId}`);
  }

  public async processMessage(
    message: Message,
    conversation: ConversationContext
  ): Promise<Message> {
    // Auto-select persona based on conversation type if available
    if (conversation.metadata?.conversationType) {
      const personaMap: Record<string, string> = {
        'support': 'support-persona',
        'sales': 'sales-persona',
        'notification': 'notification-persona'
      };
      
      const personaId = personaMap[conversation.metadata.conversationType];
      if (personaId && this.personas.has(personaId)) {
        this.switchPersona(personaId);
      }
    }
    
    return super.processMessage(message, conversation);
  }
}