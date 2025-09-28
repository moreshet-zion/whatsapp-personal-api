import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { createRedisHealthHandler } from '../dist/routes/redisHealth.js'

test('GET /health/redis returns ok status and payload', async () => {
  const setCalls = []
  const delCalls = []

  const redisMock = {
    status: 'ready',
    connect: async () => {},
    ping: async () => 'PONG',
    set: async (key, value, mode, seconds, condition) => {
      setCalls.push({ key, value, mode, seconds, condition })
      return 'OK'
    },
    del: async (key) => {
      delCalls.push(key)
      return 1
    }
  }

  const app = express()
  app.get('/health/redis', createRedisHealthHandler(redisMock))

  const response = await request(app).get('/health/redis')

  assert.equal(response.status, 200)
  assert.equal(response.body.redis, 'ok')
  assert.equal(response.body.writeDelete, 'ok')
  assert.equal(typeof response.body.latencyMs, 'number')

  assert.equal(setCalls.length, 1)
  assert.equal(setCalls[0]?.value, 'ok')
  assert.equal(setCalls[0]?.mode, 'EX')
  assert.equal(setCalls[0]?.seconds, 5)
  assert.equal(setCalls[0]?.condition, 'NX')
  assert.match(setCalls[0]?.key ?? '', /^test:health:/)

  assert.equal(delCalls.length, 1)
  assert.equal(delCalls[0], setCalls[0]?.key)
})

test('GET /health/redis returns 503 when redis not configured', async () => {
  const app = express()
  app.get('/health/redis', createRedisHealthHandler(undefined))

  const response = await request(app).get('/health/redis')

  assert.equal(response.status, 503)
  assert.equal(response.body.redis, 'fail')
  assert.equal(response.body.reason, 'Redis not configured')
})

test('GET /health/redis returns 503 when redis operations fail', async () => {
  const redisMock = {
    status: 'connecting',
    connect: async () => {
      throw new Error('Connection failed')
    },
    ping: async () => 'PONG',
    set: async () => 'OK',
    del: async () => 1
  }

  const app = express()
  app.get('/health/redis', createRedisHealthHandler(redisMock))

  const response = await request(app).get('/health/redis')

  assert.equal(response.status, 503)
  assert.equal(response.body.redis, 'fail')
  assert.equal(response.body.reason, 'Connection failed')
})
