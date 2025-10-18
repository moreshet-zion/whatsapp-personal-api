# Memory Leak Investigation & Debugging Guide

## Current Situation

**Application**: WhatsApp Personal API on Fly.io
**Instance**: 48e46deb7ee548 (summer-rain-4241)
**Error**: Out of Memory Kill
- total-vm: 22282488kB (~22GB virtual memory)
- anon-rss: 111988kB (~112MB resident memory)
- **Current allocation**: 256MB RAM

## 🔍 Identified Issues

### 1. **Event Listener Memory Leaks** ⚠️ HIGH PRIORITY

**Location**: `src/services/whatsapp.ts`

The WhatsApp client creates event listeners that are **never cleaned up**:
- Line 161: `socket.ev.on('creds.update', saveCreds)`
- Line 163: `socket.ev.on('connection.update', async (update) => {...})`
- Line 190: `socket.ev.on('messages.upsert', async (messageUpdate) => {...})`

**Problem**: 
- When `restart()` is called (line 210), the old socket is ended but listeners remain attached
- On reconnection (line 184), new listeners are added without removing old ones
- Each disconnect/reconnect cycle adds more listeners → memory leak

**Impact**: Over time, especially with unstable connections, this accumulates hundreds of listeners.

### 2. **Cron Job and Timeout Accumulation**

**Location**: `src/services/scheduler.ts`

- Lines 30-31: Maps storing cron tasks and timeouts
- On update (line 346-357): Old tasks are stopped but might not be fully garbage collected
- If jobs fail to stop properly, they accumulate in memory

### 3. **Insufficient Memory Allocation**

**Current**: 256MB (`fly.toml` line 39)
**Problem**: 
- WhatsApp Baileys library maintains WebSocket connections, session state, and message buffers
- Node.js default max-old-space-size for 256MB RAM is too low for this workload
- Virtual memory at 22GB suggests heavy swapping before OOM kill

### 4. **Redis Connection Issues**

**Location**: `src/infra/redis.ts` & `src/services/recorders/redisRecorder.ts`

- Redis clients created with `lazyConnect: true`
- Multiple Redis instances might be created (one in redis.ts, one per RedisRecorder)
- If Redis isn't configured, clients still exist in memory
- No connection cleanup on errors

### 5. **Message Buffer Accumulation**

**Location**: `src/services/whatsapp.ts` lines 189-207

- Incoming messages trigger async handlers
- No backpressure mechanism
- During high-message volume, handlers could pile up

## 🛠️ Recommended Fixes

### Fix 1: Clean up event listeners properly

```typescript
// In src/services/whatsapp.ts
export class WhatsAppClient {
  private eventHandlers: Map<string, any> = new Map();
  
  public async start(): Promise<void> {
    // ... existing code ...
    
    // Store handlers so we can remove them later
    const credsHandler = saveCreds;
    const connectionHandler = async (update) => { /* existing code */ };
    const messagesHandler = async (messageUpdate) => { /* existing code */ };
    
    this.socket.ev.on('creds.update', credsHandler);
    this.socket.ev.on('connection.update', connectionHandler);
    this.socket.ev.on('messages.upsert', messagesHandler);
    
    this.eventHandlers.set('creds', credsHandler);
    this.eventHandlers.set('connection', connectionHandler);
    this.eventHandlers.set('messages', messagesHandler);
  }
  
  public async restart(): Promise<void> {
    try {
      // Remove all event listeners before ending socket
      if (this.socket) {
        this.eventHandlers.forEach((handler, key) => {
          this.socket?.ev.off(`${key}.update` as any, handler);
        });
        this.eventHandlers.clear();
      }
      
      await this.socket?.end?.(new Error('manual-restart'));
    } catch {}
    
    this.socket = null;
    this.status = 'disconnected';
    this.qrState = {};
    await this.start();
  }
}
```

### Fix 2: Increase memory allocation

```toml
# In fly.toml
[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory = "512mb"  # Increased from 256mb
```

### Fix 3: Set Node.js memory limits

```dockerfile
# In Dockerfile, update the CMD line
CMD [ "node", "--max-old-space-size=384", "dist/server.js" ]
```

### Fix 4: Add memory monitoring endpoint

```typescript
// In src/server.ts, add new endpoint
app.get('/health/memory', (req, res) => {
  const used = process.memoryUsage();
  res.json({
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(used.external / 1024 / 1024)} MB`,
    arrayBuffers: `${Math.round(used.arrayBuffers / 1024 / 1024)} MB`,
  });
});
```

## 📊 Monitoring with Fly.io Tools

### 1. **Check current memory usage**
```bash
fly status
fly vm status
```

### 2. **View metrics dashboard**
```bash
fly dashboard
```

### 3. **Stream logs in real-time**
```bash
fly logs
```

### 4. **Check for OOM kills**
```bash
fly logs --search "Out of memory"
```

### 5. **Monitor resource usage**
```bash
fly metrics
```

### 6. **SSH into the machine**
```bash
fly ssh console
# Then inside the container:
ps aux --sort=-%mem | head
top -o %MEM
cat /proc/meminfo
```

### 7. **Enable fly-log-shipper for better monitoring**
Add to fly.toml:
```toml
[metrics]
  port = 9091
  path = "/metrics"
```

### 8. **Create alerts**
```bash
# Set up Fly.io to alert on high memory usage
# (Configure in Fly.io dashboard)
```

## 🧪 How to Test for Memory Leaks

### 1. **Local Testing with heapdump**

Install heapdump:
```bash
npm install heapdump
```

Add to server.ts:
```typescript
import heapdump from 'heapdump';

// Trigger heap dump on specific endpoint
app.post('/debug/heapdump', (req, res) => {
  const filename = `heapdump-${Date.now()}.heapsnapshot`;
  heapdump.writeSnapshot(filename, (err, filepath) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true, file: filepath });
    }
  });
});
```

### 2. **Use clinic.js for profiling**
```bash
npm install -g clinic
clinic doctor -- node dist/server.js
```

### 3. **Memory usage logging**
Add periodic memory logging:
```typescript
// In server.ts
setInterval(() => {
  const used = process.memoryUsage();
  logger.info({
    evt: 'memory_usage',
    rss_mb: Math.round(used.rss / 1024 / 1024),
    heap_used_mb: Math.round(used.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(used.heapTotal / 1024 / 1024),
  });
}, 60000); // Every minute
```

## 🚀 Immediate Actions

1. **Deploy with increased memory** (512MB)
2. **Add Node.js memory limit** (384MB max-old-space-size)
3. **Add memory monitoring endpoint**
4. **Monitor logs for 24-48 hours**
5. **Fix event listener cleanup**
6. **Consider Redis cleanup if not in use**

## 📈 Long-term Monitoring

1. Set up proper application monitoring (Grafana, Prometheus, or Fly.io metrics)
2. Create memory usage alerts
3. Implement graceful degradation when memory is high
4. Consider horizontal scaling if load increases
5. Review message retention policies (how long to keep messages in memory)

## 💡 Additional Considerations

### Why 22GB virtual memory with 112MB RSS?

This pattern suggests:
- Node.js allocating virtual memory space but not using it (RSS)
- Possible memory fragmentation
- V8 heap management issues
- System trying to swap but failing

### Baileys Library Specifics

The `@whiskeysockets/baileys` library:
- Maintains WebSocket connection state
- Stores session authentication data
- Buffers incoming/outgoing messages
- Can grow memory if messages aren't processed fast enough

### When to scale horizontally vs vertically

**Vertical (more RAM)**:
- Single WhatsApp session
- Simple deployment
- Cost-effective up to 1GB

**Horizontal**:
- Multiple WhatsApp accounts
- High message volume
- Better resilience

## 🔗 Useful Links

- [Fly.io Monitoring](https://fly.io/docs/reference/metrics/)
- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
