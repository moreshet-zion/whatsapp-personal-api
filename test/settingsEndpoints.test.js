import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../dist/server.js'

const API_KEY = process.env.API_TOKENS?.split(',')[0] || 'test-key'

test('GET /settings returns default settings', async () => {
  const response = await request(app)
    .get('/settings')
    .set('x-api-key', API_KEY)

  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.equal(response.body.settings.history_backend, 'redis')
})

test('PUT /settings updates backend configuration', async () => {
  const response = await request(app)
    .put('/settings')
    .set('x-api-key', API_KEY)
    .send({
      history_backend: 'base44'
    })

  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.equal(response.body.settings.history_backend, 'base44')
})

test('PUT /settings accepts valid enum values', async () => {
  const response = await request(app)
    .put('/settings')
    .set('x-api-key', API_KEY)
    .send({
      history_backend: 'invalid-backend'
    })

  assert.equal(response.status, 400)
  assert.equal(response.body.success, false)
  assert(response.body.error.includes('Invalid settings format'))
})

test('GET /settings/recording-status returns backend status', async () => {
  const response = await request(app)
    .get('/settings/recording-status')
    .set('x-api-key', API_KEY)

  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert(response.body.recording)
  assert.equal(typeof response.body.recording.backend, 'string')
  assert.equal(typeof response.body.recording.healthy, 'boolean')
  assert.equal(typeof response.body.recording.available, 'boolean')
})