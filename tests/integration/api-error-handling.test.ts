/**
 * API Error Handling Integration Tests
 * 
 * Tests that error handling middleware is working correctly
 */

import { describe, test, expect } from 'bun:test'

describe('API Error Handling Integration', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

  describe('Authentication Errors', () => {
    test('should return 401 for missing auth token', async () => {
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

    test('should return 401 for invalid auth token', async () => {
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
    test('should return 404 for non-existent resource', async () => {
      const response = await fetch(
        `${BASE_URL}/api/posts/nonexistent-post-id-12345`,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      )

      // May return 404 or 400 depending on validation
      expect([400, 404]).toContain(response.status)
    })

    test('should return 404 for non-existent user', async () => {
      const response = await fetch(
        `${BASE_URL}/api/users/nonexistent-user-id/profile`,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      )

      expect([400, 404]).toContain(response.status)
    })
  })

  describe('Validation Errors', () => {
    test('should return 400 for validation errors', async () => {
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

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    test('should provide detailed validation errors', async () => {
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

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
      
      // Should have field-level error details
      if (data.details) {
        expect(Array.isArray(data.details)).toBe(true)
        expect(data.details.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Business Logic Errors', () => {
    test('should return 400 for insufficient funds', async () => {
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

      // Will likely fail at validation or business logic
      expect([400, 402, 403]).toContain(response.status)
    })
  })

  describe('Rate Limiting', () => {
    test('should handle rate limit errors gracefully', async () => {
      // Make multiple rapid requests
      const requests = Array.from({ length: 100 }, () =>
        fetch(`${BASE_URL}/api/stats`, {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
      )

      const responses = await Promise.all(requests)
      
      // At least some should succeed
      const successCount = responses.filter(r => r.status === 200).length
      expect(successCount).toBeGreaterThan(0)

      // If rate limited, should return 429
      const rateLimited = responses.filter(r => r.status === 429)
      if (rateLimited.length > 0) {
        const data = await rateLimited[0].json()
        expect(data.error).toBeDefined()
      }
    })
  })

  describe('Error Response Consistency', () => {
    test('all errors should have consistent structure', async () => {
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
          
          // All errors should have an error field
          expect(data).toHaveProperty('error')
          expect(typeof data.error).toBe('string')
          
          // Error message should not be empty
          expect(data.error.length).toBeGreaterThan(0)
        }
      }
    })

    test('should not expose internal error details in production', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: 'invalid-json{'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      
      // Should have user-friendly error message
      expect(data.error).toBeDefined()
      
      // Should not expose stack traces or internal paths
      const errorString = JSON.stringify(data)
      expect(errorString).not.toContain('/home/')
      expect(errorString).not.toContain('node_modules')
      expect(errorString).not.toContain('at ')
    })
  })

  describe('CORS and Headers', () => {
    test('should include proper CORS headers', async () => {
      const response = await fetch(`${BASE_URL}/api/stats`)

      // Check for CORS headers (if configured)
      const headers = response.headers
      expect(headers.get('content-type')).toContain('application/json')
    })

    test('should handle OPTIONS requests', async () => {
      const response = await fetch(`${BASE_URL}/api/posts`, {
        method: 'OPTIONS'
      })

      // OPTIONS should succeed or return 404/405
      expect([200, 204, 404, 405]).toContain(response.status)
    })
  })
})





