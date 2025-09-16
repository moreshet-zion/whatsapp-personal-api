# Personal WhatsApp API — Test Calls

Set a base URL (local or deployed) and try these curl requests.

```bash
export BASE_URL=http://localhost:3000
export API_KEY=changeme # set to one of your API_TOKENS
```

## 🔥 Task Management Features

This API provides comprehensive task management capabilities:
- ✅ **Deactivate/Activate**: Toggle scheduled messages on/off without losing them
- ✅ **Delete**: Permanently remove scheduled messages  
- ✅ **Bulk Operations**: Manage multiple tasks at once
- ✅ **Filtering**: Find specific tasks by status
- ✅ **Backwards Compatible**: Works with existing scheduled cron jobs

## Health

```bash
curl -s "$BASE_URL/health" -H "x-api-key: $API_KEY" | jq
```

## QR (JSON)

```bash
curl -s "$BASE_URL/qr" -H "x-api-key: $API_KEY" | jq
```

- If not authenticated, response includes `qr` (string) and `qrImage` (data URL).
- If already authenticated, returns `{ success: false, message: "Already authenticated" }`.

## QR (HTML page)

```bash
# macOS (open in default browser)
open "$BASE_URL/qr-image" # add x-api-key in browser via query if needed ?key=$API_KEY

# Linux (xdg-open) or use your browser
xdg-open "$BASE_URL/qr-image" || true
```

## Send Message (immediate)

```bash
curl -s -X POST "$BASE_URL/send" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "972545828285",
    "message": "Hello from my API!"
  }' | jq
```

Notes:
- `number` should be digits only, as per spec example (no `+`).
- Ensure your WhatsApp is linked and the number is valid on WhatsApp.

## Scheduled Messages — List

```bash
# Get all scheduled messages
curl -s "$BASE_URL/scheduled" -H "x-api-key: $API_KEY" | jq

# Get only active scheduled messages
curl -s "$BASE_URL/scheduled?active=true" -H "x-api-key: $API_KEY" | jq

# Get only inactive/deactivated messages
curl -s "$BASE_URL/scheduled?active=false" -H "x-api-key: $API_KEY" | jq

# Get only one-time messages
curl -s "$BASE_URL/scheduled?oneTime=true" -H "x-api-key: $API_KEY" | jq
```

## Scheduled Messages — Create

```bash
curl -s -X POST "$BASE_URL/scheduled" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "972545828285",
    "message": "Happy Monday!",
    "schedule": "0 9 * * 1",
    "description": "Weekly Monday greeting",
    "oneTime": true
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
  -H "x-api-key: $API_KEY" \
  -d '{
    "message": "Updated Monday greeting",
    "schedule": "0 10 * * 1",  
    "active": true
  }' | jq
```

## Scheduled Messages — Toggle Active/Inactive (Deactivate)

```bash
# Toggle active status (activate if inactive, deactivate if active)
curl -s -X POST "$BASE_URL/scheduled/$ID/toggle" -H "x-api-key: $API_KEY" | jq
```

**💡 Pro Tip**: Use toggle to temporarily disable messages without losing them. Perfect for vacation mode or testing!

## Scheduled Messages — Delete (Permanent)

```bash
# ⚠️ WARNING: This permanently deletes the scheduled message
curl -s -X DELETE "$BASE_URL/scheduled/$ID" -H "x-api-key: $API_KEY" | jq
```

## Scheduled Messages — Bulk Operations ✨ NEW

```bash
# Bulk deactivate multiple messages (great for maintenance mode)
curl -s -X POST "$BASE_URL/scheduled/bulk" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "ids": ["id1", "id2", "id3"],
    "action": "deactivate"
  }' | jq

# Bulk activate multiple messages
curl -s -X POST "$BASE_URL/scheduled/bulk" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "ids": ["id1", "id2", "id3"],
    "action": "activate"
  }' | jq

# Bulk delete multiple messages (⚠️ PERMANENT)
curl -s -X POST "$BASE_URL/scheduled/bulk" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "ids": ["id1", "id2", "id3"],
    "action": "delete"
  }' | jq
```

## Restart WhatsApp Session

```bash
curl -s -X POST "$BASE_URL/restart" -H "x-api-key: $API_KEY" | jq
```

## Schedule Examples

```bash
curl -s "$BASE_URL/schedule-examples" -H "x-api-key: $API_KEY" | jq
```

---

## 🎯 Task Management Best Practices

### Deactivate vs Delete
- **Deactivate** (`toggle` or `active: false`): Temporarily disable messages. Perfect for:
  - Vacation mode
  - Testing/debugging  
  - Seasonal messages
  - Maintenance periods
- **Delete**: Permanently remove messages. Use when you're sure you won't need them again.

### Bulk Operations
- Use bulk operations to efficiently manage multiple tasks
- Always test with a small batch first
- Check the `results` object to see which operations succeeded/failed

### Filtering
- Use query parameters to find specific messages:
  - `?active=false` - Find all deactivated messages
  - `?active=true` - Find all active messages  
  - `?oneTime=true` - Find all one-time messages

### Backwards Compatibility
- ✅ Existing scheduled cron jobs continue to work
- ✅ Old messages without `active` field default to active
- ✅ No migration needed

---

Tips:
- Use `jq` for pretty-printing JSON (`brew install jq` or your package manager).
- Validate cron expressions at https://crontab.guru.
