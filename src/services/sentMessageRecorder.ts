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
}

/**
 * Settings for different recorder backends
 */
export interface RecorderSettings {
  history_backend: 'redis' | 'base44';
  base44?: {
    url: string;
    apiKey: string;
  };
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
        if (!settings.base44?.url || !settings.base44?.apiKey) {
          throw new Error('Base44 recorder requires URL and API key configuration');
        }
        return new Base44Recorder(settings.base44.url, settings.base44.apiKey);
      
      default:
        return null;
    }
  }
}