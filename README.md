# WhatsApp Pub/Sub System

A comprehensive WhatsApp-based publish/subscribe messaging system that allows phone numbers to subscribe to topics and receive broadcast messages with intelligent rate limiting and queue management.

## 🚀 Features

### Core Pub/Sub Functionality
- **Topic Management**: Create, update, delete, and list topics
- **Subscription Management**: Phone numbers can subscribe/unsubscribe from topics
- **Message Broadcasting**: Send messages to all subscribers of a topic
- **Subscription Status**: Check subscription status for any phone/topic combination

### Advanced Features
- **Rate Limiting**: Configurable delays between messages to prevent WhatsApp spam detection
- **Message Queue**: Reliable message delivery with retry logic and failure handling
- **Settings Management**: Configure system behavior including message delays and retry attempts
- **Health Monitoring**: Real-time status of WhatsApp connection and queue processing
- **Data Persistence**: JSON-based storage that survives server restarts

### WhatsApp Integration
- **Baileys Integration**: Uses the reliable @whiskeysockets/baileys library
- **QR Code Authentication**: Easy WhatsApp linking via web interface
- **Connection Management**: Automatic reconnection and status monitoring
- **Message Formatting**: Full WhatsApp message formatting support

### Legacy Features (Still Available)
- **Scheduled Messages**: Send recurring messages with cron expressions
- **One-time Messages**: Schedule single-time message delivery
- **Direct Messaging**: Send immediate messages to individual numbers

## 📋 Prerequisites

- Node.js 18+ 
- NPM or Yarn
- WhatsApp account for linking

## 🛠️ Installation & Setup

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd whatsapp-pubsub-system
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
```env
API_KEY=your-secure-api-key-here
PORT=3000
LOG_LEVEL=info
STORAGE_DIR=./data
```

3. **Build the project:**
```bash
npm run build
```

4. **Start the server:**
```bash
npm start
# or for development with auto-reload:
npm run dev
```

## 📱 WhatsApp Setup

1. **Start the server** and navigate to `http://localhost:3000/qr-image`
2. **Scan the QR code** with WhatsApp (Settings → Linked Devices → Link a Device)
3. **Wait for connection** - the system will automatically connect and be ready to send messages

## 🎯 Quick Start Guide

### 1. Create a Topic
```bash
curl -X POST http://localhost:3000/topics \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "news-updates",
    "description": "Daily news and announcements"
  }'
```

### 2. Subscribe Phone Numbers
```bash
curl -X POST http://localhost:3000/subscribe \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "topicId": "TOPIC_ID_FROM_STEP_1"
  }'
```

### 3. Send a Message
```bash
curl -X POST http://localhost:3000/publish \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topicId": "TOPIC_ID_FROM_STEP_1",
    "message": "Hello subscribers! This is a test message.",
    "delaySeconds": 0
  }'
```

### 4. Check System Status
```bash
curl -X GET http://localhost:3000/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 📖 API Documentation

Comprehensive API documentation is available in [`docs/PUBSUB_API.md`](docs/PUBSUB_API.md).

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | System health and status |
| `POST` | `/topics` | Create new topic |
| `GET` | `/topics` | List all topics |
| `POST` | `/subscribe` | Subscribe to topic |
| `POST` | `/unsubscribe` | Unsubscribe from topic |
| `POST` | `/publish` | Send message to topic |
| `GET` | `/settings` | Get system settings |
| `PUT` | `/settings` | Update system settings |

## 🔧 Configuration

### Rate Limiting Settings

The system includes configurable rate limiting to prevent WhatsApp spam detection:

- **`message_delay_seconds`**: Delay between messages (default: 5 seconds)
- **`max_retry_attempts`**: Max retries for failed messages (default: 3)
- **`queue_process_interval`**: Queue processing interval (default: 10 seconds)

Update settings via API:
```bash
curl -X PUT http://localhost:3000/settings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "message_delay_seconds",
    "value": "10",
    "description": "10 second delay for high-volume messaging"
  }'
```

### Recommended Settings by Use Case

**Low Volume (< 100 messages/day):**
- `message_delay_seconds`: 5
- `max_retry_attempts`: 3

**Medium Volume (100-1000 messages/day):**
- `message_delay_seconds`: 10
- `max_retry_attempts`: 2

**High Volume (1000+ messages/day):**
- `message_delay_seconds`: 15-30
- `max_retry_attempts`: 2
- Consider splitting across multiple WhatsApp accounts

## 🧪 Testing & Demo

Run the included demo script to test all functionality:

```bash
# Make sure the server is running first
npm start

# In another terminal, run the demo
node examples/pubsub-demo.js
```

The demo script will:
- Create sample topics
- Subscribe test phone numbers
- Publish test messages
- Demonstrate all API endpoints

## 📊 Monitoring & Maintenance

### Health Monitoring
Check system health regularly:
```bash
curl -X GET http://localhost:3000/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Queue Management
Monitor message queue:
```bash
curl -X GET http://localhost:3000/queue-status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Cleanup Old Messages
Clean up processed messages:
```bash
curl -X POST "http://localhost:3000/cleanup-messages?days=7" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 🏗️ Architecture

### System Components

1. **Express API Server**: RESTful API endpoints
2. **WhatsApp Client**: Baileys-based WhatsApp integration
3. **Pub/Sub Service**: Core pub/sub logic and message queue
4. **Database Service**: JSON-based data persistence
5. **Scheduler Service**: Cron-based scheduled messages (legacy feature)

### Data Storage

The system uses JSON files for data persistence:
- `data/pubsub.json`: Topics, subscribers, subscriptions, settings, message queue
- `data/scheduled.json`: Scheduled messages (legacy feature)
- `sessions/`: WhatsApp session data

### Message Flow

1. **Message Published** → Added to queue with delay
2. **Queue Processor** → Picks up pending messages
3. **Rate Limiter** → Applies configured delays
4. **WhatsApp Sender** → Delivers messages to subscribers
5. **Status Tracking** → Updates message status (sent/failed)

## 🔒 Security

- **API Key Authentication**: All endpoints require valid API key
- **Input Validation**: Comprehensive request validation using Zod
- **Rate Limiting**: Built-in protection against spam
- **Error Handling**: Secure error responses without sensitive data exposure

## 📝 Development

### Available Scripts

```bash
npm run dev      # Development with auto-reload
npm run build    # Build TypeScript
npm start        # Start production server
npm run test     # Run tests (if implemented)
```

### Project Structure

```
src/
├── models/
│   └── database.ts      # Database service and schemas
├── services/
│   ├── whatsapp.ts      # WhatsApp client integration
│   ├── scheduler.ts     # Scheduled messages (legacy)
│   └── pubsub.ts        # Pub/sub core service
├── middleware/
│   └── auth.ts          # API key authentication
└── server.ts            # Main Express application

docs/
└── PUBSUB_API.md        # Complete API documentation

examples/
└── pubsub-demo.js       # Demo script
```

## 🐛 Troubleshooting

### Common Issues

**WhatsApp not connecting:**
- Check QR code hasn't expired (refresh `/qr-image`)
- Ensure phone has internet connection
- Try restarting with `POST /restart`

**Messages not sending:**
- Verify WhatsApp connection status via `/health`
- Check queue status with `/queue-status`
- Review message delay settings

**API authentication errors:**
- Verify `API_KEY` environment variable is set
- Check Authorization header format: `Bearer YOUR_API_KEY`

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API implementation
- [Express](https://expressjs.com/) - Web application framework
- [Zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation

---

## 🚀 Production Deployment

### Using Docker

```bash
# Build the image
docker build -t whatsapp-pubsub .

# Run the container
docker run -d \
  -p 3000:3000 \
  -e API_KEY=your-secure-key \
  -v $(pwd)/data:/app/data \
  whatsapp-pubsub
```

### Using Fly.io (Configured)

```bash
fly deploy
```

### Environment Variables for Production

```env
NODE_ENV=production
API_KEY=your-very-secure-api-key-here
PORT=3000
LOG_LEVEL=info
STORAGE_DIR=/app/data
```

## 📈 Scaling Considerations

For high-volume deployments:

1. **Multiple WhatsApp Accounts**: Distribute load across multiple WhatsApp business accounts
2. **Database Upgrade**: Consider PostgreSQL or MongoDB for better performance
3. **Queue System**: Implement Redis-based queue for better reliability
4. **Load Balancing**: Use multiple server instances behind a load balancer
5. **Monitoring**: Implement comprehensive monitoring with Prometheus/Grafana

---

**Ready to get started?** Follow the [Quick Start Guide](#-quick-start-guide) above!