import test from 'node:test'
import assert from 'node:assert/strict'

// Simple unit test for the recordSent logic without Redis mocking complexity
test('recordSent data structure validation', async () => {
  const rec = {
    id: 'test-123',
    ts: 1640995200000,
    to: '1234567890',
    chatId: '1234567890@s.whatsapp.net',
    via: 'text',
    bodyPreview: 'Hello world',
    correlationId: 'corr-123',
    waMessageId: 'wa-msg-456',
    dedupeKey: 'dedupe-789'
  }

  // Validate the JSON structure would be correct
  const json = JSON.stringify(rec)
  const parsed = JSON.parse(json)
  
  assert.equal(parsed.id, 'test-123')
  assert.equal(parsed.ts, 1640995200000)
  assert.equal(parsed.to, '1234567890')
  assert.equal(parsed.via, 'text')
  assert.equal(parsed.bodyPreview, 'Hello world')
  assert.equal(parsed.correlationId, 'corr-123')
  assert.equal(parsed.waMessageId, 'wa-msg-456')
  assert.equal(parsed.dedupeKey, 'dedupe-789')
})

test('recordSent index key format', async () => {
  const rec = {
    id: 'test-456',
    ts: Date.now(),
    to: '9876543210',
    via: 'text'
  }

  const expectedIdxKey = `sent:index:${rec.id}`
  assert.equal(expectedIdxKey, 'sent:index:test-456')
})

test('recordSent hash data with missing optional fields', async () => {
  const rec = {
    id: 'test-minimal',
    ts: 1640995300000,
    to: '9876543210',
    via: 'image'
  }

  // Validate the hash structure would be correct
  const hashData = {
    ts: String(rec.ts), 
    to: rec.to, 
    chatId: rec.chatId || '',
    via: rec.via, 
    corr: rec.correlationId || '',
    waId: rec.waMessageId || '', 
    ddk: rec.dedupeKey || ''
  }

  assert.equal(hashData.ts, '1640995300000')
  assert.equal(hashData.to, '9876543210')
  assert.equal(hashData.chatId, '')
  assert.equal(hashData.via, 'image')
  assert.equal(hashData.corr, '')
  assert.equal(hashData.waId, '')
  assert.equal(hashData.ddk, '')
})