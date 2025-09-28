# WhatsApp Personal API with Scheduling

A comprehensive WhatsApp API server with advanced scheduling, pub/sub messaging, and group support. Perfect for personal automation, team communication, birthday reminders, and broadcast messaging.

## ✨ Features

- 📱 **Instant Messaging**: Send immediate messages to individuals and groups
- ⏰ **Smart Scheduling**: Cron-based recurring and date-based one-time messages  
- 📣 **Pub/Sub System**: Broadcast messages to multiple subscribers with topics
- 👥 **Group Support**: Full WhatsApp group messaging capabilities
- 🔄 **Task Management**: Activate/deactivate schedules without losing them
- 📊 **Bulk Operations**: Manage multiple schedules efficiently
- 🔐 **Secure Authentication**: API key and bearer token support
- 💾 **Persistent Storage**: Reliable data persistence for sessions and schedules
- 🌐 **Production Ready**: Docker, Fly.io deployment configurations included
- 📚 **Complete Documentation**: Comprehensive guides and API reference

## 🚀 Quick Start

Prereqs: Node.js 18+ (or 20+ recommended)

1) Install deps
```bash
npm install
```

2) Configure environment
```bash
echo 'API_TOKENS=dev_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' > .env
echo 'PORT=3000' >> .env
```

3) Start the server (dev)
```bash
npm run dev
```

4) Link WhatsApp
- Open http://localhost:3000/qr-image (recommended) or GET `/qr`
- Scan the QR using WhatsApp → Linked devices → Link a device

5) Test the API (replace the key)
```bash
curl -H "x-api-key: dev_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" http://localhost:3000/health
```

Notes
- After first link, Baileys reuses credentials in `sessions/` and reconnects automatically on restart.
- Persist `sessions/` and `data/` in production to avoid re‑auth and to keep schedules.

## 🔐 API Authentication

All endpoints require an API key:
- Header: `x-api-key: <key>`
- Alternatively: `Authorization: Bearer <key>`

Configure comma‑separated keys via `API_TOKENS`.

## 📋 API Overview

### System & Health
- `GET /health` — Connection status and system information
- `GET /health/redis` — Redis connectivity and write/delete readiness probe
- `GET /qr`, `GET /qr-image` — WhatsApp QR code for authentication
- `POST /restart` — Restart WhatsApp session
- `GET /groups` — List WhatsApp groups

### Messaging
- `POST /send` — Send immediate messages to individuals or groups

### Scheduled Messages  
- `GET /scheduled` — List with filtering options
- `POST /scheduled` — Create cron-based recurring schedules
- `POST /scheduleDate` — Create date-based one-time schedules
- `PUT /scheduled/{id}` — Update schedules
- `DELETE /scheduled/{id}` — Delete schedules  
- `POST /scheduled/{id}/toggle` — Activate/deactivate schedules
- `POST /scheduled/bulk` — Bulk operations (activate/deactivate/delete)

### Pub/Sub Broadcasting
- `GET /pubsub/topics` — List all topics
- `POST /pubsub/topics` — Create topics
- `GET /pubsub/topics/{id}` — Get topic details
- `DELETE /pubsub/topics/{id}` — Delete topics
- `POST /pubsub/topics/{id}/subscribers` — Subscribe phone numbers
- `DELETE /pubsub/topics/{id}/subscribers` — Unsubscribe phone numbers  
- `GET /pubsub/subscriptions/{number}` — Check subscription status
- `POST /pubsub/publish` — Broadcast messages to topic subscribers
- `GET /pubsub/settings` — View/update broadcast settings

### Utilities
- `GET /schedule-examples` — Cron expression examples and help

📖 **Complete API Documentation**: See [API Reference](docs/API_REFERENCE.md) for detailed schemas and examples.

### Sent History

When Redis is configured, all successfully sent messages are automatically recorded to `sent_history` Redis stream with a hash index for fast lookups.

```bash
# Show last 5 sent records
XRANGE sent_history - + COUNT 5

# Lookup by id
HGETALL sent:index:<id>
```

### Redis Health

Quick readiness probe for Redis:

```bash
curl -sS http://localhost:8080/health/redis | jq
```

**Response Format:**
- ✅ **Redis Available**: `200 OK` with connection latency and timestamp
- ❌ **Redis Unavailable**: `503 Service Unavailable` with error reason and helpful hints

**Environment Variables:**
- `REDIS_URL` - Redis connection URL (optional)
  - Supports `redis://`, `rediss://`, and `redis+tls://` protocols
  - If not set, Redis-dependent features gracefully return 503 errors

## 💡 Usage Examples

Send immediate message
```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "number": "1234567890",
    "message": "Hello from my API!"
  }'
```

Create weekly schedule
```bash
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "number": "1234567890",
    "message": "Weekly Monday check-in",
    "schedule": "0 10 * * 1",
    "description": "Monday 10am"
  }'
```

Create a topic and broadcast
```bash
# Create a topic
curl -X POST http://localhost:3000/pubsub/topics \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{ "name": "Daily Updates" }'

# Subscribe numbers
curl -X POST http://localhost:3000/pubsub/topics/<TOPIC_ID>/subscribers \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{ "number": "+1234567890" }'

# Broadcast with the configured delay between each recipient
curl -X POST http://localhost:3000/pubsub/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{ "topicId": "<TOPIC_ID>", "message": "Good morning!" }'
```

One‑time Sunday 04:27
```bash
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "number": "1234567890",
    "message": "One-time reminder",
    "schedule": "27 4 * * 0",
    "oneTime": true
  }'
```

Toggle a schedule
```bash
curl -X POST http://localhost:3000/scheduled/<ID>/toggle \
  -H "x-api-key: <API_KEY>"
```

📖 **More Examples**: See [Test Calls Guide](docs/TEST_CALLS.md) for comprehensive curl examples.

## ⏰ Cron Tips

- Format: `minute hour day month dayOfWeek`
- Validate at https://crontab.guru
- Common:
  - Daily 9am → `0 9 * * *`
  - Mondays 10am → `0 10 * * 1`
  - Fridays 5pm → `0 17 * * 5`

## 🧱 Data Storage

- WhatsApp credentials: `sessions/`
- Scheduled messages: `data/scheduled.json`
- Pub/Sub topics + subscribers: `data/pubsub.json`

## 🌐 Deployment

Fly.io (included `fly.toml`)
```bash
fly volumes create whatsapp_storage -r <region> -s 1
fly secrets set API_TOKENS=<your_keys>
fly deploy
```
Notes: One volume is used at `/data` via `STORAGE_DIR`. It contains `sessions/` and `data/` folders.

Docker
```bash
# Build
docker build -t whatsapp-personal-api .
# Run (map volumes to persist sessions/data)
docker run -p 3000:8080 \
  -e API_TOKENS=<your_keys> \
  -e STORAGE_DIR=/data \
  -v $(pwd)/storage:/data \
  whatsapp-personal-api
```

## 🛡️ Notes & Best Practices

- Personal use only; do not spam. Respect WhatsApp terms.
- Keep your API key secret. Rotate if leaked.
- Persist `sessions/` to avoid scanning again after restarts.
- Monitor `/health` and logs for connection state.
- Baileys does not expose throttling controls, so the pub/sub sender enforces your configured delay between each recipient to avoid spamming WhatsApp.

## 📚 Documentation

### Quick Start
- 🚀 **[Getting Started](docs/GETTING_STARTED.md)** - Setup and first steps
- 📋 **[API Reference](docs/API_REFERENCE.md)** - Complete endpoint documentation
- 🧪 **[Test Calls](docs/TEST_CALLS.md)** - curl examples and testing

### Feature Guides  
- ⏰ **[Scheduling Guide](docs/SCHEDULING_GUIDE.md)** - Master cron and date-based scheduling
- 📣 **[Pub/Sub Guide](docs/PUBSUB_GUIDE.md)** - Broadcasting and topic management
- 👥 **[Group Messaging](docs/GROUP_MESSAGING.md)** - Send to WhatsApp groups
- 🚀 **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment options
- 🔧 **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Reference
- 📄 **[OpenAPI Spec](api-spec.openai)** - Import into Postman/Insomnia
- 🔧 **[Task Management Features](TASK_MANAGEMENT_FEATURES.md)** - Schedule management

## 🛡️ Best Practices

- **Personal Use Only**: Respect WhatsApp Terms of Service
- **API Security**: Keep API keys secret, rotate regularly  
- **Data Backup**: Persist `sessions/` and `data/` directories
- **Rate Limiting**: Use pub/sub delays to avoid WhatsApp limits
- **Health Monitoring**: Monitor `/health` endpoint in production

## 📚 References

- **Baileys Library**: https://baileys.wiki/docs/intro/
- **Cron Expressions**: https://crontab.guru
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp
