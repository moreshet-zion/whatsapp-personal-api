# WhatsApp Personal API - Documentation Index

Welcome to the comprehensive documentation for the WhatsApp Personal API with Scheduling, Pub/Sub, and Group Messaging capabilities.

## 🚀 Getting Started

New to the API? Start here:

1. **[Getting Started Guide](GETTING_STARTED.md)** - Installation, setup, and first steps
2. **[Test Calls](TEST_CALLS.md)** - Try the API with curl examples
3. **[API Reference](API_REFERENCE.md)** - Complete endpoint documentation

## 📖 Feature Guides

Master specific features:

### Core Messaging
- **[Group Messaging](GROUP_MESSAGING.md)** - Send messages to WhatsApp groups

### Scheduling System
- **[Scheduling Guide](SCHEDULING_GUIDE.md)** - Complete scheduling documentation
  - Cron-based recurring messages
  - Date-based one-time messages
  - Task management and bulk operations
  - Best practices and common patterns

### Pub/Sub Broadcasting  
- **[Pub/Sub Guide](PUBSUB_GUIDE.md)** - Broadcasting system documentation
  - Topic creation and management
  - Subscriber management
  - Message broadcasting with delivery tracking
  - Rate limiting and settings
  - Real-world use cases

## 🚀 Deployment & Production

Deploy your API:

- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment options
  - Fly.io deployment (recommended)
  - Docker deployment
  - VPS deployment
  - Security and monitoring considerations

## 📄 Reference Documentation

Technical references:

- **[API Reference](API_REFERENCE.md)** - Complete endpoint documentation
- **[OpenAPI Specification](../api-spec.openai)** - Import into Postman/Insomnia
- **[Task Management Features](../TASK_MANAGEMENT_FEATURES.md)** - Schedule management capabilities

## 🎯 Quick Navigation

### I want to...

| Goal | Guide | Key Endpoints |
|------|-------|---------------|
| **Send a message right now** | [Getting Started](GETTING_STARTED.md#basic-usage) | `POST /send` |
| **Schedule daily reminders** | [Scheduling Guide](SCHEDULING_GUIDE.md#cron-based-scheduling) | `POST /scheduled` |
| **Send birthday messages** | [Scheduling Guide](SCHEDULING_GUIDE.md#date-based-scheduling) | `POST /scheduleDate` |
| **Broadcast to multiple people** | [Pub/Sub Guide](PUBSUB_GUIDE.md) | `POST /pubsub/publish` |
| **Message WhatsApp groups** | [Group Messaging](GROUP_MESSAGING.md) | `POST /send` with `jid` |
| **Deploy to production** | [Deployment Guide](DEPLOYMENT.md) | N/A |
| **Manage scheduled messages** | [Scheduling Guide](SCHEDULING_GUIDE.md#managing-scheduled-messages) | `PUT /scheduled/{id}` |
| **Pause/resume schedules** | [Task Management](../TASK_MANAGEMENT_FEATURES.md) | `POST /scheduled/{id}/toggle` |

### Common Use Cases

| Use Case | Primary Guide | Secondary Guide |
|----------|---------------|-----------------|
| **Personal reminders** | [Scheduling Guide](SCHEDULING_GUIDE.md) | [Getting Started](GETTING_STARTED.md) |
| **Team notifications** | [Pub/Sub Guide](PUBSUB_GUIDE.md) | [Group Messaging](GROUP_MESSAGING.md) |
| **Family coordination** | [Group Messaging](GROUP_MESSAGING.md) | [Scheduling Guide](SCHEDULING_GUIDE.md) |
| **Event announcements** | [Pub/Sub Guide](PUBSUB_GUIDE.md) | [Scheduling Guide](SCHEDULING_GUIDE.md) |
| **Business automation** | [API Reference](API_REFERENCE.md) | [Deployment Guide](DEPLOYMENT.md) |

## 🔧 Technical Overview

### System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   REST API      │    │   WhatsApp       │    │   Storage       │
│   (Express.js)  │────│   Client         │────│   (JSON files)  │
│                 │    │   (Baileys)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         │                        │                       │
    ┌────▼────┐              ┌────▼────┐              ┌───▼────┐
    │ HTTP    │              │WhatsApp │              │sessions/│
    │Endpoints│              │   Web   │              │  data/  │
    └─────────┘              └─────────┘              └────────┘
```

### Data Flow

1. **Authentication**: API keys validate requests
2. **Message Processing**: Baileys handles WhatsApp protocol
3. **Scheduling**: Cron jobs manage recurring messages
4. **Pub/Sub**: Topic-based broadcasting with rate limiting
5. **Storage**: Persistent JSON files for reliability

### Key Features

- ✅ **RESTful API** with comprehensive endpoints
- ✅ **Real-time messaging** via WhatsApp Web protocol
- ✅ **Persistent scheduling** with cron expressions
- ✅ **Topic-based broadcasting** with subscriber management
- ✅ **Group messaging** support
- ✅ **Bulk operations** for efficient management
- ✅ **Production ready** with Docker and cloud deployment
- ✅ **Comprehensive documentation** with examples

## 🛠 Development & Contributing

### File Structure
```
├── docs/                    # Documentation (you are here)
│   ├── README.md           # This file
│   ├── GETTING_STARTED.md  # Setup guide
│   ├── API_REFERENCE.md    # Complete API docs
│   ├── PUBSUB_GUIDE.md     # Broadcasting guide
│   ├── SCHEDULING_GUIDE.md # Scheduling guide
│   ├── GROUP_MESSAGING.md  # Group messaging guide
│   ├── DEPLOYMENT.md       # Production deployment
│   └── TEST_CALLS.md       # curl examples
├── src/                    # Source code
│   ├── server.ts           # Main server
│   ├── services/           # Core services
│   └── middleware/         # Auth middleware
├── data/                   # Application data (created at runtime)
│   ├── scheduled.json      # Scheduled messages
│   └── pubsub.json         # Pub/sub topics
├── sessions/               # WhatsApp sessions (created at runtime)
├── api-spec.openai         # OpenAPI specification
└── README.md               # Project overview
```

### Support & Community

- 🐛 **Issues**: Report bugs or request features
- 📖 **Documentation**: Comprehensive guides and API reference
- 💡 **Examples**: Real-world usage patterns in guides
- 🔧 **OpenAPI Spec**: Import into your favorite API tool

---

## Next Steps

1. **New Users**: Start with [Getting Started Guide](GETTING_STARTED.md)
2. **Existing Users**: Check out the new [Pub/Sub Guide](PUBSUB_GUIDE.md) 
3. **Production**: Review the [Deployment Guide](DEPLOYMENT.md)
4. **Advanced**: Deep dive into [API Reference](API_REFERENCE.md)

Happy messaging! 🚀