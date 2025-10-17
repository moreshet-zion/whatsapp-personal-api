import IORedis from 'ioredis';
import { InboundMessageRecorder } from '../sentMessageRecorder.js';
import { InboundMessage } from '../../dto/messages.js';
import { STREAM_INBOUND, ROUTING_MAXLEN, DEDUPE_TTL_SEC } from '../../infra/redis.js';

function validateRedisUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['redis:', 'rediss:', 'redis+tls:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export class RedisInboundRecorder implements InboundMessageRecorder {
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
          maxRetriesPerRequest: null,
          enableOfflineQueue: false, // Don't queue commands when offline to prevent memory buildup
          retryStrategy: (times: number) => {
            // Stop retrying after 3 attempts to avoid memory issues
            if (times > 3) {
              return null;
            }
            return Math.min(times * 1000, 3000);
          }
        } as any) // Cast to any to support all ioredis options
      : undefined;
    
    this.isRedisConfigured = Boolean(redisUrl);
  }

  async recordInbound(message: InboundMessage): Promise<string> {
    if (!this.redis) {
      throw new Error('Redis not configured');
    }
    
    // Check for duplicate using dedupeKey
    const dedupeKey = `inbound:dedupe:${message.dedupeKey}`;
    const exists = await this.redis.exists(dedupeKey);
    
    if (exists) {
      // Message already processed, return existing ID
      const existingId = await this.redis.get(dedupeKey);
      return existingId || 'duplicate';
    }
    
    const json = JSON.stringify(message);
    const streamId = await this.redis.xadd(
      STREAM_INBOUND, 'MAXLEN', '~', ROUTING_MAXLEN.toString(), '*', 'v', json
    );
    
    // Store deduplication key with TTL
    await this.redis.setex(dedupeKey, DEDUPE_TTL_SEC, streamId);
    
    // Create index entry for quick lookups
    const idxKey = `inbound:index:${message.id}`;
    await this.redis.hset(idxKey, {
      ts: String(message.ts), 
      from: message.from, 
      to: message.to,
      chatId: message.chatId,
      type: message.type,
      conversationKey: message.conversationKey,
      dedupeKey: message.dedupeKey,
      streamId: streamId
    });
    
    // Set TTL on index entry
    await this.redis.expire(idxKey, DEDUPE_TTL_SEC);
    
    return streamId;
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
    return 'redis-inbound';
  }
}