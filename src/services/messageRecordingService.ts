import pino from 'pino';
import { SentRecord } from '../dto/messages.js';
import { SentMessageRecorder, SentMessageRecorderFactory } from './sentMessageRecorder.js';
import { SettingsService } from './settingsService.js';

export class MessageRecordingService {
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private recorder: SentMessageRecorder | null = null;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 30000; // 30 seconds
  private currentBackendType: string | null = null;

  constructor(private readonly settingsService: SettingsService) {}

  private async ensureRecorder(): Promise<SentMessageRecorder | null> {
    const now = Date.now();
    const settings = this.settingsService.getRecorderSettings();
    const requestedBackend = settings.history_backend;
    
    // Check if we need to reinitialize the recorder
    const needsReinit = 
      !this.recorder ||                                              // No recorder exists
      this.currentBackendType !== requestedBackend ||               // Backend type changed
      (now - this.lastHealthCheck) > this.healthCheckInterval;      // Health check interval expired
    
    if (needsReinit) {
      // Clean up the old recorder before creating a new one
      if (this.recorder && this.currentBackendType !== requestedBackend) {
        this.logger.info({ 
          oldBackend: this.currentBackendType, 
          newBackend: requestedBackend 
        }, 'Backend type changed, cleaning up old recorder');
        try {
          await this.recorder.cleanup();
        } catch (err) {
          this.logger.warn({ err, backend: this.currentBackendType }, 'Error cleaning up old recorder');
        }
        this.recorder = null;
        this.currentBackendType = null;
      }
      
      // If we have an existing recorder of the same type, check if it's still healthy
      if (this.recorder && this.currentBackendType === requestedBackend) {
        try {
          const isHealthy = await this.recorder.isHealthy();
          if (isHealthy) {
            // Recorder is healthy, just update health check timestamp and reuse it
            this.lastHealthCheck = now;
            return this.recorder;
          } else {
            // Recorder is unhealthy, clean it up and create a new one
            this.logger.info({ backend: this.currentBackendType }, 'Existing recorder is unhealthy, recreating');
            try {
              await this.recorder.cleanup();
            } catch (err) {
              this.logger.warn({ err, backend: this.currentBackendType }, 'Error cleaning up unhealthy recorder');
            }
            this.recorder = null;
            this.currentBackendType = null;
          }
        } catch (err) {
          this.logger.warn({ err, backend: this.currentBackendType }, 'Error checking recorder health, recreating');
          try {
            await this.recorder?.cleanup();
          } catch (cleanupErr) {
            this.logger.warn({ err: cleanupErr, backend: this.currentBackendType }, 'Error cleaning up recorder during health check failure');
          }
          this.recorder = null;
          this.currentBackendType = null;
        }
      }
      
      // Create a new recorder if we don't have a healthy one
      if (!this.recorder) {
        try {
          this.recorder = await SentMessageRecorderFactory.create(settings);
          this.currentBackendType = requestedBackend;
          this.lastHealthCheck = now;
          this.logger.info({ backend: requestedBackend }, 'Created new message recorder');
        } catch (err) {
          this.logger.error({ err, backend: requestedBackend }, 'Failed to initialize message recorder');
          this.recorder = null;
          this.currentBackendType = null;
        }
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

  /**
   * Cleanup method to properly close connections when the service is shutting down
   */
  public async cleanup(): Promise<void> {
    if (this.recorder) {
      this.logger.info({ backend: this.currentBackendType }, 'Cleaning up message recording service');
      try {
        await this.recorder.cleanup();
      } catch (err) {
        this.logger.warn({ err, backend: this.currentBackendType }, 'Error during message recording service cleanup');
      } finally {
        this.recorder = null;
        this.currentBackendType = null;
        this.lastHealthCheck = 0;
      }
    }
  }
}