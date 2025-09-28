import { redis, STREAM_SENT, ROUTING_MAXLEN } from '../infra/redis.js';
import { SentRecord } from '../dto/messages.js';

export async function recordSent(rec: SentRecord): Promise<string> {
  if (!redis) {
    throw new Error('Redis not configured');
  }
  
  const json = JSON.stringify(rec);
  const id = await redis.xadd(
    STREAM_SENT, 'MAXLEN', '~', ROUTING_MAXLEN.toString(), '*', 'v', json
  );
  const idxKey = `sent:index:${rec.id}`;
  await redis.hset(idxKey, {
    ts: String(rec.ts), 
    to: rec.to, 
    chatId: rec.chatId || '',
    via: rec.via, 
    corr: rec.correlationId || '',
    waId: rec.waMessageId || '', 
    ddk: rec.dedupeKey || ''
  });
  return id;
}