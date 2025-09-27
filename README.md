# Message Interception and Routing System

A highly modular and scalable system for intercepting, routing, and processing messages with AI agent integration. Designed with flexibility in mind, supporting multiple storage backends, AI engines, and custom routing logic.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Message Interception Layer               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Message Interceptor                       │   │
│  │  - Pre-processing                                   │   │
│  │  - Queue management                                 │   │
│  │  - Post-processing                                  │   │
│  └──────────────────┬──────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      Routing Layer                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Message Router                           │   │
│  │  - Custom routing rules                            │   │
│  │  - Pattern matching                                │   │
│  │  - Keyword detection                               │   │
│  │  - Conversation detection                          │   │
│  └──────────────────┬──────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Conversation Management                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Conversation Manager                        │   │
│  │  - Conversation lifecycle                          │   │
│  │  - History tracking                                │   │
│  │  - State management                                │   │
│  │  - Analytics                                       │   │
│  └──────────────────┬──────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent Layer                           │
│  ┌──────────────┬──────────────┬──────────────────────┐   │
│  │ Support Agent│ Sales Agent  │ Custom Agents        │   │
│  │              │              │                      │   │
│  │  Personas    │  Personas    │  Personas           │   │
│  └──────┬───────┴──────┬───────┴──────┬───────────────┘   │
│         │              │              │                    │
│  ┌──────▼──────────────▼──────────────▼───────────────┐   │
│  │            AI Engine Abstraction                    │   │
│  │  ┌────────┬────────┬────────┬──────────────────┐  │   │
│  │  │OpenAI  │Claude  │Gemini  │Local/Custom      │  │   │
│  │  └────────┴────────┴────────┴──────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Storage Abstraction                       │   │
│  │  ┌──────────────┐     ┌──────────────────────┐    │   │
│  │  │ Local Files  │ ←→  │      Redis           │    │   │
│  │  └──────────────┘     └──────────────────────┘    │   │
│  │         Seamless Migration Path                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Key Features

### 1. **Message Interception**
- Centralized entry point for all incoming messages
- Pre and post-processing pipelines
- Asynchronous message queue processing
- Message status tracking

### 2. **Intelligent Routing**
- **Custom routing rules** with priority-based execution
- **Keyword-based routing** for topic detection
- **Pattern matching** with regex support
- **Conversation continuity** detection
- **Pluggable routing logic** for custom implementations

### 3. **Conversation Management**
- Full conversation lifecycle management
- Message history tracking
- Conversation state persistence
- Analytics and insights
- Automatic timeout handling

### 4. **AI Agent Abstraction**
- **Multiple agent personas** with unique personalities
- **Multi-engine support** (OpenAI, Claude, Gemini, etc.)
- **Engine hot-swapping** capability
- **Specialized agents** for different tasks
- **Tool integration** for enhanced capabilities

### 5. **Scalable Storage**
- **Local file storage** for development
- **Redis support** for production
- **Hybrid storage** with migration capabilities
- **Redis-compatible API** for seamless scaling
- TTL support for automatic cleanup

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd message_system

# Install dependencies
pip install -r requirements.txt

# Create necessary directories
mkdir -p data/storage logs
```

### Basic Usage

```python
import asyncio
from message_system.core.message import Message
from message_system.interceptor.message_interceptor import MessageInterceptor
from message_system.routing.router import CustomizableRouter
from message_system.conversation.manager import ConversationManager
from message_system.agents.base_agent import PersonaAgent
from message_system.agents.engines import EngineFactory
from message_system.storage.backends import LocalFileStorage

async def main():
    # Initialize storage
    storage = LocalFileStorage("./data/storage")
    
    # Setup router
    router = CustomizableRouter(storage)
    
    # Setup conversation manager
    conversation_manager = ConversationManager(storage)
    
    # Create an AI agent
    engine = EngineFactory.create_engine("local")
    agent = PersonaAgent(
        "assistant",
        persona={
            "name": "Assistant",
            "role": "AI Helper",
            "personality": "Helpful and friendly"
        },
        engine=engine
    )
    
    # Setup interceptor
    interceptor = MessageInterceptor(
        router=router,
        conversation_manager=conversation_manager,
        default_agent=agent
    )
    
    # Process a message
    message = Message(
        sender_id="user123",
        recipient_id="bot",
        content="Hello, I need help!"
    )
    
    response = await interceptor.intercept(message)
    print(f"Response: {response.content}")

asyncio.run(main())
```

## 🔧 Configuration

### YAML Configuration

The system supports comprehensive YAML configuration:

```yaml
# config/system_config.yaml
storage:
  type: "local"
  local:
    base_path: "./data/storage"

router:
  conversation_timeout: 1800
  keyword_routes:
    - keywords: ["support", "help"]
      agent: "support_agent"
      priority: 80

agents:
  support_agent:
    persona:
      name: "Alex"
      role: "Support Specialist"
    engine: "openai"
```

### Custom Routing Rules

```python
# Add custom routing logic
async def custom_router(message: Message):
    if "urgent" in message.content.lower():
        return RoutingDecision(
            should_process=True,
            create_new_conversation=True,
            metadata={"priority": "high"}
        )
    return None

await router.register_rule("urgency_check", custom_router)
```

### Multiple AI Engines

```python
# Configure multiple engines
openai_engine = EngineFactory.create_engine("openai", {
    "api_key": "your-key",
    "model": "gpt-4"
})

claude_engine = EngineFactory.create_engine("claude", {
    "api_key": "your-key",
    "model": "claude-3"
})

# Create multi-engine agent
agent = MultiEngineAgent("assistant", persona)
agent.add_engine("openai", openai_engine)
agent.add_engine("claude", claude_engine)
```

## 📊 Storage Migration

The system provides a seamless migration path from local files to Redis:

```python
# Start with local storage
local_storage = LocalFileStorage("./data")

# When ready to scale, add Redis
redis_storage = RedisStorage("localhost", 6379)

# Use hybrid storage for migration
hybrid = HybridStorage(
    primary=local_storage,
    secondary=redis_storage
)

# Enable sync
await hybrid.enable_sync()

# Migrate data
await hybrid.migrate_to_secondary()
```

## 🎯 Use Cases

1. **Customer Support Bot**
   - Route support queries to specialized agents
   - Maintain conversation context
   - Escalate complex issues

2. **Sales Assistant**
   - Handle product inquiries
   - Process purchase requests
   - Provide personalized recommendations

3. **Multi-Channel Communication**
   - Process messages from various channels
   - Maintain unified conversation history
   - Consistent responses across platforms

4. **Enterprise Chatbot Platform**
   - Deploy multiple specialized agents
   - Custom routing based on business rules
   - Scalable infrastructure with Redis

## 📁 Project Structure

```
message_system/
├── core/
│   ├── __init__.py
│   ├── message.py          # Message data structures
│   └── interfaces.py       # Core interfaces
├── interceptor/
│   └── message_interceptor.py  # Message interception logic
├── routing/
│   └── router.py           # Routing implementations
├── conversation/
│   └── manager.py          # Conversation management
├── agents/
│   ├── base_agent.py       # Agent implementations
│   └── engines.py          # AI engine integrations
├── storage/
│   └── backends.py         # Storage implementations
└── config/
    └── system_config.yaml  # System configuration
```

## 🔌 Extending the System

### Adding a New AI Engine

```python
class CustomEngine(BaseEngine):
    async def generate_response(self, message, history, context):
        # Your implementation
        return response_message
```

### Creating Specialized Agents

```python
class TranslationAgent(SpecializedAgent):
    def __init__(self):
        super().__init__(
            agent_id="translator",
            persona={"name": "Translator"},
            specialization="translation"
        )
    
    async def process_message(self, message, context):
        # Translation logic
        return translated_response
```

### Custom Storage Backend

```python
class MongoDBStorage(IStorageBackend):
    async def get(self, key):
        # MongoDB implementation
        pass
    
    async def set(self, key, value, ttl=None):
        # MongoDB implementation
        pass
```

## 🧪 Testing

Run the example usage:

```bash
python example_usage.py
```

Run tests (when implemented):

```bash
pytest tests/
```

## 📈 Performance Considerations

- **Async/await throughout** for non-blocking operations
- **Message queuing** for handling high loads
- **Connection pooling** for database operations
- **TTL support** for automatic cleanup
- **Batch processing** capabilities

## 🔒 Security Features

- Message content filtering
- Rate limiting support
- Conversation isolation
- Secure storage options
- API key management

## 🛣️ Roadmap

- [ ] WebSocket support for real-time messaging
- [ ] REST API endpoints
- [ ] Dashboard for monitoring
- [ ] Machine learning-based routing
- [ ] Multi-language support
- [ ] Voice message processing
- [ ] Distributed deployment support

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests.

## 📧 Support

For questions and support, please open an issue in the repository.