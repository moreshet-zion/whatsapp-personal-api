# Troubleshooting Guide

This guide covers common issues and their solutions for the WhatsApp Personal API.

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Authentication Problems](#authentication-problems)
3. [Scheduling Issues](#scheduling-issues)
4. [Pub/Sub Problems](#pubsub-problems)
5. [Group Messaging Issues](#group-messaging-issues)
6. [Performance Issues](#performance-issues)
7. [Data/Storage Issues](#datastorage-issues)
8. [Deployment Issues](#deployment-issues)

---

## Connection Issues

### WhatsApp Not Connecting

**Symptoms:**
- `/health` returns `"status": "disconnected"`
- Messages fail with "WhatsApp not connected" error

**Solutions:**

1. **Re-scan QR Code**
   ```bash
   # Check current status
   curl http://localhost:3000/health
   
   # Get new QR code
   open http://localhost:3000/qr-image
   ```

2. **Clear Sessions and Reconnect**
   ```bash
   # Stop the application
   pm2 stop whatsapp-api  # or docker stop whatsapp-api
   
   # Remove old session data
   rm -rf data/sessions/*
   
   # Restart application  
   pm2 start whatsapp-api
   
   # Scan new QR code
   ```

3. **Check Network Connectivity**
   ```bash
   # Test internet connection
   ping google.com
   
   # Check if WhatsApp Web is accessible
   curl -I https://web.whatsapp.com
   ```

### Connection Keeps Dropping

**Possible Causes:**
- Network instability
- WhatsApp account issues
- Server resource constraints

**Solutions:**

1. **Enable Auto-Restart**
   ```json
   // In PM2 ecosystem.config.js
   {
     "max_restarts": 10,
     "min_uptime": "10s"
   }
   ```

2. **Monitor Connection Status**
   ```bash
   # Set up health check monitoring
   while true; do
     STATUS=$(curl -s http://localhost:3000/health | jq -r '.status')
     if [ "$STATUS" != "connected" ]; then
       echo "$(date): Connection lost - $STATUS"
       # Add notification logic here
     fi
     sleep 30
   done
   ```

---

## Authentication Problems

### Invalid API Key

**Error:** `401 Unauthorized`

**Solutions:**

1. **Verify API Key**
   ```bash
   # Check your .env file
   grep API_TOKENS .env
   
   # Test with correct key
   curl -H "x-api-key: your_actual_key_here" http://localhost:3000/health
   ```

2. **Regenerate API Key**
   ```bash
   # Generate new secure key
   openssl rand -hex 32
   
   # Update .env file
   echo "API_TOKENS=api_$(openssl rand -hex 32)" > .env
   
   # Restart application
   pm2 restart whatsapp-api
   ```

### Bearer Token Issues

**Error:** Authorization header not working

**Solution:**
```bash
# Try both formats
curl -H "x-api-key: your_key" http://localhost:3000/health
curl -H "Authorization: Bearer your_key" http://localhost:3000/health
```

---

## Scheduling Issues

### Cron Expression Not Working

**Symptoms:**
- Scheduled message created but never sends
- Error: "Invalid cron schedule"

**Solutions:**

1. **Validate Cron Expression**
   ```bash
   # Use online validator
   open https://crontab.guru
   
   # Check API examples
   curl -H "x-api-key: $API_KEY" http://localhost:3000/schedule-examples
   ```

2. **Common Cron Mistakes**
   ```bash
   # ❌ Wrong: Every minute (too frequent)
   "* * * * *"
   
   # ✅ Correct: Every day at 9 AM
   "0 9 * * *"
   
   # ❌ Wrong: Invalid day of week
   "0 9 * * 8"  # Sunday is 0 or 7, not 8
   
   # ✅ Correct: Sunday at 9 AM
   "0 9 * * 0"
   ```

### Date-Based Schedule Not Working

**Error:** "Schedule date must be in the future"

**Solutions:**

1. **Check Date Format**
   ```bash
   # ✅ Correct: ISO 8601 format
   "2024-12-25T09:00:00Z"
   
   # ❌ Wrong: Invalid format
   "25/12/2024 09:00"
   ```

2. **Generate Future Date**
   ```bash
   # Generate date 1 hour from now
   date -u -d "+1 hour" +"%Y-%m-%dT%H:%M:%SZ"
   
   # Or use Node.js
   node -e "console.log(new Date(Date.now() + 3600000).toISOString())"
   ```

### Scheduled Messages Not Sending

**Debugging Steps:**

1. **Check Message Status**
   ```bash
   curl -H "x-api-key: $API_KEY" http://localhost:3000/scheduled | jq '.scheduledMessages[] | {id, active, schedule, description}'
   ```

2. **Verify WhatsApp Connection**
   ```bash
   curl http://localhost:3000/health | jq '.status'
   ```

3. **Check Application Logs**
   ```bash
   pm2 logs whatsapp-api
   # or
   docker logs whatsapp-api
   ```

---

## Pub/Sub Problems

### Messages Not Broadcasting

**Symptoms:**
- `/pubsub/publish` returns success but messages don't send
- Some subscribers receive messages, others don't

**Solutions:**

1. **Check Delivery Results**
   ```bash
   curl -X POST http://localhost:3000/pubsub/publish \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"topicId":"topic_id","message":"test"}' | jq '.summary.results'
   ```

2. **Verify Subscriber Phone Numbers**
   ```bash
   # Check normalized format
   curl -H "x-api-key: $API_KEY" \
     "http://localhost:3000/pubsub/subscriptions/1234567890"
   ```

3. **Adjust Message Delay**
   ```bash
   # Increase delay to avoid rate limiting
   curl -X PUT http://localhost:3000/pubsub/settings \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"messageDelaySeconds": 3}'
   ```

### Topic Management Issues

**Error:** "Topic not found"

**Solutions:**

1. **Verify Topic ID**
   ```bash
   # List all topics to find correct ID
   curl -H "x-api-key: $API_KEY" http://localhost:3000/pubsub/topics | jq '.topics[] | {id, name}'
   ```

2. **Check Topic Name Uniqueness**
   ```bash
   # Topic names must be unique
   curl -X POST http://localhost:3000/pubsub/topics \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"name":"unique-topic-name"}'
   ```

---

## Group Messaging Issues

### Cannot Send to Groups

**Error:** Message sending fails to group JID

**Solutions:**

1. **Get Correct Group JID**
   ```bash
   curl -H "x-api-key: $API_KEY" http://localhost:3000/groups | jq '.groups[] | {jid, name}'
   ```

2. **Verify Group Membership**
   - Ensure you're still a member of the group
   - Check if group still exists
   - Refresh group list

3. **Use Correct JID Format**
   ```bash
   # ✅ Correct: Group JID format
   "120363147258369076@g.us"
   
   # ❌ Wrong: Individual number format for group
   "1234567890@s.whatsapp.net"
   ```

### Groups Not Listed

**Symptoms:**
- `/groups` returns empty array
- Known groups not appearing

**Solutions:**

1. **Refresh Connection**
   ```bash
   curl -X POST http://localhost:3000/restart -H "x-api-key: $API_KEY"
   ```

2. **Check WhatsApp App**
   - Ensure you're in groups on your phone
   - Refresh WhatsApp on your device
   - Re-scan QR code if needed

---

## Performance Issues

### High Memory Usage

**Symptoms:**
- Application crashes with out-of-memory
- Slow response times

**Solutions:**

1. **Monitor Memory Usage**
   ```bash
   # Check system memory
   free -h
   
   # Check application memory
   pm2 monit
   ```

2. **Restart Application Regularly**
   ```bash
   # Add to crontab for daily restart
   0 2 * * * pm2 restart whatsapp-api
   ```

3. **Optimize Settings**
   ```bash
   # Reduce pub/sub delay if too high
   curl -X PUT http://localhost:3000/pubsub/settings \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"messageDelaySeconds": 1}'
   ```

### Slow Message Delivery

**Causes:**
- High pub/sub message delay
- Network latency
- WhatsApp rate limiting

**Solutions:**

1. **Optimize Pub/Sub Settings**
   ```bash
   # Check current settings
   curl -H "x-api-key: $API_KEY" http://localhost:3000/pubsub/settings
   
   # Adjust for your needs
   curl -X PUT http://localhost:3000/pubsub/settings \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"messageDelaySeconds": 0.5}'  # Faster but riskier
   ```

2. **Monitor Network**
   ```bash
   # Check latency
   ping web.whatsapp.com
   
   # Monitor bandwidth usage
   iftop  # or your preferred network monitor
   ```

---

## Data/Storage Issues

### Lost Scheduled Messages

**Symptoms:**
- Scheduled messages disappeared
- Application starts with no schedules

**Recovery:**

1. **Check Backup**
   ```bash
   # Look for backup files
   ls -la backups/
   
   # Restore from backup
   tar -xzf backup.tar.gz -C /
   ```

2. **Check File Permissions**
   ```bash
   # Verify data directory permissions
   ls -la data/
   chmod 755 data/
   chown -R app_user:app_group data/
   ```

### Corrupted Data Files

**Error:** JSON parsing errors on startup

**Recovery:**

1. **Backup Current State**
   ```bash
   cp data/scheduled.json data/scheduled.json.backup
   cp data/pubsub.json data/pubsub.json.backup
   ```

2. **Validate JSON**
   ```bash
   # Check JSON syntax
   jq . data/scheduled.json
   jq . data/pubsub.json
   ```

3. **Reset to Default**
   ```bash
   # If corrupted beyond repair
   echo '{"scheduledMessages":[]}' > data/scheduled.json
   echo '{"topics":[],"settings":{"messageDelaySeconds":1}}' > data/pubsub.json
   ```

---

## Deployment Issues

### Docker Container Won't Start

**Common Issues:**

1. **Volume Mount Problems**
   ```bash
   # Check volume exists
   docker volume ls
   
   # Inspect volume
   docker volume inspect whatsapp_data
   
   # Fix permissions
   docker run --rm -v whatsapp_data:/data alpine chown -R 1000:1000 /data
   ```

2. **Environment Variables**
   ```bash
   # Check environment
   docker inspect whatsapp-api | jq '.[0].Config.Env'
   
   # Fix missing vars
   docker run -e API_TOKENS="your_key" ...
   ```

### Fly.io Deployment Issues

**Common Problems:**

1. **Volume Not Attached**
   ```bash
   # Check volume status
   fly volumes list
   
   # Create if missing
   fly volumes create whatsapp_storage -r ord -s 1
   ```

2. **Secrets Not Set**
   ```bash
   # Check secrets
   fly secrets list
   
   # Set missing secrets
   fly secrets set API_TOKENS="your_secure_key"
   ```

### VPS Deployment Issues

**Common Problems:**

1. **PM2 Not Starting**
   ```bash
   # Check PM2 status
   pm2 status
   
   # Check logs
   pm2 logs whatsapp-api
   
   # Restart PM2
   pm2 resurrect
   ```

2. **Node.js Version**
   ```bash
   # Check Node version
   node --version
   
   # Install correct version
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

---

## Debug Mode

### Enable Debug Logging

```bash
# Set debug log level
export LOG_LEVEL=debug

# Or in .env file
echo 'LOG_LEVEL=debug' >> .env

# Restart application
pm2 restart whatsapp-api
```

### Monitor Real-time Logs

```bash
# PM2 logs
pm2 logs whatsapp-api -f

# Docker logs
docker logs whatsapp-api -f

# System logs
tail -f /var/log/syslog | grep whatsapp
```

---

## Getting Help

### Information to Collect

When reporting issues, include:

1. **System Info**
   ```bash
   # Node.js version
   node --version
   
   # Application health
   curl http://localhost:3000/health
   
   # System resources
   free -h && df -h
   ```

2. **Error Messages**
   - Full error messages from logs
   - HTTP response codes
   - Timestamps of issues

3. **Configuration**
   - Deployment method (Docker, PM2, etc.)
   - Environment variables (without sensitive data)
   - Any custom configurations

### Self-Diagnosis Checklist

- [ ] WhatsApp connection is active (`/health` shows "connected")
- [ ] API keys are correctly configured
- [ ] Data directory has proper permissions
- [ ] Scheduled messages are marked as `active: true`
- [ ] Phone numbers are in correct format (digits only)
- [ ] Cron expressions are valid
- [ ] Pub/sub topics exist and have subscribers
- [ ] Application logs don't show errors

### Common Solutions Summary

1. **Connection Issues** → Re-scan QR code
2. **Auth Issues** → Check API keys
3. **Schedule Issues** → Validate cron/date formats
4. **Pub/Sub Issues** → Check delivery results and delays
5. **Group Issues** → Verify JIDs and membership
6. **Performance Issues** → Monitor resources and restart
7. **Data Issues** → Check backups and file permissions
8. **Deployment Issues** → Verify environment and volumes

Most issues can be resolved by restarting the application and re-scanning the WhatsApp QR code. Always check the application logs for specific error messages.