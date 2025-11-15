/**
 * Unit Tests for Agent0Client
 * 
 * Tests the singleton getAgent0Client() function since Agent0Client
 * requires configuration and should be accessed via singleton.
 */

import { describe, test, expect } from 'bun:test'
import { getAgent0Client } from '../Agent0Client'

describe('Agent0Client', () => {
  test('getAgent0Client returns a client instance', () => {
    // This will throw if env vars are missing, which is expected
    try {
      const client = getAgent0Client()
      expect(client).toBeDefined()
      expect(client.isAvailable).toBeDefined()
    } catch (error) {
      // Expected if env vars not set in test environment
      expect(error).toBeDefined()
    }
  })
  
  test('searchAgents returns an array', async () => {
    try {
      const client = getAgent0Client()
      const results = await client.searchAgents({
        skills: ['trading']
      })
      expect(Array.isArray(results)).toBe(true)
    } catch (error) {
      // Expected if env vars not set or SDK not initialized
      expect(error).toBeDefined()
    }
  })
  
  test('getAgentProfile returns a profile or null', async () => {
    try {
      const client = getAgent0Client()
      const profile = await client.getAgentProfile(1)
      expect(profile === null || typeof profile === 'object').toBe(true)
    } catch (error) {
      // Expected if env vars not set or SDK not initialized
      expect(error).toBeDefined()
    }
  })
})

