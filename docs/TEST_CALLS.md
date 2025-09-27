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

### Send to Individual Number

```bash
curl -s -X POST "$BASE_URL/send" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "972545828285",
    "message": "Hello from my API!"
  }' | jq
```

### Send to WhatsApp Group

```bash
# First, get your groups to find the JID
curl -s "$BASE_URL/groups" -H "x-api-key: $API_KEY" | jq

# Then send to a group using the JID
curl -s -X POST "$BASE_URL/send" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "jid": "120363147258369076@g.us",
    "message": "Hello group! This is a message from the API 👋"
  }' | jq
```

Notes:
- `number` should be digits only, as per spec example (no `+`).
- Use `jid` for WhatsApp groups (format: `{groupId}@g.us`)
- Ensure your WhatsApp is linked and the number/group is valid on WhatsApp.

## 👥 WhatsApp Groups

### List Your Groups

```bash
curl -s "$BASE_URL/groups" -H "x-api-key: $API_KEY" | jq
```

This returns all WhatsApp groups you're part of with their JIDs, names, and participant counts.

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

# Get only executed date-based messages
curl -s "$BASE_URL/scheduled?executed=true" -H "x-api-key: $API_KEY" | jq

# Get pending date-based messages
curl -s "$BASE_URL/scheduled?executed=false&oneTime=true" -H "x-api-key: $API_KEY" | jq
```

## Scheduled Messages — Create (Cron-based)

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

## Scheduled Messages — Create (Date-based) ✨ NEW

Schedule a one-time message for a specific date and time:

```bash
# Schedule a message for December 26, 2025 at 8:34 PM
curl -s -X POST "$BASE_URL/scheduleDate" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "972545828285",
    "message": "Happy Holidays! 🎄",
    "scheduleDate": "2025-12-26T20:34:00Z",
    "description": "Holiday greeting"
  }' | jq

# Schedule a birthday reminder
curl -s -X POST "$BASE_URL/scheduleDate" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "972545828285",
    "message": "Happy Birthday! 🎂 Hope you have an amazing day!",
    "scheduleDate": "2025-10-15T09:00:00Z",
    "description": "Birthday reminder for John"
  }' | jq

# Schedule a meeting reminder (30 minutes from now)
FUTURE_TIME=$(date -u -d "+30 minutes" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+30M +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X POST "$BASE_URL/scheduleDate" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"number\": \"972545828285\",
    \"message\": \"Meeting reminder: Team standup in 5 minutes\",
    \"scheduleDate\": \"$FUTURE_TIME\",
    \"description\": \"Meeting reminder\"
  }" | jq
```

Copy the returned `scheduledMessage.id` value for the following calls:

```bash
export ID="<paste-id-here>"
```

## Scheduled Messages — Update

```bash
# Update a cron-based schedule
curl -s -X PUT "$BASE_URL/scheduled/$ID" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "message": "Updated Monday greeting",
    "schedule": "0 10 * * 1",  
    "active": true
  }' | jq

# Update a date-based schedule (change the date/time)
curl -s -X PUT "$BASE_URL/scheduled/$ID" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "message": "Updated holiday message",
    "scheduleDate": "2025-12-25T18:00:00Z",
    "description": "Christmas greeting"
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

## 📣 Pub/Sub System ✨ NEW

The pub/sub system allows broadcasting messages to multiple subscribers organized by topics.

### Create Topic

```bash
curl -s -X POST "$BASE_URL/pubsub/topics" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "daily-updates",
    "description": "Daily team updates"
  }' | jq

# Save the returned topic ID for next steps
export TOPIC_ID="<paste-topic-id-here>"
```

### List All Topics

```bash
curl -s "$BASE_URL/pubsub/topics" -H "x-api-key: $API_KEY" | jq
```

### Subscribe Phone Numbers

```bash
# Add first subscriber
curl -s -X POST "$BASE_URL/pubsub/topics/$TOPIC_ID/subscribers" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890"
  }' | jq

# Add second subscriber  
curl -s -X POST "$BASE_URL/pubsub/topics/$TOPIC_ID/subscribers" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "0987654321"
  }' | jq
```

### View Topic Subscribers

```bash
curl -s "$BASE_URL/pubsub/topics/$TOPIC_ID/subscribers" \
  -H "x-api-key: $API_KEY" | jq
```

### Broadcast Message

```bash
# Broadcast to all subscribers of the topic
curl -s -X POST "$BASE_URL/pubsub/publish" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "topicId": "'$TOPIC_ID'",
    "message": "🚀 Daily Update: All systems operational! Team productivity is at an all-time high. Keep up the great work! 👍"
  }' | jq
```

### Check Subscription Status

```bash
# See which topics a phone number is subscribed to
curl -s "$BASE_URL/pubsub/subscriptions/1234567890" \
  -H "x-api-key: $API_KEY" | jq
```

### Unsubscribe from Topic

```bash
curl -s -X DELETE "$BASE_URL/pubsub/topics/$TOPIC_ID/subscribers" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890"
  }' | jq
```

### Pub/Sub Settings

```bash
# View current settings
curl -s "$BASE_URL/pubsub/settings" -H "x-api-key: $API_KEY" | jq

# Update message delay (to avoid rate limiting)
curl -s -X PUT "$BASE_URL/pubsub/settings" \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -d '{
    "messageDelaySeconds": 2
  }' | jq
```

### Delete Topic

```bash
# ⚠️ WARNING: This permanently deletes the topic and all subscribers
curl -s -X DELETE "$BASE_URL/pubsub/topics/$TOPIC_ID" \
  -H "x-api-key: $API_KEY" | jq
```

---

## 📅 Date-Based vs Cron-Based Schedules

### Date-Based Schedules (`/scheduleDate`)
- **One-time messages**: Sent once at a specific date and time
- **Use cases**: 
  - Birthday reminders
  - Holiday greetings  
  - Meeting reminders
  - Event notifications
  - Appointment confirmations
- **Format**: ISO 8601 date-time (e.g., `2025-12-26T20:34:00Z`)
- **Behavior**: 
  - Message is sent once and marked as `executed`
  - Can be cancelled/deactivated before execution
  - Cannot be in the past (except 1 minute grace period)

### Cron-Based Schedules (`/scheduled`)
- **Recurring messages**: Sent on a repeating schedule
- **Use cases**:
  - Daily reminders
  - Weekly check-ins
  - Monthly reports
  - Regular notifications
- **Format**: Cron expression (e.g., `0 9 * * 1` for every Monday at 9 AM)
- **Behavior**:
  - Repeats according to cron pattern
  - Can be set as `oneTime` to auto-deactivate after first send
  - Use https://crontab.guru to validate expressions

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
