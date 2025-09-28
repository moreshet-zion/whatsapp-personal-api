import { SentMessageRecorder } from '../sentMessageRecorder.js';
import { SentRecord } from '../../dto/messages.js';

export class Base44Recorder implements SentMessageRecorder {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly externalSystem: string;

  constructor() {
    this.apiUrl = process.env.BASE44_URL || '';
    this.apiKey = process.env.BASE44_KEY || '';
    const flyReleaseVersion = process.env.FLY_RELEASE_VERSION || '';
    this.externalSystem = `flyio-whatsapp-personal-api-v${flyReleaseVersion}`;
  }

  async recordSent(record: SentRecord): Promise<string> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('Base44 API URL and key must be configured via BASE44_URL and BASE44_KEY environment variables');
    }

    try {
      const response = await this.makeBase44ApiCall(record);
      return response.id || `base44-${record.id}`;
    } catch (error) {
      throw new Error(`Base44 recording failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiUrl || !this.apiKey) {
      return false;
    }
    
    try {
      // Basic health check - verify URL format and API key presence
      return this.apiUrl.startsWith('http') && this.apiKey.length > 0;
    } catch {
      return false;
    }
  }

  getBackendType(): string {
    return 'base44';
  }

  async cleanup(): Promise<void> {
    // Base44 recorder doesn't hold persistent connections, no cleanup needed
    return Promise.resolve();
  }

  private async makeBase44ApiCall(record: SentRecord): Promise<{ id: string }> {
    // Build payload according to Base44 API specification
    const payload: any = {
      message_type: record.correlationId?.startsWith('topic:') ? 'instant' : 
                   record.correlationId ? 'scheduled' : 'instant',
      number: record.to,
      message: record.bodyPreview || '',
      status: 'sent',
      sent_at: new Date(record.ts).toISOString(),
      external_system: this.externalSystem,
      response_data: {
        whatsapp_message_id: record.waMessageId,
        chat_id: record.chatId,
        message_via: record.via,
        dedupe_key: record.dedupeKey,
        internal_record_id: record.id
      }
    };

    // Add scheduled-specific fields if applicable
    if (record.correlationId && !record.correlationId.startsWith('topic:')) {
      payload.scheduled_message_id = record.correlationId;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Base44 API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return {
      id: result.id || result.record_id || `base44-${record.id}`
    };
  }
}