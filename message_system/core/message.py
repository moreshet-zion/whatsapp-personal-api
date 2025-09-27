"""
Core message data structures and types
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
import uuid


class MessageType(Enum):
    """Types of messages in the system"""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    FILE = "file"
    SYSTEM = "system"


class MessageStatus(Enum):
    """Status of message processing"""
    RECEIVED = "received"
    QUEUED = "queued"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"
    IGNORED = "ignored"


@dataclass
class Message:
    """Base message class"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str = ""
    recipient_id: str = ""
    content: str = ""
    type: MessageType = MessageType.TEXT
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    status: MessageStatus = MessageStatus.RECEIVED
    conversation_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for storage"""
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'recipient_id': self.recipient_id,
            'content': self.content,
            'type': self.type.value,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata,
            'status': self.status.value,
            'conversation_id': self.conversation_id
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Message':
        """Create message from dictionary"""
        return cls(
            id=data.get('id', str(uuid.uuid4())),
            sender_id=data.get('sender_id', ''),
            recipient_id=data.get('recipient_id', ''),
            content=data.get('content', ''),
            type=MessageType(data.get('type', 'text')),
            timestamp=datetime.fromisoformat(data.get('timestamp', datetime.now().isoformat())),
            metadata=data.get('metadata', {}),
            status=MessageStatus(data.get('status', 'received')),
            conversation_id=data.get('conversation_id')
        )


@dataclass
class ConversationContext:
    """Context information for a conversation"""
    conversation_id: str
    participant_ids: List[str]
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True
    agent_id: Optional[str] = None
    agent_persona: Optional[str] = None