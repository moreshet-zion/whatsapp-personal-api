# Bug Fix: Scheduled Messages to WhatsApp Groups

## Problem Description

When scheduling a message to a WhatsApp group, the message was being sent to a contact number instead of the group. This resulted in the message being sent to an invalid phone number like `+120363339062208504` instead of the group with JID `120363339062208504@g.us`.

### Example
- **Group JID**: `120363339062208504@g.us`
- **Incorrectly sent to**: `+120363339062208504` (treated as a contact number)

### Symptoms
- Immediate messages to groups worked correctly
- Scheduled messages to groups were sent to non-existent contact numbers

## Root Cause

The bug was in the `formatJid()` method in `/workspace/src/services/scheduler.ts` (lines 210-221).

When processing scheduled messages, if the group JID was accidentally placed in the `number` field instead of the `jid` field, the code would:

1. Take the value `120363339062208504@g.us` from the `number` field
2. Strip ALL non-numeric characters using `.replace(/[^0-9]/g, '')`
3. This removed the `@g.us` suffix, leaving only `120363339062208504`
4. Append `@s.whatsapp.net` to make it `120363339062208504@s.whatsapp.net`
5. WhatsApp then interpreted this as a contact number `+120363339062208504`

### Code Before Fix

```typescript
private formatJid(msg: ScheduledMessage): string {
  if (msg.jid) {
    return msg.jid
  } else if (msg.number) {
    const trimmed = msg.number.replace(/[^0-9]/g, '')
    return `${trimmed}@s.whatsapp.net`
  } else {
    throw new Error('No recipient specified')
  }
}
```

## Solution

The fix adds a check to detect if the `number` field already contains a complete JID (either group or individual) and uses it directly without modification.

### Code After Fix

```typescript
private formatJid(msg: ScheduledMessage): string {
  if (msg.jid) {
    // Use the provided JID directly (for groups or already formatted numbers)
    return msg.jid
  } else if (msg.number) {
    // Check if the number field already contains a JID (e.g., group JID like 120363339062208504@g.us)
    if (msg.number.includes('@g.us') || msg.number.includes('@s.whatsapp.net') || msg.number.includes('@broadcast')) {
      // Already a JID, use it directly
      return msg.number
    }
    // Format the phone number as a JID
    const trimmed = msg.number.replace(/[^0-9]/g, '')
    return `${trimmed}@s.whatsapp.net`
  } else {
    throw new Error('No recipient specified')
  }
}
```

## Files Modified

1. **`/workspace/src/services/scheduler.ts`** (lines 210-226)
   - Updated `formatJid()` method to detect and handle JIDs in the `number` field
   - Added support for group JIDs (`@g.us`), individual JIDs (`@s.whatsapp.net`), and broadcast lists (`@broadcast`)

2. **`/workspace/src/server.ts`** (lines 113-129)
   - Updated JID formatting logic in `/send` endpoint for consistency
   - Added support for all WhatsApp JID formats

## Behavioral Changes

### Before Fix
- If a group JID was provided in the `number` field (user error or frontend bug), it would be converted to an invalid contact number
- Example: `120363339062208504@g.us` → `+120363339062208504`

### After Fix
- If a group JID is provided in either the `jid` or `number` field, it's used correctly
- Phone numbers continue to work as before
- More robust handling of edge cases
- Supports all WhatsApp JID formats:
  - Groups: `@g.us`
  - Individual contacts: `@s.whatsapp.net`
  - Broadcast lists: `@broadcast`

## Testing

A comprehensive test suite has been added in `/workspace/test/groupJidHandling.test.js` that covers:

1. ✅ Immediate messages with group JID in `jid` field
2. ✅ Immediate messages with group JID in `number` field (edge case)
3. ✅ Cron-based scheduled messages with group JID in `jid` field
4. ✅ Cron-based scheduled messages with group JID in `number` field (the bug scenario)
5. ✅ Date-based scheduled messages with group JID in `jid` field
6. ✅ Date-based scheduled messages with group JID in `number` field
7. ✅ Regular phone numbers in immediate messages
8. ✅ Regular phone numbers in scheduled messages

## Best Practices

While this fix makes the system more robust, users should still:
- Use the `jid` field for group JIDs (e.g., `120363339062208504@g.us`)
- Use the `number` field for phone numbers (e.g., `1234567890`)

The fix ensures that even if these fields are used incorrectly, the system will still work correctly.

## Backwards Compatibility

This fix is fully backwards compatible:
- Existing scheduled messages with phone numbers will continue to work
- Existing scheduled messages with group JIDs in the correct field will continue to work
- The fix only adds additional handling for edge cases
