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

  constructor(client?: IORedis) {
    if (client) {
      this.redis = client;
      this.isRedisConfigured = true;
      return;
    }

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
    
    const payload = JSON.stringify({
      ...message,
      metadata: message.metadata || undefined
    });

    const streamFields: string[] = [
      'payload', payload,
      'id', message.id,
      'ts', String(message.ts),
      'from', message.from,
      'to', message.to,
      'chatId', message.chatId,
      'type', message.type,
      'dedupeKey', message.dedupeKey,
      'conversationKey', message.conversationKey
    ];

    if (message.text) {
      streamFields.push('text', message.text);
    }

    if (message.mediaUrl) {
      streamFields.push('mediaUrl', message.mediaUrl);
    }

    if (message.metadata) {
      streamFields.push('metadata', JSON.stringify(message.metadata));
    }

    const streamId = await this.redis.xadd(
      STREAM_INBOUND,
      'MAXLEN',
      '~',
      ROUTING_MAXLEN.toString(),
      '*',
      ...streamFields
    );
    
    // Store deduplication key with TTL
    await this.redis.setex(dedupeKey, DEDUPE_TTL_SEC, streamId);
    
    // Create index entry for quick lookups
    const idxKey = `inbound:index:${message.id}`;
    const indexData: Record<string, string> = {
      ts: String(message.ts),
      from: message.from,
      to: message.to,
      chatId: message.chatId,
      type: message.type,
      conversationKey: message.conversationKey,
      dedupeKey: message.dedupeKey,
      streamId: streamId
    };

    if (message.text) {
      indexData.text = message.text;
    }

    if (message.mediaUrl) {
      indexData.mediaUrl = message.mediaUrl;
    }

    if (message.metadata) {
      indexData.metadata = JSON.stringify(message.metadata);
    }

    await this.redis.hset(idxKey, indexData);
    
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