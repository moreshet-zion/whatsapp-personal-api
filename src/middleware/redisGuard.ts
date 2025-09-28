import type { Request, Response, NextFunction } from 'express'
import { isRedisConfigured } from '../infra/redis.js'

/**
 * Middleware to ensure Redis is configured and available for routes that require it.
 * Returns 503 Service Unavailable if Redis is not configured.
 */
export function requireRedis(req: Request, res: Response, next: NextFunction) {
  if (!isRedisConfigured) {
    return res.status(503).json({ 
      success: false, 
      error: 'Redis is required for this endpoint but not configured',
      hint: 'Set REDIS_URL environment variable to enable Redis functionality'
    })
  }
  next()
}

/**
 * Middleware that adds Redis availability info to response headers.
 * Useful for debugging and monitoring.
 */
export function addRedisHeaders(req: Request, res: Response, next: NextFunction) {
  res.set('X-Redis-Available', isRedisConfigured ? 'true' : 'false')
  next()
}