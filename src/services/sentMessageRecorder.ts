import { SentRecord } from '../dto/messages.js';

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

  /**
   * Clean up resources and close connections
   */
  cleanup(): Promise<void>;
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