import type { RequestHandler } from 'express'
import { randomBytes } from 'crypto'
import { performance } from 'perf_hooks'

export interface RedisHealthClient {
  status: string
  connect: () => Promise<unknown>
  ping: () => Promise<unknown>
  set: (key: string, value: string, mode: 'EX', seconds: number, condition: 'NX') => Promise<'OK' | null>
  del: (key: string) => Promise<number>
}

export function createRedisHealthHandler(redis?: RedisHealthClient): RequestHandler {
  if (!redis) {
    return (_req, res) => {
      res.status(503).json({ redis: 'fail', reason: 'Redis not configured' })
    }
  }

  return async (_req, res) => {
    const start = performance.now()
    const key = `test:health:${randomBytes(8).toString('hex')}`
    try {
      if (redis.status !== 'ready') {
        await redis.connect()
      }

      await redis.ping()

      const writeResult = await redis.set(key, 'ok', 'EX', 5, 'NX')
      if (writeResult !== 'OK') {
        throw new Error('Failed to write test key')
      }

      const deleteResult = await redis.del(key)
      if (deleteResult !== 1) {
        throw new Error('Failed to delete test key')
      }

      const latencyMs = performance.now() - start
      res.json({ redis: 'ok', writeDelete: 'ok', latencyMs })
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error'
      await redis.del(key).catch(() => {})
      res.status(503).json({ redis: 'fail', reason })
    }
  }
}
