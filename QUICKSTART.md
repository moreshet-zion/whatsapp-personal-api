# 🚀 Quick Start Guide

## System Overview

This is a **high-level message interception and routing system** with the following key components:

1. **Message Interceptor** - Entry point for all incoming messages
2. **Intelligent Router** - Decides whether to process, route, or ignore messages
3. **Conversation Manager** - Handles conversation lifecycle and history
4. **AI Agent Abstraction** - Supports multiple AI engines (OpenAI, Claude, Gemini, etc.)
5. **Storage Layer** - Local files now, Redis-ready for scaling

## 🎯 Key Design Principles

- **Pluggable Architecture**: Easy to add new AI engines, routing rules, or storage backends
- **Scalability Ready**: Start with local files, seamlessly migrate to Redis
- **Customizable Logic**: Add your own routing rules, message processors, and agent behaviors
- **Multi-Engine Support**: Switch between different AI providers without code changes

## 📦 Installation

```bash
# No external dependencies required for basic usage!
python3 start_system.py
```

For production with real AI engines:
```bash
# Create virtual environment (optional)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## 🏃 Running the System

### Interactive Mode (Default)
```bash
python3 start_system.py
```
Chat with the bot in real-time!

### Demo Mode
```bash
python3 start_system.py --demo
```
See automated message processing examples.

### Custom Usage
```python
from message_system.core.message import Message
from message_system.interceptor.message_interceptor import MessageInterceptor
# ... see example_usage.py for full examples
```

## 🔧 Configuration Options

### 1. Custom Routing Rules

Add keyword-based routing:
```python
router.add_keyword_rule(
    keywords=["urgent", "emergency"],
    create_new=True,
    priority=100
)
```

Add pattern-based routing:
```python
router.add_pattern_rule(
    pattern=r"ticket #\d+",
    conversation_id="support_conv",
    priority=90
)
```

### 2. AI Engine Configuration

**Local Engine** (for testing):
```python
engine = EngineFactory.create_engine("local", {
    "responses": {
        "hello": "Hi there!",
        "help": "How can I help?"
    }
})
```

**OpenAI Engine**:
```python
engine = EngineFactory.create_engine("openai", {
    "api_key": "your-key",
    "model": "gpt-4",
    "temperature": 0.7
})
```

**Claude Engine**:
```python
engine = EngineFactory.create_engine("claude", {
    "api_key": "your-key",
    "model": "claude-3-opus"
})
```

### 3. Agent Personas

```python
agent = PersonaAgent(
    agent_id="support",
    persona={
        "name": "Alex",
        "role": "Support Specialist",
        "personality": "Helpful and patient",
        "instructions": "Help users with technical issues"
    },
    engine=engine
)
```

## 📊 Storage Migration Path

### Phase 1: Local Development
```python
storage = LocalFileStorage("./data")
```

### Phase 2: Add Redis (Hybrid)
```python
local = LocalFileStorage("./data")
redis = RedisStorage("localhost", 6379)
storage = HybridStorage(local, redis)
```

### Phase 3: Full Redis
```python
storage = RedisStorage("localhost", 6379)
```

## 🎨 Architecture Highlights

### Routing Decision Flow
```
Message → Router → Decision:
  ├─ should_process: true/false
  ├─ conversation_id: existing or null
  ├─ create_new_conversation: true/false
  └─ metadata: custom data
```

### Conversation Lifecycle
```
New Message → Route Decision → Create/Get Conversation 
    → Process with Agent → Update History → Return Response
```

### Storage Abstraction
```python
# Same interface for all backends!
await storage.set("key", value)
await storage.get("key")
await storage.append_to_list("list_key", item)
```

## 📝 Common Use Cases

### Customer Support Bot
```python
# Route support queries to specialized agent
router.add_keyword_rule(
    keywords=["help", "support", "issue"],
    create_new=True,
    priority=80
)
```

### Multi-Department Routing
```python
def route_to_department(message):
    if "billing" in message.content.lower():
        return RoutingDecision(
            should_process=True,
            metadata={"department": "billing"}
        )
    # ... more departments
```

### Conversation Continuity
```python
# System automatically detects ongoing conversations
# within 30-minute timeout window
```

## 🔌 Extending the System

### Add New AI Engine
```python
class CustomEngine(BaseEngine):
    async def generate_response(self, message, history, context):
        # Your implementation
        return response
```

### Add Custom Router
```python
async def custom_rule(message):
    # Your logic
    return RoutingDecision(...)

await router.register_rule("my_rule", custom_rule)
```

### Add Message Processor
```python
def encrypt_sensitive(message):
    # Process message
    return message

interceptor.add_pre_processor(encrypt_sensitive)
```

## 📊 Monitoring

Check active conversations:
```python
conversations = await manager.list_active_conversations()
for conv in conversations:
    print(f"ID: {conv.conversation_id}")
    print(f"Participants: {conv.participant_ids}")
```

Get conversation history:
```python
history = await manager.get_conversation_history(conv_id)
for msg in history:
    print(f"{msg.sender_id}: {msg.content}")
```

## 🚨 Important Notes

1. **API Keys**: For production, add real API keys for AI engines
2. **Storage**: Default uses local files, perfect for development
3. **Scaling**: System designed to scale - just swap storage backend
4. **Customization**: Every component is pluggable and extensible

## 📚 File Structure

```
/workspace/
├── message_system/          # Core system
│   ├── core/               # Base classes and interfaces
│   ├── interceptor/        # Message interception
│   ├── routing/            # Routing logic
│   ├── conversation/       # Conversation management
│   ├── agents/             # AI agents and engines
│   └── storage/            # Storage backends
├── config/                 # Configuration files
├── data/                   # Local storage (auto-created)
├── start_system.py         # Quick start script
├── example_usage.py        # Detailed examples
└── README.md              # Full documentation
```

## 🎉 Ready to Start!

Run the system:
```bash
python3 start_system.py
```

Type messages to interact with the bot, or use `--demo` flag to see automated examples.

Happy messaging! 🚀