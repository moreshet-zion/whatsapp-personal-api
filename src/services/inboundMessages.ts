import type { WAMessage } from '@whiskeysockets/baileys'
import pino from 'pino'
import { redis, isRedisConfigured, STREAM_INBOUND, ROUTING_MAXLEN, DEDUPE_TTL_SEC } from '../infra/redis.js'
import { InboundMessage, MessageType } from '../dto/messages.js'
import { hash } from '../utils/hash.js'

export class InboundMessageProcessor {
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' })

  constructor() {
    if (!isRedisConfigured) {
      this.logger.warn('Redis not configured - inbound messages will be logged but not stored')
    }
  }

  public async processMessage(waMessage: WAMessage): Promise<void> {
    try {
      const normalized = this.normalizeMessage(waMessage)
      
      if (!normalized) {
        this.logger.debug({ messageId: waMessage.key.id }, 'Skipping message normalization')
        return
      }

      // Check for duplicates
      const isDuplicate = await this.isDuplicate(normalized.dedupeKey)
      if (isDuplicate) {
        this.logger.info({ 
          messageId: normalized.id, 
          dedupeKey: normalized.dedupeKey 
        }, 'Skipped duplicate inbound message')
        return
      }

      // Publish to Redis Stream
      await this.publishToStream(normalized)
      
      this.logger.info({
        messageId: normalized.id,
        from: normalized.from,
        chatId: normalized.chatId,
        type: normalized.type
      }, 'Published inbound message to Redis Stream')

    } catch (err) {
      this.logger.error({ err, messageId: waMessage.key.id }, 'Failed to process inbound message')
    }
  }

  private normalizeMessage(waMessage: WAMessage): InboundMessage | null {
    const key = waMessage.key
    const message = waMessage.message
    
    if (!key.remoteJid || !key.id || !waMessage.messageTimestamp) {
      return null
    }

    // Extract message type and text content
    const { type, text } = this.extractMessageContent(message)
    
    // Generate dedupe key based on message ID and sender
    const dedupeKey = hash(`${key.id}:${key.remoteJid}:${waMessage.messageTimestamp}`)
    
    // Generate conversation key for grouping messages by chat
    const conversationKey = hash(key.remoteJid)

    const inboundMessage: InboundMessage = {
      id: key.id,
      ts: Number(waMessage.messageTimestamp) * 1000, // Convert to milliseconds
      from: key.participant || key.remoteJid, // participant for group messages, remoteJid for direct
      to: 'me', // Our WhatsApp account
      chatId: key.remoteJid,
      type,
      dedupeKey,
      conversationKey,
      metadata: {
        isGroup: key.remoteJid.endsWith('@g.us'),
        ...(key.participant && { participant: key.participant })
      }
    }

    // Only add text if it exists
    if (text) {
      inboundMessage.text = text
    }

    return inboundMessage
  }

  private extractMessageContent(message: any): { type: MessageType; text?: string } {
    if (!message) {
      return { type: 'unknown' }
    }

    // Handle different message types
    if (message.conversation) {
      return { type: 'text', text: message.conversation }
    }
    
    if (message.extendedTextMessage?.text) {
      return { type: 'text', text: message.extendedTextMessage.text }
    }
    
    if (message.imageMessage) {
      return { 
        type: 'image', 
        text: message.imageMessage.caption || undefined 
      }
    }
    
    if (message.videoMessage) {
      return { 
        type: 'video', 
        text: message.videoMessage.caption || undefined 
      }
    }
    
    if (message.audioMessage) {
      return { type: 'audio' }
    }
    
    if (message.documentMessage) {
      return { 
        type: 'document',
        text: message.documentMessage.caption || message.documentMessage.fileName || undefined
      }
    }
    
    if (message.stickerMessage) {
      return { type: 'sticker' }
    }

    return { type: 'unknown' }
  }

  private async isDuplicate(dedupeKey: string): Promise<boolean> {
    if (!redis) return false

    try {
      const exists = await redis.exists(`dedupe:${dedupeKey}`)
      return exists === 1
    } catch (err) {
      this.logger.warn({ err, dedupeKey }, 'Failed to check duplicate - allowing message')
      return false
    }
  }

  private async publishToStream(message: InboundMessage): Promise<void> {
    if (!redis) {
      this.logger.warn('Redis not available - message not stored')
      return
    }

    try {
      // Set deduplication key with TTL
      await redis.setex(`dedupe:${message.dedupeKey}`, DEDUPE_TTL_SEC, '1')

      // Publish to stream with automatic trimming
      await redis.xadd(
        STREAM_INBOUND,
        'MAXLEN', '~', ROUTING_MAXLEN, // ~ means approximate trimming for better performance
        '*', // Auto-generate ID
        'data', JSON.stringify(message)
      )

    } catch (err) {
      this.logger.error({ err, messageId: message.id }, 'Failed to publish message to Redis Stream')
      throw err
    }
  }
}