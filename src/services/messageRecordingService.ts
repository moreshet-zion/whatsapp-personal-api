import pino from 'pino';
import { SentRecord } from '../dto/messages.js';
import { SentMessageRecorder, SentMessageRecorderFactory } from './sentMessageRecorder.js';
import { SettingsService } from './settingsService.js';

export class MessageRecordingService {
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private recorder: SentMessageRecorder | null = null;
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

  public async getBackendStatus(): Promise<{
    backend: string;
    healthy: boolean;
    available: boolean;
  } | null> {
    try {
      const recorder = await this.ensureRecorder();
      
      if (!recorder) {
        return { backend: 'none', healthy: false, available: false };
      }

      const healthy = await recorder.isHealthy();
      
      return {
        backend: recorder.getBackendType(),
        healthy,
        available: true
      };
    } catch (err) {
      this.logger.error({ err }, 'Failed to get backend status');
      return null;
    }
  }
}