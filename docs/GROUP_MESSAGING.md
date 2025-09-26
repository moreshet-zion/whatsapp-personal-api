# WhatsApp Group Messaging Documentation

This document explains how to send direct and scheduled messages to WhatsApp groups using the updated API.

## Overview

The WhatsApp API has been enhanced to support sending messages to groups in addition to individual phone numbers. This is achieved by using WhatsApp JIDs (Jabber IDs) which are unique identifiers for groups.

## Key Changes

### 1. New `/groups` Endpoint

Fetch all WhatsApp groups you're part of:

```http
GET /groups
```

**Response:**
```json
{
  "success": true,
  "groups": [
    {
      "jid": "120363147258369076@g.us",
      "name": "Family Group",
      "participants": 10
    },
    {
      "jid": "120363147258369077@g.us", 
      "name": "Work Team",
      "participants": 25
    }
  ]
}
```

### 2. Updated `/send` Endpoint

The send endpoint now accepts either a `number` OR a `jid`:

**Send to a phone number:**
```json
POST /send
{
  "number": "1234567890",
  "message": "Hello!"
}
```

**Send to a group:**
```json
POST /send
{
  "jid": "120363147258369076@g.us",
  "message": "Hello group!"
}
```

### 3. Updated Scheduled Messages

Both cron-based and date-based scheduled messages now support groups:

**Schedule recurring message to group:**
```json
POST /scheduled
{
  "jid": "120363147258369076@g.us",
  "message": "Weekly team reminder",
  "schedule": "0 9 * * 1",
  "description": "Monday morning team sync reminder"
}
```

**Schedule one-time message to group:**
```json
POST /scheduleDate
{
  "jid": "120363147258369076@g.us",
  "message": "Happy New Year team! 🎉",
  "scheduleDate": "2025-01-01T00:00:00Z",
  "description": "New Year greeting"
}
```

## Implementation Approach

### Architecture Changes

1. **WhatsApp Service (`/src/services/whatsapp.ts`)**
   - Added `getGroupChats()` method that uses Baileys' `groupFetchAllParticipating()` to fetch all groups
   - Returns simplified group data with JID, name, and participant count

2. **Server Routes (`/src/server.ts`)**
   - Added `/groups` GET endpoint
   - Modified all message-sending endpoints to accept optional `jid` parameter
   - Updated validation schemas to require either `number` OR `jid`

3. **Scheduler Service (`/src/services/scheduler.ts`)**
   - Updated `ScheduledMessage` schema to include optional `jid` field
   - Modified `formatJid()` method to handle both phone numbers and group JIDs
   - Updated `create()` and `createDateSchedule()` methods to accept JIDs

### JID Format

- **Individual numbers:** `{number}@s.whatsapp.net` (e.g., `1234567890@s.whatsapp.net`)
- **Groups:** `{groupId}@g.us` (e.g., `120363147258369076@g.us`)

The system automatically formats phone numbers into JIDs but uses provided JIDs directly.

## Usage Examples

### Example 1: Get all groups and send a message

```bash
# 1. Get all groups
curl -X GET http://localhost:3000/groups \
  -H "x-api-key: YOUR_API_KEY"

# 2. Send message to a specific group
curl -X POST http://localhost:3000/send \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jid": "120363147258369076@g.us",
    "message": "Hello everyone!"
  }'
```

### Example 2: Schedule daily standup reminder

```bash
curl -X POST http://localhost:3000/scheduled \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jid": "120363147258369076@g.us",
    "message": "Daily standup in 15 minutes! 📋",
    "schedule": "45 9 * * 1-5",
    "description": "Daily standup reminder (weekdays at 9:45 AM)"
  }'
```

### Example 3: Schedule a birthday message to a group

```bash
curl -X POST http://localhost:3000/scheduleDate \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jid": "120363147258369076@g.us",
    "message": "Happy Birthday Sarah! 🎂🎉",
    "scheduleDate": "2025-03-15T09:00:00Z",
    "description": "Sarah birthday message to team group"
  }'
```

## Backward Compatibility

All existing functionality remains intact:
- Endpoints that previously accepted only `number` now accept either `number` OR `jid`
- Existing scheduled messages with phone numbers continue to work
- The API maintains full backward compatibility

## Error Handling

- If neither `number` nor `jid` is provided: Returns 400 error
- If WhatsApp is not connected: Returns 503 error
- If group JID is invalid: Message sending will fail with appropriate error

## Benefits

1. **Unified Interface:** Same endpoints work for both individual and group messaging
2. **Flexibility:** Choose between phone numbers or JIDs based on your needs
3. **Group Management:** Easy discovery of available groups via `/groups` endpoint
4. **Scheduling:** Full scheduling support for group messages (recurring and one-time)
5. **Backward Compatible:** No breaking changes to existing integrations