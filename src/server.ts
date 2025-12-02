import express from 'express'
import dotenv from 'dotenv'
import pino from 'pino'
import path from 'path'
import QRCode from 'qrcode'
import { z } from 'zod'
import { WhatsAppClient } from './services/whatsapp.js'
import { SchedulerService } from './services/scheduler.js'
import { PubSubService } from './services/pubsub.js'
import { apiKeyAuth } from './middleware/auth.js'
import { redis } from './infra/redis.js'
import { createRedisHealthHandler } from './routes/redisHealth.js'
import { SettingsService } from './services/settingsService.js'
import { MessageRecordingService } from './services/messageRecordingService.js'
import { OpenAIService } from './services/openaiService.js'

dotenv.config({ path: process.env.ENV_PATH || '.env' })

const STORAGE_DIR = process.env.STORAGE_DIR || process.cwd()
const sessionsDir = path.resolve(STORAGE_DIR, 'sessions')
const dataDir = path.resolve(STORAGE_DIR, 'data')
export const app = express()
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

app.use(express.json())
app.use(apiKeyAuth)

const PORT = Number(process.env.PORT || 3000)

// Instantiate services after env loaded
const whatsappClient = new WhatsAppClient(sessionsDir)
const settingsService = new SettingsService(dataDir)
const messageRecording = new MessageRecordingService(settingsService)
const scheduler = new SchedulerService(dataDir, whatsappClient, messageRecording)
const pubSub = new PubSubService(dataDir, whatsappClient, messageRecording)

// Initialize OpenAI service with settings
const settings = settingsService.getSettings()
const openaiConfig = settings.openai ? {
  apiKey: settings.openai.apiKey,
  keyword: settings.openai.keyword,
  enabled: settings.openai.enabled ?? false,
  model: settings.openai.model ?? 'gpt-3.5-turbo'
} : {}
const openaiService = new OpenAIService(openaiConfig, messageRecording)

// Set up inbound message handler for recording and OpenAI processing
whatsappClient.setMessageHandler(async (message) => {
  try {
    await messageRecording.recordInbound(message)
    
    // Check if message should be processed by OpenAI
    if (openaiService.shouldProcessMessage(message)) {
      try {
        const response = await openaiService.processMessage(message)
        if (response && whatsappClient.getConnectionStatus() === 'connected') {
          const sock = whatsappClient.getSocket()
          if (sock) {
            await sock.sendMessage(message.chatId, { text: response })
            logger.info({ messageId: message.id, chatId: message.chatId }, 'OpenAI response sent')
          }
        }
      } catch (err) {
        logger.error({ err, messageId: message.id }, 'Failed to process message with OpenAI')
      }
    }
  } catch (err) {
    logger.error({ err, messageId: message.id }, 'Failed to record inbound message')
  }
})

// Start WhatsApp client
whatsappClient.start().catch((err) => logger.error({ err }, 'Failed to start WhatsApp client'))

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: whatsappClient.getConnectionStatus(),
    timestamp: new Date().toISOString(),
    scheduledMessages: scheduler.list().length,
    activeJobs: scheduler.activeJobs()
  })
})

app.get('/health/redis', createRedisHealthHandler(redis))

// Memory usage endpoint for monitoring
app.get('/health/memory', (req, res) => {
  const used = process.memoryUsage()
  const formatMB = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`
  
  res.json({
    rss: formatMB(used.rss),
    heapTotal: formatMB(used.heapTotal),
    heapUsed: formatMB(used.heapUsed),
    external: formatMB(used.external),
    arrayBuffers: formatMB(used.arrayBuffers),
    uptime: process.uptime(),
    uptimeFormatted: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
  })
})

// QR endpoint
app.get('/qr', async (req, res) => {
  if (whatsappClient.getConnectionStatus() === 'connected') {
    return res.json({ success: false, message: 'Already authenticated' })
  }
  const qrState = whatsappClient.getQR()
  if (!qrState || !qrState.qrString) {
    return res.json({ success: false, message: 'QR code not available yet, please wait...' })
  }
  const qrImage = await QRCode.toDataURL(qrState.qrString)
  return res.json({ success: true, qr: qrState.qrString, qrImage })
})

// QR HTML page
app.get('/qr-image', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  if (whatsappClient.getConnectionStatus() === 'connected') {
    return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp QR</title></head><body><h1>Already authenticated</h1><p>Your WhatsApp session is connected.</p></body></html>`)
  }
  const qrState = whatsappClient.getQR()
  if (!qrState || !qrState.qrString) {
    return res.send(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>WhatsApp QR</title></head><body><h1>QR not available yet</h1><p>Please wait... this page will auto-refresh.</p></body></html>`)
  }
  const dataUrl = await QRCode.toDataURL(qrState.qrString)
  return res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp QR</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#111;color:#eee} .card{background:#1c1c1c;padding:24px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.3);text-align:center} img{width:320px;height:320px} p{opacity:.8}</style></head><body><div class="card"><h1>Scan to Link WhatsApp</h1><img alt="WhatsApp QR" src="${dataUrl}"><p>Open WhatsApp → Linked devices → Link a device</p><p><small>This page auto-refreshes on reload if the code expires.</small></p></div></body></html>`)
})

// Get group chats
app.get('/groups', async (req, res) => {
  if (whatsappClient.getConnectionStatus() !== 'connected') {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' })
  }
  try {
    const groups = await whatsappClient.getGroupChats()
    return res.json({ success: true, groups })
  } catch (err) {
    logger.error({ err }, 'Failed to fetch groups')
    return res.status(500).json({ success: false, error: 'Failed to fetch groups' })
  }
})

// Send message - now supports both phone numbers and JIDs
const sendBodySchema = z.object({ 
  number: z.string().optional(), 
  jid: z.string().optional(),
  message: z.string() 
}).refine(data => data.number || data.jid, {
  message: "Either 'number' or 'jid' must be provided"
})

app.post('/send', async (req, res) => {
  const parse = sendBodySchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters. Either number or jid must be provided.' })
  }
  if (whatsappClient.getConnectionStatus() !== 'connected') {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' })
  }
  try {
    const sock = whatsappClient.getSocket()
    if (!sock) throw new Error('Socket not available')
    
    let warning: string | undefined
    
    // Determine the JID to use
    let jid: string
    if (parse.data.jid) {
      // Check if jid field contains a phone number instead of JID
      if (!parse.data.jid.includes('@')) {
        // Phone number in jid field
        jid = `${parse.data.jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`
        warning = `Phone number detected in 'jid' field. Automatically formatted. Please use 'number' field for phone numbers (e.g., ${parse.data.jid}).`
        logger.warn({ jid: parse.data.jid }, 'Phone number detected in jid field')
      } else {
        // Use the provided JID directly (for groups or already formatted numbers)
        jid = parse.data.jid
      }
    } else if (parse.data.number) {
      // Check if the number field already contains a JID (e.g., group JID like 120363339062208504@g.us)
      if (parse.data.number.includes('@g.us') || parse.data.number.includes('@s.whatsapp.net') || parse.data.number.includes('@broadcast')) {
        // Already a JID, use it directly
        jid = parse.data.number
        warning = `JID detected in 'number' field. Please use 'jid' field for group/broadcast identifiers (e.g., ${parse.data.number}).`
        logger.warn({ number: parse.data.number }, 'JID detected in number field')
      } else {
        // Format the phone number as a JID
        jid = `${parse.data.number.replace(/[^0-9]/g, '')}@s.whatsapp.net`
      }
    } else {
      throw new Error('No recipient specified')
    }
    
    const result = await sock.sendMessage(jid, { text: parse.data.message })
    
    // Record sent message using the configured backend
    try {
      const rec = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        ts: Date.now(),
        to: parse.data.number || parse.data.jid || '',
        chatId: jid,
        via: 'text' as const,
        bodyPreview: parse.data.message.slice(0, 120),
        ...(result?.key?.id && { waMessageId: result.key.id })
      }
      await messageRecording.recordSent(rec)
    } catch (err) {
      // Don't fail the request if recording fails
      logger.error({ err }, 'Failed to record sent message')
    }
    
    const response: any = { success: true, message: 'Message sent successfully' }
    if (warning) response.warning = warning
    return res.json(response)
  } catch (err) {
    logger.error({ err }, 'Failed to send message')
    return res.status(500).json({ success: false, error: 'Failed to send message' })
  }
})

// Scheduled messages
app.get('/scheduled', (req, res) => {
  const { active, oneTime, executed } = req.query
  let messages = scheduler.list()
  
  // Filter by active status if specified
  if (active !== undefined) {
    const isActive = active === 'true'
    messages = messages.filter(m => m.active === isActive)
  }
  
  // Filter by oneTime status if specified  
  if (oneTime !== undefined) {
    const isOneTime = oneTime === 'true'
    messages = messages.filter(m => m.oneTime === isOneTime)
  }
  
  // Filter by executed status if specified
  if (executed !== undefined) {
    const isExecuted = executed === 'true'
    messages = messages.filter(m => m.executed === isExecuted)
  }
  
  res.json({ success: true, scheduledMessages: messages })
})

const createScheduledSchema = z.object({
  number: z.string().optional(),
  jid: z.string().optional(),
  message: z.string(),
  schedule: z.string(),
  description: z.string().optional(),
  oneTime: z.boolean().optional()
}).refine(data => data.number || data.jid, {
  message: "Either 'number' or 'jid' must be provided"
})

app.post('/scheduled', (req, res) => {
  const parse = createScheduledSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters. Either number or jid must be provided.' })
  }
  try {
    const data: Parameters<typeof scheduler.create>[0] = {
      message: parse.data.message,
      schedule: parse.data.schedule,
      description: parse.data.description ?? '',
      oneTime: parse.data.oneTime ?? false
    }
    
    let warning: string | undefined
    
    // Normalize: if number field contains a JID, move it to jid field
    if (parse.data.number && (parse.data.number.includes('@g.us') || parse.data.number.includes('@s.whatsapp.net') || parse.data.number.includes('@broadcast'))) {
      // JID was mistakenly placed in number field
      if (!parse.data.jid) {
        data.jid = parse.data.number
        warning = `JID detected in 'number' field. Automatically moved to 'jid' field. Please use 'jid' field for group/broadcast identifiers (e.g., ${parse.data.number}).`
        logger.warn({ number: parse.data.number }, 'JID detected in number field, moved to jid field')
      } else {
        // Both provided, prefer jid field and ignore number
        data.jid = parse.data.jid
        warning = `JID provided in both 'number' and 'jid' fields. Using 'jid' field value (${parse.data.jid}). The 'number' field should contain phone numbers only.`
        logger.warn({ number: parse.data.number, jid: parse.data.jid }, 'JID provided in both fields, using jid field')
      }
    } else if (parse.data.jid && !parse.data.jid.includes('@')) {
      // Phone number was placed in jid field
      if (!parse.data.number) {
        data.number = parse.data.jid
        warning = `Phone number detected in 'jid' field. Automatically moved to 'number' field. Please use 'number' field for phone numbers (e.g., ${parse.data.jid}).`
        logger.warn({ jid: parse.data.jid }, 'Phone number detected in jid field, moved to number field')
      } else {
        // Both provided, prefer number field for phone numbers
        data.number = parse.data.number
        warning = `Phone number provided in both 'number' and 'jid' fields. Using 'number' field value (${parse.data.number}). The 'jid' field should contain JIDs with @ symbol.`
        logger.warn({ number: parse.data.number, jid: parse.data.jid }, 'Phone number provided in both fields, using number field')
      }
    } else {
      // Normal case: assign as provided
      if (parse.data.number) data.number = parse.data.number
      if (parse.data.jid) data.jid = parse.data.jid
    }
    
    const msg = scheduler.create(data)
    const response: any = { success: true, message: 'Scheduled message created', scheduledMessage: msg }
    if (warning) response.warning = warning
    res.json(response)
  } catch (err) {
    return res.status(400).json({ success: false, error: (err as Error).message || 'Invalid cron schedule' })
  }
})

const updateScheduledSchema = z.object({
  number: z.string().optional(),
  jid: z.string().optional(),
  message: z.string().optional(),
  schedule: z.string().optional(),
  scheduleDate: z.string().optional(),
  description: z.string().optional(),
  oneTime: z.boolean().optional(),
  active: z.boolean().optional()
})
app.put('/scheduled/:id', (req, res) => {
  const parse = updateScheduledSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  try {
    const updates: any = {}
    let warning: string | undefined
    
    // Normalize: if number field contains a JID, move it to jid field
    if (parse.data.number !== undefined && parse.data.number && (parse.data.number.includes('@g.us') || parse.data.number.includes('@s.whatsapp.net') || parse.data.number.includes('@broadcast'))) {
      // JID was mistakenly placed in number field
      if (parse.data.jid === undefined) {
        updates.jid = parse.data.number
        updates.number = undefined // Clear the number field
        warning = `JID detected in 'number' field. Automatically moved to 'jid' field. Please use 'jid' field for group/broadcast identifiers (e.g., ${parse.data.number}).`
        logger.warn({ number: parse.data.number }, 'JID detected in number field during update, moved to jid field')
      } else {
        // Both provided, prefer jid field
        updates.jid = parse.data.jid
        updates.number = undefined // Clear the number field
        warning = `JID provided in both 'number' and 'jid' fields. Using 'jid' field value (${parse.data.jid}). The 'number' field should contain phone numbers only.`
        logger.warn({ number: parse.data.number, jid: parse.data.jid }, 'JID provided in both fields during update, using jid field')
      }
    } else if (parse.data.jid !== undefined && parse.data.jid && !parse.data.jid.includes('@')) {
      // Phone number was placed in jid field
      if (parse.data.number === undefined) {
        updates.number = parse.data.jid
        updates.jid = undefined // Clear the jid field
        warning = `Phone number detected in 'jid' field. Automatically moved to 'number' field. Please use 'number' field for phone numbers (e.g., ${parse.data.jid}).`
        logger.warn({ jid: parse.data.jid }, 'Phone number detected in jid field during update, moved to number field')
      } else {
        // Both provided, prefer number field for phone numbers
        updates.number = parse.data.number
        updates.jid = undefined // Clear the jid field
        warning = `Phone number provided in both 'number' and 'jid' fields. Using 'number' field value (${parse.data.number}). The 'jid' field should contain JIDs with @ symbol.`
        logger.warn({ number: parse.data.number, jid: parse.data.jid }, 'Phone number provided in both fields during update, using number field')
      }
    } else {
      // Normal case: assign as provided
      if (parse.data.number !== undefined) updates.number = parse.data.number
      if (parse.data.jid !== undefined) updates.jid = parse.data.jid
    }
    
    if (parse.data.message !== undefined) updates.message = parse.data.message
    if (parse.data.schedule !== undefined) updates.schedule = parse.data.schedule
    if (parse.data.scheduleDate !== undefined) updates.scheduleDate = parse.data.scheduleDate
    if (parse.data.description !== undefined) updates.description = parse.data.description
    if (parse.data.oneTime !== undefined) updates.oneTime = parse.data.oneTime
    if (parse.data.active !== undefined) updates.active = parse.data.active
    const updated = scheduler.update(req.params.id, updates)
    if (!updated) return res.status(404).json({ success: false, error: 'Scheduled message not found' })
    const response: any = { success: true, message: 'Scheduled message updated', scheduledMessage: updated }
    if (warning) response.warning = warning
    res.json(response)
  } catch (err) {
    return res.status(400).json({ success: false, error: (err as Error).message })
  }
})

app.delete('/scheduled/:id', (req, res) => {
  const ok = scheduler.delete(req.params.id)
  if (!ok) return res.status(404).json({ success: false, error: 'Scheduled message not found' })
  res.json({ success: true, message: 'Scheduled message deleted' })
})

app.post('/scheduled/:id/toggle', (req, res) => {
  const toggled = scheduler.toggle(req.params.id)
  if (!toggled) return res.status(404).json({ success: false, error: 'Scheduled message not found' })
  res.json({ success: true, message: toggled.active ? 'Scheduled message activated' : 'Scheduled message deactivated', scheduledMessage: toggled })
})

// Normalize scheduled messages - fix messages with JIDs in the wrong field
app.post('/scheduled/normalize', (req, res) => {
  try {
    const result = scheduler.normalizeAllMessages()
    res.json({ 
      success: true, 
      message: `Normalized ${result.fixed} scheduled message(s)`, 
      fixed: result.fixed,
      totalMessages: result.messages.length 
    })
  } catch (err) {
    logger.error({ err }, 'Failed to normalize scheduled messages')
    return res.status(500).json({ success: false, error: 'Failed to normalize scheduled messages' })
  }
})

// Schedule a one-time message at a specific date/time
const scheduleDateSchema = z.object({
  number: z.string().optional(),
  jid: z.string().optional(),
  message: z.string(),
  scheduleDate: z.string(), // ISO 8601 date string
  description: z.string().optional()
}).refine(data => data.number || data.jid, {
  message: "Either 'number' or 'jid' must be provided"
})

app.post('/scheduleDate', (req, res) => {
  const parse = scheduleDateSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters. Either number or jid must be provided.' })
  }
  try {
    const data: Parameters<typeof scheduler.createDateSchedule>[0] = {
      message: parse.data.message,
      scheduleDate: parse.data.scheduleDate,
      description: parse.data.description || ''
    }
    
    let warning: string | undefined
    
    // Normalize: if number field contains a JID, move it to jid field
    if (parse.data.number && (parse.data.number.includes('@g.us') || parse.data.number.includes('@s.whatsapp.net') || parse.data.number.includes('@broadcast'))) {
      // JID was mistakenly placed in number field
      if (!parse.data.jid) {
        data.jid = parse.data.number
        warning = `JID detected in 'number' field. Automatically moved to 'jid' field. Please use 'jid' field for group/broadcast identifiers (e.g., ${parse.data.number}).`
        logger.warn({ number: parse.data.number }, 'JID detected in number field, moved to jid field')
      } else {
        // Both provided, prefer jid field and ignore number
        data.jid = parse.data.jid
        warning = `JID provided in both 'number' and 'jid' fields. Using 'jid' field value (${parse.data.jid}). The 'number' field should contain phone numbers only.`
        logger.warn({ number: parse.data.number, jid: parse.data.jid }, 'JID provided in both fields, using jid field')
      }
    } else if (parse.data.jid && !parse.data.jid.includes('@')) {
      // Phone number was placed in jid field
      if (!parse.data.number) {
        data.number = parse.data.jid
        warning = `Phone number detected in 'jid' field. Automatically moved to 'number' field. Please use 'number' field for phone numbers (e.g., ${parse.data.jid}).`
        logger.warn({ jid: parse.data.jid }, 'Phone number detected in jid field, moved to number field')
      } else {
        // Both provided, prefer number field for phone numbers
        data.number = parse.data.number
        warning = `Phone number provided in both 'number' and 'jid' fields. Using 'number' field value (${parse.data.number}). The 'jid' field should contain JIDs with @ symbol.`
        logger.warn({ number: parse.data.number, jid: parse.data.jid }, 'Phone number provided in both fields, using number field')
      }
    } else {
      // Normal case: assign as provided
      if (parse.data.number) data.number = parse.data.number
      if (parse.data.jid) data.jid = parse.data.jid
    }
    
    const msg = scheduler.createDateSchedule(data)
    const response: any = { success: true, message: 'Date-based scheduled message created', scheduledMessage: msg }
    if (warning) response.warning = warning
    res.json(response)
  } catch (err) {
    return res.status(400).json({ success: false, error: (err as Error).message })
  }
})

// Pub/Sub Topics
const createTopicSchema = z.object({
  name: z.string().min(1, 'Topic name is required'),
  description: z.string().optional()
})

app.get('/pubsub/topics', (_req, res) => {
  res.json({ success: true, topics: pubSub.listTopics() })
})

app.post('/pubsub/topics', (req, res) => {
  const parse = createTopicSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  try {
    const topic = pubSub.createTopic(parse.data)
    res.status(201).json({ success: true, message: 'Topic created', topic })
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message })
  }
})

app.delete('/pubsub/topics/:id', (req, res) => {
  const deleted = pubSub.deleteTopic(req.params.id)
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Topic not found' })
  }
  res.json({ success: true, message: 'Topic deleted' })
})

app.get('/pubsub/topics/:id', (req, res) => {
  const topic = pubSub.getTopic(req.params.id)
  if (!topic) {
    return res.status(404).json({ success: false, error: 'Topic not found' })
  }
  res.json({ success: true, topic })
})

app.get('/pubsub/topics/:id/subscribers', (req, res) => {
  const subscribers = pubSub.listSubscribers(req.params.id)
  if (!subscribers) {
    return res.status(404).json({ success: false, error: 'Topic not found' })
  }
  res.json({ success: true, subscribers })
})

const subscriberSchema = z.object({
  number: z.string().min(1, 'Phone number is required')
})

app.post('/pubsub/topics/:id/subscribers', (req, res) => {
  const parse = subscriberSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  try {
    const result = pubSub.subscribe(req.params.id, parse.data.number)
    res.json({ success: true, message: result.created ? 'Subscribed to topic' : 'Already subscribed', topic: result.topic })
  } catch (err) {
    res.status(404).json({ success: false, error: (err as Error).message })
  }
})

app.delete('/pubsub/topics/:id/subscribers', (req, res) => {
  const parse = subscriberSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  try {
    const result = pubSub.unsubscribe(req.params.id, parse.data.number)
    res.json({ success: true, message: result.removed ? 'Unsubscribed from topic' : 'Not subscribed', topic: result.topic })
  } catch (err) {
    res.status(404).json({ success: false, error: (err as Error).message })
  }
})

app.get('/pubsub/subscriptions/:number', (req, res) => {
  try {
    const status = pubSub.getSubscriptionStatus(req.params.number)
    res.json({ success: true, subscription: status })
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message })
  }
})

const publishSchema = z.object({
  topicId: z.string(),
  message: z.string()
})

app.post('/pubsub/publish', async (req, res) => {
  const parse = publishSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  try {
    const summary = await pubSub.publish(parse.data.topicId, parse.data.message)
    res.json({ success: true, message: 'Message broadcast completed', summary })
  } catch (err) {
    const message = (err as Error).message
    const status = message === 'WhatsApp not connected' || message === 'WhatsApp socket unavailable' ? 503 : message === 'Topic not found' ? 404 : 400
    res.status(status).json({ success: false, error: message })
  }
})

const settingsSchema = z.object({
  messageDelaySeconds: z.number().min(0).optional()
})

app.get('/pubsub/settings', (_req, res) => {
  res.json({ success: true, settings: pubSub.getSettings() })
})

app.put('/pubsub/settings', (req, res) => {
  const parse = settingsSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  try {
    const settings = pubSub.updateSettings(parse.data)
    res.json({ success: true, message: 'Settings updated', settings })
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message })
  }
})

// Bulk operations for scheduled messages
const bulkOperationSchema = z.object({
  ids: z.array(z.string()),
  action: z.enum(['activate', 'deactivate', 'delete'])
})

app.post('/scheduled/bulk', (req, res) => {
  const parse = bulkOperationSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  
  const { ids, action } = parse.data
  const results: { success: string[], failed: Array<{ id: string, error: string }> } = { success: [], failed: [] }
  
  for (const id of ids) {
    try {
      if (action === 'delete') {
        const deleted = scheduler.delete(id)
        if (deleted) {
          results.success.push(id)
        } else {
          results.failed.push({ id, error: 'Not found' })
        }
      } else if (action === 'activate' || action === 'deactivate') {
        const toggled = scheduler.toggle(id, action === 'activate')
        if (toggled) {
          results.success.push(id)
        } else {
          results.failed.push({ id, error: 'Not found' })
        }
      }
    } catch (err) {
      results.failed.push({ id, error: (err as Error).message })
    }
  }
  
  res.json({ 
    success: true, 
    message: `Bulk ${action} completed`, 
    results: {
      processed: ids.length,
      successful: results.success.length,
      failed: results.failed.length,
      successfulIds: results.success,
      failures: results.failed
    }
  })
})

// Restart session
app.post('/restart', async (req, res) => {
  try {
    await whatsappClient.restart()
    res.json({ success: true, message: 'WhatsApp session restart initiated' })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to restart' })
  }
})

// Settings endpoints
app.get('/settings', (req, res) => {
  try {
    const settings = settingsService.getSettings()
    res.json({ success: true, settings })
  } catch (err) {
    logger.error({ err }, 'Failed to get settings')
    res.status(500).json({ success: false, error: 'Failed to get settings' })
  }
})

const updateSettingsSchema = z.object({
  history_backend: z.enum(['redis', 'base44']).optional(),
  openai: z.object({
    apiKey: z.string().optional(),
    keyword: z.string().optional(),
    enabled: z.boolean().optional(),
    model: z.string().optional()
  }).optional()
})

app.put('/settings', (req, res) => {
  const parse = updateSettingsSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid settings format', details: parse.error.issues })
  }
  
  try {
    const updates: any = {}
    if (parse.data.history_backend !== undefined) {
      updates.history_backend = parse.data.history_backend
    }
    if (parse.data.openai !== undefined) {
      updates.openai = parse.data.openai
      // Sync OpenAI service config
      const openaiUpdates: Partial<import('./services/openaiService.js').OpenAIConfig> = {}
      if (parse.data.openai.apiKey !== undefined) openaiUpdates.apiKey = parse.data.openai.apiKey
      if (parse.data.openai.keyword !== undefined) openaiUpdates.keyword = parse.data.openai.keyword
      if (parse.data.openai.enabled !== undefined) openaiUpdates.enabled = parse.data.openai.enabled
      if (parse.data.openai.model !== undefined) openaiUpdates.model = parse.data.openai.model
      openaiService.updateConfig(openaiUpdates)
    }
    const updatedSettings = settingsService.updateSettings(updates)
    res.json({ success: true, message: 'Settings updated', settings: updatedSettings })
  } catch (err) {
    logger.error({ err }, 'Failed to update settings')
    const message = err instanceof Error ? err.message : 'Failed to update settings'
    res.status(400).json({ success: false, error: message })
  }
})

app.get('/settings/recording-status', async (req, res) => {
  try {
    const status = await messageRecording.getBackendStatus()
    res.json({ success: true, recording: status })
  } catch (err) {
    logger.error({ err }, 'Failed to get recording status')
    res.status(500).json({ success: false, error: 'Failed to get recording status' })
  }
})

// OpenAI configuration endpoints
app.get('/openai/config', (req, res) => {
  try {
    const config = openaiService.getConfig()
    // Don't expose the full API key in response for security
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : undefined
    }
    res.json({ success: true, config: safeConfig })
  } catch (err) {
    logger.error({ err }, 'Failed to get OpenAI config')
    res.status(500).json({ success: false, error: 'Failed to get OpenAI config' })
  }
})

const updateOpenAIConfigSchema = z.object({
  apiKey: z.string().optional(),
  keyword: z.string().optional(),
  enabled: z.boolean().optional(),
  model: z.string().optional()
})

app.put('/openai/config', (req, res) => {
  const parse = updateOpenAIConfigSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid OpenAI config format', details: parse.error.issues })
  }
  
  try {
    // Update OpenAI service config
    openaiService.updateConfig(parse.data)
    
    // Also update settings service for persistence
    const currentSettings = settingsService.getSettings()
    const openaiSettings: any = { ...currentSettings.openai }
    if (parse.data.apiKey !== undefined) openaiSettings.apiKey = parse.data.apiKey
    if (parse.data.keyword !== undefined) openaiSettings.keyword = parse.data.keyword
    if (parse.data.enabled !== undefined) openaiSettings.enabled = parse.data.enabled
    if (parse.data.model !== undefined) openaiSettings.model = parse.data.model
    
    const updatedSettings = settingsService.updateSettings({
      ...currentSettings,
      openai: openaiSettings
    })
    
    const config = openaiService.getConfig()
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : undefined
    }
    
    res.json({ success: true, message: 'OpenAI config updated', config: safeConfig })
  } catch (err) {
    logger.error({ err }, 'Failed to update OpenAI config')
    const message = err instanceof Error ? err.message : 'Failed to update OpenAI config'
    res.status(400).json({ success: false, error: message })
  }
})

// Utilities: schedule examples
app.get('/schedule-examples', (req, res) => {
  res.json({
    success: true,
    examples: {
      'Every day at 9 AM': '0 9 * * *',
      'Every Monday at 10 AM': '0 10 * * 1',
      'Every Friday at 5 PM': '0 17 * * 5'
    },
    format: 'minute hour day month dayOfWeek',
    note: 'Use https://crontab.guru to validate your cron expressions'
  })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`)
  })
  
  // Periodic memory usage logging for monitoring
  setInterval(() => {
    const used = process.memoryUsage()
    logger.info({
      evt: 'memory_usage',
      rss_mb: Math.round(used.rss / 1024 / 1024),
      heap_used_mb: Math.round(used.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(used.heapTotal / 1024 / 1024),
      external_mb: Math.round(used.external / 1024 / 1024),
      uptime_hours: Math.round(process.uptime() / 3600 * 10) / 10
    }, 'Memory usage snapshot')
  }, 5 * 60 * 1000) // Log every 5 minutes
}


