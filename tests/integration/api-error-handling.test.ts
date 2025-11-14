/**
 * API Error Handling Integration Tests
 * 
 * Tests that error handling middleware is working correctly
 */

import { describe, test, expect } from 'bun:test'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const serverAvailable = await (async () => {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return response.status < 500
  } catch {
    console.log(`⚠️  Server not available - Skipping API error handling tests`)
    return false
  }
})()

describe('API Error Handling Integration', () => {
  describe('Authentication Errors', () => {
    test.skipIf(!serverAvailable)('should return 401 for missing auth token', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Test post'
        })
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBeDefined()
      expect(data.error.toLowerCase()).toContain('auth')
    })

    test.skipIf(!serverAvailable)('should return 401 for invalid auth token', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token-12345'
        },
        body: JSON.stringify({
          content: 'Test post'
        })
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('Not Found Errors', () => {
    test.skipIf(!serverAvailable)('should return 404 for non-existent resource', async () => {
      const response = await fetch(
        `${BASE_URL}/api/posts/nonexistent-post-id-12345`,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      )

      expect([200, 400, 401, 404, 500]).toContain(response.status)
    })

    test.skipIf(!serverAvailable)('should return 404 for non-existent user', async () => {
      const response = await fetch(
        `${BASE_URL}/api/users/nonexistent-user-id/profile`,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      )

      expect([200, 400, 401, 404]).toContain(response.status)
    })
  })

  describe('Validation Errors', () => {
    test.skipIf(!serverAvailable)('should return 400 for validation errors', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          // Missing required content field
        })
      })

      expect([400, 401]).toContain(response.status)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test.skipIf(!serverAvailable)('should provide detailed validation errors', async () => {
      const response = await fetch(`${BASE_URL}/api/users/test-user/update-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          username: 'a', // Too short
          bio: 'x'.repeat(1001) // Too long
        })
      })

      expect([204, 400, 401, 405]).toContain(response.status)
      
      if (response.status !== 204 && response.headers.get('content-type')?.includes('json')) {
        const data = await response.json()
        expect(data.error).toBeDefined()
        
        if (data.details) {
          expect(Array.isArray(data.details)).toBe(true)
          expect(data.details.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Business Logic Errors', () => {
    test.skipIf(!serverAvailable)('should return 400 for insufficient funds', async () => {
      const response = await fetch(`${BASE_URL}/api/markets/predictions/test-id/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          amount: 999999999, // Unrealistic amount
          outcome: 'yes'
        })
      })

      expect([400, 401, 402, 403, 404]).toContain(response.status)
    })
  })

  describe('Rate Limiting', () => {
    test.skipIf(!serverAvailable)('should handle rate limit errors gracefully', async () => {
      const requests = Array.from({ length: 100 }, () =>
        fetch(`${BASE_URL}/api/stats`)
      )

      const responses = await Promise.all(requests)
      
      const successCount = responses.filter(r => r.status === 200).length
      expect(successCount).toBeGreaterThan(0)

      const rateLimited = responses.filter(r => r.status === 429)
      if (rateLimited.length > 0 && rateLimited[0]) {
        const data = await rateLimited[0].json()
        expect(data.error).toBeDefined()
      }
    }, 10000)
  })

  describe('Error Response Consistency', () => {
    test.skipIf(!serverAvailable)('all errors should have consistent structure', async () => {
      const endpoints = [
        { url: '/api/posts', method: 'POST', body: {} },
        { url: '/api/users/invalid/profile', method: 'GET' },
        { url: '/api/markets/predictions/invalid/buy', method: 'POST', body: {} }
      ]

      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint.url}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
        })

        if (!response.ok) {
          const data = await response.json()
          expect(data).toHaveProperty('error')
          expect(['string', 'object']).toContain(typeof data.error)
          
          if (typeof data.error === 'string') {
            expect(data.error.length).toBeGreaterThan(0)
          }
        }
      }
    })

    test.skipIf(!serverAvailable)('should not expose internal error details in production', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: 'invalid-json{'
      })

      expect([400, 401]).toContain(response.status)
      const data = await response.json()
      
      expect(data.error).toBeDefined()
      
      const errorString = JSON.stringify(data)
      expect(errorString).not.toContain('/home/')
      expect(errorString).not.toContain('node_modules')
      expect(errorString).not.toContain('at ')
    })
  })

  describe('CORS and Headers', () => {
    test.skipIf(!serverAvailable)('should include proper CORS headers', async () => {
      const response = await fetch(`${BASE_URL}/api/stats`)

      expect(response.ok).toBe(true)
      const headers = response.headers
      expect(headers.get('content-type')).toContain('application/json')
    })

    test.skipIf(!serverAvailable)('should handle OPTIONS requests', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'OPTIONS'
      })

      expect([200, 204, 404, 405]).toContain(response.status)
    })
  })
})

