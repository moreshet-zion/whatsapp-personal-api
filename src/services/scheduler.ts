import cron, { type ScheduledTask } from 'node-cron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import pino from 'pino'
import type { ConnectionStatus, WhatsAppClient } from './whatsapp.js'

export const scheduledMessageSchema = z.object({
  id: z.string(),
  number: z.string(),
  message: z.string(),
  schedule: z.string(),
  description: z.string().optional().default(''),
  oneTime: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  created: z.string(),
  updated: z.string()
})

export type ScheduledMessage = z.infer<typeof scheduledMessageSchema>

export class SchedulerService {
  private readonly dataFile: string
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' })
  private idToTask: Map<string, ScheduledTask> = new Map()
  private messages: ScheduledMessage[] = []
  private whatsappClient: WhatsAppClient

  constructor(dataDir = path.resolve(process.cwd(), 'data'), whatsappClient: WhatsAppClient) {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    this.dataFile = path.join(dataDir, 'scheduled.json')
    this.whatsappClient = whatsappClient
    this.load()
    this.restoreJobs()
  }

  private load() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8')
        const rawMessages = JSON.parse(raw)
        // Apply schema validation and defaults for backwards compatibility
        this.messages = rawMessages.map((msg: any) => scheduledMessageSchema.parse(msg))
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to load scheduled messages')
      this.messages = []
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.messages, null, 2))
    } catch (err) {
      this.logger.error({ err }, 'Failed to save scheduled messages')
    }
  }

  public list(): ScheduledMessage[] {
    return this.messages
  }

  public activeJobs(): number {
    return Array.from(this.idToTask.values()).filter((t) => t.getStatus() === 'scheduled').length
  }

  private scheduleJob(msg: ScheduledMessage) {
    try {
      if (!cron.validate(msg.schedule)) throw new Error('Invalid cron expression')
      const task = cron.schedule(msg.schedule, async () => {
        const status: ConnectionStatus = this.whatsappClient.getConnectionStatus()
        if (status !== 'connected') {
          this.logger.warn('Skipping scheduled send: WhatsApp disconnected')
          return
        }
        try {
          const sock = this.whatsappClient.getSocket()
          if (!sock) return
          const jid = this.formatJid(msg.number)
          await sock.sendMessage(jid, { text: msg.message })
          this.logger.info({ id: msg.id }, 'Scheduled message sent')
          if (msg.oneTime) {
            this.toggle(msg.id, false)
          }
        } catch (err) {
          this.logger.error({ err }, 'Failed to send scheduled message')
        }
      })
      this.idToTask.set(msg.id, task)
      if (msg.active) task.start()
    } catch (err) {
      this.logger.error({ err }, 'Failed to create cron job')
    }
  }

  private formatJid(number: string) {
    const trimmed = number.replace(/[^0-9]/g, '')
    return `${trimmed}@s.whatsapp.net`
  }

  private restoreJobs() {
    for (const m of this.messages) {
      this.scheduleJob(m)
    }
  }

  public create(input: { number: string; message: string; schedule: string; description?: string; oneTime?: boolean }): ScheduledMessage {
    if (!cron.validate(input.schedule)) {
      throw new Error('Invalid cron expression')
    }
    const now = new Date().toISOString()
    const msg: ScheduledMessage = {
      id: uuidv4(),
      number: input.number,
      message: input.message,
      schedule: input.schedule,
      description: input.description || '',
      oneTime: Boolean(input.oneTime),
      active: true,
      created: now,
      updated: now
    }
    this.messages.push(msg)
    this.save()
    this.scheduleJob(msg)
    return msg
  }

  public update(id: string, updates: Partial<Omit<ScheduledMessage, 'id' | 'created'>>) {
    const idx = this.messages.findIndex((m) => m.id === id)
    if (idx === -1) return null
    const prev = this.messages[idx] as ScheduledMessage
    const next: ScheduledMessage = {
      id: prev.id,
      number: updates.number ?? prev.number,
      message: updates.message ?? prev.message,
      schedule: updates.schedule ?? prev.schedule,
      description: updates.description ?? prev.description,
      oneTime: updates.oneTime ?? prev.oneTime,
      active: updates.active ?? prev.active,
      created: prev.created,
      updated: new Date().toISOString()
    }
    this.messages[idx] = next
    this.save()
    // reschedule if needed
    const existing = this.idToTask.get(id)
    if (existing) {
      existing.stop()
      existing.destroy()
      this.idToTask.delete(id)
    }
    this.scheduleJob(next)
    return next
  }

  public delete(id: string) {
    const idx = this.messages.findIndex((m) => m.id === id)
    if (idx === -1) return false
    const existing = this.idToTask.get(id)
    if (existing) {
      existing.stop()
      existing.destroy()
      this.idToTask.delete(id)
    }
    this.messages.splice(idx, 1)
    this.save()
    return true
  }

  public toggle(id: string, nextActive?: boolean) {
    const idx = this.messages.findIndex((m) => m.id === id)
    if (idx === -1) return null
    const task = this.idToTask.get(id)
    if (!task) return null
    const current = this.messages[idx] as ScheduledMessage
    const shouldActivate = nextActive ?? !current.active
    current.active = shouldActivate
    current.updated = new Date().toISOString()
    if (shouldActivate) task.start()
    else task.stop()
    this.save()
    return this.messages[idx]
  }
}

// Instantiated in server.ts with configured storage paths
