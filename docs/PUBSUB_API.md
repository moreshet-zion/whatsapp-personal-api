# WhatsApp Pub/Sub System API Documentation

This document describes the complete API for the WhatsApp pub/sub system that allows phone numbers to subscribe to topics and receive broadcast messages.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Health & Status](#health--status)
4. [Topic Management](#topic-management)
5. [Subscription Management](#subscription-management)
6. [Subscriber Management](#subscriber-management)
7. [Message Publishing](#message-publishing)
8. [Settings Management](#settings-management)
9. [Queue Management](#queue-management)
10. [Error Handling](#error-handling)
11. [Usage Examples](#usage-examples)

## Overview

The WhatsApp Pub/Sub system provides a complete solution for managing topics, subscribers, and message broadcasting via WhatsApp. It includes:

- **Rate Limiting**: Configurable delays between messages to prevent spam
- **Message Queue**: Reliable message delivery with retry logic
- **Topic Management**: Create, update, delete, and list topics
- **Subscription Management**: Users can subscribe/unsubscribe from topics
- **Settings API**: Configure system behavior including message delays

## Authentication

All API endpoints require authentication via API key in the header:

```
Authorization: Bearer YOUR_API_KEY
```

Set the `API_KEY` environment variable to configure authentication.

## Health & Status

### GET /health

Get system health status including WhatsApp connection, queue status, and statistics.

**Response:**
```json
{
  "status": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "scheduledMessages": 5,
  "activeJobs": 3,
  "pubsub": {
    "pendingMessages": 2,
    "isProcessing": false,
    "topics": 10,
    "subscribers": 25
  }
}
```

## Topic Management

### POST /topics

Create a new topic.

**Request Body:**
```json
{
  "name": "weather-alerts",
  "description": "Daily weather alerts and warnings"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Topic created successfully",
  "topic": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "weather-alerts",
    "description": "Daily weather alerts and warnings",
    "created": "2024-01-15T10:30:00.000Z",
    "updated": "2024-01-15T10:30:00.000Z",
    "active": true
  }
}
```

### GET /topics

List all topics. Use `?active=true` to get only active topics.

**Response:**
```json
{
  "success": true,
  "topics": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "weather-alerts",
      "description": "Daily weather alerts and warnings",
      "created": "2024-01-15T10:30:00.000Z",
      "updated": "2024-01-15T10:30:00.000Z",
      "active": true
    }
  ]
}
```

### GET /topics/:id

Get a specific topic by ID.

**Response:**
```json
{
  "success": true,
  "topic": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "weather-alerts",
    "description": "Daily weather alerts and warnings",
    "created": "2024-01-15T10:30:00.000Z",
    "updated": "2024-01-15T10:30:00.000Z",
    "active": true
  }
}
```

### PUT /topics/:id

Update a topic.

**Request Body:**
```json
{
  "name": "weather-updates",
  "description": "Updated weather information",
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Topic updated successfully",
  "topic": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "weather-updates",
    "description": "Updated weather information",
    "created": "2024-01-15T10:30:00.000Z",
    "updated": "2024-01-15T10:35:00.000Z",
    "active": true
  }
}
```

### DELETE /topics/:id

Delete a topic and all associated subscriptions.

**Response:**
```json
{
  "success": true,
  "message": "Topic deleted successfully"
}
```

### GET /topics/:id/subscribers

Get all subscribers for a specific topic.

**Response:**
```json
{
  "success": true,
  "topic": "weather-alerts",
  "subscribers": [
    {
      "id": "456e7890-e89b-12d3-a456-426614174001",
      "phoneNumber": "+1234567890",
      "name": "John Doe",
      "created": "2024-01-15T09:00:00.000Z",
      "active": true
    }
  ]
}
```

## Subscription Management

### POST /subscribe

Subscribe a phone number to a topic.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "topicId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully subscribed to topic"
}
```

### POST /unsubscribe

Unsubscribe a phone number from a topic.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "topicId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully unsubscribed from topic"
}
```

### GET /subscription-status/:phoneNumber/:topicId

Check if a phone number is subscribed to a topic.

**Response:**
```json
{
  "success": true,
  "phoneNumber": "+1234567890",
  "topicId": "123e4567-e89b-12d3-a456-426614174000",
  "subscribed": true
}
```

## Subscriber Management

### GET /subscribers

Get all subscribers.

**Response:**
```json
{
  "success": true,
  "subscribers": [
    {
      "id": "456e7890-e89b-12d3-a456-426614174001",
      "phoneNumber": "+1234567890",
      "name": "John Doe",
      "created": "2024-01-15T09:00:00.000Z",
      "active": true
    }
  ]
}
```

### GET /subscribers/:phoneNumber

Get a specific subscriber by phone number.

**Response:**
```json
{
  "success": true,
  "subscriber": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "phoneNumber": "+1234567890",
    "name": "John Doe",
    "created": "2024-01-15T09:00:00.000Z",
    "active": true
  }
}
```

### GET /subscribers/:phoneNumber/topics

Get all topics a subscriber is subscribed to.

**Response:**
```json
{
  "success": true,
  "phoneNumber": "+1234567890",
  "topics": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "weather-alerts",
      "description": "Daily weather alerts and warnings",
      "created": "2024-01-15T10:30:00.000Z",
      "updated": "2024-01-15T10:30:00.000Z",
      "active": true
    }
  ]
}
```

### PUT /subscribers/:phoneNumber

Update subscriber information.

**Request Body:**
```json
{
  "name": "John Smith",
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscriber updated successfully",
  "subscriber": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "phoneNumber": "+1234567890",
    "name": "John Smith",
    "created": "2024-01-15T09:00:00.000Z",
    "active": true
  }
}
```

### DELETE /subscribers/:phoneNumber

Delete a subscriber and all their subscriptions.

**Response:**
```json
{
  "success": true,
  "message": "Subscriber deleted successfully"
}
```

## Message Publishing

### POST /publish

Publish a message to all subscribers of a topic.

**Request Body:**
```json
{
  "topicId": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Weather Alert: Heavy rain expected this afternoon. Stay safe!",
  "delaySeconds": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message queued for delivery",
  "queueItem": {
    "id": "789e0123-e89b-12d3-a456-426614174002",
    "topicId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Weather Alert: Heavy rain expected this afternoon. Stay safe!",
    "scheduledFor": "2024-01-15T10:40:00.000Z",
    "status": "pending",
    "attempts": 0,
    "created": "2024-01-15T10:40:00.000Z",
    "updated": "2024-01-15T10:40:00.000Z"
  }
}
```

## Settings Management

### GET /settings

Get all system settings.

**Response:**
```json
{
  "success": true,
  "settings": [
    {
      "key": "message_delay_seconds",
      "value": "5",
      "description": "Delay in seconds between sending messages to prevent spam",
      "updated": "2024-01-15T10:00:00.000Z"
    },
    {
      "key": "max_retry_attempts",
      "value": "3",
      "description": "Maximum retry attempts for failed messages",
      "updated": "2024-01-15T10:00:00.000Z"
    },
    {
      "key": "queue_process_interval",
      "value": "10",
      "description": "Interval in seconds to process message queue",
      "updated": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### GET /settings/:key

Get a specific setting value.

**Response:**
```json
{
  "success": true,
  "key": "message_delay_seconds",
  "value": "5"
}
```

### PUT /settings

Update a setting.

**Request Body:**
```json
{
  "key": "message_delay_seconds",
  "value": "10",
  "description": "Increased delay to 10 seconds for better rate limiting"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Setting updated successfully",
  "setting": {
    "key": "message_delay_seconds",
    "value": "10",
    "description": "Increased delay to 10 seconds for better rate limiting",
    "updated": "2024-01-15T10:45:00.000Z"
  }
}
```

## Queue Management

### GET /queue-status

Get message queue status.

**Response:**
```json
{
  "success": true,
  "queue": {
    "pendingMessages": 5,
    "isProcessing": false,
    "whatsappConnected": true
  }
}
```

### POST /cleanup-messages

Clean up old processed messages from the queue.

**Query Parameters:**
- `days` (optional): Number of days to keep messages (default: 7)

**Response:**
```json
{
  "success": true,
  "message": "Cleaned up 15 old messages"
}
```

## Error Handling

All API endpoints return consistent error responses:

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error description",
  "details": ["Detailed validation errors if applicable"]
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (missing/invalid API key)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error
- `503`: Service Unavailable (WhatsApp not connected)

## Usage Examples

### Complete Workflow Example

```bash
# 1. Create a topic
curl -X POST http://localhost:3000/topics \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "news-updates",
    "description": "Daily news updates"
  }'

# 2. Subscribe users to the topic
curl -X POST http://localhost:3000/subscribe \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "topicId": "TOPIC_ID_FROM_STEP_1"
  }'

# 3. Publish a message
curl -X POST http://localhost:3000/publish \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topicId": "TOPIC_ID_FROM_STEP_1",
    "message": "Breaking News: Important update for all subscribers!",
    "delaySeconds": 0
  }'

# 4. Check queue status
curl -X GET http://localhost:3000/queue-status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Rate Limiting Configuration

```bash
# Check current message delay setting
curl -X GET http://localhost:3000/settings/message_delay_seconds \
  -H "Authorization: Bearer YOUR_API_KEY"

# Update message delay to 10 seconds (recommended for high-volume)
curl -X PUT http://localhost:3000/settings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "message_delay_seconds",
    "value": "10",
    "description": "10 second delay for high-volume messaging"
  }'
```

### Subscription Management

```bash
# Check if user is subscribed to a topic
curl -X GET http://localhost:3000/subscription-status/+1234567890/TOPIC_ID \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get all topics a user is subscribed to
curl -X GET http://localhost:3000/subscribers/+1234567890/topics \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get all subscribers for a topic
curl -X GET http://localhost:3000/topics/TOPIC_ID/subscribers \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Key Features

### Rate Limiting & Spam Prevention
- Configurable delays between messages (default: 5 seconds)
- Retry logic with exponential backoff
- Queue-based message processing
- WhatsApp connection status monitoring

### Reliability
- Persistent JSON-based storage
- Message queue with retry attempts
- Automatic cleanup of old messages
- Comprehensive error handling and logging

### Scalability
- Efficient subscriber lookups
- Batch message processing
- Configurable processing intervals
- Memory-efficient data structures

### Management
- Complete CRUD operations for topics and subscribers
- Subscription status tracking
- System settings configuration
- Health monitoring and statistics