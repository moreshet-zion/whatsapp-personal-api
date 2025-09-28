import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!, {
  lazyConnect: true,
  maxRetriesPerRequest: null
});

export const STREAM_INBOUND = process.env.STREAM_INBOUND || 'inbound_messages';
export const STREAM_OUTBOUND = process.env.STREAM_OUTBOUND || 'outbound_commands';
export const STREAM_SENT = process.env.STREAM_SENT || 'sent_history';
export const ROUTING_MAXLEN = parseInt(process.env.ROUTING_MAXLEN || '10000', 10);
export const DEDUPE_TTL_SEC = parseInt(process.env.DEDUPE_TTL_SEC || '86400', 10);