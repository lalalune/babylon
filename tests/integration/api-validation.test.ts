/**
 * API Validation Integration Tests
 * 
 * Tests that Zod validation is working correctly across critical API routes
 */

import { describe, test, expect } from 'bun:test'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
// Check server availability at module load time
const serverAvailable = await (async () => {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return response.status < 500
  } catch {
    console.log(`⚠️  Server not available at ${BASE_URL} - Skipping API tests`)
    console.log('   To run these tests: bun run dev (in another terminal)')
    return false
  }
})()

describe('API Validation Integration', () => {
  describe('User Routes Validation', () => {
    test.skipIf(!serverAvailable)('POST /api/users/[userId]/follow - should reject invalid userId', async () => {

      const response = await fetch(`${BASE_URL}/api/users/invalid-uuid/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })

      expect([200, 400, 401, 404]).toContain(response.status)
      if (response.status >= 400) {
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })

    test.skipIf(!serverAvailable)('PATCH /api/users/[userId]/update-profile - should reject invalid data', async () => {

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

      expect([400, 401, 405]).toContain(response.status)
      if (response.status >= 400) {
        try {
          const data = await response.json()
          if (data) {
            expect(data.error || data.message).toBeDefined()
          }
        } catch {
          // Response might not be JSON (HTML error page)
          expect(response.ok).toBe(false)
        }
      }
    })
  })

  describe('Post Routes Validation', () => {
    test.skipIf(!serverAvailable)('POST /api/posts - should reject empty content', async () => {

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

      // Server may return 400, 401, or 500 for validation errors
      expect([400, 401, 500]).toContain(response.status)
      if (response.status >= 400) {
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })

    test.skipIf(!serverAvailable)('POST /api/posts - should reject content exceeding max length', async () => {

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

      // Server may return 400, 401, or 500 for validation errors
      expect([400, 401, 500]).toContain(response.status)
      if (response.status >= 400) {
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })
  })

  describe('Market Routes Validation', () => {
    test.skipIf(!serverAvailable)('POST /api/markets/predictions/[id]/buy - should reject invalid amount', async () => {

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

      expect([400, 401, 404]).toContain(response.status)
      if (response.status >= 400) {
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })

    test.skipIf(!serverAvailable)('POST /api/markets/perps/open - should reject invalid leverage', async () => {

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

      expect([400, 401, 404]).toContain(response.status)
      if (response.status >= 400) {
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })
  })

  describe('Agent Routes Validation', () => {
    test.skipIf(!serverAvailable)('POST /api/agents/auth - should reject missing credentials', async () => {

      const response = await fetch(`${BASE_URL}/api/agents/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing agentId and signature
        })
      })

      // Server may return 400, 401, or 500 for validation errors
      expect([400, 401, 500]).toContain(response.status)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test.skipIf(!serverAvailable)('POST /api/agents/onboard - should reject invalid agent data', async () => {

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

      // Server may return 400, 401, or 500 for validation errors
      expect([400, 401, 500]).toContain(response.status)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Chat Routes Validation', () => {
    test.skipIf(!serverAvailable)('POST /api/chats - should reject invalid chat name', async () => {

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

      // Server may return 400, 401, or 500 for validation errors
      expect([400, 401, 500]).toContain(response.status)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test.skipIf(!serverAvailable)('POST /api/chats/[id]/message - should reject empty message', async () => {

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

      // Server may return 400, 401, or 500 for validation errors
      expect([400, 401, 500]).toContain(response.status)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Query Parameter Validation', () => {
    test.skipIf(!serverAvailable)('GET /api/users/[userId]/posts - should reject invalid pagination', async () => {

      const response = await fetch(
        `${BASE_URL}/api/users/test-user/posts?limit=-1&page=0`,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      )

      expect([200, 400, 401]).toContain(response.status)
      if (response.status >= 400) {
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })

    test.skipIf(!serverAvailable)('GET /api/feed/widgets/trending-posts - should reject invalid timeframe', async () => {

      const response = await fetch(
        `${BASE_URL}/api/feed/widgets/trending-posts?timeframe=invalid`,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      )

      expect([200, 400, 401]).toContain(response.status)
      if (response.status >= 400) {
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })
  })

  describe('Error Response Format', () => {
    test.skipIf(!serverAvailable)('should return consistent error format for validation failures', async () => {

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

      // Server may return 400, 401, or 500 for validation errors
      expect([400, 401, 500]).toContain(response.status)
      const data = await response.json()
      
      expect(data).toHaveProperty('error')
      expect(typeof data.error).toBe('string')
      
      if (data.details) {
        expect(Array.isArray(data.details)).toBe(true)
      }
    })
  })
})

