"""
Conversation Manager Implementation
"""
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging
import json

from ..core.message import Message, ConversationContext
from ..core.interfaces import IConversationManager, IStorageBackend

logger = logging.getLogger(__name__)


class ConversationManager(IConversationManager):
    """
    Manages conversations lifecycle and state
    """
    
    def __init__(self, storage: IStorageBackend):
        self.storage = storage
    
    async def create_conversation(self, 
                                 initial_message: Message,
                                 metadata: Dict[str, Any] = None) -> ConversationContext:
        """Create a new conversation"""
        conversation_id = str(uuid.uuid4())
        now = datetime.now()
        
        context = ConversationContext(
            conversation_id=conversation_id,
            participant_ids=[initial_message.sender_id, initial_message.recipient_id],
            created_at=now,
            updated_at=now,
            metadata=metadata or {},
            is_active=True,
            agent_id=metadata.get("agent_id") if metadata else None,
            agent_persona=metadata.get("agent_persona") if metadata else None
        )
        
        # Store conversation context
        await self._save_conversation_context(context)
        
        # Add to active conversations for sender
        await self.storage.append_to_list(
            f"active_conversations:{initial_message.sender_id}",
            conversation_id
        )
        
        # Store initial message
        await self._save_message(conversation_id, initial_message)
        
        # Update last activity
        await self._update_last_activity(conversation_id)
        
        logger.info(f"Created conversation {conversation_id}")
        return context
    
    async def get_conversation(self, conversation_id: str) -> Optional[ConversationContext]:
        """Retrieve a conversation by ID"""
        data = await self.storage.get(f"conversation:{conversation_id}:context")
        
        if data:
            return self._deserialize_context(data)
        
        return None
    
    async def update_conversation(self, 
                                 conversation_id: str,
                                 message: Message) -> None:
        """Update conversation with new message"""
        # Get existing context
        context = await self.get_conversation(conversation_id)
        if not context:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Update context
        context.updated_at = datetime.now()
        
        # Save updated context
        await self._save_conversation_context(context)
        
        # Save message
        await self._save_message(conversation_id, message)
        
        # Update last activity
        await self._update_last_activity(conversation_id)
        
        logger.debug(f"Updated conversation {conversation_id} with message {message.id}")
    
    async def list_active_conversations(self, 
                                       participant_id: Optional[str] = None) -> List[ConversationContext]:
        """List active conversations"""
        conversations = []
        
        if participant_id:
            # Get conversations for specific participant
            conversation_ids = await self.storage.get_list(
                f"active_conversations:{participant_id}",
                0, -1
            )
        else:
            # Get all active conversations
            pattern = "conversation:*:context"
            keys = await self.storage.list_keys(pattern)
            conversation_ids = [key.split(":")[1] for key in keys]
        
        # Load conversation contexts
        for conv_id in conversation_ids:
            context = await self.get_conversation(conv_id)
            if context and context.is_active:
                conversations.append(context)
        
        return conversations
    
    async def close_conversation(self, conversation_id: str) -> None:
        """Mark a conversation as closed"""
        context = await self.get_conversation(conversation_id)
        if not context:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        context.is_active = False
        context.updated_at = datetime.now()
        
        await self._save_conversation_context(context)
        
        # Remove from active conversations for all participants
        for participant_id in context.participant_ids:
            # This is simplified - in production you'd want to properly remove from list
            await self.storage.delete(f"active_conversations:{participant_id}")
        
        logger.info(f"Closed conversation {conversation_id}")
    
    async def get_conversation_history(self, 
                                      conversation_id: str,
                                      limit: int = 50) -> List[Message]:
        """Get message history for a conversation"""
        messages_data = await self.storage.get_list(
            f"conversation:{conversation_id}:messages",
            -limit, -1  # Get last 'limit' messages
        )
        
        messages = []
        for data in messages_data:
            try:
                message_dict = json.loads(data) if isinstance(data, str) else data
                messages.append(Message.from_dict(message_dict))
            except Exception as e:
                logger.error(f"Error deserializing message: {e}")
        
        return messages
    
    async def _save_conversation_context(self, context: ConversationContext) -> None:
        """Save conversation context to storage"""
        data = self._serialize_context(context)
        await self.storage.set(
            f"conversation:{context.conversation_id}:context",
            data
        )
    
    async def _save_message(self, conversation_id: str, message: Message) -> None:
        """Save message to conversation history"""
        await self.storage.append_to_list(
            f"conversation:{conversation_id}:messages",
            json.dumps(message.to_dict())
        )
    
    async def _update_last_activity(self, conversation_id: str) -> None:
        """Update last activity timestamp"""
        await self.storage.set(
            f"conversation:{conversation_id}:last_activity",
            datetime.now().isoformat()
        )
    
    def _serialize_context(self, context: ConversationContext) -> str:
        """Serialize conversation context"""
        return json.dumps({
            'conversation_id': context.conversation_id,
            'participant_ids': context.participant_ids,
            'created_at': context.created_at.isoformat(),
            'updated_at': context.updated_at.isoformat(),
            'metadata': context.metadata,
            'is_active': context.is_active,
            'agent_id': context.agent_id,
            'agent_persona': context.agent_persona
        })
    
    def _deserialize_context(self, data: str) -> ConversationContext:
        """Deserialize conversation context"""
        obj = json.loads(data) if isinstance(data, str) else data
        return ConversationContext(
            conversation_id=obj['conversation_id'],
            participant_ids=obj['participant_ids'],
            created_at=datetime.fromisoformat(obj['created_at']),
            updated_at=datetime.fromisoformat(obj['updated_at']),
            metadata=obj.get('metadata', {}),
            is_active=obj.get('is_active', True),
            agent_id=obj.get('agent_id'),
            agent_persona=obj.get('agent_persona')
        )


class ConversationAnalytics:
    """
    Analytics and insights for conversations
    """
    
    def __init__(self, manager: ConversationManager):
        self.manager = manager
    
    async def get_conversation_stats(self, conversation_id: str) -> Dict[str, Any]:
        """Get statistics for a conversation"""
        context = await self.manager.get_conversation(conversation_id)
        if not context:
            return {}
        
        messages = await self.manager.get_conversation_history(conversation_id)
        
        return {
            'conversation_id': conversation_id,
            'message_count': len(messages),
            'participant_count': len(context.participant_ids),
            'duration': (context.updated_at - context.created_at).total_seconds(),
            'is_active': context.is_active,
            'created_at': context.created_at.isoformat(),
            'updated_at': context.updated_at.isoformat()
        }
    
    async def get_participant_stats(self, participant_id: str) -> Dict[str, Any]:
        """Get statistics for a participant"""
        conversations = await self.manager.list_active_conversations(participant_id)
        
        total_messages = 0
        for conv in conversations:
            messages = await self.manager.get_conversation_history(conv.conversation_id)
            total_messages += len([m for m in messages if m.sender_id == participant_id])
        
        return {
            'participant_id': participant_id,
            'active_conversations': len(conversations),
            'total_messages_sent': total_messages
        }