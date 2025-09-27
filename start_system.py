#!/usr/bin/env python3
"""
Quick start script for the Message Interception System
"""
import asyncio
import sys
import os
from pathlib import Path

# Add the workspace to Python path
sys.path.insert(0, str(Path(__file__).parent))

from message_system.core.message import Message, MessageType
from message_system.interceptor.message_interceptor import MessageInterceptor
from message_system.routing.router import CustomizableRouter
from message_system.conversation.manager import ConversationManager
from message_system.agents.base_agent import PersonaAgent
from message_system.agents.engines import EngineFactory
from message_system.storage.backends import LocalFileStorage


async def create_system():
    """Create and configure the message interception system"""
    
    print("🚀 Initializing Message Interception System...")
    
    # Initialize storage
    storage = LocalFileStorage("./data/storage")
    print("✅ Storage initialized (Local Files)")
    
    # Setup router with custom configuration
    router_config = {
        "keyword_routes": [
            {
                "keywords": ["support", "help", "issue", "problem"],
                "create_new": True,
                "priority": 80
            },
            {
                "keywords": ["buy", "purchase", "price", "cost"],
                "create_new": True,
                "priority": 75
            }
        ]
    }
    router = CustomizableRouter(storage, router_config)
    print("✅ Router configured with custom rules")
    
    # Setup conversation manager
    conversation_manager = ConversationManager(storage)
    print("✅ Conversation Manager initialized")
    
    # Create AI engine (local for demo)
    engine = EngineFactory.create_engine("local", {
        "responses": {
            "hello": "Hello! I'm your AI assistant. How can I help you today?",
            "help": "I'm here to help! You can ask me about:\n- Technical support\n- Product information\n- General questions",
            "bye": "Thank you for chatting! Have a great day!",
            "support": "I can help you with technical issues. Please describe your problem.",
            "price": "For pricing information, please visit our website or contact sales."
        }
    })
    print("✅ AI Engine configured (Local Engine)")
    
    # Create AI agent
    agent = PersonaAgent(
        "assistant",
        persona={
            "name": "Assistant",
            "role": "AI Helper",
            "personality": "Helpful, friendly, and knowledgeable",
            "max_history_size": 20
        },
        engine=engine
    )
    print("✅ AI Agent created")
    
    # Setup interceptor
    interceptor = MessageInterceptor(
        router=router,
        conversation_manager=conversation_manager,
        default_agent=agent
    )
    print("✅ Message Interceptor initialized")
    
    print("\n✨ System ready for message processing!\n")
    
    return interceptor, conversation_manager


async def interactive_mode(interceptor, conversation_manager):
    """Run the system in interactive mode"""
    
    print("=" * 60)
    print("💬 INTERACTIVE MESSAGE SYSTEM")
    print("=" * 60)
    print("\nCommands:")
    print("  - Type your message and press Enter to send")
    print("  - Type '/conversations' to list active conversations")
    print("  - Type '/clear' to start a new conversation")
    print("  - Type '/quit' to exit")
    print("\n" + "=" * 60)
    
    user_id = f"user_{os.getpid()}"
    print(f"\nYour user ID: {user_id}")
    print("=" * 60 + "\n")
    
    while True:
        try:
            # Get user input
            user_input = input("You: ").strip()
            
            if not user_input:
                continue
            
            # Handle commands
            if user_input.lower() == '/quit':
                print("\n👋 Goodbye!")
                break
            
            elif user_input.lower() == '/conversations':
                conversations = await conversation_manager.list_active_conversations(user_id)
                print(f"\n📋 Active conversations: {len(conversations)}")
                for conv in conversations:
                    print(f"  - ID: {conv.conversation_id[:8]}... (Created: {conv.created_at.strftime('%H:%M:%S')})")
                print()
                continue
            
            elif user_input.lower() == '/clear':
                # Close all conversations for this user
                conversations = await conversation_manager.list_active_conversations(user_id)
                for conv in conversations:
                    await conversation_manager.close_conversation(conv.conversation_id)
                print("✅ Started new conversation\n")
                continue
            
            # Create and process message
            message = Message(
                sender_id=user_id,
                recipient_id="bot",
                content=user_input,
                type=MessageType.TEXT
            )
            
            # Process the message
            response = await interceptor.intercept(message)
            
            if response:
                print(f"Bot: {response.content}\n")
            else:
                print("(No response generated)\n")
                
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {e}\n")


async def demo_mode(interceptor):
    """Run a quick demo"""
    
    print("=" * 60)
    print("🎭 DEMO MODE - Automated Message Processing")
    print("=" * 60)
    
    demo_messages = [
        ("user_001", "Hello! I need help with my account"),
        ("user_001", "I forgot my password"),
        ("user_002", "What are your prices?"),
        ("user_003", "The app is not working properly"),
        ("user_002", "Do you have any discounts?"),
    ]
    
    for sender_id, content in demo_messages:
        print(f"\n[{sender_id}]: {content}")
        
        message = Message(
            sender_id=sender_id,
            recipient_id="bot",
            content=content,
            type=MessageType.TEXT
        )
        
        response = await interceptor.intercept(message)
        
        if response:
            print(f"[Bot]: {response.content}")
        else:
            print("[System]: Message processed but no response generated")
        
        await asyncio.sleep(1)  # Small delay for readability
    
    print("\n" + "=" * 60)
    print("✅ Demo completed!")
    print("=" * 60)


async def main():
    """Main entry point"""
    
    # Parse command line arguments
    mode = "interactive"
    if len(sys.argv) > 1:
        if sys.argv[1] in ["--demo", "-d"]:
            mode = "demo"
        elif sys.argv[1] in ["--help", "-h"]:
            print("Usage: python start_system.py [--demo|-d] [--help|-h]")
            print("\nOptions:")
            print("  --demo, -d    Run in demo mode with automated messages")
            print("  --help, -h    Show this help message")
            print("\nDefault: Interactive mode")
            return
    
    # Create the system
    interceptor, conversation_manager = await create_system()
    
    # Start processing in background
    processing_task = asyncio.create_task(interceptor.start_processing())
    
    try:
        if mode == "demo":
            await demo_mode(interceptor)
        else:
            await interactive_mode(interceptor, conversation_manager)
    finally:
        # Cleanup
        await interceptor.stop_processing()
        processing_task.cancel()
        try:
            await processing_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 System shutdown complete!")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)