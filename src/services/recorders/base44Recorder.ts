import { SentMessageRecorder } from '../sentMessageRecorder.js';
import { SentRecord } from '../../dto/messages.js';

export class Base44Recorder implements SentMessageRecorder {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string
  ) {}

  async recordSent(record: SentRecord): Promise<string> {
    // TODO: Implement Base44 API call
    // This is a stub implementation
    
    try {
      // Placeholder for actual API call to Base44
      const response = await this.makeBase44ApiCall(record);
      return response.id || `base44-${Date.now()}`;
    } catch (error) {
      throw new Error(`Base44 recording failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiUrl || !this.apiKey) {
      return false;
    }
    
    try {
      // TODO: Implement health check endpoint call
      // For now, just check if we have the required config
      return this.apiUrl.startsWith('http') && this.apiKey.length > 0;
    } catch {
      return false;
    }
  }

  getBackendType(): string {
    return 'base44';
  }

  private async makeBase44ApiCall(record: SentRecord): Promise<{ id: string }> {
    // TODO: Implement actual Base44 API integration
    // This is a stub that will be implemented later
    
    const payload = {
      id: record.id,
      timestamp: record.ts,
      recipient: record.to,
      chatId: record.chatId,
      messageType: record.via,
      bodyPreview: record.bodyPreview,
      correlationId: record.correlationId,
      whatsappMessageId: record.waMessageId,
      dedupeKey: record.dedupeKey
    };

    // Stub response - replace with actual fetch call later
    console.log(`[Base44 Stub] Would send to ${this.apiUrl} with payload:`, payload);
    
    return {
      id: `base44-${record.id}-${Date.now()}`
    };
  }
}