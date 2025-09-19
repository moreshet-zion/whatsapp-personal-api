import cron from 'node-cron'
import pino from 'pino'
import { DatabaseService, MessageQueue, Topic, Subscriber } from '../models/database.js'
import { WhatsAppClient } from './whatsapp.js'

export class PubSubService {
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' })
  private db: DatabaseService
  private whatsappClient: WhatsAppClient
  private processingTask: ReturnType<typeof cron.schedule> | null = null
  private isProcessing = false
  
  constructor(dataDir: string, whatsappClient: WhatsAppClient) {
    this.db = new DatabaseService(dataDir)
    this.whatsappClient = whatsappClient
    this.startQueueProcessor()
  }
  
  private startQueueProcessor() {
    const interval = this.db.getSetting('queue_process_interval') || '10'
    const cronExpression = `*/${interval} * * * * *` // Every N seconds
    
    this.processingTask = cron.schedule(cronExpression, () => {
      this.processMessageQueue().catch(err => {
        this.logger.error({ err }, 'Error processing message queue')
      })
    })
    
    this.processingTask.start()
    this.logger.info('Message queue processor started')
  }
  
  private async processMessageQueue() {
    if (this.isProcessing) {
      this.logger.debug('Queue processing already in progress, skipping')
      return
    }
    
    if (this.whatsappClient.getConnectionStatus() !== 'connected') {
      this.logger.debug('WhatsApp not connected, skipping queue processing')
      return
    }
    
    this.isProcessing = true
    
    try {
      const pendingMessages = this.db.getPendingMessages()
      
      if (pendingMessages.length === 0) {
        return
      }
      
      this.logger.info(`Processing ${pendingMessages.length} pending messages`)
      
      const messageDelay = parseInt(this.db.getSetting('message_delay_seconds') || '5') * 1000
      const maxRetries = parseInt(this.db.getSetting('max_retry_attempts') || '3')
      
      for (const message of pendingMessages) {
        try {
          // Update status to processing
          this.db.updateMessageStatus(message.id, 'processing')
          
          // Get topic and subscribers
          const topic = this.db.getTopic(message.topicId)
          if (!topic || !topic.active) {
            this.logger.warn(`Topic ${message.topicId} not found or inactive, marking message as failed`)
            this.db.updateMessageStatus(message.id, 'failed')
            continue
          }
          
          const subscribers = this.db.getTopicSubscribers(message.topicId)
          if (subscribers.length === 0) {
            this.logger.info(`No subscribers for topic ${topic.name}, marking message as sent`)
            this.db.updateMessageStatus(message.id, 'sent')
            continue
          }
          
          this.logger.info(`Sending message to ${subscribers.length} subscribers of topic "${topic.name}"`)
          
          // Send message to each subscriber with delay
          let successCount = 0
          let failureCount = 0
          
          for (let i = 0; i < subscribers.length; i++) {
            const subscriber = subscribers[i]!
            
            try {
              await this.sendWhatsAppMessage(subscriber.phoneNumber, message.message)
              successCount++
              this.logger.debug(`Message sent to ${subscriber.phoneNumber}`)
              
              // Add delay between messages (except for the last one)
              if (i < subscribers.length - 1) {
                await this.delay(messageDelay)
              }
            } catch (err) {
              failureCount++
              this.logger.error({ err, phoneNumber: subscriber.phoneNumber }, 'Failed to send message to subscriber')
            }
          }
          
          // Update message status based on results
          if (successCount > 0) {
            this.db.updateMessageStatus(message.id, 'sent')
            this.logger.info(`Message sent successfully to ${successCount}/${subscribers.length} subscribers`)
          } else {
            // All sends failed, check if we should retry
            if (message.attempts < maxRetries) {
              this.db.updateMessageStatus(message.id, 'pending', true)
              this.logger.warn(`All sends failed, will retry (attempt ${message.attempts + 1}/${maxRetries})`)
            } else {
              this.db.updateMessageStatus(message.id, 'failed', true)
              this.logger.error(`All sends failed after ${maxRetries} attempts, marking as failed`)
            }
          }
          
        } catch (err) {
          this.logger.error({ err, messageId: message.id }, 'Error processing message')
          
          // Handle retry logic
          if (message.attempts < maxRetries) {
            this.db.updateMessageStatus(message.id, 'pending', true)
          } else {
            this.db.updateMessageStatus(message.id, 'failed', true)
          }
        }
      }
      
    } finally {
      this.isProcessing = false
    }
  }
  
  private async sendWhatsAppMessage(phoneNumber: string, message: string): Promise<void> {
    const sock = this.whatsappClient.getSocket()
    if (!sock) {
      throw new Error('WhatsApp socket not available')
    }
    
    const jid = this.formatJid(phoneNumber)
    await sock.sendMessage(jid, { text: message })
  }
  
  private formatJid(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/[^0-9]/g, '')
    return `${cleaned}@s.whatsapp.net`
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  // Public API methods
  
  // Topic management
  createTopic(name: string, description?: string): Topic {
    return this.db.createTopic({ name, description, active: true })
  }
  
  getTopics(activeOnly = false): Topic[] {
    return this.db.getTopics(activeOnly)
  }
  
  getTopic(id: string): Topic | null {
    return this.db.getTopic(id)
  }
  
  updateTopic(id: string, updates: { name?: string; description?: string; active?: boolean }): Topic | null {
    return this.db.updateTopic(id, updates)
  }
  
  deleteTopic(id: string): boolean {
    return this.db.deleteTopic(id)
  }
  
  // Subscriber management
  getSubscribers(): Subscriber[] {
    return this.db.getSubscribers()
  }
  
  getSubscriber(phoneNumber: string): Subscriber | null {
    return this.db.getSubscriber(phoneNumber)
  }
  
  updateSubscriber(phoneNumber: string, updates: { name?: string; active?: boolean }): Subscriber | null {
    return this.db.updateSubscriber(phoneNumber, updates)
  }
  
  deleteSubscriber(phoneNumber: string): boolean {
    return this.db.deleteSubscriber(phoneNumber)
  }
  
  // Subscription management
  subscribe(topicId: string, phoneNumber: string): boolean {
    const subscription = this.db.subscribe(topicId, phoneNumber)
    if (subscription) {
      this.logger.info(`Phone ${phoneNumber} subscribed to topic ${topicId}`)
      return true
    }
    return false
  }
  
  unsubscribe(topicId: string, phoneNumber: string): boolean {
    const result = this.db.unsubscribe(topicId, phoneNumber)
    if (result) {
      this.logger.info(`Phone ${phoneNumber} unsubscribed from topic ${topicId}`)
    }
    return result
  }
  
  getTopicSubscribers(topicId: string): Subscriber[] {
    return this.db.getTopicSubscribers(topicId)
  }
  
  getSubscriberTopics(phoneNumber: string): Topic[] {
    return this.db.getSubscriberTopics(phoneNumber)
  }
  
  isSubscribed(topicId: string, phoneNumber: string): boolean {
    return this.db.isSubscribed(topicId, phoneNumber)
  }
  
  // Messaging
  publishMessage(topicId: string, message: string, delaySeconds = 0): MessageQueue | null {
    const topic = this.db.getTopic(topicId)
    if (!topic || !topic.active) {
      this.logger.error(`Cannot publish to topic ${topicId}: topic not found or inactive`)
      return null
    }
    
    const subscribers = this.db.getTopicSubscribers(topicId)
    if (subscribers.length === 0) {
      this.logger.warn(`No subscribers for topic ${topic.name}`)
      return null
    }
    
    const queueItem = this.db.addToQueue(topicId, message, delaySeconds)
    this.logger.info(`Message queued for topic "${topic.name}" with ${subscribers.length} subscribers`)
    
    return queueItem
  }
  
  // Settings management
  getSettings() {
    return this.db.getSettings()
  }
  
  getSetting(key: string): string | null {
    return this.db.getSetting(key)
  }
  
  updateSetting(key: string, value: string, description?: string) {
    const result = this.db.updateSetting(key, value, description)
    
    // If queue processing interval changed, restart the processor
    if (key === 'queue_process_interval') {
      this.restartQueueProcessor()
    }
    
    this.logger.info(`Setting ${key} updated to: ${value}`)
    return result
  }
  
  private restartQueueProcessor() {
    if (this.processingTask) {
      this.processingTask.stop()
      this.processingTask.destroy()
    }
    this.startQueueProcessor()
  }
  
  // Queue management
  getQueueStatus() {
    const pending = this.db.getPendingMessages()
    return {
      pendingMessages: pending.length,
      isProcessing: this.isProcessing,
      whatsappConnected: this.whatsappClient.getConnectionStatus() === 'connected'
    }
  }
  
  cleanupOldMessages(olderThanDays = 7): number {
    return this.db.cleanupOldMessages(olderThanDays)
  }
  
  // Shutdown
  shutdown() {
    if (this.processingTask) {
      this.processingTask.stop()
      this.processingTask.destroy()
    }
    this.db.close()
  }
}