import express from 'express'
import dotenv from 'dotenv'
import pino from 'pino'
import path from 'path'
import QRCode from 'qrcode'
import { z } from 'zod'
import { WhatsAppClient } from './services/whatsapp.js'
import { SchedulerService } from './services/scheduler.js'
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
  res.json({ success: true, scheduledMessages: scheduler.list() })
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

app.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT}`)
})


