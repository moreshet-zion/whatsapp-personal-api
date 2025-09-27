/**
 * Message Router Implementation
 * Handles routing logic for incoming WhatsApp messages
 */

import { EventEmitter } from 'eventemitter3';
import { 
  IMessageRouter, 
  RoutingRule, 
  IConversationManager,
  IStorageBackend 
} from '../core/interfaces';
import { 
  Message, 
  RoutingDecision,
  ConversationContext 
} from '../core/types';
import { Logger } from '../utils/Logger';

export class MessageRouter extends EventEmitter implements IMessageRouter {
  private rules: Map<string, RoutingRule> = new Map();
  private defaultAction: RoutingDecision = {
    shouldProcess: false,
    action: 'ignore',
    reason: 'No matching routing rule'
  };
  
  constructor(
    private storage: IStorageBackend,
    private conversationManager: IConversationManager,
    private logger: Logger
  ) {
    super();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Rule: Continue existing active conversations
    this.registerRule('continue-conversation', {
      name: 'continue-conversation',
      priority: 100,
      condition: async (message: Message) => {
        const conversation = await this.conversationManager.getActiveConversationByPhone(message.from);
        return conversation !== null && conversation.state === 'active';
      },
      action: async (message: Message) => {
        const conversation = await this.conversationManager.getActiveConversationByPhone(message.from);
        return {
          shouldProcess: true,
          action: 'continue_conversation',
          conversationId: conversation?.conversationId,
          agentId: conversation?.agentId,
          reason: 'Continuing active conversation'
        };
      }
    });

    // Rule: Ignore system messages
    this.registerRule('ignore-system', {
      name: 'ignore-system',
      priority: 95,
      condition: (message: Message) => message.type === 'system',
      action: () => ({
        shouldProcess: false,
        action: 'ignore',
        reason: 'System message'
      })
    });

    // Rule: Start conversation on greeting
    this.registerRule('greeting-detector', {
      name: 'greeting-detector',
      priority: 50,
      condition: (message: Message) => {
        const greetings = /^(hi|hello|hey|good morning|good afternoon|good evening|help|start)\b/i;
        return greetings.test(message.content.trim());
      },
      action: () => ({
        shouldProcess: true,
        action: 'start_conversation',
        createNewConversation: true,
        reason: 'Greeting detected - starting new conversation'
      })
    });
  }

  public registerRule(name: string, rule: RoutingRule): void {
    this.rules.set(name, rule);
    this.logger.info(`Routing rule registered: ${name} (priority: ${rule.priority})`);
    this.emit('rule:registered', { name, rule });
  }

  public removeRule(name: string): void {
    if (this.rules.delete(name)) {
      this.logger.info(`Routing rule removed: ${name}`);
      this.emit('rule:removed', { name });
    }
  }

  public setDefaultAction(action: RoutingDecision): void {
    this.defaultAction = action;
    this.logger.info('Default routing action updated');
  }

  public async route(message: Message): Promise<RoutingDecision> {
    try {
      // Get all enabled rules and sort by priority (higher first)
      const sortedRules = Array.from(this.rules.values())
        .filter(rule => rule.enabled !== false)
        .sort((a, b) => b.priority - a.priority);

      // Evaluate rules in priority order
      for (const rule of sortedRules) {
        try {
          const matches = await Promise.resolve(rule.condition(message));
          
          if (matches) {
            const decision = await Promise.resolve(rule.action(message));
            
            this.logger.debug(`Message routed by rule: ${rule.name}`, {
              messageId: message.id,
              decision
            });
            
            this.emit('message:routed', { 
              message, 
              rule: rule.name, 
              decision 
            });
            
            // Store routing decision for analytics
            await this.storeRoutingDecision(message, rule.name, decision);
            
            return decision;
          }
        } catch (error) {
          this.logger.error(`Error evaluating rule ${rule.name}:`, error);
        }
      }

      // No rules matched, return default action
      this.logger.debug(`No routing rules matched for message ${message.id}, using default action`);
      
      await this.storeRoutingDecision(message, 'default', this.defaultAction);
      
      return this.defaultAction;
      
    } catch (error) {
      this.logger.error('Error in message routing:', error);
      
      return {
        shouldProcess: false,
        action: 'ignore',
        reason: `Routing error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async storeRoutingDecision(
    message: Message, 
    ruleName: string, 
    decision: RoutingDecision
  ): Promise<void> {
    const key = `routing:${message.id}`;
    const data = {
      messageId: message.id,
      phoneNumber: message.from,
      ruleName,
      decision,
      timestamp: new Date().toISOString()
    };
    
    await this.storage.set(key, data, 86400); // Store for 24 hours
  }

  // Additional utility methods for custom routing logic

  public addKeywordRule(
    name: string,
    keywords: string[],
    action: RoutingDecision,
    priority: number = 50
  ): void {
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');
    
    this.registerRule(name, {
      name,
      priority,
      condition: (message: Message) => keywordRegex.test(message.content),
      action: () => action
    });
  }

  public addPatternRule(
    name: string,
    pattern: RegExp,
    action: RoutingDecision,
    priority: number = 50
  ): void {
    this.registerRule(name, {
      name,
      priority,
      condition: (message: Message) => pattern.test(message.content),
      action: () => action
    });
  }

  public addPhoneNumberRule(
    name: string,
    phoneNumbers: string[],
    action: RoutingDecision,
    priority: number = 60
  ): void {
    const phoneSet = new Set(phoneNumbers);
    
    this.registerRule(name, {
      name,
      priority,
      condition: (message: Message) => phoneSet.has(message.from),
      action: () => action
    });
  }

  public addTimeBasedRule(
    name: string,
    startHour: number,
    endHour: number,
    action: RoutingDecision,
    priority: number = 40
  ): void {
    this.registerRule(name, {
      name,
      priority,
      condition: (message: Message) => {
        const hour = new Date().getHours();
        return hour >= startHour && hour < endHour;
      },
      action: () => action
    });
  }

  public addCustomRule(
    name: string,
    evaluator: (message: Message) => Promise<RoutingDecision | null>,
    priority: number = 50
  ): void {
    this.registerRule(name, {
      name,
      priority,
      condition: async (message: Message) => {
        const result = await evaluator(message);
        return result !== null;
      },
      action: async (message: Message) => {
        const result = await evaluator(message);
        return result || this.defaultAction;
      }
    });
  }
}

/**
 * Department-based router for business use cases
 */
export class DepartmentRouter extends MessageRouter {
  private departments: Map<string, {
    keywords: string[];
    agentId: string;
    priority: number;
  }> = new Map();

  public addDepartment(
    name: string,
    config: {
      keywords: string[];
      agentId: string;
      priority?: number;
    }
  ): void {
    this.departments.set(name, {
      ...config,
      priority: config.priority || 50
    });

    // Create routing rule for this department
    this.addKeywordRule(
      `dept-${name}`,
      config.keywords,
      {
        shouldProcess: true,
        action: 'start_conversation',
        createNewConversation: true,
        agentId: config.agentId,
        reason: `Routed to ${name} department`,
        metadata: { department: name }
      },
      config.priority || 50
    );
  }

  public removeDepartment(name: string): void {
    if (this.departments.delete(name)) {
      this.removeRule(`dept-${name}`);
    }
  }
}