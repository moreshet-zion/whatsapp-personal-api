# WhatsApp Message Interception & Conversation Management Service

A **TypeScript-based service** that adds intelligent message interception, routing, and AI-powered conversation management to your existing WhatsApp API infrastructure.

## 🎯 Purpose

This service is designed to **extend** your existing WhatsApp API with:
- **Incoming message interception** and intelligent routing
- **AI-powered conversation management** with multiple agent personas
- **Enhanced pub/sub** that can initiate conversations with topic subscribers
- **Scalable architecture** (local storage → Redis when ready)

## ✨ Key Features

### 1. **Message Interception & Routing**
- Intercept incoming WhatsApp messages
- Route based on keywords, patterns, or custom logic
- Automatically detect and continue existing conversations
- Support for department-based routing

### 2. **AI-Powered Conversations**
- Multiple AI engine support (OpenAI, Claude, Mock for testing)
- Specialized agent personas (Support, Sales, Custom)
- Conversation context management
- Automatic response generation

### 3. **Enhanced Pub/Sub**
- Publish messages to topic subscribers
- **NEW**: Initiate AI conversations with each subscriber
- Campaign management
- Batch conversation initiation

### 4. **Flexible Storage**
- Start with local file storage
- Seamlessly migrate to Redis when scaling
- Same API regardless of backend

## 🏗️ Architecture

```
Your WhatsApp API
       ↓
[Message Interception Layer]
       ↓
[Routing Engine] → [Conversation Manager] → [AI Agents]
       ↓                    ↓                     ↓
[Storage Layer] ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ↓
```

## 📦 Installation

```bash
npm install

# For development
npm run dev

# For production
npm run build
npm start
```

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { 
  WhatsAppInterceptionService,
  ServiceConfig 
} from './src/WhatsAppInterceptionService';

// Your existing WhatsApp API
const whatsappAPI = {
  async sendMessage(to: string, message: string) {
    // Your implementation
    return { messageId: 'xxx', status: 'sent' };
  },
  // ... other methods
};

const config: ServiceConfig = {
  storage: {
    type: 'local' // or 'redis'
  },
  whatsapp: {
    botPhoneNumber: '+1234567890',
    api: whatsappAPI
  },
  ai: {
    defaultEngine: 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4'
    }
  }
};

const service = new WhatsAppInterceptionService(config);
await service.start();
```

### 2. Process Incoming Messages

```typescript
// When you receive a WhatsApp message
const incomingMessage = {
  id: 'msg123',
  from: '+user_phone',
  to: '+bot_phone',
  content: 'Hello, I need help',
  type: 'text',
  timestamp: new Date()
};

// Process through interception service
const response = await service.processIncomingMessage(incomingMessage);

// Response is automatically sent via your WhatsApp API
```

### 3. Initiate Conversations (Pub/Sub Enhancement)

```typescript
// Subscribe users to a topic
await service.subscribeToTopic('customers', '+1111111111');
await service.subscribeToTopic('customers', '+2222222222');

// Send message and start AI conversation with each subscriber
await service.publishToTopic(
  'customers',
  'Hi! We have a special offer for you. Reply to learn more!',
  true, // Initiate conversation
  {
    conversationType: 'sales',
    agentId: 'sales-agent',
    config: {
      allowUserResponse: true,
      autoCloseAfter: 60 // minutes
    }
  }
);
```

### 4. Custom Routing Rules

```typescript
// Add department routing
service.addRoutingRule(
  'billing-department',
  (message) => message.content.includes('invoice') || message.content.includes('payment'),
  (message) => ({
    shouldProcess: true,
    action: 'start_conversation',
    agentId: 'billing-agent',
    reason: 'Billing inquiry detected'
  })
);

// VIP customer routing
service.addRoutingRule(
  'vip-routing',
  (message) => vipCustomers.includes(message.from),
  (message) => ({
    shouldProcess: true,
    action: 'start_conversation',
    agentId: 'vip-agent',
    priority: 100,
    reason: 'VIP customer'
  })
);
```

## 🤖 AI Agent Configuration

### Built-in Agents

```typescript
// Support Agent
const supportAgent = new SupportAgent('support-agent', logger, aiEngine);

// Sales Agent  
const salesAgent = new SalesAgent('sales-agent', logger, aiEngine);

// Custom Agent
const customAgent = new Agent(
  'custom-agent',
  {
    name: 'Custom Assistant',
    role: 'Specialized Helper',
    personality: 'Professional and knowledgeable',
    instructions: 'Your specific instructions here',
    responseStyle: {
      tone: 'formal',
      useEmojis: false,
      maxLength: 300
    }
  },
  logger,
  aiEngine
);
```

### AI Engines

```typescript
// OpenAI
const openaiEngine = AIEngineFactory.createEngine('openai', {
  apiKey: 'your-key',
  model: 'gpt-4'
}, logger);

// Claude
const claudeEngine = AIEngineFactory.createEngine('claude', {
  apiKey: 'your-key',
  model: 'claude-3'
}, logger);

// Mock (for testing)
const mockEngine = AIEngineFactory.createEngine('mock', {
  responses: {
    'hello': 'Hi there!',
    'help': 'How can I assist you?'
  }
}, logger);
```

## 📊 Conversation Management

### Get Conversation Statistics

```typescript
const stats = await service.getConversationStats(conversationId);
// Returns: duration, messageCount, avgResponseTime, tags

const activeConvs = await service.listActiveConversations({
  agentId: 'support-agent',
  state: 'active'
});
```

### Campaign Management

```typescript
await service.conversationPublisher.createCampaign({
  name: 'Summer Sale',
  topicId: 'customers',
  message: 'Summer sale starts now! 50% off everything!',
  conversationType: 'sales',
  agentId: 'sales-agent',
  schedule: new Date('2024-06-01T10:00:00'),
  metadata: {
    campaign_type: 'promotional'
  }
});
```

## 🔄 Storage Migration Path

### Phase 1: Local Development
```typescript
storage: {
  type: 'local',
  localPath: './data/storage'
}
```

### Phase 2: Production with Redis
```typescript
storage: {
  type: 'redis',
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password'
  }
}
```

## 📁 Project Structure

```
/workspace/
├── src/
│   ├── core/              # Core types and interfaces
│   ├── routing/           # Message routing logic
│   ├── conversation/      # Conversation management
│   ├── interceptor/       # Message interception
│   ├── agents/            # AI agents and engines
│   ├── storage/           # Storage backends
│   ├── pubsub/           # Pub/sub with conversation initiation
│   └── WhatsAppInterceptionService.ts  # Main service
├── examples/              # Usage examples
├── package.json
└── tsconfig.json
```

## 🎯 Use Cases

1. **Customer Support Automation**
   - Route support queries to specialized agents
   - Maintain conversation context
   - Escalate to human agents when needed

2. **Sales & Marketing Campaigns**
   - Send promotional messages to subscribers
   - Start AI-powered sales conversations
   - Track engagement and conversions

3. **Notification System with Engagement**
   - Send notifications that can turn into conversations
   - Allow users to respond and get AI assistance
   - Auto-close after specified time

4. **Multi-Department Business**
   - Route to billing, support, sales departments
   - Different AI personas for each department
   - Unified conversation history

## 🔌 Integration with Existing System

This service is designed to work **alongside** your existing WhatsApp API:

```typescript
// Your existing WhatsApp webhook
app.post('/webhook/whatsapp', async (req, res) => {
  const message = req.body;
  
  // NEW: Process through interception service
  const response = await interceptionService.processIncomingMessage(message);
  
  // Your existing logic continues...
  await yourExistingLogic(message);
  
  res.sendStatus(200);
});

// Your existing pub/sub
async function publishToSubscribers(topicId: string, message: string) {
  // NEW: Use enhanced pub/sub with conversation initiation
  await interceptionService.publishToTopic(
    topicId,
    message,
    true, // Enable AI conversations
    { conversationType: 'notification' }
  );
}
```

## 📊 Events

The service emits various events for monitoring:

```typescript
service.on('message:processed', ({ message, response }) => {
  console.log('Message processed', message.id);
});

service.on('conversation:created', (conversation) => {
  console.log('New conversation', conversation.conversationId);
});

service.on('conversation:initiated', ({ phoneNumber, conversationId }) => {
  console.log('Conversation initiated with', phoneNumber);
});

service.on('error', (error) => {
  console.error('Service error:', error);
});
```

## 🚦 Service Control

```typescript
// Start service
await service.start();

// Stop service
await service.stop();

// Get status
const status = service.getStatus();
// { running: true, agents: ['support', 'sales'], activeConversations: 5 }
```

## 🔒 Security Considerations

- Store API keys in environment variables
- Implement rate limiting for incoming messages
- Validate phone numbers before processing
- Use Redis with password in production
- Implement message encryption for sensitive data

## 📝 License

MIT

## 🤝 Contributing

This service is designed to be extended. Feel free to:
- Add new AI engines
- Create custom agents
- Implement new routing strategies
- Add storage backends