import pino from 'pino';
import { SentRecord, InboundMessage } from '../dto/messages.js';
import { SentMessageRecorder, SentMessageRecorderFactory, InboundMessageRecorder, InboundMessageRecorderFactory } from './sentMessageRecorder.js';
import { SettingsService } from './settingsService.js';

export class MessageRecordingService {
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private recorder: SentMessageRecorder | null = null;
  private inboundRecorder: InboundMessageRecorder | null = null;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 30000; // 30 seconds

  constructor(private readonly settingsService: SettingsService) {}

  private async ensureRecorder(): Promise<SentMessageRecorder | null> {
    const now = Date.now();
    
    // Re-initialize recorder if settings might have changed or it's been a while
    if (!this.recorder || (now - this.lastHealthCheck) > this.healthCheckInterval) {
      try {
        const settings = this.settingsService.getRecorderSettings();
        this.recorder = await SentMessageRecorderFactory.create(settings);
        this.lastHealthCheck = now;
      } catch (err) {
        this.logger.error({ err }, 'Failed to initialize message recorder');
        this.recorder = null;
      }
    }
    
    return this.recorder;
  }

  private async ensureInboundRecorder(): Promise<InboundMessageRecorder | null> {
    const now = Date.now();
    
    // Re-initialize inbound recorder if settings might have changed or it's been a while
    if (!this.inboundRecorder || (now - this.lastHealthCheck) > this.healthCheckInterval) {
      try {
        const settings = this.settingsService.getRecorderSettings();
        this.inboundRecorder = await InboundMessageRecorderFactory.create(settings);
        this.lastHealthCheck = now;
      } catch (err) {
        this.logger.error({ err }, 'Failed to initialize inbound message recorder');
        this.inboundRecorder = null;
      }
    }
    
    return this.inboundRecorder;
  }

  public async recordSent(record: SentRecord): Promise<string | null> {
    try {
      const recorder = await this.ensureRecorder();
      
      if (!recorder) {
        this.logger.warn('No message recorder available');
        return null;
      }

      // Check if backend is healthy before attempting to record
      const isHealthy = await recorder.isHealthy();
      if (!isHealthy) {
        this.logger.warn({ backend: recorder.getBackendType() }, 'Message recorder backend is unhealthy');
        return null;
      }

      const recordId = await recorder.recordSent(record);
      
      this.logger.info({ 
        evt: 'sent_recorded', 
        id: record.id, 
        to: record.to, 
        via: record.via,
        backend: recorder.getBackendType(),
        recordId 
      });
      
      return recordId;
    } catch (err) {
      this.logger.error({ err, record: record.id }, 'Failed to record sent message');
      return null;
    }
  }

  public async recordInbound(message: InboundMessage): Promise<string | null> {
    try {
      const recorder = await this.ensureInboundRecorder();
      
      if (!recorder) {
        this.logger.warn('No inbound message recorder available');
        return null;
      }

      // Check if backend is healthy before attempting to record
      const isHealthy = await recorder.isHealthy();
      if (!isHealthy) {
        this.logger.warn({ backend: recorder.getBackendType() }, 'Inbound message recorder backend is unhealthy');
        return null;
      }

      const recordId = await recorder.recordInbound(message);
      
      this.logger.info({ 
        evt: 'inbound_recorded', 
        id: message.id, 
        from: message.from, 
        to: message.to,
        type: message.type,
        chatId: message.chatId,
        backend: recorder.getBackendType(),
        recordId 
      });
      
      return recordId;
    } catch (err) {
      this.logger.error({ err, messageId: message.id }, 'Failed to record inbound message');
      return null;
    }
  }

  public async getConversationHistory(conversationKey: string, beforeTimestamp?: number, maxMessages?: number): Promise<InboundMessage[]> {
    try {
      const inboundRecorder = await this.ensureInboundRecorder();
      
      if (!inboundRecorder) {
        this.logger.warn('No inbound message recorder available for history retrieval');
        return [];
      }

      // Check if backend is healthy before attempting to retrieve
      const isHealthy = await inboundRecorder.isHealthy();
      if (!isHealthy) {
        this.logger.warn({ backend: inboundRecorder.getBackendType() }, 'Inbound message recorder backend is unhealthy');
        return [];
      }

      // Use the getConversationHistory method if available
      if (inboundRecorder.getConversationHistory) {
        const messages = await inboundRecorder.getConversationHistory(conversationKey, beforeTimestamp, maxMessages);
        this.logger.info({ 
          evt: 'conversation_history_retrieved', 
          conversationKey,
          messageCount: messages.length,
          beforeTimestamp,
          maxMessages
        });
        return messages;
      }

      return [];
    } catch (err) {
      this.logger.error({ err, conversationKey }, 'Failed to retrieve conversation history');
      return [];
    }
  }

  public async getBackendStatus(): Promise<{
    backend: string;
    healthy: boolean;
    available: boolean;
    inbound?: {
      backend: string;
      healthy: boolean;
      available: boolean;
    };
  } | null> {
    try {
      const recorder = await this.ensureRecorder();
      const inboundRecorder = await this.ensureInboundRecorder();
      
      if (!recorder) {
        return { backend: 'none', healthy: false, available: false };
      }

      const healthy = await recorder.isHealthy();
      
      const result: any = {
        backend: recorder.getBackendType(),
        healthy,
        available: true
      };

      // Add inbound recorder status if available
      if (inboundRecorder) {
        const inboundHealthy = await inboundRecorder.isHealthy();
        result.inbound = {
          backend: inboundRecorder.getBackendType(),
          healthy: inboundHealthy,
          available: true
        };
      }
      
      return result;
    } catch (err) {
      this.logger.error({ err }, 'Failed to get backend status');
      return null;
    }
  }
}