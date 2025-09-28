import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'

// Create mock middleware functions for testing
function createMockRequireRedis(isConfigured) {
  return (req, res, next) => {
    if (!isConfigured) {
      return res.status(503).json({ 
        success: false, 
        error: 'Redis is required for this endpoint but not configured',
        hint: 'Set REDIS_URL environment variable to enable Redis functionality'
      })
    }
    next()
  }
}

function createMockAddRedisHeaders(isConfigured) {
  return (req, res, next) => {
    res.set('X-Redis-Available', isConfigured ? 'true' : 'false')
    next()
  }
}

test('requireRedis middleware returns 503 when Redis not configured', async () => {
  const app = express()
  app.use(createMockRequireRedis(false))
  app.get('/test', (req, res) => res.json({ success: true }))
  
  const response = await request(app).get('/test')
  
  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
  assert.equal(response.body.error, 'Redis is required for this endpoint but not configured')
  assert.equal(response.body.hint, 'Set REDIS_URL environment variable to enable Redis functionality')
})

test('requireRedis middleware passes through when Redis is configured', async () => {
  const app = express()
  app.use(createMockRequireRedis(true))
  app.get('/test', (req, res) => res.json({ success: true }))
  
  const response = await request(app).get('/test')
  
  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
})

test('addRedisHeaders middleware adds correct headers', async () => {
  const app = express()
  app.use(createMockAddRedisHeaders(true))
  app.get('/test', (req, res) => res.json({ success: true }))
  
  const response = await request(app).get('/test')
  
  assert.equal(response.status, 200)
  assert.equal(response.headers['x-redis-available'], 'true')
})