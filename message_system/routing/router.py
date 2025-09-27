"""
Message Router Implementation with customizable routing logic
"""
import re
from typing import Dict, Any, List, Callable, Optional
from datetime import datetime, timedelta
import logging

from ..core.message import Message
from ..core.interfaces import IMessageRouter, RoutingDecision, IStorageBackend

logger = logging.getLogger(__name__)


class RoutingRule:
    """Represents a custom routing rule"""
    
    def __init__(self, 
                 name: str,
                 condition: Callable[[Message], bool],
                 action: Callable[[Message], RoutingDecision],
                 priority: int = 0):
        self.name = name
        self.condition = condition
        self.action = action
        self.priority = priority


class MessageRouter(IMessageRouter):
    """
    Flexible message router with customizable routing logic
    """
    
    def __init__(self, storage: IStorageBackend):
        self.storage = storage
        self.rules: List[RoutingRule] = []
        self._initialize_default_rules()
    
    def _initialize_default_rules(self):
        """Initialize default routing rules"""
        
        # Rule: Ignore system messages
        self.add_rule(
            RoutingRule(
                name="ignore_system",
                condition=lambda msg: msg.metadata.get("is_system", False),
                action=lambda msg: RoutingDecision(
                    should_process=False,
                    reason="System message ignored"
                ),
                priority=100
            )
        )
        
        # Rule: Route to existing conversation if reply
        self.add_rule(
            RoutingRule(
                name="existing_conversation",
                condition=lambda msg: msg.metadata.get("reply_to_conversation") is not None,
                action=lambda msg: RoutingDecision(
                    should_process=True,
                    conversation_id=msg.metadata.get("reply_to_conversation"),
                    reason="Continuing existing conversation"
                ),
                priority=90
            )
        )
    
    def add_rule(self, rule: RoutingRule) -> None:
        """Add a routing rule"""
        self.rules.append(rule)
        self.rules.sort(key=lambda r: r.priority, reverse=True)
        logger.info(f"Added routing rule: {rule.name} with priority {rule.priority}")
    
    async def register_rule(self, name: str, rule: Callable) -> None:
        """Register a custom routing rule function"""
        self.add_rule(
            RoutingRule(
                name=name,
                condition=lambda msg: True,  # Always evaluate
                action=rule,
                priority=50  # Default priority
            )
        )
    
    async def route(self, message: Message) -> RoutingDecision:
        """
        Route an incoming message based on configured rules
        """
        try:
            # Check for active conversation from the same sender
            existing_conversation_id = await self._find_active_conversation(message.sender_id)
            
            # Evaluate custom rules in priority order
            for rule in self.rules:
                if rule.condition(message):
                    decision = rule.action(message)
                    if decision:
                        logger.info(f"Message {message.id} routed by rule: {rule.name}")
                        return decision
            
            # Default routing logic
            if existing_conversation_id:
                # Check if conversation is still active (within timeout window)
                is_active = await self._is_conversation_active(existing_conversation_id)
                if is_active:
                    return RoutingDecision(
                        should_process=True,
                        conversation_id=existing_conversation_id,
                        reason="Continuing active conversation"
                    )
            
            # Check if message should start a new conversation
            if self._should_start_conversation(message):
                return RoutingDecision(
                    should_process=True,
                    create_new_conversation=True,
                    reason="Starting new conversation"
                )
            
            # Default: ignore the message
            return RoutingDecision(
                should_process=False,
                reason="No routing rule matched"
            )
            
        except Exception as e:
            logger.error(f"Error routing message {message.id}: {str(e)}")
            return RoutingDecision(
                should_process=False,
                reason=f"Routing error: {str(e)}"
            )
    
    async def _find_active_conversation(self, sender_id: str) -> Optional[str]:
        """Find active conversation for a sender"""
        key = f"active_conversations:{sender_id}"
        conversations = await self.storage.get_list(key, 0, -1)
        
        if conversations:
            # Return the most recent conversation
            return conversations[-1]
        
        return None
    
    async def _is_conversation_active(self, conversation_id: str) -> bool:
        """Check if a conversation is still active"""
        key = f"conversation:{conversation_id}:last_activity"
        last_activity = await self.storage.get(key)
        
        if last_activity:
            # Check if within timeout window (default 30 minutes)
            last_time = datetime.fromisoformat(last_activity)
            timeout = timedelta(minutes=30)
            return datetime.now() - last_time < timeout
        
        return False
    
    def _should_start_conversation(self, message: Message) -> bool:
        """Determine if message should start a new conversation"""
        # Check for conversation starters
        starters = [
            r'^(hi|hello|hey|start)',
            r'^(help|assist)',
            r'(new conversation|new chat)',
        ]
        
        content_lower = message.content.lower()
        for pattern in starters:
            if re.search(pattern, content_lower):
                return True
        
        # Check if message has explicit start flag
        if message.metadata.get("start_conversation", False):
            return True
        
        # Default: start conversation for any non-empty message
        return len(message.content.strip()) > 0


class CustomizableRouter(MessageRouter):
    """
    Extended router with more customization options
    """
    
    def __init__(self, storage: IStorageBackend, config: Dict[str, Any] = None):
        super().__init__(storage)
        self.config = config or {}
        self._setup_custom_rules()
    
    def _setup_custom_rules(self):
        """Setup custom rules based on configuration"""
        
        # Add keyword-based routing
        if "keyword_routes" in self.config:
            for keyword_config in self.config["keyword_routes"]:
                self.add_keyword_rule(
                    keywords=keyword_config["keywords"],
                    conversation_id=keyword_config.get("conversation_id"),
                    create_new=keyword_config.get("create_new", False),
                    priority=keyword_config.get("priority", 50)
                )
        
        # Add pattern-based routing
        if "pattern_routes" in self.config:
            for pattern_config in self.config["pattern_routes"]:
                self.add_pattern_rule(
                    pattern=pattern_config["pattern"],
                    conversation_id=pattern_config.get("conversation_id"),
                    create_new=pattern_config.get("create_new", False),
                    priority=pattern_config.get("priority", 50)
                )
    
    def add_keyword_rule(self, 
                        keywords: List[str], 
                        conversation_id: Optional[str] = None,
                        create_new: bool = False,
                        priority: int = 50):
        """Add a keyword-based routing rule"""
        
        def condition(msg: Message) -> bool:
            content_lower = msg.content.lower()
            return any(keyword.lower() in content_lower for keyword in keywords)
        
        def action(msg: Message) -> RoutingDecision:
            return RoutingDecision(
                should_process=True,
                conversation_id=conversation_id,
                create_new_conversation=create_new,
                reason=f"Keyword match: {keywords}"
            )
        
        self.add_rule(
            RoutingRule(
                name=f"keyword_rule_{keywords[0]}",
                condition=condition,
                action=action,
                priority=priority
            )
        )
    
    def add_pattern_rule(self,
                        pattern: str,
                        conversation_id: Optional[str] = None,
                        create_new: bool = False,
                        priority: int = 50):
        """Add a regex pattern-based routing rule"""
        
        compiled_pattern = re.compile(pattern, re.IGNORECASE)
        
        def condition(msg: Message) -> bool:
            return bool(compiled_pattern.search(msg.content))
        
        def action(msg: Message) -> RoutingDecision:
            return RoutingDecision(
                should_process=True,
                conversation_id=conversation_id,
                create_new_conversation=create_new,
                reason=f"Pattern match: {pattern}"
            )
        
        self.add_rule(
            RoutingRule(
                name=f"pattern_rule_{pattern[:20]}",
                condition=condition,
                action=action,
                priority=priority
            )
        )