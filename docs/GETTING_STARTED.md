# Getting Started Guide

This guide will help you set up and start using the WhatsApp Personal API with Scheduling.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [First Setup](#first-setup)
5. [Basic Usage](#basic-usage)
6. [Next Steps](#next-steps)

---

## Prerequisites

- **Node.js 18+** (Node.js 20+ recommended)
- **WhatsApp Account** that can be linked to WhatsApp Web
- **Basic knowledge** of REST APIs and JSON

---

## Installation

### 1. Clone and Install

```bash
# Clone the repository (if applicable) or navigate to your project folder
cd your-whatsapp-api-project

# Install dependencies
npm install
```

### 2. Verify Installation

```bash
# Check if TypeScript compiles successfully
npm run build

# Check if all dependencies are installed
npm ls
```

---

## Configuration

### 1. Create Environment File

Create a `.env` file in your project root:

```bash
# Create .env file
touch .env
```

### 2. Configure API Keys

Add your configuration to `.env`:

```env
# Required: API authentication tokens (comma-separated)
API_TOKENS=dev_your_secret_key_here_32_chars,prod_another_key_here

# Optional: Server port (defaults to 3000)
PORT=3000

# Optional: Storage directory (defaults to current directory)
STORAGE_DIR=./data

# Optional: Log level (defaults to 'info')
LOG_LEVEL=info
```

**Security Note:** Keep your API keys secret! Use long, random strings (32+ characters).

### 3. Generate Secure API Keys

```bash
# Generate a secure API key (Linux/macOS)
openssl rand -hex 32

# Or use Node.js
node -e "console.log('api_' + require('crypto').randomBytes(32).toString('hex'))"
```

---

## First Setup

### 1. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Or production mode
npm start
```

You should see:
```
Server listening on http://localhost:3000
```

### 2. Check System Health

Test that the API is running:

```bash
# Test without authentication (health endpoint only)
curl http://localhost:3000/health

# Should return:
# {
#   "status": "disconnected",
#   "timestamp": "2024-01-15T10:30:00Z",
#   "scheduledMessages": 0,
#   "activeJobs": 0
# }
```

### 3. Link WhatsApp Account

**Option A: Browser Method (Recommended)**

1. Open your browser and go to: `http://localhost:3000/qr-image`
2. You'll see a QR code page
3. Open WhatsApp on your phone
4. Go to **Settings → Linked Devices → Link a Device**
5. Scan the QR code displayed in your browser

**Option B: API Method**

```bash
# Get QR code as JSON (replace with your API key)
curl -H "x-api-key: dev_your_secret_key_here_32_chars" http://localhost:3000/qr

# The response includes a base64 image you can display
```

### 4. Verify Connection

After scanning the QR code:

```bash
# Check connection status
curl http://localhost:3000/health

# Should now return:
# {
#   "status": "connected",
#   "timestamp": "2024-01-15T10:35:00Z",
#   "scheduledMessages": 0,
#   "activeJobs": 0
# }
```

---

## Basic Usage

Now that your API is connected, let's try some basic operations.

### 1. Send Your First Message

```bash
# Set your API key as a variable (replace with your actual key)
export API_KEY="dev_your_secret_key_here_32_chars"

# Send a test message to yourself (replace with your number)
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "Hello from my WhatsApp API! 🎉"
  }'
```

**Note:** Use your phone number in digits only format (no + or spaces).

### 2. Schedule a Recurring Message

```bash
# Schedule a daily reminder at 9 AM
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "Good morning! Have a great day! ☀️",
    "schedule": "0 9 * * *",
    "description": "Daily morning greeting"
  }'
```

### 3. Schedule a One-Time Message

```bash
# Schedule a birthday message for next week
curl -X POST http://localhost:3000/scheduleDate \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "Happy Birthday! 🎂 Hope you have an amazing day!",
    "scheduleDate": "2024-02-15T09:00:00Z",
    "description": "Birthday reminder"
  }'
```

### 4. View Your Scheduled Messages

```bash
# List all scheduled messages
curl -H "x-api-key: $API_KEY" http://localhost:3000/scheduled
```

### 5. Create Your First Pub/Sub Topic

```bash
# Create a topic for family updates
curl -X POST http://localhost:3000/pubsub/topics \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "family-updates",
    "description": "Updates for the family group"
  }'

# Note the returned topic ID for the next steps
```

---

## Next Steps

Congratulations! You now have a working WhatsApp API. Here's what you can explore next:

### 📚 Learn More Features

1. **[API Reference](API_REFERENCE.md)** - Complete documentation of all endpoints
2. **[Pub/Sub Guide](PUBSUB_GUIDE.md)** - Learn about broadcasting to multiple subscribers  
3. **[Scheduling Guide](SCHEDULING_GUIDE.md)** - Master cron expressions and date-based scheduling
4. **[Group Messaging](GROUP_MESSAGING.md)** - Send messages to WhatsApp groups

### 🛠 Advanced Configuration

1. **[Deployment Guide](DEPLOYMENT.md)** - Deploy to production (Fly.io, Docker)
2. **[Examples & Use Cases](EXAMPLES.md)** - Real-world usage examples
3. **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions

### 🔒 Production Checklist

Before using in production:

- [ ] Generate secure API keys (32+ characters)
- [ ] Set up persistent storage for `/data` and `/sessions` directories  
- [ ] Configure proper backup for your data
- [ ] Set up monitoring for the `/health` endpoint
- [ ] Review and test your scheduled messages
- [ ] Consider rate limiting for your API usage

### 💡 Common Use Cases

- **Birthday Reminders**: Schedule messages for important dates
- **Daily Check-ins**: Send good morning/evening messages
- **Team Updates**: Use pub/sub to broadcast to team members
- **Event Notifications**: Remind about meetings or events  
- **Personal Automation**: Integrate with other services and workflows

---

## Getting Help

- **Documentation**: Check the other guides in the `/docs` folder
- **Examples**: See `TEST_CALLS.md` for comprehensive curl examples
- **OpenAPI Spec**: Import `api-spec.openai` into Postman or similar tools
- **Health Check**: Always start debugging by checking `/health` endpoint

---

## File Structure After Setup

```
your-project/
├── .env                 # Your configuration (keep secret!)
├── data/               # Created automatically
│   ├── scheduled.json   # Your scheduled messages
│   └── pubsub.json     # Your pub/sub topics
├── sessions/           # Created automatically  
│   └── auth_info_...   # WhatsApp session data
├── docs/              # Documentation
├── src/               # Source code
└── ...
```

**Important**: Backup the `data/` and `sessions/` directories to avoid losing your schedules and having to re-authenticate with WhatsApp!