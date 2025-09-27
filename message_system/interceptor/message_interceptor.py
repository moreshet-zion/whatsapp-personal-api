"""
Message Interceptor - Entry point for all incoming messages
"""
import asyncio
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime
import logging

from ..core.message import Message, MessageStatus
from ..core.interfaces import (
    IMessageRouter, 
    IConversationManager,
    IAgent,
    RoutingDecision
)

logger = logging.getLogger(__name__)


class MessageInterceptor:
    """
    Main entry point for intercepting and processing messages.
    Coordinates between router, conversation manager, and agents.
    """
    
    def __init__(self,
                 router: IMessageRouter,
                 conversation_manager: IConversationManager,
                 default_agent: Optional[IAgent] = None):
        self.router = router
        self.conversation_manager = conversation_manager
        self.default_agent = default_agent
        self.agents: Dict[str, IAgent] = {}
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.processing = False
        self._pre_processors: List[Callable] = []
        self._post_processors: List[Callable] = []
    
    def register_agent(self, agent_id: str, agent: IAgent) -> None:
        """Register an AI agent"""
        self.agents[agent_id] = agent
        logger.info(f"Registered agent: {agent_id}")
    
    def add_pre_processor(self, processor: Callable) -> None:
        """Add a pre-processing function for messages"""
        self._pre_processors.append(processor)
    
    def add_post_processor(self, processor: Callable) -> None:
        """Add a post-processing function for messages"""
        self._post_processors.append(processor)
    
    async def intercept(self, message: Message) -> Optional[Message]:
        """
        Main interception point for incoming messages
        
        Args:
            message: Incoming message to process
            
        Returns:
            Response message if generated, None otherwise
        """
        try:
            # Run pre-processors
            for processor in self._pre_processors:
                message = await processor(message) if asyncio.iscoroutinefunction(processor) else processor(message)
            
            # Update message status
            message.status = MessageStatus.QUEUED
            
            # Route the message
            routing_decision = await self.router.route(message)
            
            if not routing_decision.should_process:
                message.status = MessageStatus.IGNORED
                logger.info(f"Message {message.id} ignored: {routing_decision.reason}")
                return None
            
            # Handle conversation creation or retrieval
            if routing_decision.create_new_conversation:
                conversation = await self.conversation_manager.create_conversation(
                    initial_message=message,
                    metadata=routing_decision.metadata
                )
                message.conversation_id = conversation.conversation_id
                logger.info(f"Created new conversation: {conversation.conversation_id}")
            elif routing_decision.conversation_id:
                conversation = await self.conversation_manager.get_conversation(
                    routing_decision.conversation_id
                )
                if not conversation:
                    logger.error(f"Conversation {routing_decision.conversation_id} not found")
                    message.status = MessageStatus.FAILED
                    return None
                message.conversation_id = conversation.conversation_id
            else:
                logger.error("No conversation context for message")
                message.status = MessageStatus.FAILED
                return None
            
            # Update message status
            message.status = MessageStatus.PROCESSING
            
            # Select agent
            agent = self._select_agent(conversation)
            if not agent:
                logger.error("No agent available to process message")
                message.status = MessageStatus.FAILED
                return None
            
            # Process message with agent
            response = await agent.process_message(message, conversation)
            
            # Update conversation
            await self.conversation_manager.update_conversation(
                conversation.conversation_id,
                message
            )
            
            if response:
                await self.conversation_manager.update_conversation(
                    conversation.conversation_id,
                    response
                )
            
            # Update message status
            message.status = MessageStatus.PROCESSED
            
            # Run post-processors on response
            if response:
                for processor in self._post_processors:
                    response = await processor(response) if asyncio.iscoroutinefunction(processor) else processor(response)
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing message {message.id}: {str(e)}")
            message.status = MessageStatus.FAILED
            raise
    
    def _select_agent(self, conversation: 'ConversationContext') -> Optional[IAgent]:
        """Select appropriate agent for the conversation"""
        if conversation.agent_id and conversation.agent_id in self.agents:
            return self.agents[conversation.agent_id]
        return self.default_agent
    
    async def start_processing(self) -> None:
        """Start processing messages from queue"""
        self.processing = True
        logger.info("Message interceptor started processing")
        
        while self.processing:
            try:
                # Get message from queue with timeout
                message = await asyncio.wait_for(
                    self.message_queue.get(), 
                    timeout=1.0
                )
                
                # Process the message
                await self.intercept(message)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error in message processing loop: {str(e)}")
    
    async def stop_processing(self) -> None:
        """Stop processing messages"""
        self.processing = False
        logger.info("Message interceptor stopped processing")
    
    async def queue_message(self, message: Message) -> None:
        """Add message to processing queue"""
        await self.message_queue.put(message)
        logger.debug(f"Queued message {message.id}")