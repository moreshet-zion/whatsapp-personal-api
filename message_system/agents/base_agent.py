"""
Base AI Agent Implementation
"""
from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod
import logging
from datetime import datetime

from ..core.message import Message, ConversationContext, MessageType
from ..core.interfaces import IAgent, IAgentEngine

logger = logging.getLogger(__name__)


class BaseAgent(IAgent):
    """
    Base implementation of an AI agent with persona
    """
    
    def __init__(self, 
                 agent_id: str,
                 persona: Dict[str, Any],
                 engine: Optional[IAgentEngine] = None):
        self.agent_id = agent_id
        self.persona = persona
        self.engine = engine
        self.conversation_memory: Dict[str, List[Message]] = {}
    
    async def process_message(self, 
                             message: Message,
                             conversation_context: ConversationContext) -> Message:
        """Process a message and generate response"""
        if not self.engine:
            raise ValueError("No AI engine configured for this agent")
        
        # Get conversation history
        history = self._get_conversation_history(conversation_context.conversation_id)
        
        # Add current message to history
        history.append(message)
        
        # Prepare context with persona
        context = {
            'persona': self.persona,
            'conversation_id': conversation_context.conversation_id,
            'participant_ids': conversation_context.participant_ids,
            'metadata': conversation_context.metadata
        }
        
        # Generate response using the AI engine
        response = await self.engine.generate_response(
            message=message,
            conversation_history=history,
            context=context
        )
        
        # Set response metadata
        response.sender_id = self.agent_id
        response.recipient_id = message.sender_id
        response.conversation_id = conversation_context.conversation_id
        
        # Add response to history
        history.append(response)
        
        # Update memory
        self._update_conversation_history(conversation_context.conversation_id, history)
        
        logger.info(f"Agent {self.agent_id} generated response for conversation {conversation_context.conversation_id}")
        
        return response
    
    def get_persona(self) -> Dict[str, Any]:
        """Get agent persona configuration"""
        return self.persona
    
    def set_engine(self, engine: IAgentEngine) -> None:
        """Set the AI engine for this agent"""
        self.engine = engine
        logger.info(f"Agent {self.agent_id} configured with engine: {engine.get_engine_name()}")
    
    def _get_conversation_history(self, conversation_id: str) -> List[Message]:
        """Get conversation history from memory"""
        return self.conversation_memory.get(conversation_id, [])
    
    def _update_conversation_history(self, conversation_id: str, history: List[Message]) -> None:
        """Update conversation history in memory"""
        # Keep only last N messages to prevent memory issues
        max_history = self.persona.get('max_history_size', 50)
        self.conversation_memory[conversation_id] = history[-max_history:]


class PersonaAgent(BaseAgent):
    """
    Agent with enhanced persona capabilities
    """
    
    def __init__(self,
                 agent_id: str,
                 persona: Dict[str, Any],
                 engine: Optional[IAgentEngine] = None):
        super().__init__(agent_id, persona, engine)
        self._validate_persona()
    
    def _validate_persona(self):
        """Validate persona configuration"""
        required_fields = ['name', 'role', 'personality']
        for field in required_fields:
            if field not in self.persona:
                raise ValueError(f"Persona missing required field: {field}")
    
    def get_system_prompt(self) -> str:
        """Generate system prompt from persona"""
        prompt = f"You are {self.persona['name']}, a {self.persona['role']}.\n"
        prompt += f"Personality: {self.persona['personality']}\n"
        
        if 'instructions' in self.persona:
            prompt += f"Instructions: {self.persona['instructions']}\n"
        
        if 'knowledge_base' in self.persona:
            prompt += f"Knowledge: {self.persona['knowledge_base']}\n"
        
        if 'constraints' in self.persona:
            prompt += f"Constraints: {', '.join(self.persona['constraints'])}\n"
        
        return prompt


class MultiEngineAgent(BaseAgent):
    """
    Agent that can switch between multiple AI engines
    """
    
    def __init__(self,
                 agent_id: str,
                 persona: Dict[str, Any],
                 engines: Dict[str, IAgentEngine] = None):
        super().__init__(agent_id, persona, None)
        self.engines = engines or {}
        self.primary_engine = None
    
    def add_engine(self, name: str, engine: IAgentEngine) -> None:
        """Add an AI engine"""
        self.engines[name] = engine
        if not self.primary_engine:
            self.primary_engine = name
            self.engine = engine
    
    def switch_engine(self, engine_name: str) -> None:
        """Switch to a different AI engine"""
        if engine_name not in self.engines:
            raise ValueError(f"Engine {engine_name} not found")
        
        self.primary_engine = engine_name
        self.engine = self.engines[engine_name]
        logger.info(f"Agent {self.agent_id} switched to engine: {engine_name}")
    
    async def process_message_with_engine(self,
                                         message: Message,
                                         conversation_context: ConversationContext,
                                         engine_name: str) -> Message:
        """Process message with a specific engine"""
        if engine_name not in self.engines:
            raise ValueError(f"Engine {engine_name} not found")
        
        # Temporarily switch engine
        original_engine = self.engine
        self.engine = self.engines[engine_name]
        
        try:
            response = await self.process_message(message, conversation_context)
            return response
        finally:
            self.engine = original_engine


class SpecializedAgent(PersonaAgent):
    """
    Agent specialized for specific tasks
    """
    
    def __init__(self,
                 agent_id: str,
                 persona: Dict[str, Any],
                 engine: Optional[IAgentEngine] = None,
                 specialization: str = None):
        super().__init__(agent_id, persona, engine)
        self.specialization = specialization or persona.get('specialization', 'general')
        self.tools: Dict[str, Any] = {}
    
    def add_tool(self, name: str, tool: Any) -> None:
        """Add a specialized tool for this agent"""
        self.tools[name] = tool
        logger.info(f"Added tool {name} to agent {self.agent_id}")
    
    async def process_message(self,
                             message: Message,
                             conversation_context: ConversationContext) -> Message:
        """Process message with specialization logic"""
        
        # Apply pre-processing based on specialization
        message = await self._preprocess_by_specialization(message)
        
        # Generate response
        response = await super().process_message(message, conversation_context)
        
        # Apply post-processing based on specialization
        response = await self._postprocess_by_specialization(response)
        
        return response
    
    async def _preprocess_by_specialization(self, message: Message) -> Message:
        """Preprocess message based on specialization"""
        if self.specialization == "technical_support":
            # Extract technical details
            message.metadata['extracted_tech_details'] = self._extract_technical_info(message.content)
        elif self.specialization == "sales":
            # Identify product mentions
            message.metadata['product_mentions'] = self._identify_products(message.content)
        
        return message
    
    async def _postprocess_by_specialization(self, response: Message) -> Message:
        """Postprocess response based on specialization"""
        if self.specialization == "technical_support":
            # Add helpful links or documentation
            response.metadata['helpful_resources'] = self._get_technical_resources(response.content)
        elif self.specialization == "sales":
            # Add product recommendations
            response.metadata['recommendations'] = self._get_product_recommendations(response.content)
        
        return response
    
    def _extract_technical_info(self, content: str) -> Dict[str, Any]:
        """Extract technical information from message"""
        # Placeholder for technical extraction logic
        return {'keywords': [], 'error_codes': []}
    
    def _identify_products(self, content: str) -> List[str]:
        """Identify product mentions in message"""
        # Placeholder for product identification logic
        return []
    
    def _get_technical_resources(self, content: str) -> List[str]:
        """Get relevant technical resources"""
        # Placeholder for resource lookup logic
        return []
    
    def _get_product_recommendations(self, content: str) -> List[str]:
        """Get product recommendations"""
        # Placeholder for recommendation logic
        return []