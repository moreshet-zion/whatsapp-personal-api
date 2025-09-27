/**
 * Basic usage example of WhatsApp Message Interception Service
 */

import { 
  WhatsAppInterceptionService,
  ServiceConfig,
  IWhatsAppAPI,
  WhatsAppMessage,
  MessageType
} from '../src/WhatsAppInterceptionService';

/**
 * Mock WhatsApp API for demonstration
 * Replace this with your actual WhatsApp API implementation
 */
class MockWhatsAppAPI implements IWhatsAppAPI {
  async sendMessage(
    to: string,
    message: string,
    options?: any
  ): Promise<{ messageId: string; status: string }> {
    console.log(`📱 Sending WhatsApp message to ${to}: ${message}`);
    return {
      messageId: `msg_${Date.now()}`,
      status: 'sent'
    };
  }

  async markAsRead(messageId: string): Promise<void> {
    console.log(`✓ Marked message ${messageId} as read`);
  }

  async getMessageStatus(messageId: string): Promise<string> {
    return 'delivered';
  }
}

async function main() {
  // Configuration
  const config: ServiceConfig = {
    storage: {
      type: 'local',
      localPath: './data/whatsapp-storage'
    },
    whatsapp: {
      botPhoneNumber: '+1234567890',
      api: new MockWhatsAppAPI()
    },
    ai: {
      defaultEngine: 'mock' // Using mock engine for demo
    },
    routing: {
      departments: [
        {
          name: 'support',
          keywords: ['help', 'support', 'issue', 'problem'],
          agentId: 'support-agent'
        },
        {
          name: 'sales',
          keywords: ['buy', 'purchase', 'price', 'product'],
          agentId: 'sales-agent'
        }
      ]
    },
    conversation: {
      timeoutMinutes: 30,
      maxHistorySize: 100
    }
  };

  // Initialize service
  const service = new WhatsAppInterceptionService(config);

  // Set up event listeners
  service.on('message:processed', ({ message, response }) => {
    console.log(`✅ Processed message from ${message.from}`);
    if (response) {
      console.log(`   Response: ${response.content}`);
    }
  });

  service.on('conversation:created', (conversation) => {
    console.log(`🆕 New conversation started: ${conversation.conversationId}`);
  });

  service.on('conversation:initiated', ({ phoneNumber, conversationId }) => {
    console.log(`📞 Initiated conversation with ${phoneNumber}: ${conversationId}`);
  });

  // Start the service
  await service.start();

  console.log('\n=== WhatsApp Message Interception Service Started ===\n');

  // Example 1: Process incoming messages
  console.log('📥 Example 1: Processing incoming messages\n');
  
  const incomingMessages: WhatsAppMessage[] = [
    {
      id: '1',
      from: '+9876543210',
      to: '+1234567890',
      content: 'Hello, I need help with my account',
      type: MessageType.TEXT,
      timestamp: new Date()
    },
    {
      id: '2',
      from: '+9876543210',
      to: '+1234567890',
      content: 'I forgot my password',
      type: MessageType.TEXT,
      timestamp: new Date()
    },
    {
      id: '3',
      from: '+5555555555',
      to: '+1234567890',
      content: 'What products do you have?',
      type: MessageType.TEXT,
      timestamp: new Date()
    }
  ];

  for (const message of incomingMessages) {
    console.log(`\n💬 Incoming: "${message.content}" from ${message.from}`);
    const response = await service.processIncomingMessage(message);
    
    if (response) {
      console.log(`🤖 Bot response: "${response.content}"`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay
  }

  // Example 2: Pub/Sub - Send notification to topic subscribers
  console.log('\n📢 Example 2: Pub/Sub with conversation initiation\n');
  
  // Subscribe some users to a topic
  const topicId = 'promotions';
  const subscribers = ['+1111111111', '+2222222222', '+3333333333'];
  
  for (const phoneNumber of subscribers) {
    await service.subscribeToTopic(topicId, phoneNumber);
    console.log(`   ✓ Subscribed ${phoneNumber} to topic: ${topicId}`);
  }
  
  // Publish message to topic with conversation initiation
  console.log(`\n📤 Publishing to topic "${topicId}" with conversation initiation...`);
  
  await service.publishToTopic(
    topicId,
    '🎉 Special offer! Get 20% off on all products today. Reply to learn more!',
    true, // Initiate conversation
    {
      conversationType: 'sales',
      agentId: 'sales-agent',
      config: {
        allowUserResponse: true,
        autoCloseAfter: 60, // Auto-close after 60 minutes
        maxMessages: 10
      }
    }
  );

  // Example 3: Direct conversation initiation
  console.log('\n💬 Example 3: Direct conversation initiation\n');
  
  const result = await service.initiateConversations({
    phoneNumbers: ['+4444444444', '+5555555555'],
    message: 'Hello! We wanted to check in and see how your experience has been.',
    conversationType: 'support',
    agentId: 'support-agent',
    metadata: {
      campaign: 'customer-satisfaction',
      source: 'automated'
    }
  });
  
  console.log(`   ✓ Initiated: ${result.initiated.length} conversations`);
  if (result.failed.length > 0) {
    console.log(`   ✗ Failed: ${result.failed.length} conversations`);
  }

  // Example 4: Custom routing rule
  console.log('\n🔀 Example 4: Adding custom routing rule\n');
  
  service.addRoutingRule(
    'vip-customers',
    (message) => {
      // Check if message is from VIP customer
      const vipNumbers = ['+VIP1234567', '+VIP7654321'];
      return vipNumbers.includes(message.from);
    },
    (message) => ({
      shouldProcess: true,
      action: 'start_conversation' as const,
      createNewConversation: true,
      agentId: 'vip-agent',
      priority: 100,
      reason: 'VIP customer detected'
    })
  );
  
  console.log('   ✓ Added VIP customer routing rule');

  // Example 5: Get statistics
  console.log('\n📊 Example 5: Getting statistics\n');
  
  const activeConversations = await service.listActiveConversations();
  console.log(`   Active conversations: ${activeConversations.length}`);
  
  for (const conv of activeConversations.slice(0, 3)) {
    const stats = await service.getConversationStats(conv.conversationId);
    console.log(`   - Conversation ${conv.conversationId.substring(0, 8)}...`);
    console.log(`     Messages: ${stats.messageCount}`);
    console.log(`     Duration: ${Math.round(stats.duration / 1000)}s`);
  }

  // Get service status
  const status = service.getStatus();
  console.log('\n📈 Service Status:');
  console.log(`   Running: ${status.running}`);
  console.log(`   Agents: ${status.agents.join(', ')}`);

  // Wait a bit before stopping
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Stop the service
  console.log('\n⏹️  Stopping service...');
  await service.stop();
  
  console.log('\n=== Service stopped successfully ===');
}

// Run the example
main().catch(console.error);