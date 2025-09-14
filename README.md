# WhatsApp Personal API with Scheduling

A personal WhatsApp API server with scheduled messaging, built on Express + Baileys. Perfect for birthday reminders, regular check‑ins, and automated notifications.

## ✨ Features

- 📱 Send immediate WhatsApp messages via REST API
- ⏰ Schedule recurring messages (daily, weekly, monthly)
- 🎂 One‑time scheduled messages
- 🔄 Pause/resume schedules
- 📊 Connection health endpoint
- 🔐 QR code authentication (+ HTML QR page)
- 💾 Persistent storage for sessions and schedules
- 🛡️ API key authentication

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

## 📋 API Endpoints

See `api-spec.openai` for schema details.

System
- GET `/health` — Connection status and counts
- GET `/qr` — JSON QR payload (when not authenticated)
- GET `/qr-image` — HTML QR page
- POST `/restart` — Restart WhatsApp session

Messaging
- POST `/send` — Send an immediate message

Scheduled Messages
- GET `/scheduled` — List all
- POST `/scheduled` — Create
- PUT `/scheduled/:id` — Update
- DELETE `/scheduled/:id` — Delete
- POST `/scheduled/:id/toggle` — Activate/Deactivate

Utilities
- GET `/schedule-examples`

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

More examples in `docs/TEST_CALLS.md`.

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

## 📚 References

- Baileys docs: https://baileys.wiki/docs/intro/
- Repository: https://github.com/WhiskeySockets/Baileys
