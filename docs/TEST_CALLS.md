# Personal WhatsApp API — Test Calls

Set a base URL (local or deployed) and try these curl requests.

```bash
export BASE_URL=http://localhost:3000
```

## Health

```bash
curl -s "$BASE_URL/health" | jq
```

## QR (JSON)

```bash
curl -s "$BASE_URL/qr" | jq
```

- If not authenticated, response includes `qr` (string) and `qrImage` (data URL).
- If already authenticated, returns `{ success: false, message: "Already authenticated" }`.

## QR (HTML page)

```bash
# macOS (open in default browser)
open "$BASE_URL/qr-image"

# Linux (xdg-open) or use your browser
xdg-open "$BASE_URL/qr-image" || true
```

## Send Message (immediate)

```bash
curl -s -X POST "$BASE_URL/send" \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "1234567890",
    "message": "Hello from my API!"
  }' | jq
```

Notes:
- `number` should be digits only, as per spec example (no `+`).
- Ensure your WhatsApp is linked and the number is valid on WhatsApp.

## Scheduled Messages — List

```bash
curl -s "$BASE_URL/scheduled" | jq
```

## Scheduled Messages — Create

```bash
curl -s -X POST "$BASE_URL/scheduled" \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "1234567890",
    "message": "Happy Monday!",
    "schedule": "0 9 * * 1",
    "description": "Weekly Monday greeting",
    "oneTime": false
  }' | jq
```

Copy the returned `scheduledMessage.id` value for the following calls:

```bash
export ID="<paste-id-here>"
```

## Scheduled Messages — Update

```bash
curl -s -X PUT "$BASE_URL/scheduled/$ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Updated Monday greeting",
    "schedule": "0 10 * * 1",  
    "active": true
  }' | jq
```

## Scheduled Messages — Toggle Active

```bash
curl -s -X POST "$BASE_URL/scheduled/$ID/toggle" | jq
```

## Scheduled Messages — Delete

```bash
curl -s -X DELETE "$BASE_URL/scheduled/$ID" | jq
```

## Restart WhatsApp Session

```bash
curl -s -X POST "$BASE_URL/restart" | jq
```

## Schedule Examples

```bash
curl -s "$BASE_URL/schedule-examples" | jq
```

---

Tips:
- Use `jq` for pretty-printing JSON (`brew install jq` or your package manager).
- Validate cron expressions at https://crontab.guru.
