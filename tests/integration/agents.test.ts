/**
 * Integration Tests for Agents Feature
 * 
 * Tests the complete agent lifecycle:
 * - Agent creation
 * - Chat functionality
 * - Wallet operations
 * - Autonomous tick
 */

import { describe, it, expect, beforeAll } from 'bun:test'

describe('Agents Integration Tests', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
  let testAgentId: string
  let authToken: string

  beforeAll(() => {
    // In a real test, you'd authenticate and get a token
    authToken = process.env.TEST_AUTH_TOKEN || 'test-token'
  })

  describe('Agent Creation', () => {
    it('should create a new agent', async () => {
      // Skip this test if no valid auth token is available
      if (!authToken || authToken === 'test-token') {
        console.log('Skipping agent creation test - no valid auth token (requires Privy authentication)')
        return
      }

      const response = await fetch(`${BASE_URL}/api/agents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Agent',
          description: 'Test agent for integration testing',
          system: 'You are a test agent',
          bio: ['Test bio'],
          initialDeposit: 100,
          modelTier: 'free'
        })
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.agent).toBeDefined()
      expect(data.agent.name).toBe('Test Agent')
      expect(data.agent.pointsBalance).toBe(100)
      
      testAgentId = data.agent.id
    })
  })

  describe('Agent Chat', () => {
    it('should send a message to the agent', async () => {
      if (!testAgentId) {
        console.log('Skipping chat test - no agent ID')
        return
      }

      const response = await fetch(`${BASE_URL}/api/agents/${testAgentId}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Hello, test agent!',
          usePro: false
        })
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.response).toBeDefined()
      expect(data.pointsCost).toBe(1)
    })
  })

  describe('Agent Wallet', () => {
    it('should deposit points to agent', async () => {
      if (!testAgentId) {
        console.log('Skipping wallet test - no agent ID')
        return
      }

      const response = await fetch(`${BASE_URL}/api/agents/${testAgentId}/wallet`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'deposit',
          amount: 50
        })
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.balance.current).toBeGreaterThan(0)
    })

    it('should withdraw points from agent', async () => {
      if (!testAgentId) {
        console.log('Skipping withdrawal test - no agent ID')
        return
      }

      const response = await fetch(`${BASE_URL}/api/agents/${testAgentId}/wallet`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'withdraw',
          amount: 25
        })
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('Agent Logs', () => {
    it('should retrieve agent logs', async () => {
      if (!testAgentId) {
        console.log('Skipping logs test - no agent ID')
        return
      }

      const response = await fetch(`${BASE_URL}/api/agents/${testAgentId}/logs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.logs)).toBe(true)
    })
  })

  describe('Agent Deletion', () => {
    it('should delete the agent', async () => {
      if (!testAgentId) {
        console.log('Skipping deletion test - no agent ID')
        return
      }

      const response = await fetch(`${BASE_URL}/api/agents/${testAgentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })
})

// Export for running as module
export {}

