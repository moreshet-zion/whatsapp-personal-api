import { SentMessageRecorder } from '../sentMessageRecorder.js';
import { SentRecord } from '../../dto/messages.js';
import { redis, isRedisConfigured, STREAM_SENT, ROUTING_MAXLEN } from '../../infra/redis.js';

export class RedisRecorder implements SentMessageRecorder {
  async recordSent(record: SentRecord): Promise<string> {
    if (!redis) {
      throw new Error('Redis not configured');
    }
    
    const json = JSON.stringify(record);
    const id = await redis.xadd(
      STREAM_SENT, 'MAXLEN', '~', ROUTING_MAXLEN.toString(), '*', 'v', json
    );
    
    const idxKey = `sent:index:${record.id}`;
    await redis.hset(idxKey, {
      ts: String(record.ts), 
      to: record.to, 
      chatId: record.chatId || '',
      via: record.via, 
      corr: record.correlationId || '',
      waId: record.waMessageId || '', 
      ddk: record.dedupeKey || ''
    });
    
    return id;
  }

  async isHealthy(): Promise<boolean> {
    if (!isRedisConfigured || !redis) {
      return false;
    }
    
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  getBackendType(): string {
    return 'redis';
  }
}