import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import pino from 'pino'
import { z } from 'zod'
import type { WhatsAppClient } from './whatsapp.js'
import { recordSent } from '../queue/sentRecorder.js'
import { isRedisConfigured, redis } from '../infra/redis.js'

const subscriberSchema = z.object({
  number: z.string(),
  subscribedAt: z.string()
})

const topicSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().default(''),
  subscribers: z.array(subscriberSchema).default([]),
  created: z.string(),
  updated: z.string()
})

const settingsSchema = z.object({
  messageDelaySeconds: z.number().min(0).default(1)
})

const pubSubDataSchema = z.object({
  topics: z.array(topicSchema).default([]),
  settings: settingsSchema.default({ messageDelaySeconds: 1 })
})

export type TopicSubscriber = z.infer<typeof subscriberSchema>
export type PubSubTopic = z.infer<typeof topicSchema>
export type PubSubSettings = z.infer<typeof settingsSchema>

export type PublishResult = {
  number: string
  success: boolean
  error?: string
}

export type PublishSummary = {
  topic: PubSubTopic
  attempted: number
  delivered: number
  results: PublishResult[]
}

export class PubSubService {
  private readonly dataFile: string
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' })
  private readonly whatsappClient: WhatsAppClient
  private data: z.infer<typeof pubSubDataSchema> = {
    topics: [],
    settings: { messageDelaySeconds: 1 }
  }

  constructor(dataDir = path.resolve(process.cwd(), 'data'), whatsappClient: WhatsAppClient) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    this.dataFile = path.join(dataDir, 'pubsub.json')
    this.whatsappClient = whatsappClient
    this.load()
  }

  private load() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8')
        const parsed = JSON.parse(raw)
        this.data = pubSubDataSchema.parse(parsed)
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to load pub/sub data')
      this.data = { topics: [], settings: { messageDelaySeconds: 1 } }
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2))
    } catch (err) {
      this.logger.error({ err }, 'Failed to save pub/sub data')
    }
  }

  public listTopics(): PubSubTopic[] {
    return this.data.topics
  }

  public getTopic(id: string): PubSubTopic | undefined {
    return this.data.topics.find((topic) => topic.id === id)
  }

  public getTopicByName(name: string): PubSubTopic | undefined {
    const normalized = name.trim().toLowerCase()
    return this.data.topics.find((topic) => topic.name.trim().toLowerCase() === normalized)
  }

  public createTopic(input: { name: string; description?: string | undefined }): PubSubTopic {
    const name = input.name.trim()
    if (!name) {
      throw new Error('Topic name is required')
    }
    if (this.getTopicByName(name)) {
      throw new Error('Topic with this name already exists')
    }
    const now = new Date().toISOString()
    const topic: PubSubTopic = {
      id: uuidv4(),
      name,
      description: input.description?.trim() ?? '',
      subscribers: [],
      created: now,
      updated: now
    }
    this.data.topics.push(topic)
    this.save()
    return topic
  }

  public deleteTopic(id: string): boolean {
    const idx = this.data.topics.findIndex((topic) => topic.id === id)
    if (idx === -1) return false
    this.data.topics.splice(idx, 1)
    this.save()
    return true
  }

  public listSubscribers(topicId: string): TopicSubscriber[] | null {
    const topic = this.getTopic(topicId)
    if (!topic) return null
    return topic.subscribers
  }

  public subscribe(topicId: string, number: string): { topic: PubSubTopic; created: boolean } {
    const topic = this.getTopic(topicId)
    if (!topic) {
      throw new Error('Topic not found')
    }
    const normalizedNumber = this.normalizeNumber(number)
    if (!normalizedNumber) {
      throw new Error('Phone number must contain digits')
    }
    const existing = topic.subscribers.find((sub) => sub.number === normalizedNumber)
    if (existing) {
      return { topic, created: false }
    }
    const now = new Date().toISOString()
    topic.subscribers.push({ number: normalizedNumber, subscribedAt: now })
    topic.updated = now
    this.save()
    return { topic, created: true }
  }

  public unsubscribe(topicId: string, number: string): { topic: PubSubTopic; removed: boolean } {
    const topic = this.getTopic(topicId)
    if (!topic) {
      throw new Error('Topic not found')
    }
    const normalizedNumber = this.normalizeNumber(number)
    if (!normalizedNumber) {
      throw new Error('Phone number must contain digits')
    }
    const prevLength = topic.subscribers.length
    topic.subscribers = topic.subscribers.filter((sub) => sub.number !== normalizedNumber)
    const removed = topic.subscribers.length !== prevLength
    if (removed) {
      topic.updated = new Date().toISOString()
      this.save()
    }
    return { topic, removed }
  }

  public getSubscriptionStatus(number: string): { number: string; normalized: string; topics: Array<Pick<PubSubTopic, 'id' | 'name'>> } {
    const normalized = this.normalizeNumber(number)
    if (!normalized) {
      throw new Error('Phone number must contain digits')
    }
    const topics = this.data.topics
      .filter((topic) => topic.subscribers.some((sub) => sub.number === normalized))
      .map((topic) => ({ id: topic.id, name: topic.name }))
    return { number, normalized, topics }
  }

  public getSettings(): PubSubSettings {
    return this.data.settings
  }

  public updateSettings(settings: { messageDelaySeconds?: number | undefined }): PubSubSettings {
    if (settings.messageDelaySeconds !== undefined) {
      if (settings.messageDelaySeconds < 0) {
        throw new Error('messageDelaySeconds must be zero or greater')
      }
      this.data.settings.messageDelaySeconds = settings.messageDelaySeconds
    }
    this.save()
    return this.data.settings
  }

  public async publish(topicId: string, message: string): Promise<PublishSummary> {
    const topic = this.getTopic(topicId)
    if (!topic) {
      throw new Error('Topic not found')
    }
    if (!message.trim()) {
      throw new Error('Message is required')
    }
    if (this.whatsappClient.getConnectionStatus() !== 'connected') {
      throw new Error('WhatsApp not connected')
    }
    const socket = this.whatsappClient.getSocket()
    if (!socket) {
      throw new Error('WhatsApp socket unavailable')
    }
    const delayMs = Math.max(0, Math.round(this.data.settings.messageDelaySeconds * 1000))
    const results: PublishResult[] = []
    let delivered = 0
    for (const [index, sub] of topic.subscribers.entries()) {
      const jid = this.formatJid(sub.number)
      try {
        const result = await socket.sendMessage(jid, { text: message })
        delivered += 1
        results.push({ number: sub.number, success: true })
        
        // Record sent message if Redis is configured
        if (isRedisConfigured && redis) {
          try {
            const rec = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
              ts: Date.now(),
              to: sub.number,
              chatId: jid,
              via: 'text' as const,
              bodyPreview: message.slice(0, 120),
              correlationId: `topic:${topicId}`,
              ...(result?.key?.id && { waMessageId: result.key.id })
            }
            await recordSent(rec)
            this.logger.info({ evt: 'sent_recorded', id: rec.id, to: rec.to, via: rec.via })
          } catch (err) {
            this.logger.error({ err }, 'Failed to record sent message')
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
        results.push({ number: sub.number, success: false, error: errorMessage })
        this.logger.error({ err, topicId, number: sub.number }, 'Failed to publish message to subscriber')
      }
      if (delayMs > 0 && index < topic.subscribers.length - 1) {
        await this.delay(delayMs)
      }
    }
    return {
      topic,
      attempted: topic.subscribers.length,
      delivered,
      results
    }
  }

  private normalizeNumber(number: string): string {
    return number.replace(/[^0-9]/g, '')
  }

  private formatJid(number: string): string {
    const normalized = this.normalizeNumber(number)
    return `${normalized}@s.whatsapp.net`
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}
