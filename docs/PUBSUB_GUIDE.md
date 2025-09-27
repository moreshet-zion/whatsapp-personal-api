# Pub/Sub System Guide

The pub/sub (publish/subscribe) system allows you to broadcast messages to multiple subscribers organized by topics. This is perfect for newsletters, team updates, announcements, and any scenario where you need to send the same message to multiple people.

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Getting Started](#getting-started)
4. [Managing Topics](#managing-topics)
5. [Managing Subscribers](#managing-subscribers)
6. [Publishing Messages](#publishing-messages)
7. [Settings and Configuration](#settings-and-configuration)
8. [Best Practices](#best-practices)
9. [Use Cases](#use-cases)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The pub/sub system provides:

- **Topic Management**: Create topics for different types of content
- **Subscriber Management**: Add/remove phone numbers from topics
- **Message Broadcasting**: Send messages to all topic subscribers
- **Delivery Tracking**: See which messages were delivered successfully
- **Rate Limiting**: Configurable delay between messages to avoid spam
- **Subscription Tracking**: See which topics a number is subscribed to

---

## Core Concepts

### Topics
A **topic** is a named category for messages. Examples:
- `daily-updates` - Daily team updates
- `family-news` - Family announcements  
- `product-launches` - Product release notifications
- `emergency-alerts` - Urgent notifications

### Subscribers
**Subscribers** are phone numbers that receive messages from topics they're subscribed to.

### Publishing
**Publishing** means sending a message to all subscribers of a specific topic.

---

## Getting Started

### 1. Create Your First Topic

```bash
export API_KEY="your_api_key_here"

# Create a topic for daily updates
curl -X POST http://localhost:3000/pubsub/topics \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "daily-updates",
    "description": "Daily status updates for the team"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Topic created",
  "topic": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "daily-updates",
    "description": "Daily status updates for the team",
    "subscribers": [],
    "created": "2024-01-15T10:30:00Z",
    "updated": "2024-01-15T10:30:00Z"
  }
}
```

**Important**: Save the topic `id` - you'll need it for subsequent operations.

### 2. Add Subscribers

```bash
# Add subscribers to your topic
export TOPIC_ID="123e4567-e89b-12d3-a456-426614174000"

# Add first subscriber
curl -X POST "http://localhost:3000/pubsub/topics/$TOPIC_ID/subscribers" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890"
  }'

# Add second subscriber
curl -X POST "http://localhost:3000/pubsub/topics/$TOPIC_ID/subscribers" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "0987654321"
  }'
```

### 3. Publish Your First Message

```bash
# Broadcast a message to all subscribers
curl -X POST http://localhost:3000/pubsub/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "topicId": "'$TOPIC_ID'",
    "message": "Hello everyone! This is our first broadcast message 📢"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Message broadcast completed",
  "summary": {
    "topic": { /* topic details */ },
    "attempted": 2,
    "delivered": 2,
    "results": [
      {
        "number": "1234567890",
        "success": true
      },
      {
        "number": "0987654321", 
        "success": true
      }
    ]
  }
}
```

---

## Managing Topics

### List All Topics

```bash
curl -H "x-api-key: $API_KEY" http://localhost:3000/pubsub/topics
```

### Get Topic Details

```bash
curl -H "x-api-key: $API_KEY" "http://localhost:3000/pubsub/topics/$TOPIC_ID"
```

### Delete a Topic

```bash
# ⚠️ This permanently deletes the topic and all its subscribers
curl -X DELETE "http://localhost:3000/pubsub/topics/$TOPIC_ID" \
  -H "x-api-key: $API_KEY"
```

### Topic Naming Best Practices

- Use **kebab-case**: `daily-updates` not `Daily Updates`
- Be **descriptive**: `product-launches` not `news`
- Keep it **short**: `team-alerts` not `team-emergency-alert-system`
- Avoid **spaces**: Use hyphens or underscores

---

## Managing Subscribers

### View Subscribers for a Topic

```bash
curl -H "x-api-key: $API_KEY" \
  "http://localhost:3000/pubsub/topics/$TOPIC_ID/subscribers"
```

### Subscribe a Phone Number

```bash
curl -X POST "http://localhost:3000/pubsub/topics/$TOPIC_ID/subscribers" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "5551234567"
  }'
```

**Phone Number Formats**: The system accepts various formats but normalizes them:
- `+1-234-567-8900` → `1234567890`
- `(234) 567-8900` → `2345678900`
- `234-567-8900` → `2345678900`

### Unsubscribe a Phone Number

```bash
curl -X DELETE "http://localhost:3000/pubsub/topics/$TOPIC_ID/subscribers" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "5551234567"
  }'
```

### Check Subscriptions for a Number

```bash
# See which topics a number is subscribed to
curl -H "x-api-key: $API_KEY" \
  "http://localhost:3000/pubsub/subscriptions/1234567890"
```

Response:
```json
{
  "success": true,
  "subscription": {
    "number": "1234567890",
    "normalized": "1234567890",
    "topics": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "daily-updates"
      },
      {
        "id": "456e7890-e89b-12d3-a456-426614174111",
        "name": "emergency-alerts"
      }
    ]
  }
}
```

---

## Publishing Messages

### Basic Publishing

```bash
curl -X POST http://localhost:3000/pubsub/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "topicId": "'$TOPIC_ID'",
    "message": "Weekly team update: All projects are on track! 👍"
  }'
```

### Understanding Delivery Results

The publish response includes detailed delivery information:

```json
{
  "success": true,
  "message": "Message broadcast completed",
  "summary": {
    "topic": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "daily-updates"
    },
    "attempted": 3,    // Total subscribers
    "delivered": 2,    // Successful deliveries
    "results": [
      {
        "number": "1234567890",
        "success": true
      },
      {
        "number": "0987654321",
        "success": true  
      },
      {
        "number": "5555555555",
        "success": false,
        "error": "Failed to send message"
      }
    ]
  }
}
```

### Message Formatting Tips

**Emojis**: Use emojis to make messages more engaging
```json
{
  "message": "🚨 Emergency Alert: Office is closed today due to weather ❄️"
}
```

**Line Breaks**: Use `\n` for line breaks
```json
{
  "message": "Daily Update:\n\n✅ Project A completed\n🔄 Project B in progress\n📅 Meeting at 3 PM"
}
```

**Links**: WhatsApp will automatically format URLs
```json
{
  "message": "Check out our new blog post: https://example.com/blog/updates"
}
```

---

## Settings and Configuration

### View Current Settings

```bash
curl -H "x-api-key: $API_KEY" http://localhost:3000/pubsub/settings
```

Response:
```json
{
  "success": true,
  "settings": {
    "messageDelaySeconds": 1
  }
}
```

### Update Settings

```bash
# Set 2-second delay between messages
curl -X PUT http://localhost:3000/pubsub/settings \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "messageDelaySeconds": 2
  }'
```

### Why Message Delay Matters

- **Rate Limiting**: WhatsApp has limits on message frequency
- **Spam Prevention**: Delays make broadcasts look more natural
- **Reliability**: Reduces chance of connection issues
- **Politeness**: Avoids overwhelming recipients

**Recommended Settings**:
- **Small groups** (< 10 subscribers): 1 second
- **Medium groups** (10-50 subscribers): 2-3 seconds  
- **Large groups** (50+ subscribers): 3-5 seconds

---

## Best Practices

### Topic Organization

1. **Keep Topics Focused**
   - ✅ Good: `product-updates`, `team-social`, `emergency-alerts`
   - ❌ Bad: `general-stuff`, `misc`, `everything`

2. **Use Descriptive Names**
   - ✅ Good: `weekly-sales-reports`
   - ❌ Bad: `reports`

3. **Plan Topic Hierarchy**
   ```
   company-all          # Company-wide announcements
   engineering-team     # Engineering team updates  
   engineering-alerts   # Engineering emergency alerts
   product-launches     # Product launch notifications
   ```

### Subscriber Management

1. **Get Consent**: Only subscribe people who opted in
2. **Provide Unsubscribe**: Make it easy for people to opt out
3. **Clean Up**: Regularly remove inactive numbers
4. **Test First**: Always test with a small group

### Message Quality

1. **Be Clear and Concise**
   ```
   ✅ Good: "Meeting moved to 3 PM today - Conference Room B"
   ❌ Bad: "Hey everyone, just wanted to let you know that the meeting we had scheduled for 2 PM has been moved to 3 PM due to a conflict with another meeting. New location is Conference Room B on the 5th floor."
   ```

2. **Use Appropriate Frequency**
   - Daily updates: Once per day maximum
   - Weekly updates: 1-2 times per week
   - Emergency alerts: Only when truly urgent

3. **Add Context**
   ```
   ✅ Good: "[Team Update] Project Alpha completed ahead of schedule 🎉"
   ❌ Bad: "It's done"
   ```

### Error Handling

Always check the delivery results:

```bash
# Example of handling failed deliveries
RESPONSE=$(curl -s -X POST http://localhost:3000/pubsub/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"topicId":"'$TOPIC_ID'","message":"Test"}')

echo "$RESPONSE" | jq '.summary.delivered'  # Count of successful deliveries
echo "$RESPONSE" | jq '.summary.results[] | select(.success == false)'  # Failed deliveries
```

---

## Use Cases

### 1. Team Daily Standup Updates

```bash
# Create topic
curl -X POST http://localhost:3000/pubsub/topics \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "daily-standup",
    "description": "Daily team standup notifications"
  }'

# Daily update message
curl -X POST http://localhost:3000/pubsub/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "topicId": "'$TOPIC_ID'",
    "message": "📋 Daily Standup Reminder\n\nTime: 9:30 AM\nLocation: Conference Room A\n\nPlease prepare your updates! 👋"
  }'
```

### 2. Family Newsletter

```bash
# Create family topic
curl -X POST http://localhost:3000/pubsub/topics \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "family-updates",
    "description": "Weekly family news and updates"
  }'

# Weekly family update
curl -X POST http://localhost:3000/pubsub/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "topicId": "'$TOPIC_ID'",
    "message": "👨‍👩‍👧‍👦 Family Weekly Update\n\n🎉 Sarah got promoted!\n🏠 House repairs completed\n📅 Family dinner this Sunday at 6 PM\n\nLove you all! ❤️"
  }'
```

### 3. Emergency Alerts

```bash
# Create emergency topic
curl -X POST http://localhost:3000/pubsub/topics \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "emergency-alerts",
    "description": "Urgent emergency notifications"
  }'

# Set faster delivery for emergencies
curl -X PUT http://localhost:3000/pubsub/settings \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"messageDelaySeconds": 0.5}'

# Emergency alert
curl -X POST http://localhost:3000/pubsub/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "topicId": "'$TOPIC_ID'",
    "message": "🚨 EMERGENCY ALERT 🚨\n\nOffice evacuation in progress due to fire alarm.\n\nMeet at the parking lot.\nDo not use elevators."
  }'
```

### 4. Product Launch Notifications

```bash
# Create product topic
curl -X POST http://localhost:3000/pubsub/topics \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "product-launches",
    "description": "New product announcements"
  }'

# Product launch message
curl -X POST http://localhost:3000/pubsub/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "topicId": "'$TOPIC_ID'",
    "message": "🚀 Product Launch Alert!\n\n✨ Introducing our new mobile app!\n📱 Available on iOS and Android\n🎁 Early bird discount: 50% off\n\nDownload now: https://ourapp.com"
  }'
```

---

## Troubleshooting

### Common Issues

**1. Publishing Fails**
```json
{
  "success": false,
  "error": "WhatsApp not connected"
}
```
**Solution**: Check WhatsApp connection status at `/health` endpoint.

**2. Some Messages Not Delivered**
Check the delivery results in the publish response:
```json
{
  "number": "1234567890",
  "success": false,
  "error": "Failed to send message"
}
```
**Possible causes**:
- Number is not on WhatsApp
- Number has blocked you
- WhatsApp rate limiting
- Temporary connection issues

**3. Topic Not Found**
```json
{
  "success": false,
  "error": "Topic not found"
}
```
**Solution**: Verify the topic ID is correct by listing all topics.

**4. Subscriber Already Exists**
```json
{
  "success": true,
  "message": "Already subscribed"
}
```
**Note**: This is not an error - the system prevents duplicate subscriptions.

### Debugging Tips

1. **Check Health First**
   ```bash
   curl http://localhost:3000/health
   ```

2. **List All Topics**
   ```bash
   curl -H "x-api-key: $API_KEY" http://localhost:3000/pubsub/topics
   ```

3. **Test with Small Groups**
   Start with 1-2 subscribers before adding more.

4. **Monitor Delivery Results**
   Always check the `results` array in publish responses.

5. **Check Phone Number Format**
   Use the subscription status endpoint to see the normalized format.

### Rate Limiting Issues

If you're experiencing delivery failures:

1. **Increase Message Delay**
   ```bash
   curl -X PUT http://localhost:3000/pubsub/settings \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"messageDelaySeconds": 5}'
   ```

2. **Split Large Topics**
   Instead of one topic with 100 subscribers, create multiple smaller topics.

3. **Test Delivery Times**
   Monitor how long broadcasts take and adjust accordingly.

---

## Advanced Usage

### Combining with Scheduled Messages

You can combine pub/sub with scheduled messages for automated broadcasts:

```bash
# Schedule a daily morning update
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "jid": "trigger@automation.local",
    "message": "trigger-daily-update",
    "schedule": "0 8 * * *",
    "description": "Trigger daily pub/sub update"
  }'
```

Then use a webhook or external system to listen for this trigger and call the pub/sub API.

### Integration with External Systems

The pub/sub API works great with:
- **Zapier/IFTTT**: Trigger broadcasts from other apps
- **GitHub Actions**: Send deployment notifications
- **Monitoring Tools**: Alert teams about system issues
- **CRM Systems**: Send customer update broadcasts
- **Calendar Apps**: Send meeting reminders to teams

---

This completes the pub/sub system guide. The pub/sub feature provides a powerful way to manage communication with multiple recipients while maintaining control over delivery timing and tracking results.