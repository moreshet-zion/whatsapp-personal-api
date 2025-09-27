"""
Core interfaces and abstract base classes
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, Callable
from .message import Message, ConversationContext


class RoutingDecision:
    """Represents a routing decision for a message"""
    
    def __init__(self, 
                 should_process: bool,
                 conversation_id: Optional[str] = None,
                 create_new_conversation: bool = False,
                 reason: str = "",
                 metadata: Dict[str, Any] = None):
        self.should_process = should_process
        self.conversation_id = conversation_id
        self.create_new_conversation = create_new_conversation
        self.reason = reason
        self.metadata = metadata or {}


class IMessageRouter(ABC):
    """Interface for message routing logic"""
    
    @abstractmethod
    async def route(self, message: Message) -> RoutingDecision:
        """
        Determine how to route an incoming message
        
        Returns:
            RoutingDecision object containing routing information
        """
        pass
    
    @abstractmethod
    async def register_rule(self, name: str, rule: Callable) -> None:
        """Register a custom routing rule"""
        pass


class IConversationManager(ABC):
    """Interface for conversation management"""
    
    @abstractmethod
    async def create_conversation(self, 
                                 initial_message: Message,
                                 metadata: Dict[str, Any] = None) -> ConversationContext:
        """Create a new conversation"""
        pass
    
    @abstractmethod
    async def get_conversation(self, conversation_id: str) -> Optional[ConversationContext]:
        """Retrieve a conversation by ID"""
        pass
    
    @abstractmethod
    async def update_conversation(self, 
                                 conversation_id: str,
                                 message: Message) -> None:
        """Update conversation with new message"""
        pass
    
    @abstractmethod
    async def list_active_conversations(self, 
                                       participant_id: Optional[str] = None) -> List[ConversationContext]:
        """List active conversations, optionally filtered by participant"""
        pass
    
    @abstractmethod
    async def close_conversation(self, conversation_id: str) -> None:
        """Mark a conversation as closed"""
        pass


class IStorageBackend(ABC):
    """Interface for storage backend (can be implemented with files, Redis, etc.)"""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get value by key"""
        pass
    
    @abstractmethod
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value with optional TTL"""
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete value by key"""
        pass
    
    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        pass
    
    @abstractmethod
    async def list_keys(self, pattern: str) -> List[str]:
        """List keys matching pattern"""
        pass
    
    @abstractmethod
    async def append_to_list(self, key: str, value: Any) -> None:
        """Append value to a list"""
        pass
    
    @abstractmethod
    async def get_list(self, key: str, start: int = 0, end: int = -1) -> List[Any]:
        """Get list values"""
        pass


class IAgentEngine(ABC):
    """Interface for AI agent engines (ChatGPT, Claude, Gemini, etc.)"""
    
    @abstractmethod
    async def generate_response(self, 
                               message: Message,
                               conversation_history: List[Message],
                               context: Dict[str, Any] = None) -> Message:
        """Generate a response to a message"""
        pass
    
    @abstractmethod
    def get_engine_name(self) -> str:
        """Get the name of the engine"""
        pass
    
    @abstractmethod
    def get_capabilities(self) -> Dict[str, Any]:
        """Get engine capabilities"""
        pass


class IAgent(ABC):
    """Interface for AI agents with personas"""
    
    @abstractmethod
    async def process_message(self, 
                             message: Message,
                             conversation_context: ConversationContext) -> Message:
        """Process a message and generate response"""
        pass
    
    @abstractmethod
    def get_persona(self) -> Dict[str, Any]:
        """Get agent persona configuration"""
        pass
    
    @abstractmethod
    def set_engine(self, engine: IAgentEngine) -> None:
        """Set the AI engine for this agent"""
        pass