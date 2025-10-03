import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../dist/server.js'

// Test suite to verify group JID handling in both immediate and scheduled messages
// This addresses the bug where scheduled messages to groups were being sent as contacts

test('POST /send with group JID in jid field', async () => {
  const response = await request(app)
    .post('/send')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      jid: '120363339062208504@g.us',
      message: 'Test message to group'
    })

  // Should get 503 because WhatsApp is not connected in test environment
  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
  assert.equal(response.body.error, 'WhatsApp not connected')
})

test('POST /send with group JID in number field (edge case)', async () => {
  const response = await request(app)
    .post('/send')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      number: '120363339062208504@g.us',
      message: 'Test message to group via number field'
    })

  // Should get 503 because WhatsApp is not connected in test environment
  // The fix ensures this doesn't get converted to a contact number
  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
  assert.equal(response.body.error, 'WhatsApp not connected')
})

test('POST /scheduled with group JID in jid field', async () => {
  const response = await request(app)
    .post('/scheduled')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      jid: '120363339062208504@g.us',
      message: 'Scheduled message to group',
      schedule: '0 9 * * *'
    })

  // Should succeed in creating the scheduled message
  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.ok(response.body.scheduledMessage)
  assert.equal(response.body.scheduledMessage.jid, '120363339062208504@g.us')
  
  // Clean up: delete the scheduled message
  if (response.body.scheduledMessage?.id) {
    await request(app)
      .delete(`/scheduled/${response.body.scheduledMessage.id}`)
      .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
  }
})

test('POST /scheduled with group JID in number field (edge case that caused the bug)', async () => {
  const response = await request(app)
    .post('/scheduled')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      number: '120363339062208504@g.us',
      message: 'Scheduled message to group via number field',
      schedule: '0 10 * * *'
    })

  // Should succeed in creating the scheduled message
  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.ok(response.body.scheduledMessage)
  // The number field should be preserved as-is
  assert.equal(response.body.scheduledMessage.number, '120363339062208504@g.us')
  
  // Clean up: delete the scheduled message
  if (response.body.scheduledMessage?.id) {
    await request(app)
      .delete(`/scheduled/${response.body.scheduledMessage.id}`)
      .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
  }
})

test('POST /scheduleDate with group JID in jid field', async () => {
  const futureDate = new Date(Date.now() + 3600000).toISOString() // 1 hour from now
  
  const response = await request(app)
    .post('/scheduleDate')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      jid: '120363339062208504@g.us',
      message: 'Date-scheduled message to group',
      scheduleDate: futureDate
    })

  // Should succeed in creating the scheduled message
  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.ok(response.body.scheduledMessage)
  assert.equal(response.body.scheduledMessage.jid, '120363339062208504@g.us')
  
  // Clean up: delete the scheduled message
  if (response.body.scheduledMessage?.id) {
    await request(app)
      .delete(`/scheduled/${response.body.scheduledMessage.id}`)
      .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
  }
})

test('POST /scheduleDate with group JID in number field (edge case)', async () => {
  const futureDate = new Date(Date.now() + 3600000).toISOString() // 1 hour from now
  
  const response = await request(app)
    .post('/scheduleDate')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      number: '120363339062208504@g.us',
      message: 'Date-scheduled message to group via number field',
      scheduleDate: futureDate
    })

  // Should succeed in creating the scheduled message
  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.ok(response.body.scheduledMessage)
  assert.equal(response.body.scheduledMessage.number, '120363339062208504@g.us')
  
  // Clean up: delete the scheduled message
  if (response.body.scheduledMessage?.id) {
    await request(app)
      .delete(`/scheduled/${response.body.scheduledMessage.id}`)
      .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
  }
})

test('POST /send with regular phone number', async () => {
  const response = await request(app)
    .post('/send')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      number: '1234567890',
      message: 'Test message to phone number'
    })

  // Should get 503 because WhatsApp is not connected in test environment
  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
  assert.equal(response.body.error, 'WhatsApp not connected')
})

test('POST /scheduled with regular phone number', async () => {
  const response = await request(app)
    .post('/scheduled')
    .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
    .send({
      number: '1234567890',
      message: 'Scheduled message to phone number',
      schedule: '0 11 * * *'
    })

  // Should succeed in creating the scheduled message
  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.ok(response.body.scheduledMessage)
  assert.equal(response.body.scheduledMessage.number, '1234567890')
  
  // Clean up: delete the scheduled message
  if (response.body.scheduledMessage?.id) {
    await request(app)
      .delete(`/scheduled/${response.body.scheduledMessage.id}`)
      .set('x-api-key', process.env.API_TOKENS?.split(',')[0] || 'test-key')
  }
})
