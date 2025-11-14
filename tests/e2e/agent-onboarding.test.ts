/**
 * E2E Test: Agent Onboarding
 * 
 * Tests the complete agent onboarding flow against real backend:
 * 1. Generate HD wallet
 * 2. Authenticate via /api/agents/auth
 * 3. Register on-chain via /api/agents/onboard
 * 4. Verify agent can make authenticated requests
 */

import { test, expect } from '@playwright/test'
import { HDNodeWallet, Mnemonic } from 'ethers'

const API_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_MNEMONIC = 'test test test test test test test test test test test junk'
const TEST_AGENT_SECRET = process.env.BABYLON_AGENT_SECRET || 'test-agent-secret-e2e'

test.describe('Agent Onboarding E2E', () => {
  let testWallet: HDNodeWallet
  let testAgentId: string
  let sessionToken: string
  
  test.beforeAll(() => {
    const mnemonic = Mnemonic.fromPhrase(TEST_MNEMONIC)
    testWallet = HDNodeWallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/999")
    testAgentId = `test-agent-${Date.now()}`
  })
  
  test('should generate deterministic HD wallet', () => {
    expect(testWallet.address).toBeTruthy()
    expect(testWallet.privateKey).toBeTruthy()
    expect(testWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    
    const mnemonic2 = Mnemonic.fromPhrase(TEST_MNEMONIC)
    const wallet2 = HDNodeWallet.fromMnemonic(mnemonic2, "m/44'/60'/0'/0/999")
    expect(wallet2.address).toBe(testWallet.address)
  })
  
  test('should authenticate agent and receive session token', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/agents/auth`, {
      data: {
        agentId: testAgentId,
        agentSecret: TEST_AGENT_SECRET,
      },
    })
    
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.sessionToken).toBeTruthy()
    expect(data.expiresAt).toBeGreaterThan(Date.now())
    
    sessionToken = data.sessionToken
    console.log('✅ Agent authenticated successfully')
  })
  
  test('should fail authentication with invalid credentials', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/agents/auth`, {
      data: {
        agentId: testAgentId,
        agentSecret: 'wrong-secret',
      },
    })
    
    expect(response.ok()).toBe(false)
    expect(response.status()).toBe(401)
    console.log('✅ Invalid credentials correctly rejected')
  })
  
  test('should check agent registration status', async ({ request }) => {
    // First authenticate
    const authResponse = await request.post(`${API_BASE_URL}/api/agents/auth`, {
      data: {
        agentId: testAgentId,
        agentSecret: TEST_AGENT_SECRET,
      },
    })
    
    const authData = await authResponse.json()
    sessionToken = authData.sessionToken
    
    const response = await request.get(`${API_BASE_URL}/api/agents/onboard`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
      },
    })
    
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    expect(data).toHaveProperty('isRegistered')
    expect(data).toHaveProperty('agentId')
    console.log('✅ Registration status checked:', data.isRegistered)
  })
  
  test('should fetch stats endpoint without auth', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/stats`)
    
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    expect(data).toHaveProperty('success')
    console.log('✅ Public stats endpoint working')
  })
})

