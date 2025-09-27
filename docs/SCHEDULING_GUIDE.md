# Scheduling Guide

This guide covers everything you need to know about scheduling messages in the WhatsApp Personal API, including both cron-based recurring schedules and date-based one-time messages.

## Table of Contents

1. [Overview](#overview)
2. [Types of Scheduling](#types-of-scheduling)
3. [Cron-Based Scheduling](#cron-based-scheduling)
4. [Date-Based Scheduling](#date-based-scheduling)
5. [Managing Scheduled Messages](#managing-scheduled-messages)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The scheduling system supports two types of scheduled messages:

1. **Cron-Based**: Recurring messages using cron expressions
2. **Date-Based**: One-time messages at specific dates/times

Both types support:
- Individual phone numbers and WhatsApp groups
- Activation/deactivation without losing the schedule
- Bulk operations for managing multiple schedules
- Comprehensive filtering and search

---

## Types of Scheduling

### Cron-Based Scheduling
- **Format**: Cron expressions (e.g., `0 9 * * 1`)
- **Use Cases**: Daily reminders, weekly check-ins, monthly reports
- **Behavior**: Repeats according to the cron pattern
- **Special Feature**: Can be marked as "one-time" to auto-deactivate after first execution

### Date-Based Scheduling  
- **Format**: ISO 8601 date-time (e.g., `2024-12-25T09:00:00Z`)
- **Use Cases**: Birthday reminders, holiday greetings, meeting reminders
- **Behavior**: Executes once at the specified time, then marked as executed
- **Constraint**: Must be in the future (with 1-minute grace period)

---

## Cron-Based Scheduling

### Understanding Cron Expressions

Cron format: `minute hour day month dayOfWeek`

| Field | Values | Examples |
|-------|--------|----------|
| minute | 0-59 | `0` (top of hour), `30` (half past) |
| hour | 0-23 | `9` (9 AM), `21` (9 PM) |
| day | 1-31 | `1` (1st of month), `15` (15th) |
| month | 1-12 | `1` (January), `12` (December) |
| dayOfWeek | 0-7 | `0` or `7` (Sunday), `1` (Monday) |

**Special Characters:**
- `*` = Any value
- `-` = Range (e.g., `1-5` for Mon-Fri)
- `,` = List (e.g., `1,3,5` for Mon/Wed/Fri)
- `/` = Step (e.g., `*/15` for every 15 minutes)

### Common Cron Examples

```bash
# Daily at 9 AM
"0 9 * * *"

# Weekdays at 8:30 AM  
"30 8 * * 1-5"

# Mondays at 10 AM
"0 10 * * 1"

# Last Friday of every month at 5 PM
"0 17 * * 5"

# Every 15 minutes during business hours
"*/15 9-17 * * 1-5"

# First day of every month at midnight
"0 0 1 * *"
```

### Creating Cron-Based Schedules

```bash
export API_KEY="your_api_key_here"

# Daily good morning message
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "Good morning! Have a great day! ☀️",
    "schedule": "0 8 * * *",
    "description": "Daily morning greeting"
  }'

# Weekly team check-in (Mondays at 9 AM)
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "jid": "120363147258369076@g.us",
    "message": "📋 Weekly Check-in\n\nPlease share your updates for this week:\n• What you completed\n• What you'\''re working on\n• Any blockers\n\nThanks! 👍",
    "schedule": "0 9 * * 1",
    "description": "Weekly team check-in reminder"
  }'

# One-time cron (auto-deactivates after first run)
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "Reminder: Don'\''t forget the meeting at 2 PM today!",
    "schedule": "0 13 * * *",
    "description": "Meeting reminder",
    "oneTime": true
  }'
```

### Validating Cron Expressions

**Online Tools:**
- https://crontab.guru - Interactive cron expression builder
- https://cronexpressiondescriptor.azurewebsites.net - Human-readable descriptions

**API Helper:**
```bash
# Get common cron examples
curl -H "x-api-key: $API_KEY" http://localhost:3000/schedule-examples
```

---

## Date-Based Scheduling

### ISO 8601 Date Format

Format: `YYYY-MM-DDTHH:MM:SSZ`
- **Date**: `YYYY-MM-DD` (e.g., `2024-12-25`)
- **Time**: `HH:MM:SS` (24-hour format)
- **Timezone**: `Z` for UTC (recommended) or `+/-HH:MM` for offset

### Creating Date-Based Schedules

```bash
# Birthday reminder
curl -X POST http://localhost:3000/scheduleDate \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "🎂 Happy Birthday! Hope you have an amazing day filled with joy and celebration! 🎉",
    "scheduleDate": "2024-10-15T09:00:00Z",
    "description": "John'\''s birthday reminder"
  }'

# Holiday greeting to family group
curl -X POST http://localhost:3000/scheduleDate \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "jid": "120363147258369076@g.us",
    "message": "🎄 Merry Christmas to our wonderful family! Wishing you all love, joy, and happiness this holiday season! ❤️",
    "scheduleDate": "2024-12-25T08:00:00Z",
    "description": "Christmas greeting to family"
  }'

# Meeting reminder (30 minutes before)
curl -X POST http://localhost:3000/scheduleDate \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "📅 Meeting Reminder\n\nYour meeting with the client starts in 30 minutes!\n\n📍 Conference Room B\n⏰ 2:00 PM\n\nSee you there! 👋",
    "scheduleDate": "2024-01-20T13:30:00Z",
    "description": "Client meeting reminder"
  }'
```

### Generating Future Dates

**Using Command Line:**
```bash
# 1 hour from now (Linux/macOS)
date -u -d "+1 hour" +"%Y-%m-%dT%H:%M:%SZ"

# Tomorrow at 9 AM (Linux/macOS)
date -u -d "tomorrow 9:00" +"%Y-%m-%dT%H:%M:%SZ"

# Next Friday at 5 PM (macOS)
date -u -v+1w -v-fri -v17H -v0M -v0S +"%Y-%m-%dT%H:%M:%SZ"
```

**Using Node.js:**
```javascript
// 1 hour from now
new Date(Date.now() + 60 * 60 * 1000).toISOString()

// Tomorrow at 9 AM UTC
const tomorrow = new Date()
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
tomorrow.setUTCHours(9, 0, 0, 0)
console.log(tomorrow.toISOString())
```

---

## Managing Scheduled Messages

### Listing Scheduled Messages

```bash
# List all scheduled messages
curl -H "x-api-key: $API_KEY" http://localhost:3000/scheduled

# Filter active messages only
curl -H "x-api-key: $API_KEY" \
  "http://localhost:3000/scheduled?active=true"

# Filter inactive messages
curl -H "x-api-key: $API_KEY" \
  "http://localhost:3000/scheduled?active=false"

# Find one-time messages
curl -H "x-api-key: $API_KEY" \
  "http://localhost:3000/scheduled?oneTime=true"

# Find pending date-based messages
curl -H "x-api-key: $API_KEY" \
  "http://localhost:3000/scheduled?executed=false"
```

### Updating Scheduled Messages

```bash
export MESSAGE_ID="your_message_id_here"

# Update message content and schedule
curl -X PUT "http://localhost:3000/scheduled/$MESSAGE_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "message": "Updated reminder message 📝",
    "schedule": "0 10 * * 1",
    "description": "Updated weekly reminder"
  }'

# Change from cron to date-based
curl -X PUT "http://localhost:3000/scheduled/$MESSAGE_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "scheduleDate": "2024-12-25T09:00:00Z",
    "schedule": null,
    "description": "Now a date-based message"
  }'

# Deactivate without deleting
curl -X PUT "http://localhost:3000/scheduled/$MESSAGE_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "active": false
  }'
```

### Toggle Active Status

```bash
# Toggle between active/inactive
curl -X POST "http://localhost:3000/scheduled/$MESSAGE_ID/toggle" \
  -H "x-api-key: $API_KEY"
```

### Deleting Scheduled Messages

```bash
# Permanently delete a message
curl -X DELETE "http://localhost:3000/scheduled/$MESSAGE_ID" \
  -H "x-api-key: $API_KEY"
```

### Bulk Operations

```bash
# Bulk deactivate multiple messages (vacation mode)
curl -X POST http://localhost:3000/scheduled/bulk \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "ids": ["id1", "id2", "id3"],
    "action": "deactivate"
  }'

# Bulk activate messages (back from vacation)
curl -X POST http://localhost:3000/scheduled/bulk \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "ids": ["id1", "id2", "id3"], 
    "action": "activate"
  }'

# Bulk delete (⚠️ permanent)
curl -X POST http://localhost:3000/scheduled/bulk \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "ids": ["id1", "id2", "id3"],
    "action": "delete"
  }'
```

---

## Best Practices

### Schedule Design

1. **Use Appropriate Timing**
   - Morning reminders: 7-9 AM
   - Business updates: 9-11 AM  
   - Evening check-ins: 5-7 PM
   - Avoid late night/early morning (unless urgent)

2. **Consider Timezones**
   - Use UTC for consistency
   - Account for recipient timezones in your scheduling
   - Be mindful of daylight saving time changes

3. **Frequency Guidelines**
   ```bash
   # ✅ Good: Daily motivational quote
   "0 8 * * *"
   
   # ✅ Good: Weekly team update
   "0 9 * * 1" 
   
   # ❌ Avoid: Every hour during work day (too frequent)
   "0 9-17 * * 1-5"
   ```

### Message Content

1. **Keep Messages Contextual**
   ```json
   {
     "message": "📅 Weekly Reminder: Team meeting at 2 PM today in Conference Room A"
   }
   ```

2. **Add Scheduling Context**
   ```json
   {
     "description": "Weekly team meeting reminder - Mondays at 2 PM"
   }
   ```

3. **Use Emojis Appropriately**
   ```json
   {
     "message": "☀️ Good morning! Today's agenda:\n• 9 AM - Stand-up\n• 11 AM - Client call\n• 3 PM - Planning meeting"
   }
   ```

### Maintenance Strategies

1. **Regular Reviews**
   ```bash
   # Monthly review of all schedules
   curl -H "x-api-key: $API_KEY" http://localhost:3000/scheduled | jq '.scheduledMessages[] | {id, description, active, schedule}'
   ```

2. **Vacation Mode**
   ```bash
   # Before vacation: deactivate all personal reminders
   curl -X POST http://localhost:3000/scheduled/bulk \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"ids":["personal_ids_here"],"action":"deactivate"}'
   ```

3. **Seasonal Adjustments**
   ```bash
   # Update summer schedule (later wake-up time)
   curl -X PUT "http://localhost:3000/scheduled/$MORNING_REMINDER_ID" \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"schedule":"0 9 * * *"}' # Changed from 8 AM to 9 AM
   ```

---

## Common Patterns

### Personal Automation

```bash
# Daily motivation
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "💪 You'\''ve got this! Make today amazing!",
    "schedule": "0 7 * * *",
    "description": "Daily motivation"
  }'

# Weekly planning reminder
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "📋 Weekly Planning Time!\n\n• Review last week\n• Plan next week\n• Set priorities\n\nTime to organize! 🗂️",
    "schedule": "0 18 * * 0",
    "description": "Sunday evening planning"
  }'

# Monthly review
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890", 
    "message": "📊 Monthly Review Time!\n\n• Goals progress\n• Wins and challenges\n• Next month focus\n\nReflection time! 🤔",
    "schedule": "0 19 1 * *",
    "description": "First of month review"
  }'
```

### Team Management

```bash
# Stand-up reminders (weekdays)
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "jid": "team_group_jid_here",
    "message": "📋 Stand-up in 15 minutes!\n\n📍 Conference Room A\n⏰ 9:30 AM\n\nSee you there! 👋",
    "schedule": "15 9 * * 1-5",
    "description": "Daily stand-up reminder (weekdays)"
  }'

# Sprint planning reminder
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "jid": "team_group_jid_here",
    "message": "🚀 Sprint Planning Tomorrow!\n\n📅 Tuesday 10 AM\n📍 Conference Room B\n\nPlease review the backlog beforehand 📝",
    "schedule": "0 17 * * 1",
    "description": "Sprint planning reminder (Monday evening)"
  }'
```

### Family Coordination

```bash
# Weekly family dinner reminder
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "jid": "family_group_jid_here",
    "message": "🍽️ Family Dinner Tomorrow!\n\n⏰ 6 PM at Mom & Dad'\''s\n🍝 Pasta night!\n\nWho'\''s bringing dessert? 🧁",
    "schedule": "0 18 * * 0",
    "description": "Sunday family dinner reminder"
  }'

# School event reminders
curl -X POST http://localhost:3000/scheduleDate \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "jid": "family_group_jid_here",
    "message": "🎓 School Event Reminder\n\n📅 Parent-Teacher Conference\n⏰ Tomorrow at 3 PM\n📍 Room 205\n\nDon'\''t forget! 📝",
    "scheduleDate": "2024-03-14T15:00:00Z",
    "description": "Parent-teacher conference reminder"
  }'
```

### Health and Habits

```bash
# Water reminder
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "💧 Hydration check! Time for some water 🚰",
    "schedule": "0 */2 9-17 * *",
    "description": "Water reminder every 2 hours during work"
  }'

# Exercise reminder
curl -X POST http://localhost:3000/scheduled \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "number": "1234567890",
    "message": "🏃‍♂️ Exercise time! Your body will thank you 💪\n\nEven 10 minutes makes a difference!",
    "schedule": "0 18 * * 1,3,5",
    "description": "Exercise reminder (Mon/Wed/Fri)"
  }'
```

---

## Troubleshooting

### Common Issues

**1. Cron Expression Not Working**
```bash
# Test your cron expression
curl -H "x-api-key: $API_KEY" http://localhost:3000/schedule-examples
```
Use https://crontab.guru to validate expressions.

**2. Date-Based Message Not Scheduling**
```json
{
  "success": false,
  "error": "Schedule date must be in the future"
}
```
**Solution**: Ensure the date is at least 1 minute in the future.

**3. Message Not Sending**
Check the message status:
```bash
curl -H "x-api-key: $API_KEY" http://localhost:3000/scheduled
```
Look for `active: false` or connection issues.

**4. Timezone Confusion**
Always use UTC in your date strings and convert locally:
```javascript
// Convert local time to UTC
const localDate = new Date('2024-12-25 09:00:00')
const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000)
console.log(utcDate.toISOString())
```

### Debugging Steps

1. **Check WhatsApp Connection**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Verify Schedule Syntax**
   Use online validators for cron expressions.

3. **Test with Near-Future Times**
   ```bash
   # Schedule 2 minutes from now for testing
   FUTURE=$(date -u -d "+2 minutes" +"%Y-%m-%dT%H:%M:%SZ")
   curl -X POST http://localhost:3000/scheduleDate \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d "{\"number\":\"your_number\",\"message\":\"Test\",\"scheduleDate\":\"$FUTURE\"}"
   ```

4. **Check Server Logs**
   Look for error messages in your server console.

### Performance Considerations

1. **Many Schedules**: The system can handle hundreds of scheduled messages
2. **Memory Usage**: Each active schedule uses minimal memory
3. **Storage**: All schedules are persisted to `data/scheduled.json`
4. **Startup Time**: All schedules are restored when the server restarts

---

This guide covers all aspects of scheduling in the WhatsApp Personal API. Whether you need simple daily reminders or complex recurring patterns, the scheduling system provides the flexibility and reliability you need for automated messaging.