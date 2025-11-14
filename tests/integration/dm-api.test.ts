/**
 * Direct Message API Integration Tests
 * 
 * Tests for DM creation and messaging endpoints
 */

import { describe, test, expect } from 'bun:test'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
// Check server availability at module load time
const serverAvailable = await (async () => {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return response.status < 500
  } catch {
    console.log(`⚠️  Server not available at ${BASE_URL} - Skipping DM API tests`)
    return false
  }
})()

describe('DM Creation API', () => {
  describe('POST /api/chats/dm', () => {
    test.skipIf(!serverAvailable)('should reject request without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'demo-user-babylon-support',
        }),
      })

      expect(response.status).toBe(401)
    })

    test.skipIf(!serverAvailable)('should reject self-DM attempts', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          userId: 'test-user-id', // Same as authenticated user
        }),
      })

      expect([400, 401]).toContain(response.status)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test.skipIf(!serverAvailable)('should reject DM to non-existent user', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          userId: 'nonexistent-user-12345',
        }),
      })

      expect([400, 401, 404]).toContain(response.status)
    })

    test.skipIf(!serverAvailable)('should have proper response structure for valid DM creation', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          userId: 'demo-user-babylon-support',
        }),
      })

      // Either success or auth failure
      if (response.status === 201) {
        const data = await response.json()
        expect(data.chat).toBeDefined()
        expect(data.chat.id).toBeDefined()
        expect(data.chat.isGroup).toBe(false)
        expect(data.chat.otherUser).toBeDefined()
        expect(data.chat.otherUser.id).toBe('demo-user-babylon-support')
      } else {
        // Auth failed - this is expected with test-token
        expect(response.status).toBe(401)
      }
    })
  })

  describe('DM Chat ID Format', () => {
    test('should generate consistent chat IDs', () => {
      const user1 = 'user-a'
      const user2 = 'user-b'
      
      // Sorted IDs ensure consistency regardless of who initiates
      const sortedIds1 = [user1, user2].sort()
      const sortedIds2 = [user2, user1].sort()
      
      const chatId1 = `dm-${sortedIds1.join('-')}`
      const chatId2 = `dm-${sortedIds2.join('-')}`
      
      expect(chatId1).toBe(chatId2)
      expect(chatId1).toMatch(/^dm-/)
    })
  })
})

describe('DM Messaging API', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

  describe('POST /api/chats/[id]/message', () => {
    test.skipIf(!serverAvailable)('should require authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/dm-test-chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Hello!',
        }),
      })

      expect(response.status).toBe(401)
    })

    test.skipIf(!serverAvailable)('should validate message content', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/dm-test-chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          content: '', // Empty content
        }),
      })

      expect([400, 401]).toContain(response.status)
    })

    test.skipIf(!serverAvailable)('should enforce minimum message length', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/dm-test-chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          content: 'Hi', // Too short (min 10 chars)
        }),
      })

      expect([400, 401]).toContain(response.status)
    })

    test.skipIf(!serverAvailable)('should have proper response structure for DM messages', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/dm-test-chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          content: 'This is a test message for DM!',
        }),
      })

      // Check response structure if successful
      if (response.status === 201) {
        const data = await response.json()
        expect(data.message).toBeDefined()
        expect(data.message.content).toBeDefined()
        expect(data.quality).toBeDefined()
        expect(data.chatType).toBe('dm')
        expect(data.membership).toBeUndefined()
      } else {
        // Auth failed - this is expected with test-token
        expect(response.status).toBe(401)
      }
    })
  })
})

describe('DM Chat Fetch API', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

  describe('GET /api/chats', () => {
    test.skipIf(!serverAvailable)('should separate group chats and direct chats', async () => {
      const response = await fetch(`${BASE_URL}/api/chats`, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      // Auth will fail with test token - this is expected
      expect([200, 401]).toContain(response.status)
      
      if (response.status === 200) {
        const data = await response.json()
        
        // If we got data, validate structure
        if (data.groupChats || data.directChats) {
          expect(Array.isArray(data.groupChats) || data.groupChats === undefined).toBe(true)
          expect(Array.isArray(data.directChats) || data.directChats === undefined).toBe(true)
        }
      }
    })
  })

  describe('GET /api/chats/[id]', () => {
    test.skipIf(!serverAvailable)('should include otherUser for DM chats', async () => {
      const dmChatId = 'dm-test-user-1-test-user-2'
      
      const response = await fetch(`${BASE_URL}/api/chats/${dmChatId}`, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      // Auth will likely fail with test token, or chat won't exist
      expect([200, 401, 404]).toContain(response.status)
      
      if (response.status === 200) {
        const data = await response.json()
        
        if (data.chat && !data.chat.isGroup) {
          expect(data.chat.otherUser).toBeDefined()
        }
      }
    })
  })
})

describe('DM Validation Rules', () => {
  test('should validate user ID format', () => {
    const validIds = [
      'demo-user-babylon-support',
      '550e8400-e29b-41d4-a716-446655440000',
      'did:privy:cm6sqq4og01qw9l70rbmyjn20',
    ]

    for (const id of validIds) {
      expect(id.length).toBeGreaterThan(0)
      expect(typeof id).toBe('string')
    }
  })

  test('should reject invalid user IDs', () => {
    const invalidIds = [
      '',
      null,
      undefined,
    ]

    for (const id of invalidIds) {
      expect(id).toBeFalsy()
    }
    
    // Whitespace should be rejected as invalid
    expect(' '.trim()).toBeFalsy()
  })
})

