import IORedis from 'ioredis'

function validateRedisUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['redis:', 'rediss:', 'redis+tls:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

const redisUrl = process.env.REDIS_URL

// Validate Redis URL format if provided
if (redisUrl && !validateRedisUrl(redisUrl)) {
  console.warn(`Warning: REDIS_URL appears to be invalid: ${redisUrl}`)
}

export const redis = redisUrl
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
  : undefined

export const isRedisConfigured = Boolean(redisUrl)

// Redis Stream configuration constants for message routing and deduplication
// These are prepared for future implementation of Redis-backed message processing
export const STREAM_INBOUND = process.env.STREAM_INBOUND || 'inbound_messages'
export const STREAM_OUTBOUND = process.env.STREAM_OUTBOUND || 'outbound_commands'
export const STREAM_SENT = process.env.STREAM_SENT || 'sent_history'
export const ROUTING_MAXLEN = parseInt(process.env.ROUTING_MAXLEN || '10000', 10)
export const DEDUPE_TTL_SEC = parseInt(process.env.DEDUPE_TTL_SEC || '86400', 10)
