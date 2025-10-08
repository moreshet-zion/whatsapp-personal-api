import test from 'node:test'
import assert from 'node:assert/strict'
import { WhatsAppClient } from '../dist/services/whatsapp.js'

// Test suite for inbound message conversion to ensure text is always captured
// This addresses the critical bug where messages were stored in Redis without text content

test('convertWAMessageToInbound: extracts text from conversation message (production example)', async (t) => {
  const client = new WhatsAppClient()
  
  // Simulate the production example from logs - Msg #1
  const waMessage = {
    key: {
      remoteJid: '972545828285@s.whatsapp.net',
      fromMe: false,
      id: '3AC9FF3DA4921ADC1C2C'
    },
    messageTimestamp: 1759949763,
    pushName: 'Aviad S.',
    message: {
      conversation: 'הי , אתה יכול לרשום אותי לערבית הערב?',
      messageContextInfo: {
        deviceListMetadata: {
          senderKeyIndexes: [],
          recipientKeyIndexes: []
        }
      }
    }
  }

  // Mock the socket user
  const mockSocket = { user: { id: '972509104061:8@s.whatsapp.net' } }
  client['socket'] = mockSocket

  // Use reflection to call the private method for testing
  const result = client['convertWAMessageToInbound'](waMessage)

  // Verify the conversion matches the expected output from Msg #2
  assert.ok(result, 'Should successfully convert message')
  assert.equal(result.id, '3AC9FF3DA4921ADC1C2C')
  assert.equal(result.ts, 1759949763000)
  assert.equal(result.from, '972545828285@s.whatsapp.net')
  assert.equal(result.to, '972509104061:8@s.whatsapp.net')
  assert.equal(result.chatId, '972545828285@s.whatsapp.net')
  assert.equal(result.type, 'text')
  assert.equal(result.dedupeKey, '3AC9FF3DA4921ADC1C2C-1759949763000')
  assert.equal(result.conversationKey, '972545828285@s.whatsapp.net')
  
  // CRITICAL: Verify text is extracted
  assert.equal(result.text, 'הי , אתה יכול לרשום אותי לערבית הערב?')
  
  // Verify metadata
  assert.equal(result.metadata.fromMe, false)
  assert.equal(result.metadata.pushName, 'Aviad S.')
})

test('convertWAMessageToInbound: handles unknown message type with fallback (critical fix)', async (t) => {
  const client = new WhatsAppClient()
  
  // Simulate a message that would result in type 'unknown' without extracted text
  // This was the bug: these messages were stored in Redis WITHOUT any text content
  const waMessage = {
    key: {
      remoteJid: '120363117023266550@g.us',
      fromMe: false,
      id: '3934008134'
    },
    messageTimestamp: 1759702647,
    pushName: '',
    message: {
      // Some unsupported message type that doesn't match our extractors
      pollCreationMessage: {
        name: 'Which option do you prefer?',
        options: [
          { optionName: 'Option A' },
          { optionName: 'Option B' }
        ],
        selectableOptionsCount: 1
      }
    }
  }

  // Mock the socket user
  const mockSocket = { user: { id: '972509104061:8@s.whatsapp.net' } }
  client['socket'] = mockSocket

  // Use reflection to call the private method for testing
  const result = client['convertWAMessageToInbound'](waMessage)

  // Verify the conversion
  assert.ok(result, 'Should successfully convert message')
  assert.equal(result.id, '3934008134')
  assert.equal(result.ts, 1759702647000)
  assert.equal(result.from, '120363117023266550@g.us')
  assert.equal(result.chatId, '120363117023266550@g.us')
  assert.equal(result.type, 'unknown')
  
  // CRITICAL FIX VERIFICATION: Even with type 'unknown', text field MUST exist
  assert.ok(result.text, 'Text field must exist even for unknown message types')
  
  // The text should be a stringified version of the raw message
  const parsedText = JSON.parse(result.text)
  assert.ok(parsedText.pollCreationMessage, 'Should contain the raw message data')
  assert.equal(parsedText.pollCreationMessage.name, 'Which option do you prefer?')
  
  console.log('✅ CRITICAL FIX VERIFIED: Unknown message types now include text field with raw message data')
  console.log('   Before fix: Redis would store:', JSON.stringify({ ...result, text: undefined }))
  console.log('   After fix:  Redis now stores:', JSON.stringify(result))
})

test('convertWAMessageToInbound: handles image with caption', async (t) => {
  const client = new WhatsAppClient()
  
  const waMessage = {
    key: {
      remoteJid: '1234567890@s.whatsapp.net',
      fromMe: false,
      id: 'IMG123'
    },
    messageTimestamp: 1700000000,
    pushName: 'Test User',
    message: {
      imageMessage: {
        caption: 'Check out this image!',
        url: 'https://example.com/image.jpg',
        mimetype: 'image/jpeg'
      }
    }
  }

  const mockSocket = { user: { id: 'bot@s.whatsapp.net' } }
  client['socket'] = mockSocket

  const result = client['convertWAMessageToInbound'](waMessage)

  assert.ok(result, 'Should successfully convert message')
  assert.equal(result.type, 'text')
  assert.equal(result.text, 'Check out this image!', 'Should extract caption as text')
})

test('convertWAMessageToInbound: handles image without caption (fallback)', async (t) => {
  const client = new WhatsAppClient()
  
  const waMessage = {
    key: {
      remoteJid: '1234567890@s.whatsapp.net',
      fromMe: false,
      id: 'IMG456'
    },
    messageTimestamp: 1700000000,
    pushName: 'Test User',
    message: {
      imageMessage: {
        url: 'https://example.com/image.jpg',
        mimetype: 'image/jpeg'
        // No caption
      }
    }
  }

  const mockSocket = { user: { id: 'bot@s.whatsapp.net' } }
  client['socket'] = mockSocket

  const result = client['convertWAMessageToInbound'](waMessage)

  assert.ok(result, 'Should successfully convert message')
  assert.equal(result.type, 'image')
  
  // With the fix, even images without captions should have text field with raw data
  assert.ok(result.text, 'Should have text field with raw message data as fallback')
  
  const parsedText = JSON.parse(result.text)
  assert.ok(parsedText.imageMessage, 'Should contain the raw image message data')
})

test('convertWAMessageToInbound: handles extended text message', async (t) => {
  const client = new WhatsAppClient()
  
  const waMessage = {
    key: {
      remoteJid: '1234567890@s.whatsapp.net',
      fromMe: false,
      id: 'EXT123'
    },
    messageTimestamp: 1700000000,
    pushName: 'Test User',
    message: {
      extendedTextMessage: {
        text: 'This is an extended text message with formatting'
      }
    }
  }

  const mockSocket = { user: { id: 'bot@s.whatsapp.net' } }
  client['socket'] = mockSocket

  const result = client['convertWAMessageToInbound'](waMessage)

  assert.ok(result, 'Should successfully convert message')
  assert.equal(result.type, 'text')
  assert.equal(result.text, 'This is an extended text message with formatting')
})

test('Demonstrate production bug fix: Redis storage comparison', async (t) => {
  const client = new WhatsAppClient()
  
  // Production example that was failing
  const problematicMessage = {
    key: {
      remoteJid: '120363117023266550@g.us',
      fromMe: false,
      id: '3934008134'
    },
    messageTimestamp: 1759702647,
    message: {
      unknownType: { some: 'data' }
    }
  }

  const mockSocket = { user: { id: '972509104061:8@s.whatsapp.net' } }
  client['socket'] = mockSocket

  const result = client['convertWAMessageToInbound'](problematicMessage)

  console.log('\n📊 PRODUCTION BUG FIX COMPARISON:')
  console.log('================================')
  
  console.log('\n❌ BEFORE (what was stored in Redis - missing text):')
  console.log('v')
  console.log('{"id":"3934008134","ts":1759702647000,"from":"120363117023266550@g.us","to":"972509104061:8@s.whatsapp.net","chatId":"120363117023266550@g.us","type":"unknown","dedupeKey":"3934008134-1759702647000","conversationKey":"120363117023266550@g.us","metadata":{"fromMe":false,"participant":"","pushName":""}}')
  
  console.log('\n✅ AFTER (what is now stored in Redis - includes text):')
  console.log('v')
  console.log(JSON.stringify(result))
  
  console.log('\n🔑 KEY DIFFERENCE:')
  console.log('   Before: No "text" field → Message content lost!')
  console.log('   After:  "text" field contains:', result.text?.substring(0, 50) + '...')
  console.log('================================\n')

  // Verify the fix
  assert.ok(result.text, 'CRITICAL: Text field must always exist')
  assert.notEqual(result.text, undefined, 'Text must not be undefined')
  assert.notEqual(result.text, '', 'Text must not be empty')
})
