# WhatsApp Connection Closure Fix

## Problem Summary

Your WhatsApp connection was repeatedly closing with:
- **Status Code 405**: Connection closed by server
- **"Buffer timeout reached, auto-flushing"**: Pino logger buffer timeouts

## Root Causes Identified

### 1. **Missing KeepAlive Configuration** (CRITICAL)
- **Issue**: No `keepAliveIntervalMs` configured in Baileys socket
- **Impact**: WhatsApp server closes idle connections, resulting in status code 405
- **Solution**: Added `keepAliveIntervalMs: 60000` (60-second ping interval)

### 2. **Missing Timeout Configurations**
- **Issue**: No timeout settings for connections and queries
- **Impact**: Connections can hang indefinitely or timeout unexpectedly
- **Solution**: Added:
  - `connectTimeoutMs: 60000` 
  - `defaultQueryTimeoutMs: 60000`
  - `retryRequestDelayMs: 1000`

### 3. **Aggressive Reconnection Logic**
- **Issue**: Fixed 1-second reconnection delay with no backoff
- **Impact**: Can trigger rate limiting and waste resources
- **Solution**: Implemented exponential backoff (2s → 4s → 8s → 16s → 32s → 60s max)

### 4. **Insufficient Error Logging**
- **Issue**: Limited error context on connection failures
- **Impact**: Difficult to debug connection issues
- **Solution**: Enhanced logging with full error details and reconnection metrics

## Changes Made to `src/services/whatsapp.ts`

### 1. Added Reconnection Tracking
```typescript
private reconnectAttempts: number = 0
private maxReconnectAttempts: number = 10
```

### 2. Enhanced Socket Configuration
```typescript
this.socket = makeWASocket({
  auth: state,
  printQRInTerminal: false,
  browser: Browsers.macOS('Safari'),
  logger: pino({ level: 'warn' }),
  syncFullHistory: false,
  // NEW: Critical connection settings
  keepAliveIntervalMs: 60000,        // Keep connection alive
  connectTimeoutMs: 60000,           // Connection timeout
  defaultQueryTimeoutMs: 60000,      // Query timeout
  retryRequestDelayMs: 1000,         // Retry delay
  markOnlineOnConnect: true,         // Mark as online when connected
})
```

### 3. Exponential Backoff Reconnection
- Attempts: 1-10 before giving up
- Delays: 2s, 4s, 8s, 16s, 32s, up to 60s max
- Resets to 0 on successful connection

### 4. Enhanced Error Logging
Now logs:
- Status codes
- Error messages and stack traces
- Reconnection attempt count
- Calculated backoff delays

## Why This Fixes Status Code 405

**Status code 405** in Baileys typically means "Connection Closed" or "Method Not Allowed" and commonly occurs when:

1. **No KeepAlive Pings**: The WhatsApp server closes connections that don't send regular keepalive pings. This is the #1 cause.
2. **Network Timeouts**: Without proper timeout configurations, connections can be closed unexpectedly.
3. **Rate Limiting**: Aggressive reconnection without backoff can trigger server-side rate limits.

The `keepAliveIntervalMs: 60000` setting ensures your connection sends a ping every 60 seconds, preventing the server from considering it idle and closing it.

## Testing & Monitoring

### 1. Monitor Logs for Improvements
Look for:
- ✅ **No more "Buffer timeout" messages** (or significantly reduced)
- ✅ **"WhatsApp connected successfully"** messages
- ✅ **Reconnection attempts with backoff delays** if disconnections occur
- ✅ **Connection stays stable for longer periods**

### 2. Check Connection Status
```bash
curl http://your-api-url/health
```

Expected response:
```json
{
  "status": "connected",
  "timestamp": "2025-10-23T...",
  "scheduledMessages": 0,
  "activeJobs": []
}
```

### 3. Review Logs in Fly.io
```bash
fly logs -a your-app-name
```

Look for:
- Successful connections staying open
- Reduced reconnection frequency
- No more repeated 405 errors

## Additional Recommendations

### 1. **Consider Upgrading Baileys** (If Stable Version Available)
You're currently using `@whiskeysockets/baileys@7.0.0-rc.2` (release candidate).
Check for stable releases:
```bash
npm view @whiskeysockets/baileys versions
```

### 2. **Monitor Memory Usage**
Your Fly.io instance has limited memory (384MB). Monitor for memory issues:
```bash
curl http://your-api-url/health/memory
```

### 3. **Session Backup**
Ensure your session files are properly persisted. Connection closures can sometimes corrupt session data. Your current setup stores sessions in `/workspace/sessions` or `STORAGE_DIR/sessions`.

### 4. **Network Stability**
If issues persist, consider:
- Fly.io region issues (try different regions)
- Network connectivity in your deployment environment
- Firewall/proxy issues blocking WebSocket connections

## Common Baileys Connection Issues (Reference)

| Status Code | Meaning | Common Cause |
|-------------|---------|--------------|
| 401 | Unauthorized | Logged out, session expired |
| 405 | Connection Closed | **Missing keepalive, timeout** |
| 408 | Request Timeout | Network issues, slow connection |
| 411 | Restart Required | Server requested restart |
| 428 | Connection Closed | Connection lost |
| 440 | Connection Replaced | Logged in elsewhere |
| 515 | Rate Limited | Too many requests |

## If Issues Persist

1. **Check Baileys GitHub Issues**: Search for your specific error code
   - https://github.com/WhiskeySockets/Baileys/issues

2. **Enable Debug Logging**: Change logger level to 'debug' temporarily
   ```typescript
   logger: pino({ level: 'debug' })
   ```

3. **Verify Session Files**: Check if session files are corrupted
   ```bash
   ls -la /path/to/sessions/
   ```

4. **Manual Restart**: Use the restart endpoint if needed
   ```bash
   curl -X POST http://your-api-url/restart \
     -H "X-API-Key: your-api-key"
   ```

5. **Re-authenticate**: If session is corrupted, delete session files and re-scan QR code
   ```bash
   rm -rf /path/to/sessions/*
   # Then visit /qr-image to get new QR code
   ```

## Expected Outcome

After this fix:
- ✅ Connection should stay alive for hours/days without closure
- ✅ If disconnections occur, they'll use exponential backoff
- ✅ Better visibility into connection issues through enhanced logging
- ✅ No more frequent 405 errors due to missing keepalive

## Deployment

To apply these changes:

1. **Commit and deploy**:
   ```bash
   git add src/services/whatsapp.ts
   git commit -m "Fix WhatsApp connection closures with keepalive and backoff"
   git push
   ```

2. **Deploy to Fly.io**:
   ```bash
   fly deploy
   ```

3. **Monitor logs after deployment**:
   ```bash
   fly logs -a your-app-name
   ```

## Reference Links

- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [Baileys Connection Issues](https://github.com/WhiskeySockets/Baileys/issues?q=is%3Aissue+connection+closed)
- [WebSocket KeepAlive Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
