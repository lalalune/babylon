/**
 * API Validation Integration Tests
 * 
 * Tests that Zod validation is working correctly across critical API routes
 */

import { describe, test, expect } from 'bun:test'

describe('API Validation Integration', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

  describe('User Routes Validation', () => {
    test('POST /api/users/[userId]/follow - should reject invalid userId', async () => {
      const response = await fetch(`${BASE_URL}/api/users/invalid-uuid/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test('PATCH /api/users/[userId]/update-profile - should reject invalid data', async () => {
      const response = await fetch(`${BASE_URL}/api/users/test-user/update-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          username: 'a', // Too short
          email: 'invalid-email' // Invalid format
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Post Routes Validation', () => {
    test('POST /api/posts - should reject empty content', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          content: '' // Empty content
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test('POST /api/posts - should reject content exceeding max length', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          content: 'a'.repeat(10001) // Exceeds 10000 char limit
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Market Routes Validation', () => {
    test('POST /api/markets/predictions/[id]/buy - should reject invalid amount', async () => {
      const response = await fetch(`${BASE_URL}/api/markets/predictions/test-id/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          amount: -100, // Negative amount
          outcome: 'yes'
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test('POST /api/markets/perps/open - should reject invalid leverage', async () => {
      const response = await fetch(`${BASE_URL}/api/markets/perps/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          organizationId: 'test-org',
          side: 'long',
          size: 1000,
          leverage: 150 // Exceeds max leverage of 100
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Pool Routes Validation', () => {
    test('POST /api/pools/[id]/deposit - should reject invalid deposit amount', async () => {
      const response = await fetch(`${BASE_URL}/api/pools/test-pool/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          amount: 0 // Zero or negative not allowed
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Agent Routes Validation', () => {
    test('POST /api/agents/auth - should reject missing credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/agents/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing agentId and signature
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test('POST /api/agents/onboard - should reject invalid agent data', async () => {
      const response = await fetch(`${BASE_URL}/api/agents/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: '', // Empty agentId
          name: 'a', // Too short
          walletAddress: 'invalid-address' // Invalid format
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Chat Routes Validation', () => {
    test('POST /api/chats - should reject invalid chat name', async () => {
      const response = await fetch(`${BASE_URL}/api/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          name: '', // Empty name
          isGroup: true
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test('POST /api/chats/[id]/message - should reject empty message', async () => {
      const response = await fetch(`${BASE_URL}/api/chats/test-chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          content: '' // Empty message
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Query Parameter Validation', () => {
    test('GET /api/users/[userId]/posts - should reject invalid pagination', async () => {
      const response = await fetch(
        `${BASE_URL}/api/users/test-user/posts?limit=-1&page=0`,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test('GET /api/feed/widgets/trending-posts - should reject invalid timeframe', async () => {
      const response = await fetch(
        `${BASE_URL}/api/feed/widgets/trending-posts?timeframe=invalid`,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Error Response Format', () => {
    test('should return consistent error format for validation failures', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          content: '' // Invalid
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      
      // Check error response structure
      expect(data).toHaveProperty('error')
      expect(typeof data.error).toBe('string')
      
      // May have details array for field-level errors
      if (data.details) {
        expect(Array.isArray(data.details)).toBe(true)
      }
    })
  })
})





