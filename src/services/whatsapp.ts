import makeWASocket, { DisconnectReason, type WASocket, useMultiFileAuthState, Browsers, type WAMessage } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import path from 'path'
import fs from 'fs'
import { InboundMessage, MessageType } from '../dto/messages.js'

export type ConnectionStatus = 'connected' | 'disconnected'

type QRState = {
  qrString?: string
  qrImageBase64?: string
  ts?: number
}

export class WhatsAppClient {
  private socket: WASocket | null = null
  private status: ConnectionStatus = 'disconnected'
  private qrState: QRState = {}
  private readonly sessionDir: string
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' })
  private messageHandler: ((message: InboundMessage) => void) | null = null

  constructor(sessionDir = path.resolve(process.cwd(), 'sessions')) {
    this.sessionDir = sessionDir
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true })
    }
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.status
  }

  public getQR(): QRState | null {
    if (this.status === 'connected') return null
    return this.qrState.qrString ? this.qrState : {}
  }

  public getSocket(): WASocket | null {
    return this.socket
  }

  public setMessageHandler(handler: (message: InboundMessage) => void): void {
    this.messageHandler = handler
  }

  private unwrapMessage(message?: any): any {
    return message?.ephemeralMessage?.message
        ?? message?.viewOnceMessageV2?.message
        ?? message?.documentWithCaptionMessage?.message
        ?? message;
  }

  private extractTextAndType(rawMessage: any): { type: MessageType; text?: string } {
    const message = this.unwrapMessage(rawMessage?.message);

    // Check for specific message types first before extracting text
    if (message?.reactionMessage) return { type: 'reaction', text: message.reactionMessage.text };
    if (message?.imageMessage && !message.imageMessage.caption) return { type: 'image' };
    if (message?.videoMessage && !message.videoMessage.caption) return { type: 'video' };
    if (message?.stickerMessage) return { type: 'sticker' };
    if (message?.audioMessage) return { type: 'audio' };
    if (message?.documentMessage && !message.documentMessage.caption) return { type: 'document' };

    // Plain/extended text and captions
    const text =
      message?.conversation ??
      message?.extendedTextMessage?.text ??
      // Captions on media
      message?.imageMessage?.caption ??
      message?.videoMessage?.caption ??
      message?.documentMessage?.caption ??
      // Interactive replies
      message?.buttonsResponseMessage?.selectedDisplayText ??
      message?.listResponseMessage?.title ??
      // Fallback: sometimes Baileys packs a single-key object
      (typeof message === 'object' && message && Object.values(message)[0] && (Object.values(message)[0] as any)?.text);

    if (text) return { type: 'text', text };

    return { type: 'unknown' };
  }

  private convertWAMessageToInbound(waMessage: WAMessage): InboundMessage | null {
    try {
      if (!waMessage.key || !waMessage.key.remoteJid || !waMessage.messageTimestamp) {
        return null
      }

      const messageId = waMessage.key.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const timestamp = typeof waMessage.messageTimestamp === 'number' 
        ? waMessage.messageTimestamp * 1000 
        : parseInt(waMessage.messageTimestamp.toString()) * 1000
      const from = waMessage.key.remoteJid
      const chatId = waMessage.key.remoteJid
      
      // Extract message type and text using improved logic
      const { type, text } = this.extractTextAndType(waMessage);

      // Create dedupe key based on message ID and timestamp
      const dedupeKey = `${messageId}-${timestamp}`
      const conversationKey = chatId

      const result: InboundMessage = {
        id: messageId,
        ts: timestamp,
        from,
        to: this.socket?.user?.id || 'unknown',
        chatId,
        type,
        dedupeKey,
        conversationKey,
        metadata: {
          fromMe: waMessage.key.fromMe || false,
          participant: waMessage.key.participant || '',
          pushName: waMessage.pushName || ''
        }
      }

      // Only add text field if we have text content
      if (text) {
        result.text = text;
      }

      return result
    } catch (err) {
      this.logger.error({ err, messageKey: waMessage.key }, 'Failed to convert WhatsApp message to inbound format')
      return null
    }
  }

  public async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir)

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Safari'),
      logger: pino({ level: 'warn' }),
      syncFullHistory: false
    })

    this.status = this.socket.user ? 'connected' : 'disconnected'

    this.socket.ev.on('creds.update', saveCreds)

    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        this.qrState.qrString = qr
        this.qrState.ts = Date.now()
        // qr image will be generated by endpoint to avoid heavy deps here
      }

      if (connection === 'open') {
        this.status = 'connected'
        this.qrState = {}
        this.logger.info('WhatsApp connected')
      } else if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        this.status = 'disconnected'
        this.logger.warn({ statusCode }, 'WhatsApp connection closed')
        if (shouldReconnect) {
          setTimeout(() => {
            this.start().catch((err) => this.logger.error({ err }, 'Reconnection failed'))
          }, 1000)
        }
      }
    })

    // Listen for incoming messages
    this.socket.ev.on('messages.upsert', async (messageUpdate) => {
      if (!this.messageHandler) return

      for (const waMessage of messageUpdate.messages) {
        // Skip messages sent by us
        if (waMessage.key.fromMe) continue

        // Convert WhatsApp message to our inbound format
        const inboundMessage = this.convertWAMessageToInbound(waMessage)
        if (inboundMessage) {
          try {
            this.messageHandler(inboundMessage)
          } catch (err) {
            this.logger.error({ err, messageId: inboundMessage.id }, 'Error in message handler')
          }
        }
      }
    })
  }

  public async restart(): Promise<void> {
    try {
      await this.socket?.end?.(new Error('manual-restart'))
    } catch {}
    this.socket = null
    this.status = 'disconnected'
    this.qrState = {}
    await this.start()
  }

  public async getGroupChats(): Promise<Array<{ jid: string; name: string; participants: number }>> {
    if (this.status !== 'connected' || !this.socket) {
      throw new Error('WhatsApp not connected')
    }
    
    try {
      // Get all chats
      const chats = await this.socket.groupFetchAllParticipating()
      
      // Transform the group data into a simpler format
      const groups = Object.entries(chats).map(([jid, group]) => ({
        jid,
        name: group.subject || 'Unnamed Group',
        participants: group.participants ? group.participants.length : 0
      }))
      
      return groups
    } catch (err) {
      this.logger.error({ err }, 'Failed to fetch group chats')
      throw new Error('Failed to fetch group chats')
    }
  }
}


