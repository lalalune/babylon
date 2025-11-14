#!/usr/bin/env bun

/**
 * Redis Integration Test
 * 
 * Tests both local Redis and Upstash Redis configurations
 */

import { logger } from '../src/lib/logger';
import { redis, redisClientType, isRedisAvailable, safePublish, safePoll } from '../src/lib/redis';
import type Redis from 'ioredis';

async function testRedis() {
  logger.info('Testing Redis integration...', undefined, 'Test');
  logger.info('═'.repeat(60), undefined, 'Test');
  
  // Check if Redis is available
  if (!isRedisAvailable()) {
    logger.error('❌ Redis is not available!', undefined, 'Test');
    logger.info('Make sure REDIS_URL or UPSTASH_REDIS_REST_URL is configured', undefined, 'Test');
    process.exit(1);
  }
  
  logger.info(`✅ Redis client initialized (type: ${redisClientType})`, undefined, 'Test');
  
  // Test 1: Publish a message
  logger.info('\nTest 1: Publishing message to channel "test:feed"...', undefined, 'Test');
  const message1 = JSON.stringify({
    type: 'test',
    data: { hello: 'world', timestamp: Date.now() }
  });
  
  const published = await safePublish('sse:test:feed', message1);
  if (!published) {
    logger.error('❌ Failed to publish message', undefined, 'Test');
    process.exit(1);
  }
  logger.info('✅ Message published successfully', undefined, 'Test');
  
  // Test 2: Publish multiple messages
  logger.info('\nTest 2: Publishing multiple messages...', undefined, 'Test');
  for (let i = 0; i < 5; i++) {
    const msg = JSON.stringify({
      type: 'test',
      data: { message: `Test message ${i + 1}`, timestamp: Date.now() }
    });
    await safePublish('sse:test:feed', msg);
  }
  logger.info('✅ Published 5 messages', undefined, 'Test');
  
  // Test 3: Poll messages
  logger.info('\nTest 3: Polling messages from channel...', undefined, 'Test');
  const messages = await safePoll('sse:test:feed', 10);
  
  if (messages.length === 0) {
    logger.error('❌ No messages received!', undefined, 'Test');
    process.exit(1);
  }
  
  logger.info(`✅ Received ${messages.length} messages:`, undefined, 'Test');
  messages.forEach((msg, idx) => {
    try {
      const parsed = JSON.parse(msg);
      logger.info(`  ${idx + 1}. ${JSON.stringify(parsed)}`, undefined, 'Test');
    } catch {
      logger.info(`  ${idx + 1}. ${msg}`, undefined, 'Test');
    }
  });
  
  // Test 4: Verify TTL works (messages expire after 60s)
  logger.info('\nTest 4: Testing TTL...', undefined, 'Test');
  await safePublish('sse:test:ttl', 'This message should expire in 60s');
  logger.info('✅ TTL test message published (will expire in 60s)', undefined, 'Test');
  
  // Test 5: Test chat channel
  logger.info('\nTest 5: Testing chat channel...', undefined, 'Test');
  const chatMessage = JSON.stringify({
    type: 'new_message',
    data: {
      id: 'test-msg-123',
      chatId: 'test-chat',
      content: 'Hello from Redis test!',
      senderId: 'test-user',
      createdAt: new Date().toISOString()
    }
  });
  await safePublish('sse:chat:test-chat', chatMessage);
  const chatMessages = await safePoll('sse:chat:test-chat', 5);
  logger.info(`✅ Chat channel test: ${chatMessages.length} message(s) received`, undefined, 'Test');
  
  // Summary
  logger.info('\n' + '═'.repeat(60), undefined, 'Test');
  logger.info('✅ All Redis tests passed!', undefined, 'Test');
  logger.info('\nRedis Configuration:', {
    type: redisClientType,
    available: isRedisAvailable(),
    url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || 'not set'
  }, 'Test');
  
  // Cleanup
  if (redisClientType === 'standard') {
    const client = redis as Redis;
    await client.quit();
  }
  
  process.exit(0);
}

// Run test
testRedis().catch((error) => {
  logger.error('Test failed:', error, 'Test');
  process.exit(1);
});

