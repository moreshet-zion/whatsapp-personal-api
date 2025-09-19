import path from 'path'
import fs from 'fs'
import { z } from 'zod'

// Schema definitions
export const topicSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  created: z.string(),
  updated: z.string(),
  active: z.boolean().default(true)
})

export const subscriberSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  name: z.string().optional(),
  created: z.string(),
  active: z.boolean().default(true)
})

export const subscriptionSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  subscriberId: z.string(),
  created: z.string(),
  active: z.boolean().default(true)
})

export const settingsSchema = z.object({
  key: z.string(),
  value: z.string(),
  description: z.string().optional(),
  updated: z.string()
})

export const messageQueueSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  message: z.string(),
  scheduledFor: z.string(),
  status: z.enum(['pending', 'processing', 'sent', 'failed']),
  attempts: z.number().default(0),
  created: z.string(),
  updated: z.string()
})

export type Topic = z.infer<typeof topicSchema>
export type Subscriber = z.infer<typeof subscriberSchema>
export type Subscription = z.infer<typeof subscriptionSchema>
export type Settings = z.infer<typeof settingsSchema>
export type MessageQueue = z.infer<typeof messageQueueSchema>

interface DatabaseData {
  topics: Topic[]
  subscribers: Subscriber[]
  subscriptions: Subscription[]
  settings: Settings[]
  messageQueue: MessageQueue[]
}

export class DatabaseService {
  private dataDir: string
  private dbFile: string
  private data: DatabaseData = {
    topics: [],
    subscribers: [],
    subscriptions: [],
    settings: [],
    messageQueue: []
  }
  
  constructor(dataDir: string) {
    this.dataDir = dataDir
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    this.dbFile = path.join(dataDir, 'pubsub.json')
    this.loadData()
    this.initDefaultSettings()
  }
  
  private loadData() {
    try {
      if (fs.existsSync(this.dbFile)) {
        const rawData = fs.readFileSync(this.dbFile, 'utf8')
        this.data = JSON.parse(rawData)
      } else {
        this.data = {
          topics: [],
          subscribers: [],
          subscriptions: [],
          settings: [],
          messageQueue: []
        }
        this.saveData()
      }
    } catch (error) {
      console.error('Failed to load database:', error)
      this.data = {
        topics: [],
        subscribers: [],
        subscriptions: [],
        settings: [],
        messageQueue: []
      }
    }
  }
  
  private saveData() {
    try {
      fs.writeFileSync(this.dbFile, JSON.stringify(this.data, null, 2))
    } catch (error) {
      console.error('Failed to save database:', error)
    }
  }
  
  private initDefaultSettings() {
    const now = new Date().toISOString()
    
    const defaultSettings = [
      { key: 'message_delay_seconds', value: '5', description: 'Delay in seconds between sending messages to prevent spam' },
      { key: 'max_retry_attempts', value: '3', description: 'Maximum retry attempts for failed messages' },
      { key: 'queue_process_interval', value: '10', description: 'Interval in seconds to process message queue' }
    ]
    
    for (const setting of defaultSettings) {
      if (!this.data.settings.find(s => s.key === setting.key)) {
        this.data.settings.push({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          updated: now
        })
      }
    }
    
    this.saveData()
  }
  
  // Topic operations
  createTopic(topic: Omit<Topic, 'id' | 'created' | 'updated'>): Topic {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    
    const newTopic: Topic = {
      id,
      name: topic.name,
      description: topic.description,
      created: now,
      updated: now,
      active: topic.active ?? true
    }
    
    this.data.topics.push(newTopic)
    this.saveData()
    return newTopic
  }
  
  getTopics(activeOnly = false): Topic[] {
    let topics = this.data.topics
    if (activeOnly) {
      topics = topics.filter(t => t.active)
    }
    return topics.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  }
  
  getTopic(id: string): Topic | null {
    return this.data.topics.find(t => t.id === id) || null
  }
  
  updateTopic(id: string, updates: Partial<Omit<Topic, 'id' | 'created'>>): Topic | null {
    const index = this.data.topics.findIndex(t => t.id === id)
    if (index === -1) return null
    
    const now = new Date().toISOString()
    const existing = this.data.topics[index]!
    this.data.topics[index] = {
      ...existing,
      ...updates,
      updated: now
    }
    
    this.saveData()
    return this.data.topics[index]!
  }
  
  deleteTopic(id: string): boolean {
    const index = this.data.topics.findIndex(t => t.id === id)
    if (index === -1) return false
    
    // Remove topic and related subscriptions
    this.data.topics.splice(index, 1)
    this.data.subscriptions = this.data.subscriptions.filter(s => s.topicId !== id)
    this.data.messageQueue = this.data.messageQueue.filter(m => m.topicId !== id)
    
    this.saveData()
    return true
  }
  
  // Subscriber operations
  createSubscriber(subscriber: Omit<Subscriber, 'id' | 'created'>): Subscriber {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    
    const newSubscriber: Subscriber = {
      id,
      phoneNumber: subscriber.phoneNumber,
      name: subscriber.name,
      created: now,
      active: subscriber.active ?? true
    }
    
    this.data.subscribers.push(newSubscriber)
    this.saveData()
    return newSubscriber
  }
  
  getSubscriber(phoneNumber: string): Subscriber | null {
    return this.data.subscribers.find(s => s.phoneNumber === phoneNumber) || null
  }
  
  getSubscribers(): Subscriber[] {
    return this.data.subscribers.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  }
  
  updateSubscriber(phoneNumber: string, updates: Partial<Omit<Subscriber, 'id' | 'phoneNumber' | 'created'>>): Subscriber | null {
    const index = this.data.subscribers.findIndex(s => s.phoneNumber === phoneNumber)
    if (index === -1) return null
    
    const existing = this.data.subscribers[index]!
    this.data.subscribers[index] = {
      ...existing,
      ...updates
    }
    
    this.saveData()
    return this.data.subscribers[index]!
  }
  
  deleteSubscriber(phoneNumber: string): boolean {
    const index = this.data.subscribers.findIndex(s => s.phoneNumber === phoneNumber)
    if (index === -1) return false
    
    const subscriberId = this.data.subscribers[index]!.id
    
    // Remove subscriber and related subscriptions
    this.data.subscribers.splice(index, 1)
    this.data.subscriptions = this.data.subscriptions.filter(s => s.subscriberId !== subscriberId)
    
    this.saveData()
    return true
  }
  
  // Subscription operations
  subscribe(topicId: string, phoneNumber: string): Subscription | null {
    // Get or create subscriber
    let subscriber = this.getSubscriber(phoneNumber)
    if (!subscriber) {
      subscriber = this.createSubscriber({ phoneNumber, active: true })
    }
    
    // Check if topic exists
    const topic = this.getTopic(topicId)
    if (!topic) return null
    
    // Check if already subscribed
    const existing = this.data.subscriptions.find(s => s.topicId === topicId && s.subscriberId === subscriber!.id)
    if (existing) return null
    
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    
    const subscription: Subscription = {
      id,
      topicId,
      subscriberId: subscriber.id,
      created: now,
      active: true
    }
    
    this.data.subscriptions.push(subscription)
    this.saveData()
    return subscription
  }
  
  unsubscribe(topicId: string, phoneNumber: string): boolean {
    const subscriber = this.getSubscriber(phoneNumber)
    if (!subscriber) return false
    
    const index = this.data.subscriptions.findIndex(s => s.topicId === topicId && s.subscriberId === subscriber.id)
    if (index === -1) return false
    
    this.data.subscriptions.splice(index, 1)
    this.saveData()
    return true
  }
  
  getTopicSubscribers(topicId: string): Subscriber[] {
    const subscriptions = this.data.subscriptions.filter(s => s.topicId === topicId && s.active)
    const subscribers: Subscriber[] = []
    
    for (const subscription of subscriptions) {
      const subscriber = this.data.subscribers.find(s => s.id === subscription.subscriberId && s.active)
      if (subscriber) {
        subscribers.push(subscriber)
      }
    }
    
    return subscribers
  }
  
  getSubscriberTopics(phoneNumber: string): Topic[] {
    const subscriber = this.getSubscriber(phoneNumber)
    if (!subscriber) return []
    
    const subscriptions = this.data.subscriptions.filter(s => s.subscriberId === subscriber.id && s.active)
    const topics: Topic[] = []
    
    for (const subscription of subscriptions) {
      const topic = this.data.topics.find(t => t.id === subscription.topicId && t.active)
      if (topic) {
        topics.push(topic)
      }
    }
    
    return topics
  }
  
  isSubscribed(topicId: string, phoneNumber: string): boolean {
    const subscriber = this.getSubscriber(phoneNumber)
    if (!subscriber) return false
    
    return this.data.subscriptions.some(s => s.topicId === topicId && s.subscriberId === subscriber.id && s.active)
  }
  
  // Settings operations
  getSetting(key: string): string | null {
    const setting = this.data.settings.find(s => s.key === key)
    return setting ? setting.value : null
  }
  
  getSettings(): Settings[] {
    return this.data.settings.sort((a, b) => a.key.localeCompare(b.key))
  }
  
  updateSetting(key: string, value: string, description?: string): Settings {
    const now = new Date().toISOString()
    const index = this.data.settings.findIndex(s => s.key === key)
    
    const setting: Settings = {
      key,
      value,
      description,
      updated: now
    }
    
    if (index >= 0) {
      this.data.settings[index] = setting
    } else {
      this.data.settings.push(setting)
    }
    
    this.saveData()
    return setting
  }
  
  // Message queue operations
  addToQueue(topicId: string, message: string, delaySeconds = 0): MessageQueue {
    const id = crypto.randomUUID()
    const now = new Date()
    const scheduledFor = new Date(now.getTime() + (delaySeconds * 1000)).toISOString()
    
    const queueItem: MessageQueue = {
      id,
      topicId,
      message,
      scheduledFor,
      status: 'pending',
      attempts: 0,
      created: now.toISOString(),
      updated: now.toISOString()
    }
    
    this.data.messageQueue.push(queueItem)
    this.saveData()
    return queueItem
  }
  
  getPendingMessages(): MessageQueue[] {
    const now = new Date().toISOString()
    return this.data.messageQueue
      .filter(m => m.status === 'pending' && m.scheduledFor <= now)
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
  }
  
  updateMessageStatus(id: string, status: MessageQueue['status'], incrementAttempts = false): void {
    const index = this.data.messageQueue.findIndex(m => m.id === id)
    if (index >= 0) {
      const now = new Date().toISOString()
      const message = this.data.messageQueue[index]!
      message.status = status
      message.updated = now
      
      if (incrementAttempts) {
        message.attempts += 1
      }
      
      this.saveData()
    }
  }
  
  cleanupOldMessages(olderThanDays = 7): number {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    const cutoffISO = cutoffDate.toISOString()
    
    const initialLength = this.data.messageQueue.length
    this.data.messageQueue = this.data.messageQueue.filter(m => {
      const shouldKeep = !(m.status === 'sent' || m.status === 'failed') || m.created >= cutoffISO
      return shouldKeep
    })
    
    const cleaned = initialLength - this.data.messageQueue.length
    if (cleaned > 0) {
      this.saveData()
    }
    
    return cleaned
  }
  
  close() {
    // No-op for JSON database
  }
}