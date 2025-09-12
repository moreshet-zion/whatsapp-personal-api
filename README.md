# WhatsApp Personal API with Scheduling

A powerful personal WhatsApp API server with scheduled messaging capabilities. Perfect for birthday reminders, regular check-ins, and automated notifications.

## ✨ Features

- 📱 **Send immediate WhatsApp messages** via REST API
- ⏰ **Schedule recurring messages** (daily, weekly, monthly)
- 🎂 **One-time scheduled messages** (birthdays, reminders)
- 🔄 **Pause/resume scheduling** functionality
- 📊 **Connection health monitoring**
- 🔐 **QR code authentication**
- 💾 **Persistent message storage**
- 🚀 **Free deployment on Railway**

## 🚀 Quick Start

### Local Development

1. **Clone and install dependencies:**
```bash
git clone <your-repo-url>
cd whatsapp-personal-api
npm install
```

2. **Start the server:**
```bash
npm start
```

3. **Authenticate with WhatsApp:**
   - Visit `http://localhost:3000/qr`
   - Scan the QR code with your WhatsApp mobile app
   - Wait for "WhatsApp Client is ready!" message

4. **Test the API:**
```bash
# Check health
curl http://localhost:3000/health

# Send a message
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890","message":"Hello from my API!"}'
```

## 🌐 Railway Deployment (Free Tier)

Railway offers the best free tier for this project:
- **500 hours/month** (better than Heroku)
- **Persistent storage** included
- **Easy GitHub integration**
- **Automatic deployments**

### Deploy to Railway

1. **Create Railway account:** Visit [railway.app](https://railway.app)

2. **Connect your GitHub repo:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Railway auto-detects the configuration** from `railway.toml`

4. **Environment variables** (optional):
   - `PORT` (automatically set by Railway)
   - Add any custom environment variables if needed

5. **Deploy:**
   - Push to your main branch
   - Railway automatically deploys
   - Get your live URL: `https://your-app.railway.app`

6. **Authenticate on production:**
   - Visit `https://your-app.railway.app/qr`
   - Scan QR code with WhatsApp
   - Your API is now live! 🎉

## 📋 API Endpoints

### System
- `GET /health` - Connection status and system info
- `GET /qr` - QR code for WhatsApp authentication
- `POST /restart` - Restart WhatsApp session

### Messaging
- `POST /send` - Send immediate message

### Scheduled Messages
- `GET /scheduled` - List all scheduled messages
- `POST /scheduled` - Create scheduled message
- `PUT /scheduled/:id` - Update scheduled message
- `DELETE /scheduled/:id` - Delete scheduled message
- `POST /scheduled/:id/toggle` - Pause/resume scheduled message

### Utilities
- `GET /schedule-examples` - Cron schedule examples

## 💡 Usage Examples

### Send Immediate Message
```bash
curl -X POST https://your-app.railway.app/send \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "message": "Hello! This is from my personal API 🚀"
  }'
```

### Schedule Daily Good Morning Message
```bash
curl -X POST https://your-app.railway.app/scheduled \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "message": "Good morning! Have a great day! ☀️",
    "schedule": "0 8 * * *",
    "description": "Daily morning greeting"
  }'
```

### Schedule Weekly Check-in
```bash
curl -X POST https://your-app.railway.app/scheduled \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "message": "Hey! How was your weekend? 😊",
    "schedule": "0 10 * * 1",
    "description": "Weekly Monday check-in"
  }'
```

### Schedule Birthday Reminder
```bash
curl -X POST https://your-app.railway.app/scheduled \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "message": "🎉 Happy Birthday! Hope you have an amazing day! 🎂",
    "schedule": "0 9 15 3 *",
    "description": "John's birthday - March 15th",
    "oneTime": false
  }'
```

### One-time Reminder
```bash
curl -X POST https://your-app.railway.app/scheduled \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "message": "Don't forget about the meeting at 3 PM today!",
    "schedule": "0 14 25 12 *",
    "description": "Christmas meeting reminder",
    "oneTime": true
  }'
```

## ⏰ Cron Schedule Examples

| Description | Cron Expression | Explanation |
|-------------|----------------|-------------|
| Every day at 9 AM | `0 9 * * *` | Daily morning message |
| Every Monday at 10 AM | `0 10 * * 1` | Weekly check-in |
| Every Friday at 5 PM | `0 17 * * 5` | Weekend greeting |
| Every weekday at 8 AM | `0 8 * * 1-5` | Work day reminders |
| First of every month at noon | `0 12 1 * *` | Monthly reminder |
| Every 30 minutes | `*/30 * * * *` | Frequent updates |
| Christmas Day at 9 AM | `0 9 25 12 *` | Holiday greeting |
| Every Sunday at 7 PM | `0 19 * * 0` | Weekly wrap-up |

**Format:** `minute hour day month dayOfWeek`

**Tip:** Use [crontab.guru](https://crontab.guru) to validate your cron expressions!

## 🛠️ Advanced Usage

### Check System Status
```bash
curl https://your-app.railway.app/health
```

### List All Scheduled Messages
```bash
curl https://your-app.railway.app/scheduled
```

### Pause a Scheduled Message
```bash
curl -X POST https://your-app.railway.app/scheduled/MESSAGE_ID/toggle
```

### Update a Scheduled Message
```bash
curl -X PUT https://your-app.railway.app/scheduled/MESSAGE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Updated message content!",
    "schedule": "0 10 * * *"
  }'
```

## 🔧 Configuration

### Environment Variables
- `PORT` - Server port (default: 3000, set automatically by Railway)

### Data Storage
- Scheduled messages are stored in `data/scheduled_messages.json`
- WhatsApp session data is stored in `whatsapp_session/`
- Both directories are created automatically

## 🚨 Important Notes

### Railway Deployment
- **Free tier:** 500 hours/month (about 16.7 hours/day)
- **Persistent storage:** Included (your scheduled messages persist)
- **Auto-sleep:** App sleeps after 30 minutes of inactivity
- **Wake-up:** First request after sleep takes ~10-15 seconds

### WhatsApp Limitations
- You need to scan QR code once per deployment
- If WhatsApp session expires, you'll need to re-authenticate
- WhatsApp may temporarily limit message sending if you send too many messages

### Best Practices
- Don't spam messages (respect WhatsApp's terms)
- Test with your own number first
- Monitor the `/health` endpoint
- Keep scheduled messages reasonable (not too frequent)

## 🛡️ Security

- This is designed for **personal use only**
- No authentication is implemented (add your own if needed)
- Keep your Railway URL private
- Don't share your QR code or session files

## 📱 Mobile App Integration

You can build a simple mobile app or web interface to interact with your API:

```javascript
// Example: Send message from JavaScript
async function sendMessage(number, message) {
  const response = await fetch('https://your-app.railway.app/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, message })
  });
  return response.json();
}

// Example: Create scheduled message
async function scheduleMessage(number, message, schedule, description) {
  const response = await fetch('https://your-app.railway.app/scheduled', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, message, schedule, description })
  });
  return response.json();
}
```

## 🆘 Troubleshooting

### Common Issues

1. **Chrome/Puppeteer timeout errors:**
   - Run `npm run check-chrome` to test Chrome configuration
   - Ensure Chrome or Chromium is installed on your system
   - The app automatically detects Chrome installation
   - If issues persist, set `PUPPETEER_EXECUTABLE_PATH` environment variable

2. **QR Code not showing:**
   - Wait a few seconds after starting the server
   - Visit `/qr` endpoint again
   - Check server logs for errors

3. **Messages not sending:**
   - Check `/health` endpoint - ensure status is "connected"
   - Verify phone number format (no country code, just digits)
   - Check WhatsApp connection on your phone

4. **Scheduled messages not working:**
   - Verify cron expression at [crontab.guru](https://crontab.guru)
   - Check if message is active: `GET /scheduled`
   - Ensure WhatsApp is connected when schedule triggers

5. **Port already in use:**
   - Kill existing processes: `pkill -f "node server.js"`
   - Or use a different port: `PORT=3001 npm start`

6. **Deployment issues:**
   - Check build logs in deployment platform dashboard
   - Ensure all files are committed to Git
   - Verify `package.json` has correct start script

### Logs and Debugging

**Local development:**
```bash
npm run dev  # Uses nodemon for auto-restart
```

**Railway logs:**
- View logs in Railway dashboard
- Check health endpoint for system status
- Monitor scheduled message activity

## 🎯 Use Cases

### Personal Automation
- Birthday reminders for friends and family
- Daily motivational messages to yourself
- Weekly check-ins with loved ones
- Appointment reminders
- Medication reminders

### Business/Professional
- Client follow-ups
- Meeting reminders
- Weekly status updates
- Holiday greetings
- Project deadline alerts

### Fun & Creative
- Daily jokes or quotes
- Weather updates
- Random compliments
- Trivia questions
- Photo sharing reminders

## 📄 License

MIT License - feel free to modify and use for personal projects!

## 🤝 Contributing

This is a personal project template, but feel free to:
- Report bugs
- Suggest improvements
- Share your use cases
- Fork and customize for your needs

---

**Enjoy your personal WhatsApp automation! 🚀**

For questions or issues, check the troubleshooting section above or review the server logs.
