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

  async getConversationHistory(conversationKey: string, beforeTimestamp?: number, maxMessages: number = 50): Promise<InboundMessage[]> {
    if (!this.redis) {
      return [];
    }

    try {
      // Read messages from the stream in reverse order (newest first)
      // We'll read more than maxMessages to account for filtering
      const readCount = maxMessages * 2; // Read extra to account for filtering
      const messages = await this.redis.xrevrange(STREAM_INBOUND, '+', '-', 'COUNT', readCount);

      const result: InboundMessage[] = [];
      const cutoffTimestamp = beforeTimestamp || Date.now();
      
      for (const [streamId, fields] of messages) {
        if (result.length >= maxMessages) {
          break;
        }

        // Extract the message JSON from the stream
        const messageJson = fields.find(([key]) => key === 'v')?.[1];
        if (!messageJson) {
          continue;
        }

        try {
          const message: InboundMessage = JSON.parse(messageJson);
          
          // Filter by conversationKey
          if (message.conversationKey !== conversationKey) {
            continue;
          }

          // Filter by timestamp (only include messages before the cutoff)
          if (message.ts >= cutoffTimestamp) {
            continue;
          }

          result.push(message);
        } catch (err) {
          // Skip invalid JSON messages
          continue;
        }
      }

      // Sort by timestamp ascending (oldest first) for proper conversation flow
      result.sort((a, b) => a.ts - b.ts);

      return result;
    } catch (err) {
      // Return empty array on error rather than throwing
      return [];
    }
  }

  getBackendType(): string {
    return 'redis-inbound';
  }
}