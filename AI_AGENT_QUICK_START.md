# AI Agent Quick Start

This is a quick reference for setting up the AI agent feature. For complete documentation, see [AI Agent Guide](docs/AI_AGENT_GUIDE.md).

## 3-Step Setup

### 1. Set OpenAI API Key

```bash
# Add to .env file
echo 'OPENAI_API_KEY=sk-proj-your-key-here' >> .env
```

### 2. Configure & Enable Agent

```bash
# Replace <API_KEY> with your WhatsApp API key
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "enabled": true,
    "persona": "You are a helpful AI assistant. Be friendly and concise.",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "maxTokens": 500,
    "autoReply": true
  }'
```

### 3. Test It!

Send a WhatsApp message to your connected number and get an AI response!

## Common Operations

### Check Status
```bash
curl -H "x-api-key: <API_KEY>" http://localhost:3000/agent
```

### Enable/Disable
```bash
# Enable
curl -X POST http://localhost:3000/agent/enable -H "x-api-key: <API_KEY>"

# Disable
curl -X POST http://localhost:3000/agent/disable -H "x-api-key: <API_KEY>"
```

### Update Persona
```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "persona": "Your new persona here..."
  }'
```

### Restrict to Specific Numbers (Whitelist)
```bash
curl -X PUT http://localhost:3000/agent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY>" \
  -d '{
    "whitelistedNumbers": ["+1234567890", "+0987654321"]
  }'
```

### Clear Conversation History
```bash
# Clear all conversations
curl -X DELETE http://localhost:3000/agent/contexts -H "x-api-key: <API_KEY>"

# Clear specific chat
curl -X DELETE http://localhost:3000/agent/context/<CHAT_ID> -H "x-api-key: <API_KEY>"
```

## Configuration Quick Reference

| Parameter | Default | Description |
|-----------|---------|-------------|
| `enabled` | `false` | Enable/disable the agent |
| `model` | `gpt-4o-mini` | OpenAI model to use |
| `persona` | (default) | System prompt defining behavior |
| `temperature` | `0.7` | Creativity (0.0-2.0) |
| `maxTokens` | `500` | Max response length |
| `autoReply` | `true` | Auto-send responses |
| `whitelistedNumbers` | `[]` | Allowed numbers (empty = all) |
| `conversationContextLimit` | `10` | Messages in context |

## Popular Personas

### Personal Assistant
```json
{
  "persona": "You are my personal assistant. Help with scheduling, reminders, and quick information. Be brief and actionable."
}
```

### Customer Support
```json
{
  "persona": "You are a professional customer support agent. Be empathetic, solution-focused, and always acknowledge concerns."
}
```

### Casual Friend
```json
{
  "persona": "You are a friendly chat buddy. Use casual language, emojis occasionally, and be warm and supportive.",
  "temperature": 0.9
}
```

### Professional Advisor
```json
{
  "persona": "You are a professional advisor. Provide clear, accurate information. Always remind users to consult experts for important decisions.",
  "temperature": 0.5
}
```

## API Endpoints

- `GET /agent` - Get configuration and status
- `PUT /agent` - Update configuration
- `POST /agent/enable` - Enable agent
- `POST /agent/disable` - Disable agent
- `GET /agent/contexts` - Get context count
- `GET /agent/context/:chatId` - Get conversation history
- `DELETE /agent/context/:chatId` - Clear specific conversation
- `DELETE /agent/contexts` - Clear all conversations

## Troubleshooting

**Agent not responding?**
1. Check if enabled: `GET /agent`
2. Verify OpenAI API key is set
3. Check logs for errors
4. Verify whitelist (if set)

**High costs?**
- Lower `maxTokens` (e.g., 200-300)
- Use `gpt-4o-mini` (default)
- Reduce `conversationContextLimit`
- Use whitelist to limit usage

**Poor responses?**
- Improve persona (be more specific)
- Increase `maxTokens` if cut off
- Adjust `temperature`
- Try `gpt-4o` for better reasoning

## Cost Estimation

With **gpt-4o-mini** (recommended):
- ~100 messages/day: $0.50-1.00/month
- ~500 messages/day: $2.50-5.00/month
- ~1000 messages/day: $5.00-10.00/month

*Costs vary based on message length and conversation context*

## Full Documentation

For detailed information, examples, and best practices:
- **[Complete AI Agent Guide](docs/AI_AGENT_GUIDE.md)**
- **[API Reference](docs/API_REFERENCE.md)**

## Support

Questions? Check the [AI Agent Guide](docs/AI_AGENT_GUIDE.md) or review logs for errors.
