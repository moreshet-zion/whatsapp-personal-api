import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../dist/server.js'

// Integration smoke test - verify /send endpoint doesn't break with sent recording
test('POST /send endpoint with sent recording (smoke test)', async () => {
  // This is a smoke test that verifies the endpoint doesn't crash
  // In real usage, it would fail because WhatsApp is not connected, but
  // we can verify that the sent recording logic doesn't break the flow
  
  const response = await request(app)
    .post('/send')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      number: '1234567890',
      message: 'Test message for sent recording'
    })

  // Should get 503 because WhatsApp is not connected in test environment
  // But importantly, it shouldn't crash due to sent recording logic
  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
  assert.equal(response.body.error, 'WhatsApp not connected')
})

test('POST /send endpoint handles missing recipient', async () => {
  const response = await request(app)
    .post('/send')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      message: 'Test message without recipient'
    })

  assert.equal(response.status, 400)
  assert.equal(response.body.success, false)
  assert(response.body.error.includes('Either number or jid must be provided'))
})