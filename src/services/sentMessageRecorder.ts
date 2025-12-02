import { SentRecord, InboundMessage } from '../dto/messages.js';

/**
 * Interface for recording sent messages to different backends
 */
export interface SentMessageRecorder {
  /**
   * Record a sent message
   * @param record The sent message record to store
   * @returns Promise resolving to the record ID or identifier
   */
  recordSent(record: SentRecord): Promise<string>;

  /**
   * Check if the backend is available and healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get the backend name/type
   */
  getBackendType(): string;
}

/**
 * Interface for recording inbound messages to different backends
 */
export interface InboundMessageRecorder {
  /**
   * Record an inbound message
   * @param message The inbound message to store
   * @returns Promise resolving to the record ID or identifier
   */
  recordInbound(message: InboundMessage): Promise<string>;

  /**
   * Retrieve past messages from the same conversation
   * @param conversationKey The conversation identifier
   * @param beforeTimestamp Optional timestamp to get messages before this time
   * @param maxMessages Maximum number of messages to retrieve
   * @returns Promise resolving to array of messages
   */
  getConversationHistory?(conversationKey: string, beforeTimestamp?: number, maxMessages?: number): Promise<InboundMessage[]>;

  /**
   * Check if the backend is available and healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get the backend name/type
   */
  getBackendType(): string;
}

/**
 * Settings for different recorder backends
 */
export interface RecorderSettings {
  history_backend: 'redis' | 'base44';
}

/**
 * Factory for creating message recorders based on settings
 */
export class SentMessageRecorderFactory {
  static async create(settings: RecorderSettings): Promise<SentMessageRecorder | null> {
    switch (settings.history_backend) {
      case 'redis':
        const { RedisRecorder } = await import('./recorders/redisRecorder.js');
        return new RedisRecorder();
      
      case 'base44':
        const { Base44Recorder } = await import('./recorders/base44Recorder.js');
        return new Base44Recorder();
      
      default:
        return null;
    }
  }
}

/**
 * Factory for creating inbound message recorders based on settings
 */
export class InboundMessageRecorderFactory {
  static async create(settings: RecorderSettings): Promise<InboundMessageRecorder | null> {
    switch (settings.history_backend) {
      case 'redis':
        const { RedisInboundRecorder } = await import('./recorders/redisInboundRecorder.js');
        return new RedisInboundRecorder();
      
      case 'base44':
        // Base44 doesn't support inbound recording yet
        return null;
      
      default:
        return null;
    }
  }
}