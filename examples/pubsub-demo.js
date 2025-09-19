#!/usr/bin/env node

/**
 * WhatsApp Pub/Sub System Demo
 * 
 * This script demonstrates how to use the pub/sub system API.
 * Make sure the server is running and WhatsApp is connected before running this demo.
 * 
 * Usage: node examples/pubsub-demo.js
 */

const API_BASE = 'http://localhost:3000'
const API_KEY = process.env.API_KEY || 'your-api-key-here'

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  const url = `${API_BASE}${endpoint}`
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
  
  if (data) {
    options.body = JSON.stringify(data)
  }
  
  try {
    const response = await fetch(url, options)
    const result = await response.json()
    
    console.log(`${method} ${endpoint}:`, response.status)
    console.log(JSON.stringify(result, null, 2))
    console.log('---')
    
    return result
  } catch (error) {
    console.error(`Error calling ${method} ${endpoint}:`, error.message)
    return null
  }
}

async function demo() {
  console.log('🚀 WhatsApp Pub/Sub System Demo')
  console.log('================================\\n')
  
  // 1. Check system health
  console.log('📊 Checking system health...')
  await apiCall('GET', '/health')
  
  // 2. Create topics
  console.log('📝 Creating topics...')
  const newsTopicResult = await apiCall('POST', '/topics', {
    name: 'daily-news',
    description: 'Daily news updates and breaking news'
  })
  
  const weatherTopicResult = await apiCall('POST', '/topics', {
    name: 'weather-alerts',
    description: 'Weather warnings and forecasts'
  })
  
  if (!newsTopicResult?.success || !weatherTopicResult?.success) {
    console.error('❌ Failed to create topics')
    return
  }
  
  const newsTopicId = newsTopicResult.topic.id
  const weatherTopicId = weatherTopicResult.topic.id
  
  // 3. List all topics
  console.log('📋 Listing all topics...')
  await apiCall('GET', '/topics')
  
  // 4. Subscribe phone numbers to topics
  console.log('📱 Subscribing phone numbers to topics...')
  
  const phoneNumbers = ['+1234567890', '+0987654321', '+1122334455']
  
  // Subscribe all phones to news
  for (const phone of phoneNumbers) {
    await apiCall('POST', '/subscribe', {
      phoneNumber: phone,
      topicId: newsTopicId
    })
  }
  
  // Subscribe first two phones to weather
  for (const phone of phoneNumbers.slice(0, 2)) {
    await apiCall('POST', '/subscribe', {
      phoneNumber: phone,
      topicId: weatherTopicId
    })
  }
  
  // 5. Check subscription status
  console.log('🔍 Checking subscription status...')
  await apiCall('GET', `/subscription-status/${phoneNumbers[0]}/${newsTopicId}`)
  await apiCall('GET', `/subscription-status/${phoneNumbers[2]}/${weatherTopicId}`)
  
  // 6. List subscribers for each topic
  console.log('👥 Listing topic subscribers...')
  await apiCall('GET', `/topics/${newsTopicId}/subscribers`)
  await apiCall('GET', `/topics/${weatherTopicId}/subscribers`)
  
  // 7. List topics for a subscriber
  console.log('📑 Listing subscriber topics...')
  await apiCall('GET', `/subscribers/${phoneNumbers[0]}/topics`)
  
  // 8. Check current settings
  console.log('⚙️ Checking current settings...')
  await apiCall('GET', '/settings')
  
  // 9. Update message delay setting
  console.log('🔧 Updating message delay setting...')
  await apiCall('PUT', '/settings', {
    key: 'message_delay_seconds',
    value: '3',
    description: 'Reduced delay for demo purposes'
  })
  
  // 10. Check queue status
  console.log('📬 Checking queue status...')
  await apiCall('GET', '/queue-status')
  
  // 11. Publish messages (these will be queued but not sent unless WhatsApp is connected)
  console.log('📢 Publishing messages...')
  await apiCall('POST', '/publish', {
    topicId: newsTopicId,
    message: '🗞️ Breaking News: This is a test message from the pub/sub system demo!',
    delaySeconds: 0
  })
  
  await apiCall('POST', '/publish', {
    topicId: weatherTopicId,
    message: '🌦️ Weather Alert: Demo weather warning - partly cloudy with a chance of code!',
    delaySeconds: 5
  })
  
  // 12. Check queue status after publishing
  console.log('📬 Checking queue status after publishing...')
  await apiCall('GET', '/queue-status')
  
  // 13. List all subscribers
  console.log('👥 Listing all subscribers...')
  await apiCall('GET', '/subscribers')
  
  // 14. Update a subscriber
  console.log('✏️ Updating subscriber information...')
  await apiCall('PUT', `/subscribers/${phoneNumbers[0]}`, {
    name: 'John Doe',
    active: true
  })
  
  // 15. Unsubscribe a phone from a topic
  console.log('❌ Unsubscribing from topic...')
  await apiCall('POST', '/unsubscribe', {
    phoneNumber: phoneNumbers[2],
    topicId: newsTopicId
  })
  
  // 16. Verify unsubscription
  console.log('🔍 Verifying unsubscription...')
  await apiCall('GET', `/subscription-status/${phoneNumbers[2]}/${newsTopicId}`)
  
  // 17. Final health check
  console.log('📊 Final system health check...')
  await apiCall('GET', '/health')
  
  console.log('\\n✅ Demo completed!')
  console.log('\\n📝 Summary:')
  console.log('- Created 2 topics (daily-news, weather-alerts)')
  console.log('- Subscribed 3 phone numbers with different subscription patterns')
  console.log('- Published 2 test messages (queued for delivery)')
  console.log('- Demonstrated all major API endpoints')
  console.log('\\n💡 Tips:')
  console.log('- Connect WhatsApp via /qr-image endpoint to actually send messages')
  console.log('- Monitor /queue-status to see message processing')
  console.log('- Adjust settings via /settings endpoint for your use case')
  console.log('- Use /cleanup-messages to clean old queue items')
}

// Run the demo
demo().catch(console.error)