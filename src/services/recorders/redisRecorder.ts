import IORedis from 'ioredis';
import { SentMessageRecorder } from '../sentMessageRecorder.js';
import { SentRecord } from '../../dto/messages.js';

function validateRedisUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['redis:', 'rediss:', 'redis+tls:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Redis Stream configuration constants
const STREAM_SENT = process.env.STREAM_SENT || 'sent_history';
const ROUTING_MAXLEN = parseInt(process.env.ROUTING_MAXLEN || '10000', 10);

export class RedisRecorder implements SentMessageRecorder {
  private readonly redis: IORedis | undefined;
  private readonly isRedisConfigured: boolean;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    
    // Validate Redis URL format if provided
    if (redisUrl && !validateRedisUrl(redisUrl)) {
      console.warn(`Warning: REDIS_URL appears to be invalid: ${redisUrl}`);
    }

    this.redis = redisUrl
      ? new IORedis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: null
        })
      : undefined;
    
    this.isRedisConfigured = Boolean(redisUrl);
  }

  async recordSent(record: SentRecord): Promise<string> {
    if (!this.redis) {
      throw new Error('Redis not configured');
    }
    
    const json = JSON.stringify(record);
    const id = await this.redis.xadd(
      STREAM_SENT, 'MAXLEN', '~', ROUTING_MAXLEN.toString(), '*', 'v', json
    );
    
    const idxKey = `sent:index:${record.id}`;
    await this.redis.hset(idxKey, {
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
    if (!this.isRedisConfigured || !this.redis) {
      return false;
    }
    
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  getBackendType(): string {
    return 'redis';
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (err) {
        // Ignore errors during cleanup, connection might already be closed
        console.warn('Warning: Error during Redis connection cleanup:', err);
      }
    }
  }
}