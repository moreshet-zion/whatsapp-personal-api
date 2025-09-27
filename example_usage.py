"""
Example usage of the Message Interception and Routing System
"""
import asyncio
import logging
from datetime import datetime

from message_system.core.message import Message, MessageType
from message_system.interceptor.message_interceptor import MessageInterceptor
from message_system.routing.router import CustomizableRouter
from message_system.conversation.manager import ConversationManager
from message_system.agents.base_agent import PersonaAgent, MultiEngineAgent
from message_system.agents.engines import EngineFactory
from message_system.storage.backends import LocalFileStorage, HybridStorage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def setup_system():
    """Setup the complete message interception system"""
    
    # 1. Initialize Storage (Local files with Redis-ready interface)
    storage = LocalFileStorage("./data/storage")
    
    # Optional: Setup hybrid storage for future Redis migration
    # redis_storage = RedisStorage("localhost", 6379)
    # storage = HybridStorage(primary=LocalFileStorage("./data/storage"), 
    #                        secondary=redis_storage)
    
    # 2. Setup Router with custom rules
    router_config = {
        "keyword_routes": [
            {
                "keywords": ["support", "help", "issue"],
                "create_new": True,
                "priority": 80
            },
            {
                "keywords": ["buy", "purchase", "pricing"],
                "create_new": True,
                "priority": 75
            }
        ],
        "pattern_routes": [
            {
                "pattern": r"order\s*#\d+",
                "create_new": False,
                "priority": 90
            }
        ]
    }
    
    router = CustomizableRouter(storage, router_config)
    
    # Add custom routing rule
    async def priority_routing(message: Message):
        """Route high-priority messages"""
        from message_system.core.interfaces import RoutingDecision
        
        if message.metadata.get("priority") == "high":
            return RoutingDecision(
                should_process=True,
                create_new_conversation=True,
                reason="High priority message"
            )
        return None
    
    await router.register_rule("priority_check", priority_routing)
    
    # 3. Setup Conversation Manager
    conversation_manager = ConversationManager(storage)
    
    # 4. Setup AI Engines
    # Local engine for testing
    local_engine = EngineFactory.create_engine("local", {
        "responses": {
            "hello": "Hello! How can I assist you today?",
            "help": "I'm here to help. What do you need assistance with?",
            "order": "I can help you with your order. Please provide the order number."
        }
    })
    
    # Setup for real AI engines (requires API keys)
    # openai_engine = EngineFactory.create_engine("openai", {
    #     "model": "gpt-4",
    #     "api_key": "your-api-key-here",
    #     "temperature": 0.7
    # })
    
    # claude_engine = EngineFactory.create_engine("claude", {
    #     "model": "claude-3-opus",
    #     "api_key": "your-api-key-here"
    # })
    
    # 5. Setup AI Agents with different personas
    
    # Support Agent
    support_persona = {
        "name": "Alex",
        "role": "Technical Support Specialist",
        "personality": "Helpful, patient, and technically knowledgeable",
        "instructions": "Help users with technical issues and provide clear solutions",
        "constraints": ["Be polite", "Ask clarifying questions", "Provide step-by-step solutions"]
    }
    support_agent = PersonaAgent("support_agent", support_persona, local_engine)
    
    # Sales Agent
    sales_persona = {
        "name": "Sarah",
        "role": "Sales Representative",
        "personality": "Friendly, enthusiastic, and knowledgeable about products",
        "instructions": "Help customers with product information and purchases",
        "constraints": ["Be helpful but not pushy", "Provide accurate pricing", "Suggest relevant products"]
    }
    sales_agent = PersonaAgent("sales_agent", sales_persona, local_engine)
    
    # Multi-engine Agent (can switch between different AI providers)
    multi_agent = MultiEngineAgent("multi_agent", {
        "name": "Assistant",
        "role": "General Assistant",
        "personality": "Adaptive and versatile"
    })
    multi_agent.add_engine("local", local_engine)
    # multi_agent.add_engine("openai", openai_engine)  # Add when configured
    
    # 6. Setup Message Interceptor
    interceptor = MessageInterceptor(
        router=router,
        conversation_manager=conversation_manager,
        default_agent=support_agent
    )
    
    # Register agents
    interceptor.register_agent("support_agent", support_agent)
    interceptor.register_agent("sales_agent", sales_agent)
    interceptor.register_agent("multi_agent", multi_agent)
    
    # Add message pre-processor
    def add_timestamp(message: Message) -> Message:
        """Add processing timestamp to message"""
        message.metadata["processed_at"] = datetime.now().isoformat()
        return message
    
    interceptor.add_pre_processor(add_timestamp)
    
    # Add message post-processor
    def add_response_metadata(message: Message) -> Message:
        """Add metadata to response"""
        message.metadata["response_generated_at"] = datetime.now().isoformat()
        return message
    
    interceptor.add_post_processor(add_response_metadata)
    
    return interceptor, conversation_manager


async def simulate_messages(interceptor):
    """Simulate incoming messages"""
    
    # Test messages
    test_messages = [
        {
            "content": "Hello, I need help with my account",
            "sender_id": "user_123",
            "metadata": {"channel": "web"}
        },
        {
            "content": "I'm having technical issues with the app",
            "sender_id": "user_123",
            "metadata": {"channel": "web"}
        },
        {
            "content": "What are your pricing plans?",
            "sender_id": "user_456",
            "metadata": {"channel": "email", "priority": "high"}
        },
        {
            "content": "I want to check order #12345",
            "sender_id": "user_789",
            "metadata": {"channel": "chat"}
        },
        {
            "content": "System maintenance notification",
            "sender_id": "system",
            "metadata": {"is_system": True}
        }
    ]
    
    for msg_data in test_messages:
        message = Message(
            sender_id=msg_data["sender_id"],
            recipient_id="bot",
            content=msg_data["content"],
            type=MessageType.TEXT,
            metadata=msg_data["metadata"]
        )
        
        logger.info(f"\n{'='*50}")
        logger.info(f"Processing message from {message.sender_id}: {message.content[:50]}...")
        
        # Process message
        response = await interceptor.intercept(message)
        
        if response:
            logger.info(f"Response generated: {response.content[:100]}...")
        else:
            logger.info("Message was not processed (ignored or failed)")
        
        # Small delay between messages
        await asyncio.sleep(1)


async def demonstrate_conversation_management(conversation_manager):
    """Demonstrate conversation management features"""
    
    logger.info(f"\n{'='*50}")
    logger.info("Demonstrating Conversation Management")
    logger.info("="*50)
    
    # List active conversations
    active_conversations = await conversation_manager.list_active_conversations()
    logger.info(f"Active conversations: {len(active_conversations)}")
    
    for conv in active_conversations:
        logger.info(f"  - Conversation {conv.conversation_id[:8]}...")
        logger.info(f"    Participants: {conv.participant_ids}")
        logger.info(f"    Created: {conv.created_at}")
        logger.info(f"    Active: {conv.is_active}")
        
        # Get conversation history
        history = await conversation_manager.get_conversation_history(conv.conversation_id, limit=5)
        logger.info(f"    Messages: {len(history)}")
        
        for msg in history[:2]:  # Show first 2 messages
            logger.info(f"      [{msg.sender_id}]: {msg.content[:50]}...")


async def demonstrate_custom_routing():
    """Demonstrate custom routing capabilities"""
    
    logger.info(f"\n{'='*50}")
    logger.info("Demonstrating Custom Routing")
    logger.info("="*50)
    
    # Setup storage and router
    storage = LocalFileStorage("./data/routing_demo")
    router = CustomizableRouter(storage)
    
    # Add department-based routing
    def route_to_department(message: Message):
        """Route based on department keywords"""
        from message_system.core.interfaces import RoutingDecision
        
        content_lower = message.content.lower()
        
        departments = {
            "billing": ["invoice", "payment", "charge", "bill"],
            "technical": ["bug", "error", "crash", "not working"],
            "sales": ["buy", "purchase", "discount", "offer"]
        }
        
        for dept, keywords in departments.items():
            if any(keyword in content_lower for keyword in keywords):
                return RoutingDecision(
                    should_process=True,
                    create_new_conversation=True,
                    reason=f"Routed to {dept} department",
                    metadata={"department": dept}
                )
        
        return None
    
    await router.register_rule("department_routing", route_to_department)
    
    # Test routing
    test_messages = [
        "I have a question about my invoice",
        "The app keeps crashing",
        "Do you have any discounts available?",
        "Just saying hello"
    ]
    
    for content in test_messages:
        message = Message(
            sender_id="test_user",
            recipient_id="bot",
            content=content
        )
        
        decision = await router.route(message)
        logger.info(f"Message: '{content[:50]}...'")
        logger.info(f"  Decision: Process={decision.should_process}, Reason={decision.reason}")
        if decision.metadata:
            logger.info(f"  Metadata: {decision.metadata}")


async def main():
    """Main demonstration function"""
    
    logger.info("Starting Message Interception System Demo")
    logger.info("="*50)
    
    # Setup the system
    interceptor, conversation_manager = await setup_system()
    
    # Start the interceptor processing loop (in background)
    processing_task = asyncio.create_task(interceptor.start_processing())
    
    try:
        # Simulate incoming messages
        await simulate_messages(interceptor)
        
        # Demonstrate conversation management
        await demonstrate_conversation_management(conversation_manager)
        
        # Demonstrate custom routing
        await demonstrate_custom_routing()
        
    finally:
        # Stop processing
        await interceptor.stop_processing()
        processing_task.cancel()
    
    logger.info("\nDemo completed successfully!")
    logger.info("="*50)


if __name__ == "__main__":
    asyncio.run(main())