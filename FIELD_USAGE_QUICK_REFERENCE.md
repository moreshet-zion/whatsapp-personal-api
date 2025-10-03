# Quick Reference: number vs jid Fields

## When to Use Which Field

### Use `number` field for:
- ✅ Phone numbers (digits only)
- ✅ Example: `"1234567890"`
- ✅ Will be formatted as: `1234567890@s.whatsapp.net`

### Use `jid` field for:
- ✅ WhatsApp Groups
- ✅ Broadcast Lists  
- ✅ Pre-formatted JIDs
- ✅ Examples:
  - Group: `"120363339062208504@g.us"`
  - Individual: `"1234567890@s.whatsapp.net"`
  - Broadcast: `"120363339062208504@broadcast"`

## Quick Examples

### ✅ Correct Usage

```json
// Send to phone number
{
  "number": "1234567890",
  "message": "Hello!"
}

// Send to group
{
  "jid": "120363339062208504@g.us",
  "message": "Hello everyone!"
}

// Schedule to phone
{
  "number": "1234567890",
  "message": "Reminder",
  "schedule": "0 9 * * *"
}

// Schedule to group
{
  "jid": "120363339062208504@g.us",
  "message": "Weekly update",
  "schedule": "0 9 * * 1"
}
```

### ⚠️ Works But Shows Warning

```json
// JID in wrong field (will be auto-corrected)
{
  "number": "120363339062208504@g.us",
  "message": "Hello everyone!"
}
// Warning: "JID detected in 'number' field..."

// Phone in wrong field (will be auto-corrected)
{
  "jid": "1234567890",
  "message": "Hello!"
}
// Warning: "Phone number detected in 'jid' field..."
```

## Response Format

### Without Warning (Correct Usage)
```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

### With Warning (Auto-Corrected)
```json
{
  "success": true,
  "message": "Scheduled message created",
  "warning": "JID detected in 'number' field. Automatically moved to 'jid' field. Please use 'jid' field for group/broadcast identifiers (e.g., 120363339062208504@g.us).",
  "scheduledMessage": { ... }
}
```

## How to Identify Field Type

```javascript
function determineField(value) {
  // Check if it's a JID (contains @ symbol)
  if (value.includes('@')) {
    // It's a JID - use jid field
    return { jid: value }
  } else {
    // It's a phone number - use number field
    return { number: value }
  }
}

// Usage
const recipient = '120363339062208504@g.us'
const payload = {
  ...determineField(recipient),
  message: 'Hello!'
}
```

## JID Format Reference

| Type | Format | Example |
|------|--------|---------|
| Phone (formatted) | `{digits}@s.whatsapp.net` | `1234567890@s.whatsapp.net` |
| Phone (raw) | `{digits}` | `1234567890` |
| Group | `{groupId}@g.us` | `120363339062208504@g.us` |
| Broadcast | `{listId}@broadcast` | `120363339062208504@broadcast` |

## Common Mistakes

### ❌ Don't Do This
```json
// Phone number with country code prefix
{ "number": "+1234567890" }
// Use: { "number": "1234567890" }

// Group JID in number field
{ "number": "120363339062208504@g.us" }
// Use: { "jid": "120363339062208504@g.us" }

// Phone number in jid field  
{ "jid": "1234567890" }
// Use: { "number": "1234567890" }
```

### ✅ Do This Instead
```json
// Phone numbers
{ "number": "1234567890" }

// Groups
{ "jid": "120363339062208504@g.us" }

// Pre-formatted individual JID
{ "jid": "1234567890@s.whatsapp.net" }
```

## Handling Warnings in Code

### JavaScript/TypeScript
```typescript
const response = await fetch('/scheduled', {
  method: 'POST',
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    number: '120363339062208504@g.us', // Wrong field!
    message: 'Hello',
    schedule: '0 9 * * *'
  })
})

const data = await response.json()

if (data.warning) {
  console.warn('⚠️ Field Usage Warning:', data.warning)
  // Fix your code to use correct fields
}
```

### Python
```python
import requests

response = requests.post(
    'http://localhost:3000/scheduled',
    headers={'x-api-key': API_KEY},
    json={
        'number': '120363339062208504@g.us',  # Wrong field!
        'message': 'Hello',
        'schedule': '0 9 * * *'
    }
)

data = response.json()

if 'warning' in data:
    print(f"⚠️ Field Usage Warning: {data['warning']}")
    # Fix your code to use correct fields
```

### cURL
```bash
# Check for warning in response
RESPONSE=$(curl -s -X POST http://localhost:3000/scheduled \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "120363339062208504@g.us",
    "message": "Hello",
    "schedule": "0 9 * * *"
  }')

WARNING=$(echo $RESPONSE | jq -r '.warning // empty')

if [ -n "$WARNING" ]; then
  echo "⚠️ Warning: $WARNING"
fi
```

## Utility: Fix Existing Messages

If you have existing scheduled messages with wrong field usage:

```bash
curl -X POST http://localhost:3000/scheduled/normalize \
  -H "x-api-key: $API_KEY"
```

Response:
```json
{
  "success": true,
  "message": "Normalized 5 scheduled message(s)",
  "fixed": 5,
  "totalMessages": 42
}
```

## Decision Tree

```
Is your recipient a WhatsApp Group or Broadcast List?
├─ YES → Use `jid` field
│   └─ Value should contain @g.us or @broadcast
│
└─ NO → Is it a phone number?
    ├─ YES → Use `number` field
    │   └─ Value should be digits only (no + or -)
    │
    └─ Is it a pre-formatted individual JID?
        └─ Use `jid` field
            └─ Value contains @s.whatsapp.net
```

## API Endpoints Affected

All these endpoints support both fields with auto-correction:

- `POST /send` - Send immediate message
- `POST /scheduled` - Create cron-based schedule
- `POST /scheduleDate` - Create date-based schedule
- `PUT /scheduled/:id` - Update scheduled message

## Pro Tips

1. **Always check warnings** during development
2. **Log warnings** in production to identify integration issues
3. **Use TypeScript** types to enforce correct field usage
4. **Test with real group JIDs** from `/groups` endpoint
5. **Run normalization** after importing data from other systems

## Still Confused?

**Rule of Thumb:**
- If it has an `@` symbol → use `jid` field
- If it's just numbers → use `number` field

**When in doubt:**
- The API will auto-correct and warn you
- Check the warning message for guidance
- Refer to the examples above
