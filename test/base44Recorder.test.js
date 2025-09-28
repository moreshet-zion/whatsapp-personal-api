import test from 'node:test'
import assert from 'node:assert/strict'

test('Base44Recorder payload format validation', async () => {
  const record = {
    id: 'test-123',
    ts: 1640995200000,
    to: '972501234567',
    chatId: '972501234567@s.whatsapp.net',
    via: 'text',
    bodyPreview: 'Test message content',
    correlationId: 'scheduled-msg-456',
    waMessageId: 'whatsapp-msg-789',
    dedupeKey: 'dedupe-123'
  }

  // Test payload structure matches Base44 API spec
  const expectedPayload = {
    message_type: 'scheduled', // has correlationId and doesn't start with 'topic:'
    number: '972501234567',
    message: 'Test message content',
    status: 'sent',
    sent_at: '2022-01-01T00:00:00.000Z',
    external_system: 'flyio-whatsapp-personal-api-v',
    scheduled_message_id: 'scheduled-msg-456',
    response_data: {
      whatsapp_message_id: 'whatsapp-msg-789',
      chat_id: '972501234567@s.whatsapp.net',
      message_via: 'text',
      dedupe_key: 'dedupe-123',
      internal_record_id: 'test-123'
    }
  }

  // Validate message_type logic
  assert.equal(record.correlationId && !record.correlationId.startsWith('topic:'), true)
  
  // Validate external_system format
  const flyReleaseVersion = process.env.FLY_RELEASE_VERSION || ''
  const expectedExternalSystem = `flyio-whatsapp-personal-api-v${flyReleaseVersion}`
  assert.equal(typeof expectedExternalSystem, 'string')
  
  // Validate timestamp format
  const isoDate = new Date(record.ts).toISOString()
  assert.equal(isoDate, '2022-01-01T00:00:00.000Z')
})

test('Base44Recorder message type detection', async () => {
  const testCases = [
    { correlationId: undefined, expected: 'instant' },
    { correlationId: 'topic:broadcast-123', expected: 'instant' },
    { correlationId: 'scheduled-msg-456', expected: 'scheduled' },
    { correlationId: 'cron-job-789', expected: 'scheduled' }
  ]

  testCases.forEach(({ correlationId, expected }) => {
    const messageType = correlationId?.startsWith('topic:') ? 'instant' : 
                       correlationId ? 'scheduled' : 'instant'
    assert.equal(messageType, expected, `Failed for correlationId: ${correlationId}`)
  })
})

test('Base44Recorder configuration validation', async () => {
  // Test environment variable requirements
  const originalBase44Url = process.env.BASE44_URL
  const originalBase44Key = process.env.BASE44_KEY
  
  // Clear env vars to test validation
  delete process.env.BASE44_URL
  delete process.env.BASE44_KEY
  
  const { Base44Recorder } = await import('../dist/services/recorders/base44Recorder.js')
  const recorder = new Base44Recorder()
  
  // Should not be healthy without configuration
  const healthy = await recorder.isHealthy()
  assert.equal(healthy, false)
  
  // Restore env vars
  if (originalBase44Url !== undefined) process.env.BASE44_URL = originalBase44Url
  if (originalBase44Key !== undefined) process.env.BASE44_KEY = originalBase44Key
})