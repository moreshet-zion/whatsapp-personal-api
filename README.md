# Personal WhatsApp API

Implements the server described in `api-spec.openai` using Express, Baileys, and node-cron.

## Quick start

```bash
npm run dev
```

- Open http://localhost:3000/health
- Get QR for linking: http://localhost:3000/qr

## Endpoints

See `api-spec.openai` for full schema.

- GET `/health`
- GET `/qr`
- POST `/send`
- GET `/scheduled`
- POST `/scheduled`
- PUT `/scheduled/:id`
- DELETE `/scheduled/:id`
- POST `/scheduled/:id/toggle`
- POST `/restart`
- GET `/schedule-examples`

## Notes

- Sessions stored in `sessions/`
- Scheduled messages stored in `data/scheduled.json`
- Uses Baileys. Docs: https://baileys.wiki/docs/intro/ and repo: https://github.com/WhiskeySockets/Baileys
