# AI Agent Guide

## Overview

The WhatsApp Personal API now includes built-in AI agent capabilities powered by OpenAI. This allows your WhatsApp to automatically respond to incoming messages using GPT models with customizable personas and behavior.

## Features

- 🤖 **Automatic Responses**: AI agent automatically responds to incoming WhatsApp messages
- 🎭 **Custom Personas**: Define your agent's personality and behavior with custom system prompts
- 💬 **Conversation Context**: Maintains conversation history for contextual responses
- 🔐 **Whitelist Control**: Optionally restrict responses to specific phone numbers
- ⚙️ **Flexible Configuration**: Control model, temperature, max tokens, and more
- 🔄 **Real-time Updates**: Enable/disable and reconfigure without restarting

## Quick Start

### 1. Set Your OpenAI API Key

You can configure your OpenAI API key in two ways:

**Option A: Environment Variable (Recommended)**
```bash
echo 'OPENAI_API_KEY=sk-...' >> .env
```

**Option B: API Configuration**
```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "openaiApiKey": "sk-..."
  }'
```

### 2. Configure Your Agent

Set up your agent's persona and behavior:

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "persona": "You are a friendly personal assistant. Be concise and helpful. Always respond in a warm, professional tone.",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "maxTokens": 500,
    "autoReply": true
  }'
```

### 3. Enable the Agent

```bash
curl -X POST http://localhost:3000/agent/enable \
  -H "x-api-key: <API_KEY>"
```

That's it! Your WhatsApp will now automatically respond to incoming messages using AI.

## Configuration Options

### Agent Configuration Object

```typescript
{
  enabled: boolean                  // Enable/disable the agent
  openaiApiKey?: string            // OpenAI API key (optional if using env var)
  model: string                    // OpenAI model (default: 'gpt-4o-mini')
  persona: string                  // System prompt defining agent behavior
  temperature: number              // 0-2, creativity level (default: 0.7)
  maxTokens: number               // Max tokens per response (default: 500)
  autoReply: boolean              // Automatically send responses (default: true)
  whitelistedNumbers: string[]    // Only respond to these numbers (empty = all)
  conversationContextLimit: number // Messages to keep in context (default: 10)
}
```

### Recommended Models

- **gpt-4o-mini** (default): Fast, cost-effective, great for most use cases
- **gpt-4o**: More capable, better reasoning, higher cost
- **gpt-4-turbo**: Good balance of speed and capability
- **gpt-3.5-turbo**: Fastest and cheapest, basic conversations

### Temperature Guide

- **0.0-0.3**: Focused, deterministic, factual responses
- **0.4-0.7** (recommended): Balanced creativity and consistency
- **0.8-1.5**: More creative, varied, conversational
- **1.6-2.0**: Very creative, unpredictable

## API Endpoints

### Get Agent Configuration

```bash
GET /agent
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "enabled": true,
    "model": "gpt-4o-mini",
    "persona": "You are a helpful assistant...",
    "temperature": 0.7,
    "maxTokens": 500,
    "autoReply": true,
    "whitelistedNumbers": [],
    "conversationContextLimit": 10,
    "openaiApiKey": "***"
  },
  "contextCount": 3,
  "isEnabled": true
}
```

### Update Agent Configuration

```bash
PUT /agent
```

**Request Body:**
```json
{
  "persona": "You are a friendly customer support agent...",
  "temperature": 0.5,
  "maxTokens": 300
}
```

### Enable/Disable Agent

```bash
# Enable
POST /agent/enable

# Disable
POST /agent/disable
```

### Manage Conversation Contexts

```bash
# Clear specific conversation
DELETE /agent/context/{chatId}

# Clear all conversations
DELETE /agent/contexts

# Get context statistics
GET /agent/contexts

# Get specific conversation history
GET /agent/context/{chatId}
```

## Use Cases & Examples

### Personal Assistant

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "persona": "You are my personal assistant. Help me with scheduling, reminders, and quick information. Be brief and to the point.",
    "model": "gpt-4o-mini",
    "temperature": 0.5,
    "maxTokens": 300
  }'
```

### Customer Support Bot

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "persona": "You are a customer support agent for TechCorp. Be professional, empathetic, and solution-focused. Always acknowledge customer concerns.",
    "model": "gpt-4o",
    "temperature": 0.6,
    "maxTokens": 600,
    "whitelistedNumbers": ["+1234567890", "+0987654321"]
  }'
```

### Language Tutor

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "persona": "You are a Spanish language tutor. Help users practice Spanish by responding in Spanish and providing corrections when needed. Be encouraging and patient.",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 500
  }'
```

### Casual Friend Bot

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "persona": "You are a friendly, casual chat buddy. Use casual language, emojis occasionally, and be warm and supportive. Share your thoughts and feelings.",
    "model": "gpt-4o-mini",
    "temperature": 0.9,
    "maxTokens": 400
  }'
```

### Business Assistant with Whitelist

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "persona": "You are an executive assistant. Provide professional, concise responses. Help with meeting scheduling, document questions, and business inquiries.",
    "model": "gpt-4o",
    "temperature": 0.4,
    "maxTokens": 400,
    "whitelistedNumbers": ["+1234567890", "+1122334455", "+9988776655"]
  }'
```

## Advanced Features

### Conversation Context Management

The agent maintains conversation history for contextual responses. You can control:

- **Context Limit**: Number of messages to remember (default: 10)
- **Context Timeout**: Conversations older than 30 minutes are automatically cleared
- **Manual Clear**: Clear contexts via API for privacy/reset

### Whitelist Feature

Restrict the agent to only respond to specific phone numbers:

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "whitelistedNumbers": [
      "+1234567890",
      "0987654321",
      "1122334455"
    ]
  }'
```

**Note**: Phone numbers are normalized (digits only) for matching, so you can use any format.

### Auto-Reply Toggle

If you want the agent to process messages but not automatically send responses:

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "autoReply": false
  }'
```

This is useful for:
- Testing responses without sending them
- Manual review workflows
- Building custom response logic

## Best Practices

### 1. **Persona Design**

- **Be Specific**: Clearly define role, tone, and boundaries
- **Set Expectations**: Mention response style (brief, detailed, formal, casual)
- **Add Constraints**: Include what NOT to do
- **Test Iterations**: Refine based on actual responses

Example:
```
You are a professional financial advisor assistant. Provide clear, accurate information about basic financial concepts. Be formal and precise. Never give specific investment advice or make predictions. Always remind users to consult a licensed financial advisor for personal advice. Keep responses under 200 words.
```

### 2. **Model Selection**

- **Development/Testing**: Use `gpt-4o-mini` (fast and cheap)
- **Production**: Use `gpt-4o-mini` for most cases, `gpt-4o` if you need better reasoning
- **High Volume**: Stick with `gpt-4o-mini` or `gpt-3.5-turbo` for cost efficiency

### 3. **Token Management**

- **Quick Responses**: 200-300 tokens
- **Standard**: 400-500 tokens (default)
- **Detailed**: 800-1000 tokens
- **Max**: 4096 tokens (only if needed)

Remember: Tokens count both input (conversation history) and output (response).

### 4. **Conversation Context**

- **Short Chats**: 5-10 messages (default: 10)
- **Long Conversations**: 15-20 messages
- **Support Chats**: 20-30 messages

Higher limits use more tokens = higher costs.

### 5. **Security & Privacy**

- **API Key**: Use environment variables, never hardcode
- **Whitelist**: Use whitelist for sensitive/business accounts
- **Context Clearing**: Regularly clear contexts for privacy
- **Data Retention**: Remember that conversation contexts are in-memory only

### 6. **Cost Management**

Monitor your OpenAI usage:
- Check token usage in logs
- Set up OpenAI usage alerts
- Use lower token limits for high-volume scenarios
- Consider caching for frequently asked questions

**Estimated Costs** (as of 2024):
- `gpt-4o-mini`: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- `gpt-4o`: ~$5.00 per 1M input tokens, ~$15.00 per 1M output tokens

Example: 100 messages/day with gpt-4o-mini (~500 tokens each) ≈ $0.50/month

## Troubleshooting

### Agent Not Responding

1. **Check if enabled**:
   ```bash
   curl -H "x-api-key: <API_KEY>" http://localhost:3000/agent
   ```

2. **Verify API key**:
   - Set via environment variable or API
   - Check OpenAI account for validity

3. **Check whitelist**:
   - If whitelist is set, sender must be on it
   - Empty whitelist = respond to all

4. **Check logs**:
   ```bash
   # Look for agent-related errors
   grep -i "agent" logs.txt
   grep -i "openai" logs.txt
   ```

### High Costs

- Lower `maxTokens` (e.g., 200-300)
- Use `gpt-4o-mini` instead of `gpt-4o`
- Reduce `conversationContextLimit`
- Set up whitelist to limit usage
- Monitor OpenAI dashboard

### Poor Response Quality

- Improve persona prompt (be more specific)
- Increase `maxTokens` if responses are cut off
- Adjust `temperature` (lower for consistency, higher for creativity)
- Consider upgrading to `gpt-4o` for better reasoning
- Increase `conversationContextLimit` for better context understanding

### Context Not Working

- Check `conversationContextLimit` setting
- Verify messages are being recorded
- Contexts auto-clear after 30 minutes of inactivity
- Manually clear contexts if needed

### API Key Issues

```bash
# Error: "OpenAI API key not configured"
# Solution: Set the API key

# Via environment variable
export OPENAI_API_KEY=sk-...

# Or via API
curl -X PUT http://localhost:3000/agent \
  -H "x-api-key: <API_KEY>" \
  -d '{"openaiApiKey": "sk-..."}'
```

## Integration with Other Features

### Combine with Scheduled Messages

The agent only responds to incoming messages. For scheduled AI-generated messages, consider:

1. Generate content with OpenAI API manually
2. Schedule the generated content
3. Or build custom integration

### Combine with Pub/Sub

- Agent responds to individual messages
- Pub/Sub broadcasts to multiple recipients
- Use both for comprehensive communication

### Message Recording

All AI agent messages are automatically recorded using your configured backend (Redis or Base44), just like regular messages.

## Privacy & Compliance

### Data Handling

- **Conversation Context**: Stored in-memory only, not persisted to disk
- **Message Recording**: Inbound/outbound messages are recorded per your settings
- **OpenAI**: Messages are sent to OpenAI for processing (see OpenAI's privacy policy)

### Best Practices

1. **Inform Users**: Let users know they're chatting with an AI
2. **Data Minimization**: Use whitelist to limit who can interact
3. **Regular Cleanup**: Clear contexts regularly
4. **Compliance**: Ensure compliance with WhatsApp Terms of Service and data regulations

### Clear Contexts Regularly

For privacy, periodically clear conversation contexts:

```bash
# Clear all contexts daily (via cron or scheduled task)
curl -X DELETE http://localhost:3000/agent/contexts \
  -H "x-api-key: <API_KEY>"
```

## Examples in Production

### Enable Agent with Full Configuration

```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "enabled": true,
    "openaiApiKey": "sk-proj-...",
    "model": "gpt-4o-mini",
    "persona": "You are a helpful personal assistant for John. You help with scheduling, reminders, and answering questions. Be professional but friendly. Keep responses brief and actionable. If you do not know something, say so clearly.",
    "temperature": 0.6,
    "maxTokens": 400,
    "autoReply": true,
    "whitelistedNumbers": [],
    "conversationContextLimit": 10
  }'
```

### Monitor Agent Activity

```bash
# Check agent status and active conversations
curl -H "x-api-key: <API_KEY>" http://localhost:3000/agent

# Response:
{
  "success": true,
  "agent": {...},
  "contextCount": 5,
  "isEnabled": true
}
```

### Temporarily Disable Agent

```bash
# Disable without losing configuration
curl -X POST http://localhost:3000/agent/disable \
  -H "x-api-key: <API_KEY>"

# Re-enable later
curl -X POST http://localhost:3000/agent/enable \
  -H "x-api-key: <API_KEY>"
```

## Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...           # Your OpenAI API key

# Existing Variables (still work as before)
API_TOKENS=your_api_key
PORT=3000
STORAGE_DIR=/data
LOG_LEVEL=info
```

## FAQ

**Q: Does the agent respond to group messages?**  
A: Yes, if the agent is enabled and the group chat ID is not filtered by whitelist.

**Q: Can I use different personas for different contacts?**  
A: Not directly. You would need to implement custom logic in the message handler for this. The current implementation uses a single persona for all conversations.

**Q: What happens if OpenAI API is down?**  
A: The agent will log errors but won't crash your service. Messages will still be recorded, just not responded to by AI.

**Q: Can I use other AI providers (Anthropic, etc.)?**  
A: Currently only OpenAI is supported. To add other providers, you'd need to modify the `AgentService` class.

**Q: How much does this cost?**  
A: Costs depend on usage. With gpt-4o-mini and ~100 messages/day at 500 tokens each, expect ~$0.50-1.00/month. Use OpenAI's dashboard to monitor costs.

**Q: Can I test responses without sending them?**  
A: Yes! Set `autoReply: false`, then check logs for generated responses. Responses will be generated but not sent.

**Q: How do I make the agent stop responding to someone?**  
A: Either disable the agent globally, or add a whitelist and exclude that person's number.

**Q: Does conversation context persist across restarts?**  
A: No, context is in-memory only. It's cleared on restart and after 30 minutes of inactivity.

## Support

For issues, questions, or feature requests related to the AI agent:

1. Check logs for errors: `grep -i "agent\|openai" logs.txt`
2. Verify configuration: `GET /agent`
3. Test with minimal configuration first
4. Review OpenAI API status: https://status.openai.com/

## Related Documentation

- **[API Reference](API_REFERENCE.md)** - Complete API documentation
- **[Getting Started](GETTING_STARTED.md)** - Initial setup
- **[Scheduling Guide](SCHEDULING_GUIDE.md)** - Automated messaging
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions

## Changelog

- **v1.0.0** - Initial AI agent implementation with OpenAI integration
