# Fly.io Monitoring & Debugging Commands

## 🚀 Deploy the Memory Leak Fixes

```bash
# 1. Build and deploy the updated application
fly deploy

# 2. Check deployment status
fly status

# 3. Monitor logs during deployment
fly logs
```

## 📊 Real-time Monitoring

### View Application Logs
```bash
# Stream all logs
fly logs

# Filter for memory-related logs
fly logs | grep -i memory

# Filter for OOM kills
fly logs | grep -i "out of memory"

# View specific time range
fly logs --since "1h"
fly logs --since "2024-10-17T10:00:00Z"
```

### Check Memory Usage
```bash
# View current VM status
fly vm status

# View application status
fly status

# Check metrics dashboard (opens browser)
fly dashboard

# Get specific machine info
fly machine list
fly machine status <machine-id>
```

### Use the New Memory Endpoint
```bash
# Check memory usage via API
curl https://whatsapp-personal-api.fly.dev/health/memory

# Monitor memory continuously (every 30 seconds)
watch -n 30 'curl -s https://whatsapp-personal-api.fly.dev/health/memory | jq'

# Save memory snapshots
while true; do
  echo "$(date): $(curl -s https://whatsapp-personal-api.fly.dev/health/memory | jq -c)" >> memory_log.txt
  sleep 300  # Every 5 minutes
done
```

## 🔍 Deep Debugging

### SSH into the Running Instance
```bash
# Connect to the machine
fly ssh console

# Once inside, check memory usage:
free -h
cat /proc/meminfo
ps aux --sort=-%mem | head -20
top -o %MEM

# Check Node.js process specifically
ps aux | grep node
cat /proc/$(pgrep node)/status | grep Vm

# Exit SSH
exit
```

### Check Historical Metrics
```bash
# View metrics in Fly dashboard
fly dashboard

# Or use Prometheus metrics if configured
curl https://whatsapp-personal-api.fly.dev/metrics
```

### Check for Memory Leaks
```bash
# View process details
fly ssh console -C "ps aux | grep node"

# Check if process is being restarted
fly logs | grep -i restart

# Count OOM events
fly logs --since "24h" | grep -c "Out of memory"
```

## 🔧 Maintenance Commands

### Scale Memory if Needed
```bash
# Scale to 512MB (already configured in fly.toml)
fly scale memory 512

# Scale to 1GB if issues persist
fly scale memory 1024

# View current scale
fly scale show
```

### Restart Application
```bash
# Restart all machines
fly apps restart whatsapp-personal-api

# Restart specific machine
fly machine restart <machine-id>
```

### View Current Configuration
```bash
# Show current app config
fly config show

# Show environment variables (secrets hidden)
fly config env

# Show secrets (names only)
fly secrets list
```

## 📈 Set Up Alerts

### Create Fly.io Alerts (via Dashboard)
1. Go to https://fly.io/dashboard
2. Select your app "whatsapp-personal-api"
3. Go to "Monitoring" → "Alerts"
4. Create alerts for:
   - High memory usage (>80%)
   - Application restarts
   - Health check failures

### Monitor Health Endpoints
```bash
# Check all health endpoints
curl https://whatsapp-personal-api.fly.dev/health
curl https://whatsapp-personal-api.fly.dev/health/redis
curl https://whatsapp-personal-api.fly.dev/health/memory

# Set up external monitoring (Uptime Robot, Pingdom, etc.)
# Monitor: https://whatsapp-personal-api.fly.dev/health
# Alert on: status !== "connected" or response time > 5s
```

## 🐛 Common Issues & Solutions

### Issue: App Still Crashes with OOM
```bash
# 1. Check if 512MB is enough
fly logs | grep -i memory

# 2. Scale to 1GB
fly scale memory 1024

# 3. Check if event listeners are accumulating
fly ssh console
# Inside: ps aux --sort=-%mem
# Check if memory keeps growing over time
```

### Issue: High Memory Usage Immediately After Start
```bash
# This might be normal for Baileys WhatsApp client
# Check memory endpoint after 1 hour of running
curl https://whatsapp-personal-api.fly.dev/health/memory

# If heapUsed stays under 300MB, it's healthy
# If it keeps growing, there might be another leak
```

### Issue: Multiple Redis Connections
```bash
# Check Redis connection status
curl https://whatsapp-personal-api.fly.dev/health/redis
curl https://whatsapp-personal-api.fly.dev/settings/recording-status

# If Redis is not needed, unset REDIS_URL
fly secrets unset REDIS_URL
```

## 📊 Expected Memory Usage

After the fixes, you should see:

**Healthy State:**
- RSS: 150-250 MB
- Heap Used: 80-150 MB
- Heap Total: 120-180 MB

**Warning Signs:**
- RSS growing beyond 400 MB
- Heap Used growing continuously
- External memory > 50 MB

**Critical (needs investigation):**
- RSS > 450 MB
- Heap Used > 350 MB
- Memory growing 10+ MB per hour

## 🔄 Rollback Plan

If issues persist after deployment:

```bash
# 1. Check deployment history
fly releases

# 2. Rollback to previous version
fly releases rollback

# 3. Or deploy a specific version
fly deploy --image <previous-image>
```

## 📝 Log Analysis Examples

### Find Memory Growth Patterns
```bash
# Extract memory usage from logs
fly logs --since "24h" | grep "memory_usage" | grep "rss_mb" > memory_24h.log

# Analyze growth
cat memory_24h.log | awk '{print $NF}' | sort -n
```

### Find Restart Events
```bash
fly logs --since "7d" | grep -i "restart\|starting\|stopped"
```

### Check Connection Issues
```bash
fly logs --since "24h" | grep -i "whatsapp\|connection\|disconnect"
```

## 🎯 Success Criteria

After deploying fixes, monitor for 48 hours. Success means:
- ✅ No OOM kills
- ✅ Memory usage stable (not growing continuously)
- ✅ RSS stays under 400 MB
- ✅ Application uptime > 95%
- ✅ No error spikes in logs

## 📞 Getting Help

If issues persist:
1. Collect 24h of memory logs
2. Check for patterns in crashes
3. Share logs in GitHub issues
4. Consider Fly.io support: https://fly.io/docs/about/support/
