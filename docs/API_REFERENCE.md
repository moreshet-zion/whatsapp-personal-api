# WhatsApp Personal API - Complete API Reference

This document provides comprehensive documentation for all available endpoints and features.

## Table of Contents

1. [Authentication](#authentication)
2. [System Endpoints](#system-endpoints)
3. [Messaging Endpoints](#messaging-endpoints)
4. [Scheduled Messages](#scheduled-messages)
5. [Pub/Sub System](#pubsub-system)
6. [Group Messaging](#group-messaging)
7. [Utilities](#utilities)
8. [Error Handling](#error-handling)
9. [Data Models](#data-models)

---

## Authentication

All endpoints require authentication using one of these methods:

**Header Authentication:**
```bash
x-api-key: your_api_key_here
```

**Bearer Token:**
```bash
Authorization: Bearer your_api_key_here
```

**Exception:** The `/health` endpoint does not require authentication.

---

## System Endpoints

### GET /health
Get system health and connection status.

**Authentication:** None required

**Response:**
```json
{
  "status": "connected", // "connected" | "disconnected"
  "timestamp": "2024-01-15T10:30:00Z",
  "scheduledMessages": 5,
  "activeJobs": 3
}
```

### GET /qr
Get QR code for WhatsApp authentication (JSON format).

**Response when not authenticated:**
```json
{
  "success": true,
  "qr": "QR_CODE_STRING",
  "qrImage": "data:image/png;base64,..."
}
```

**Response when already authenticated:**
```json
{
  "success": false,
  "message": "Already authenticated"
}
```

### GET /qr-image
Get QR code as an HTML page (browser-friendly).

**Response:** HTML page with QR code image and instructions.

### POST /restart
Restart the WhatsApp session.

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp session restart initiated"
}
```

---

## Messaging Endpoints

### POST /send
Send an immediate WhatsApp message.

**Request Body:**
```json
{
  "number": "1234567890", // Optional if jid provided
  "jid": "120363147258369076@g.us", // Optional if number provided
  "message": "Hello from API!"
}
```

**Notes:**
- Provide either `number` (for individual) OR `jid` (for groups)
- Number format: digits only, no country code prefix
- JID format: `{number}@s.whatsapp.net` (individual) or `{groupId}@g.us` (group)

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

### GET /groups
Get all WhatsApp groups you're part of.

**Response:**
```json
{
  "success": true,
  "groups": [
    {
      "jid": "120363147258369076@g.us",
      "name": "Family Group",
      "participants": 10
    }
  ]
}
```

---

## Scheduled Messages

### GET /scheduled
Get all scheduled messages with optional filtering.

**Query Parameters:**
- `active`: `true|false` - Filter by active status
- `oneTime`: `true|false` - Filter by one-time status  
- `executed`: `true|false` - Filter by executed status (date-based schedules)

**Examples:**
```bash
GET /scheduled                    # All messages
GET /scheduled?active=true        # Active messages only
GET /scheduled?active=false       # Inactive messages only
GET /scheduled?oneTime=true       # One-time messages only
GET /scheduled?executed=false     # Pending date-based messages
```

**Response:**
```json
{
  "success": true,
  "scheduledMessages": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "number": "1234567890",
      "message": "Weekly reminder",
      "schedule": "0 9 * * 1",
      "description": "Monday morning reminder",
      "oneTime": false,
      "active": true,
      "executed": false,
      "created": "2024-01-15T10:30:00Z",
      "updated": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /scheduled
Create a recurring scheduled message (cron-based).

**Request Body:**
```json
{
  "number": "1234567890", // Optional if jid provided
  "jid": "120363147258369076@g.us", // Optional if number provided
  "message": "Weekly check-in",
  "schedule": "0 9 * * 1", // Cron expression
  "description": "Monday 9 AM reminder", // Optional
  "oneTime": false // Optional, defaults to false
}
```

**Cron Format:** `minute hour day month dayOfWeek`
- `0 9 * * *` = Daily at 9 AM
- `0 10 * * 1` = Mondays at 10 AM  
- `0 17 * * 5` = Fridays at 5 PM

**Response:** Returns the created scheduled message object.

### POST /scheduleDate
Create a one-time scheduled message for a specific date/time.

**Request Body:**
```json
{
  "number": "1234567890", // Optional if jid provided
  "jid": "120363147258369076@g.us", // Optional if number provided
  "message": "Happy Birthday! 🎂",
  "scheduleDate": "2025-12-26T20:34:00Z", // ISO 8601 format
  "description": "Birthday reminder" // Optional
}
```

**Notes:**
- Date must be in the future (1-minute grace period allowed)
- Uses ISO 8601 format in UTC
- Message will be sent once and marked as executed

**Response:** Returns the created scheduled message object.

### PUT /scheduled/{id}
Update an existing scheduled message.

**Path Parameters:**
- `id`: Scheduled message ID

**Request Body (all fields optional):**
```json
{
  "number": "1234567890",
  "jid": "120363147258369076@g.us",
  "message": "Updated message",
  "schedule": "0 10 * * 1", // For cron-based
  "scheduleDate": "2025-12-25T18:00:00Z", // For date-based
  "description": "Updated description",
  "oneTime": true,
  "active": false // Activate/deactivate
}
```

**Response:** Returns the updated scheduled message object.

### DELETE /scheduled/{id}
Permanently delete a scheduled message.

**Path Parameters:**
- `id`: Scheduled message ID

**Response:**
```json
{
  "success": true,
  "message": "Scheduled message deleted"
}
```

### POST /scheduled/{id}/toggle
Toggle the active status of a scheduled message.

**Path Parameters:**
- `id`: Scheduled message ID

**Response:**
```json
{
  "success": true,
  "message": "Scheduled message activated", // or "deactivated"
  "scheduledMessage": { /* updated message object */ }
}
```

### POST /scheduled/bulk
Perform bulk operations on multiple scheduled messages.

**Request Body:**
```json
{
  "ids": ["id1", "id2", "id3"], // Array of message IDs
  "action": "activate" // "activate" | "deactivate" | "delete"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk activate completed",
  "results": {
    "processed": 3,
    "successful": 2,
    "failed": 1,
    "successfulIds": ["id1", "id2"],
    "failures": [
      {
        "id": "id3",
        "error": "Not found"
      }
    ]
  }
}
```

---

## Pub/Sub System

The pub/sub system allows broadcasting messages to multiple subscribers organized by topics.

### GET /pubsub/topics
Get all pub/sub topics.

**Response:**
```json
{
  "success": true,
  "topics": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "daily-updates",
      "description": "Daily team updates",
      "subscribers": [
        {
          "number": "1234567890",
          "subscribedAt": "2024-01-15T10:30:00Z"
        }
      ],
      "created": "2024-01-15T10:30:00Z",
      "updated": "2024-01-15T11:30:00Z"
    }
  ]
}
```

### POST /pubsub/topics
Create a new pub/sub topic.

**Request Body:**
```json
{
  "name": "daily-updates", // Required, unique
  "description": "Daily team updates" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Topic created",
  "topic": { /* topic object */ }
}
```

### GET /pubsub/topics/{id}
Get a specific topic with all details.

**Path Parameters:**
- `id`: Topic ID

**Response:**
```json
{
  "success": true,
  "topic": { /* complete topic object with subscribers */ }
}
```

### DELETE /pubsub/topics/{id}
Delete a topic permanently.

**Path Parameters:**
- `id`: Topic ID

**Response:**
```json
{
  "success": true,
  "message": "Topic deleted"
}
```

### GET /pubsub/topics/{id}/subscribers
Get all subscribers for a topic.

**Path Parameters:**
- `id`: Topic ID

**Response:**
```json
{
  "success": true,
  "subscribers": [
    {
      "number": "1234567890",
      "subscribedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /pubsub/topics/{id}/subscribers
Subscribe a phone number to a topic.

**Path Parameters:**
- `id`: Topic ID

**Request Body:**
```json
{
  "number": "1234567890" // Phone number (digits only)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscribed to topic", // or "Already subscribed"
  "topic": { /* updated topic object */ }
}
```

### DELETE /pubsub/topics/{id}/subscribers
Unsubscribe a phone number from a topic.

**Path Parameters:**
- `id`: Topic ID

**Request Body:**
```json
{
  "number": "1234567890" // Phone number (digits only)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Unsubscribed from topic", // or "Not subscribed"
  "topic": { /* updated topic object */ }
}
```

### GET /pubsub/subscriptions/{number}
Get subscription status for a phone number.

**Path Parameters:**
- `number`: Phone number (digits only)

**Response:**
```json
{
  "success": true,
  "subscription": {
    "number": "+1-234-567-8900", // Original input
    "normalized": "1234567890", // Normalized format
    "topics": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "daily-updates"
      }
    ]
  }
}
```

### POST /pubsub/publish
Broadcast a message to all subscribers of a topic.

**Request Body:**
```json
{
  "topicId": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Hello everyone! This is a broadcast message."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message broadcast completed",
  "summary": {
    "topic": { /* topic object */ },
    "attempted": 5, // Total subscribers
    "delivered": 4, // Successful deliveries
    "results": [
      {
        "number": "1234567890",
        "success": true
      },
      {
        "number": "0987654321",
        "success": false,
        "error": "Failed to deliver message"
      }
    ]
  }
}
```

### GET /pubsub/settings
Get current pub/sub settings.

**Response:**
```json
{
  "success": true,
  "settings": {
    "messageDelaySeconds": 1 // Delay between messages when broadcasting
  }
}
```

### PUT /pubsub/settings
Update pub/sub settings.

**Request Body:**
```json
{
  "messageDelaySeconds": 2 // Delay in seconds (minimum 0)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated",
  "settings": {
    "messageDelaySeconds": 2
  }
}
```

---

## Group Messaging

The API supports sending messages to WhatsApp groups using JIDs (Jabber IDs).

### Key Concepts

**JID Formats:**
- Individual: `{number}@s.whatsapp.net` (e.g., `1234567890@s.whatsapp.net`)
- Group: `{groupId}@g.us` (e.g., `120363147258369076@g.us`)

**Usage:**
- Use `number` parameter for individual phone numbers
- Use `jid` parameter for groups or pre-formatted numbers
- All messaging endpoints support both formats

### Examples

**Send to Individual:**
```json
POST /send
{
  "number": "1234567890",
  "message": "Hello!"
}
```

**Send to Group:**
```json
POST /send
{
  "jid": "120363147258369076@g.us",
  "message": "Hello group!"
}
```

**Schedule Group Message:**
```json
POST /scheduled
{
  "jid": "120363147258369076@g.us",
  "message": "Weekly team reminder",
  "schedule": "0 9 * * 1"
}
```

---

## Utilities

### GET /schedule-examples
Get common cron schedule patterns and help.

**Response:**
```json
{
  "success": true,
  "examples": {
    "Every day at 9 AM": "0 9 * * *",
    "Every Monday at 10 AM": "0 10 * * 1",
    "Every Friday at 5 PM": "0 17 * * 5"
  },
  "format": "minute hour day month dayOfWeek",
  "note": "Use https://crontab.guru to validate your cron expressions"
}
```

---

## Error Handling

All endpoints return consistent error responses:

### Error Response Format
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created (for resource creation) |
| `400` | Bad Request (invalid parameters) |
| `401` | Unauthorized (missing or invalid API key) |
| `404` | Not Found (resource doesn't exist) |
| `503` | Service Unavailable (WhatsApp not connected) |

### Common Error Scenarios

**Authentication Errors:**
- Missing API key → 401
- Invalid API key → 401

**WhatsApp Connection Errors:**
- WhatsApp not connected → 503
- Socket unavailable → 503

**Validation Errors:**
- Missing required fields → 400
- Invalid cron expression → 400
- Invalid date format → 400
- Date in the past → 400

**Resource Errors:**
- Topic not found → 404
- Scheduled message not found → 404
- Invalid phone number → 400

---

## Data Models

### ScheduledMessage
```typescript
{
  id: string; // UUID
  number?: string; // Phone number (digits only)
  jid?: string; // WhatsApp JID
  message: string; // Message content
  schedule?: string; // Cron expression (for recurring)
  scheduleDate?: string; // ISO 8601 date (for one-time)
  description: string; // Optional description
  oneTime: boolean; // Auto-deactivate after sending
  active: boolean; // Whether the schedule is active
  executed: boolean; // Whether date-based message was sent
  created: string; // ISO 8601 creation timestamp
  updated: string; // ISO 8601 update timestamp
}
```

### PubSubTopic
```typescript
{
  id: string; // UUID
  name: string; // Unique topic name
  description: string; // Optional description
  subscribers: TopicSubscriber[]; // List of subscribers
  created: string; // ISO 8601 creation timestamp
  updated: string; // ISO 8601 update timestamp
}
```

### TopicSubscriber
```typescript
{
  number: string; // Phone number (normalized, digits only)
  subscribedAt: string; // ISO 8601 subscription timestamp
}
```

### PublishSummary
```typescript
{
  topic: PubSubTopic; // The topic that was broadcast to
  attempted: number; // Total number of subscribers
  delivered: number; // Number of successful deliveries
  results: PublishResult[]; // Detailed results for each subscriber
}
```

### PublishResult
```typescript
{
  number: string; // Phone number
  success: boolean; // Whether delivery was successful
  error?: string; // Error message if delivery failed
}
```

---

## Rate Limiting and Best Practices

### Pub/Sub Broadcasting
- Configure `messageDelaySeconds` to avoid hitting WhatsApp rate limits
- Default delay is 1 second between messages
- Adjust based on your usage patterns

### Message Scheduling
- Use appropriate cron expressions for recurring messages
- Validate cron patterns at https://crontab.guru
- Use date-based scheduling for one-time events

### API Usage
- Keep API keys secure
- Monitor `/health` endpoint for connection status
- Handle errors gracefully in your applications
- Use bulk operations for managing multiple scheduled messages

### WhatsApp Guidelines
- Respect WhatsApp Terms of Service
- Don't spam users
- Use for personal automation only
- Monitor connection status regularly