import cron, { type ScheduledTask } from 'node-cron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import pino from 'pino'
import type { ConnectionStatus, WhatsAppClient } from './whatsapp.js'
import type { MessageRecordingService } from './messageRecordingService.js'

export const scheduledMessageSchema = z.object({
  id: z.string(),
  number: z.string().optional(),
  jid: z.string().optional(),
  message: z.string(),
  schedule: z.string(),
  description: z.string().optional().default(''),
  oneTime: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  created: z.string(),
  updated: z.string(),
  scheduleDate: z.string().optional(), // ISO date string for one-time scheduled messages
  executed: z.boolean().optional().default(false) // Track if date-based message has been sent
})

export type ScheduledMessage = z.infer<typeof scheduledMessageSchema>

export class SchedulerService {
  private readonly dataFile: string
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' })
  private idToTask: Map<string, ScheduledTask> = new Map()
  private idToTimeout: Map<string, NodeJS.Timeout> = new Map() // For date-based schedules
  private messages: ScheduledMessage[] = []
  private whatsappClient: WhatsAppClient

  constructor(
    dataDir = path.resolve(process.cwd(), 'data'), 
    whatsappClient: WhatsAppClient,
    private readonly messageRecording?: MessageRecordingService
  ) {
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
      // Check if this is a date-based schedule
      if (msg.scheduleDate) {
        this.scheduleDateJob(msg)
        return
      }
      
      // Otherwise, use cron schedule
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
          const jid = this.formatJid(msg)
          const result = await sock.sendMessage(jid, { text: msg.message })
          this.logger.info({ id: msg.id }, 'Scheduled message sent')
          
          // Record sent message using the configured backend
          if (this.messageRecording) {
            try {
              const rec = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                ts: Date.now(),
                to: msg.number || msg.jid || '',
                chatId: jid,
                via: 'text' as const,
                bodyPreview: msg.message.slice(0, 120),
                correlationId: msg.id, // Use scheduled message ID as correlation
                ...(result?.key?.id && { waMessageId: result.key.id })
              }
              await this.messageRecording.recordSent(rec)
            } catch (err) {
              this.logger.error({ err }, 'Failed to record sent message')
            }
          }
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

  private scheduleDateJob(msg: ScheduledMessage) {
    if (!msg.scheduleDate || msg.executed) return
    
    const scheduledTime = new Date(msg.scheduleDate).getTime()
    const now = Date.now()
    const delay = scheduledTime - now
    
    if (delay <= 0) {
      // If the scheduled time has already passed, check if we should still send it
      if (delay > -60000) { // Within 1 minute past, still send
        this.sendScheduledMessage(msg)
      } else {
        this.logger.warn({ id: msg.id, scheduleDate: msg.scheduleDate }, 'Scheduled date has passed, marking as executed')
        this.markAsExecuted(msg.id)
      }
      return
    }
    
    // Schedule the message
    const timeout = setTimeout(async () => {
      await this.sendScheduledMessage(msg)
      this.idToTimeout.delete(msg.id)
    }, delay)
    
    this.idToTimeout.set(msg.id, timeout)
    this.logger.info({ id: msg.id, scheduleDate: msg.scheduleDate, delay }, 'Date-based message scheduled')
  }
  
  private async sendScheduledMessage(msg: ScheduledMessage) {
    const status: ConnectionStatus = this.whatsappClient.getConnectionStatus()
    if (status !== 'connected') {
      this.logger.warn('Skipping scheduled send: WhatsApp disconnected')
      return
    }
    try {
      const sock = this.whatsappClient.getSocket()
      if (!sock) return
      const jid = this.formatJid(msg)
      const result = await sock.sendMessage(jid, { text: msg.message })
      this.logger.info({ id: msg.id }, 'Scheduled message sent')
      
      // Record sent message using the configured backend
      if (this.messageRecording) {
        try {
          const rec = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
            ts: Date.now(),
            to: msg.number || msg.jid || '',
            chatId: jid,
            via: 'text' as const,
            bodyPreview: msg.message.slice(0, 120),
            correlationId: msg.id, // Use scheduled message ID as correlation
            ...(result?.key?.id && { waMessageId: result.key.id })
          }
          await this.messageRecording.recordSent(rec)
        } catch (err) {
          this.logger.error({ err }, 'Failed to record sent message')
        }
      }
      
      this.markAsExecuted(msg.id)
    } catch (err) {
      this.logger.error({ err }, 'Failed to send scheduled message')
    }
  }
  
  private markAsExecuted(id: string) {
    const idx = this.messages.findIndex((m) => m.id === id)
    if (idx === -1) return
    const message = this.messages[idx]
    if (message) {
      message.executed = true
      message.active = false
      message.updated = new Date().toISOString()
      this.save()
    }
  }

  private formatJid(msg: ScheduledMessage): string {
    if (msg.jid) {
      // Use the provided JID directly (for groups or already formatted numbers)
      return msg.jid
    } else if (msg.number) {
      // Check if the number field already contains a JID (e.g., group JID like 120363339062208504@g.us)
      if (msg.number.includes('@g.us') || msg.number.includes('@s.whatsapp.net') || msg.number.includes('@broadcast')) {
        // Already a JID, use it directly
        return msg.number
      }
      // Format the phone number as a JID
      const trimmed = msg.number.replace(/[^0-9]/g, '')
      return `${trimmed}@s.whatsapp.net`
    } else {
      throw new Error('No recipient specified')
    }
  }

  private restoreJobs() {
    for (const m of this.messages) {
      this.scheduleJob(m)
    }
  }

  public create(input: { number?: string; jid?: string; message: string; schedule: string; description?: string; oneTime?: boolean }): ScheduledMessage {
    if (!cron.validate(input.schedule)) {
      throw new Error('Invalid cron expression')
    }
    if (!input.number && !input.jid) {
      throw new Error('Either number or jid must be provided')
    }
    const now = new Date().toISOString()
    const msg: ScheduledMessage = {
      id: uuidv4(),
      number: input.number,
      jid: input.jid,
      message: input.message,
      schedule: input.schedule,
      description: input.description || '',
      oneTime: Boolean(input.oneTime),
      active: true,
      created: now,
      updated: now,
      executed: false
    }
    this.messages.push(msg)
    this.save()
    this.scheduleJob(msg)
    return msg
  }
  
  public createDateSchedule(input: { number?: string; jid?: string; message: string; scheduleDate: string; description?: string }): ScheduledMessage {
    // Validate the date
    const scheduledTime = new Date(input.scheduleDate)
    if (isNaN(scheduledTime.getTime())) {
      throw new Error('Invalid date format')
    }
    
    if (!input.number && !input.jid) {
      throw new Error('Either number or jid must be provided')
    }
    
    // Check if date is in the past (allow 1 minute grace period)
    const now = Date.now()
    if (scheduledTime.getTime() < now - 60000) {
      throw new Error('Scheduled date is in the past')
    }
    
    const nowIso = new Date().toISOString()
    const msg: ScheduledMessage = {
      id: uuidv4(),
      number: input.number,
      jid: input.jid,
      message: input.message,
      schedule: '', // Empty for date-based schedules
      scheduleDate: input.scheduleDate,
      description: input.description || '',
      oneTime: true, // Date-based schedules are always one-time
      active: true,
      created: nowIso,
      updated: nowIso,
      executed: false
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
    
    // Validate scheduleDate if provided
    if (updates.scheduleDate) {
      const scheduledTime = new Date(updates.scheduleDate)
      if (isNaN(scheduledTime.getTime())) {
        throw new Error('Invalid date format')
      }
      if (scheduledTime.getTime() < Date.now() - 60000) {
        throw new Error('Scheduled date is in the past')
      }
    }
    
    const next: ScheduledMessage = {
      id: prev.id,
      number: updates.number !== undefined ? updates.number : prev.number,
      jid: updates.jid !== undefined ? updates.jid : prev.jid,
      message: updates.message ?? prev.message,
      schedule: updates.schedule ?? prev.schedule,
      scheduleDate: updates.scheduleDate ?? prev.scheduleDate,
      description: updates.description ?? prev.description,
      oneTime: updates.oneTime ?? prev.oneTime,
      active: updates.active ?? prev.active,
      executed: updates.executed ?? prev.executed,
      created: prev.created,
      updated: new Date().toISOString()
    }
    
    // Validate that at least one recipient (number or jid) remains after update
    if (!next.number && !next.jid) {
      throw new Error('Either number or jid must be provided')
    }
    this.messages[idx] = next
    this.save()
    
    // Clear existing schedules
    const existingTask = this.idToTask.get(id)
    if (existingTask) {
      existingTask.stop()
      existingTask.destroy()
      this.idToTask.delete(id)
    }
    
    const existingTimeout = this.idToTimeout.get(id)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      this.idToTimeout.delete(id)
    }
    
    // Reschedule
    this.scheduleJob(next)
    return next
  }

  public delete(id: string) {
    const idx = this.messages.findIndex((m) => m.id === id)
    if (idx === -1) return false
    
    // Clear cron task if exists
    const existingTask = this.idToTask.get(id)
    if (existingTask) {
      existingTask.stop()
      existingTask.destroy()
      this.idToTask.delete(id)
    }
    
    // Clear timeout if exists (for date-based schedules)
    const existingTimeout = this.idToTimeout.get(id)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      this.idToTimeout.delete(id)
    }
    
    this.messages.splice(idx, 1)
    this.save()
    return true
  }

  public toggle(id: string, nextActive?: boolean) {
    const idx = this.messages.findIndex((m) => m.id === id)
    if (idx === -1) return null
    
    const current = this.messages[idx] as ScheduledMessage
    const shouldActivate = nextActive ?? !current.active
    current.active = shouldActivate
    current.updated = new Date().toISOString()
    
    // Handle cron-based schedules
    const task = this.idToTask.get(id)
    if (task) {
      if (shouldActivate) task.start()
      else task.stop()
    }
    
    // Handle date-based schedules
    const timeout = this.idToTimeout.get(id)
    if (current.scheduleDate) {
      if (shouldActivate && !current.executed) {
        // Re-schedule if activating
        if (timeout) {
          clearTimeout(timeout)
          this.idToTimeout.delete(id)
        }
        this.scheduleDateJob(current)
      } else if (!shouldActivate && timeout) {
        // Cancel if deactivating
        clearTimeout(timeout)
        this.idToTimeout.delete(id)
      }
    }
    
    this.save()
    return this.messages[idx]
  }
}

// Instantiated in server.ts with configured storage paths
