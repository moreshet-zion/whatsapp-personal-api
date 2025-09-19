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

dotenv.config({ path: process.env.ENV_PATH || '.env' })
const STORAGE_DIR = process.env.STORAGE_DIR || process.cwd()
const sessionsDir = path.resolve(STORAGE_DIR, 'sessions')
const dataDir = path.resolve(STORAGE_DIR, 'data')
const app = express()
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

app.use(express.json())
app.use(apiKeyAuth)

const PORT = Number(process.env.PORT || 3000)

// Instantiate services after env loaded
const whatsappClient = new WhatsAppClient(sessionsDir)
const scheduler = new SchedulerService(dataDir, whatsappClient)
const pubsub = new PubSubService(dataDir, whatsappClient)

// Start WhatsApp client
whatsappClient.start().catch((err) => logger.error({ err }, 'Failed to start WhatsApp client'))

// Health endpoint
app.get('/health', (req, res) => {
  const queueStatus = pubsub.getQueueStatus()
  res.json({
    status: whatsappClient.getConnectionStatus(),
    timestamp: new Date().toISOString(),
    scheduledMessages: scheduler.list().length,
    activeJobs: scheduler.activeJobs(),
    pubsub: {
      pendingMessages: queueStatus.pendingMessages,
      isProcessing: queueStatus.isProcessing,
      topics: pubsub.getTopics(true).length,
      subscribers: pubsub.getSubscribers().length
    }
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

// Send message
const sendBodySchema = z.object({ number: z.string(), message: z.string() })
app.post('/send', async (req, res) => {
  const parse = sendBodySchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  if (whatsappClient.getConnectionStatus() !== 'connected') {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' })
  }
  try {
    const sock = whatsappClient.getSocket()
    if (!sock) throw new Error('Socket not available')
    const jid = `${parse.data.number.replace(/[^0-9]/g, '')}@s.whatsapp.net`
    await sock.sendMessage(jid, { text: parse.data.message })
    return res.json({ success: true, message: 'Message sent successfully' })
  } catch (err) {
    logger.error({ err }, 'Failed to send message')
    return res.status(500).json({ success: false, error: 'Failed to send message' })
  }
})

// Scheduled messages
app.get('/scheduled', (req, res) => {
  const { active, oneTime } = req.query
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
  
  res.json({ success: true, scheduledMessages: messages })
})

const createScheduledSchema = z.object({
  number: z.string(),
  message: z.string(),
  schedule: z.string(),
  description: z.string().optional(),
  oneTime: z.boolean().optional()
})
app.post('/scheduled', (req, res) => {
  const parse = createScheduledSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  try {
    const data = {
      number: parse.data.number,
      message: parse.data.message,
      schedule: parse.data.schedule,
      description: parse.data.description ?? '',
      oneTime: parse.data.oneTime ?? false
    }
    const msg = scheduler.create(data)
    res.json({ success: true, message: 'Scheduled message created', scheduledMessage: msg })
  } catch (err) {
    return res.status(400).json({ success: false, error: (err as Error).message || 'Invalid cron schedule' })
  }
})

const updateScheduledSchema = z.object({
  number: z.string().optional(),
  message: z.string().optional(),
  schedule: z.string().optional(),
  description: z.string().optional(),
  oneTime: z.boolean().optional(),
  active: z.boolean().optional()
})
app.put('/scheduled/:id', (req, res) => {
  const parse = updateScheduledSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters' })
  }
  const updates: any = {}
  if (parse.data.number !== undefined) updates.number = parse.data.number
  if (parse.data.message !== undefined) updates.message = parse.data.message
  if (parse.data.schedule !== undefined) updates.schedule = parse.data.schedule
  if (parse.data.description !== undefined) updates.description = parse.data.description
  if (parse.data.oneTime !== undefined) updates.oneTime = parse.data.oneTime
  if (parse.data.active !== undefined) updates.active = parse.data.active
  const updated = scheduler.update(req.params.id, updates)
  if (!updated) return res.status(404).json({ success: false, error: 'Scheduled message not found' })
  res.json({ success: true, message: 'Scheduled message updated', scheduledMessage: updated })
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

// ========================================
// PUB/SUB API ENDPOINTS
// ========================================

// Topic Management APIs
const createTopicSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
})

app.post('/topics', (req, res) => {
  const parse = createTopicSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters', details: parse.error.issues })
  }
  
  try {
    const topic = pubsub.createTopic(parse.data.name, parse.data.description)
    res.json({ success: true, message: 'Topic created successfully', topic })
  } catch (err) {
    logger.error({ err }, 'Failed to create topic')
    res.status(500).json({ success: false, error: 'Failed to create topic' })
  }
})

app.get('/topics', (req, res) => {
  const activeOnly = req.query.active === 'true'
  try {
    const topics = pubsub.getTopics(activeOnly)
    res.json({ success: true, topics })
  } catch (err) {
    logger.error({ err }, 'Failed to get topics')
    res.status(500).json({ success: false, error: 'Failed to get topics' })
  }
})

app.get('/topics/:id', (req, res) => {
  try {
    const topic = pubsub.getTopic(req.params.id)
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' })
    }
    res.json({ success: true, topic })
  } catch (err) {
    logger.error({ err }, 'Failed to get topic')
    res.status(500).json({ success: false, error: 'Failed to get topic' })
  }
})

const updateTopicSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  active: z.boolean().optional()
})

app.put('/topics/:id', (req, res) => {
  const parse = updateTopicSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters', details: parse.error.issues })
  }
  
  try {
    const updates: { name?: string; description?: string; active?: boolean } = {}
    if (parse.data.name !== undefined) updates.name = parse.data.name
    if (parse.data.description !== undefined) updates.description = parse.data.description
    if (parse.data.active !== undefined) updates.active = parse.data.active
    const topic = pubsub.updateTopic(req.params.id, updates)
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' })
    }
    res.json({ success: true, message: 'Topic updated successfully', topic })
  } catch (err) {
    logger.error({ err }, 'Failed to update topic')
    res.status(500).json({ success: false, error: 'Failed to update topic' })
  }
})

app.delete('/topics/:id', (req, res) => {
  try {
    const deleted = pubsub.deleteTopic(req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Topic not found' })
    }
    res.json({ success: true, message: 'Topic deleted successfully' })
  } catch (err) {
    logger.error({ err }, 'Failed to delete topic')
    res.status(500).json({ success: false, error: 'Failed to delete topic' })
  }
})

// Topic Subscribers API
app.get('/topics/:id/subscribers', (req, res) => {
  try {
    const topic = pubsub.getTopic(req.params.id)
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' })
    }
    
    const subscribers = pubsub.getTopicSubscribers(req.params.id)
    res.json({ success: true, topic: topic.name, subscribers })
  } catch (err) {
    logger.error({ err }, 'Failed to get topic subscribers')
    res.status(500).json({ success: false, error: 'Failed to get topic subscribers' })
  }
})

// Subscription Management APIs
const subscribeSchema = z.object({
  phoneNumber: z.string().min(1),
  topicId: z.string().min(1)
})

app.post('/subscribe', (req, res) => {
  const parse = subscribeSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters', details: parse.error.issues })
  }
  
  try {
    const success = pubsub.subscribe(parse.data.topicId, parse.data.phoneNumber)
    if (!success) {
      return res.status(400).json({ success: false, error: 'Failed to subscribe - topic not found or already subscribed' })
    }
    res.json({ success: true, message: 'Successfully subscribed to topic' })
  } catch (err) {
    logger.error({ err }, 'Failed to subscribe')
    res.status(500).json({ success: false, error: 'Failed to subscribe' })
  }
})

app.post('/unsubscribe', (req, res) => {
  const parse = subscribeSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters', details: parse.error.issues })
  }
  
  try {
    const success = pubsub.unsubscribe(parse.data.topicId, parse.data.phoneNumber)
    if (!success) {
      return res.status(400).json({ success: false, error: 'Failed to unsubscribe - not subscribed to this topic' })
    }
    res.json({ success: true, message: 'Successfully unsubscribed from topic' })
  } catch (err) {
    logger.error({ err }, 'Failed to unsubscribe')
    res.status(500).json({ success: false, error: 'Failed to unsubscribe' })
  }
})

// Subscriber Management APIs
app.get('/subscribers', (req, res) => {
  try {
    const subscribers = pubsub.getSubscribers()
    res.json({ success: true, subscribers })
  } catch (err) {
    logger.error({ err }, 'Failed to get subscribers')
    res.status(500).json({ success: false, error: 'Failed to get subscribers' })
  }
})

app.get('/subscribers/:phoneNumber', (req, res) => {
  try {
    const subscriber = pubsub.getSubscriber(req.params.phoneNumber)
    if (!subscriber) {
      return res.status(404).json({ success: false, error: 'Subscriber not found' })
    }
    res.json({ success: true, subscriber })
  } catch (err) {
    logger.error({ err }, 'Failed to get subscriber')
    res.status(500).json({ success: false, error: 'Failed to get subscriber' })
  }
})

app.get('/subscribers/:phoneNumber/topics', (req, res) => {
  try {
    const topics = pubsub.getSubscriberTopics(req.params.phoneNumber)
    res.json({ success: true, phoneNumber: req.params.phoneNumber, topics })
  } catch (err) {
    logger.error({ err }, 'Failed to get subscriber topics')
    res.status(500).json({ success: false, error: 'Failed to get subscriber topics' })
  }
})

const updateSubscriberSchema = z.object({
  name: z.string().optional(),
  active: z.boolean().optional()
})

app.put('/subscribers/:phoneNumber', (req, res) => {
  const parse = updateSubscriberSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters', details: parse.error.issues })
  }
  
  try {
    const updates: { name?: string; active?: boolean } = {}
    if (parse.data.name !== undefined) updates.name = parse.data.name
    if (parse.data.active !== undefined) updates.active = parse.data.active
    const subscriber = pubsub.updateSubscriber(req.params.phoneNumber, updates)
    if (!subscriber) {
      return res.status(404).json({ success: false, error: 'Subscriber not found' })
    }
    res.json({ success: true, message: 'Subscriber updated successfully', subscriber })
  } catch (err) {
    logger.error({ err }, 'Failed to update subscriber')
    res.status(500).json({ success: false, error: 'Failed to update subscriber' })
  }
})

app.delete('/subscribers/:phoneNumber', (req, res) => {
  try {
    const deleted = pubsub.deleteSubscriber(req.params.phoneNumber)
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Subscriber not found' })
    }
    res.json({ success: true, message: 'Subscriber deleted successfully' })
  } catch (err) {
    logger.error({ err }, 'Failed to delete subscriber')
    res.status(500).json({ success: false, error: 'Failed to delete subscriber' })
  }
})

// Subscription Status API
app.get('/subscription-status/:phoneNumber/:topicId', (req, res) => {
  try {
    const isSubscribed = pubsub.isSubscribed(req.params.topicId, req.params.phoneNumber)
    res.json({ 
      success: true, 
      phoneNumber: req.params.phoneNumber,
      topicId: req.params.topicId,
      subscribed: isSubscribed 
    })
  } catch (err) {
    logger.error({ err }, 'Failed to check subscription status')
    res.status(500).json({ success: false, error: 'Failed to check subscription status' })
  }
})

// Messaging API
const publishMessageSchema = z.object({
  topicId: z.string().min(1),
  message: z.string().min(1),
  delaySeconds: z.number().min(0).optional().default(0)
})

app.post('/publish', (req, res) => {
  const parse = publishMessageSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters', details: parse.error.issues })
  }
  
  if (whatsappClient.getConnectionStatus() !== 'connected') {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' })
  }
  
  try {
    const queueItem = pubsub.publishMessage(parse.data.topicId, parse.data.message, parse.data.delaySeconds)
    if (!queueItem) {
      return res.status(400).json({ success: false, error: 'Failed to publish message - topic not found or no subscribers' })
    }
    res.json({ success: true, message: 'Message queued for delivery', queueItem })
  } catch (err) {
    logger.error({ err }, 'Failed to publish message')
    res.status(500).json({ success: false, error: 'Failed to publish message' })
  }
})

// Settings Management API
app.get('/settings', (req, res) => {
  try {
    const settings = pubsub.getSettings()
    res.json({ success: true, settings })
  } catch (err) {
    logger.error({ err }, 'Failed to get settings')
    res.status(500).json({ success: false, error: 'Failed to get settings' })
  }
})

const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  description: z.string().optional()
})

app.put('/settings', (req, res) => {
  const parse = updateSettingSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ success: false, error: 'Invalid request parameters', details: parse.error.issues })
  }
  
  try {
    const setting = pubsub.updateSetting(parse.data.key, parse.data.value, parse.data.description)
    res.json({ success: true, message: 'Setting updated successfully', setting })
  } catch (err) {
    logger.error({ err }, 'Failed to update setting')
    res.status(500).json({ success: false, error: 'Failed to update setting' })
  }
})

app.get('/settings/:key', (req, res) => {
  try {
    const value = pubsub.getSetting(req.params.key)
    if (value === null) {
      return res.status(404).json({ success: false, error: 'Setting not found' })
    }
    res.json({ success: true, key: req.params.key, value })
  } catch (err) {
    logger.error({ err }, 'Failed to get setting')
    res.status(500).json({ success: false, error: 'Failed to get setting' })
  }
})

// Queue Status API
app.get('/queue-status', (req, res) => {
  try {
    const status = pubsub.getQueueStatus()
    res.json({ success: true, queue: status })
  } catch (err) {
    logger.error({ err }, 'Failed to get queue status')
    res.status(500).json({ success: false, error: 'Failed to get queue status' })
  }
})

// Cleanup API
app.post('/cleanup-messages', (req, res) => {
  const days = parseInt(req.query.days as string) || 7
  try {
    const cleaned = pubsub.cleanupOldMessages(days)
    res.json({ success: true, message: `Cleaned up ${cleaned} old messages` })
  } catch (err) {
    logger.error({ err }, 'Failed to cleanup messages')
    res.status(500).json({ success: false, error: 'Failed to cleanup messages' })
  }
})

// ========================================
// END PUB/SUB API ENDPOINTS
// ========================================

app.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT}`)
})


