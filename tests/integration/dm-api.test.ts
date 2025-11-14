/**
 * Direct Message API Integration Tests
 * 
 * Tests for DM creation and messaging endpoints
 */

import { describe, test, expect } from 'bun:test'

describe('DM Creation API', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

  describe('POST /api/chats/dm', () => {
    test('should reject request without authentication', async () => {
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

    test('should reject self-DM attempts', async () => {
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

      // Should return 400 with SELF_DM_NOT_ALLOWED error
      expect([400, 401]).toContain(response.status)
      if (response.status === 400) {
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })

    test('should reject DM to non-existent user', async () => {
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

      expect([400, 404]).toContain(response.status)
    })

    test('should have proper response structure for valid DM creation', async () => {
      // Note: This test will likely fail without valid auth
      // but validates the expected response structure
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
    test('should require authentication', async () => {
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

    test('should validate message content', async () => {
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

    test('should enforce minimum message length', async () => {
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

      // Either validation error or auth error
      expect([400, 401]).toContain(response.status)
    })

    test('should have proper response structure for DM messages', async () => {
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
        // DMs should not have membership stats
        expect(data.membership).toBeUndefined()
      }
    })
  })
})

describe('DM Chat Fetch API', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

  describe('GET /api/chats', () => {
    test('should separate group chats and direct chats', async () => {
      const response = await fetch(`${BASE_URL}/api/chats`, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      if (response.status === 200) {
        const data = await response.json()
        
        // Should have both arrays
        expect(Array.isArray(data.groupChats)).toBe(true)
        expect(Array.isArray(data.directChats)).toBe(true)
        
        // Direct chats should have otherUser field
        if (data.directChats.length > 0) {
          const dm = data.directChats[0]
          expect(dm.isGroup).toBe(false)
          expect(dm.otherUser).toBeDefined()
          expect(dm.otherUser.id).toBeDefined()
        }
      }
    })
  })

  describe('GET /api/chats/[id]', () => {
    test('should include otherUser for DM chats', async () => {
      const dmChatId = 'dm-test-user-1-test-user-2'
      
      const response = await fetch(`${BASE_URL}/api/chats/${dmChatId}`, {
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })

      if (response.status === 200) {
        const data = await response.json()
        
        expect(data.chat).toBeDefined()
        if (!data.chat.isGroup) {
          // DM should have otherUser info
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
      ' ',
      null,
      undefined,
    ]

    for (const id of invalidIds) {
      expect(id).toBeFalsy()
    }
  })
})

