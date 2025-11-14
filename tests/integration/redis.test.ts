/**
 * Redis Integration Test
 * 
 * Tests Redis pub/sub for real-time features
 */

import { describe, test, expect } from 'bun:test'
import { isRedisAvailable, safePublish, safePoll } from '@/lib/redis'

describe('Redis Integration', () => {
  test('Redis is available', () => {
    expect(isRedisAvailable()).toBe(true)
  })

  test('Publish and poll messages', async () => {
    const channel = 'sse:test:integration'
    const message = JSON.stringify({
      type: 'test',
      data: { timestamp: Date.now() }
    })

    const published = await safePublish(channel, message)
    expect(published).toBe(true)

    const messages = await safePoll(channel, 10)
    expect(messages.length).toBeGreaterThan(0)
  })

  test('Multiple messages in sequence', async () => {
    const channel = 'sse:test:batch'

    for (let i = 0; i < 5; i++) {
      await safePublish(channel, JSON.stringify({ message: i }))
    }

    const messages = await safePoll(channel, 10)
    expect(messages.length).toBeGreaterThanOrEqual(5)
  })

  test('Chat channel messaging', async () => {
    const chatMessage = JSON.stringify({
      type: 'new_message',
      data: {
        id: 'test-msg',
        chatId: 'test-chat',
        content: 'Test message',
        senderId: 'test-user',
        createdAt: new Date().toISOString()
      }
    })

    await safePublish('sse:chat:test-chat', chatMessage)
    const messages = await safePoll('sse:chat:test-chat', 5)

    expect(messages.length).toBeGreaterThan(0)
  })
})

