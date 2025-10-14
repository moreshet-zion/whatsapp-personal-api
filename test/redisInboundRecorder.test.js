import test from 'node:test'
import assert from 'node:assert/strict'

class FakeRedis {
  constructor() {
    this.commands = []
    this.hashes = new Map()
  }

  async exists() {
    return 0
  }

  async get() {
    return null
  }

  async xadd(...args) {
    this.commands.push(args)
    return '1-0'
  }

  async setex() {
    return 'OK'
  }

  async hset(key, value) {
    this.hashes.set(key, value)
    return 'OK'
  }

  async expire() {
    return 1
  }

  async ping() {
    return 'PONG'
  }
}

test('RedisInboundRecorder stores payload and text field', async () => {
  const { RedisInboundRecorder } = await import('../dist/services/recorders/redisInboundRecorder.js')

  const fakeRedis = new FakeRedis()
  const recorder = new RedisInboundRecorder(fakeRedis)

  const message = {
    id: 'msg-1',
    ts: 1700000000000,
    from: '123@s.whatsapp.net',
    to: 'bot@s.whatsapp.net',
    chatId: '123@s.whatsapp.net',
    type: 'text',
    text: 'Hello from WhatsApp',
    dedupeKey: 'msg-1-1700000000000',
    conversationKey: '123@s.whatsapp.net',
    metadata: {
      fromMe: false,
      participant: '',
      pushName: 'Tester'
    }
  }

  const id = await recorder.recordInbound(message)
  assert.equal(id, '1-0')

  assert.equal(fakeRedis.commands.length, 1)
  const args = fakeRedis.commands[0]

  // Ensure the payload JSON includes the text
  const payloadIndex = args.indexOf('payload')
  assert.ok(payloadIndex !== -1)
  const payload = JSON.parse(args[payloadIndex + 1])
  assert.equal(payload.text, 'Hello from WhatsApp')

  // Ensure the text field is also stored separately for easier consumption
  // Find the 'text' field that contains the actual message content
  // Start from index 5 where the field-value pairs begin (after MAXLEN params)
  let textIndex = -1
  for (let i = 5; i < args.length - 1; i += 2) {
    if (args[i] === 'text' && args[i + 1] === 'Hello from WhatsApp') {
      textIndex = i
      break
    }
  }
  assert.ok(textIndex !== -1, 'text field with message content should be present in Redis stream')
  assert.equal(args[textIndex + 1], 'Hello from WhatsApp')

  // Hash index should include the text for quick lookups
  const indexData = fakeRedis.hashes.get('inbound:index:msg-1')
  assert.equal(indexData.text, 'Hello from WhatsApp')
})