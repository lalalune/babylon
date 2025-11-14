/**
 * AuthManager Tests
 * Unit tests for the authentication manager
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { ethers } from 'ethers'
import { AuthManager } from '../../server/auth-manager'
import type { AgentCredentials } from '../../types'

describe('AuthManager', () => {
  let authManager: AuthManager
  let wallet: ethers.Wallet

  beforeEach(() => {
    authManager = new AuthManager()
    wallet = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890123')
  })

  describe('Authentication', () => {
    test('should successfully authenticate with valid credentials', async () => {
      const timestamp = Date.now()
      const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
      const signature = await wallet.signMessage(message)

      const credentials: AgentCredentials = {
        address: wallet.address,
        tokenId: 1,
        signature,
        timestamp
      }

      const result = await authManager.authenticate(credentials)
      expect(result.success).toBe(true)
      expect(result.sessionToken).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    test('should reject authentication with invalid signature', async () => {
      const credentials: AgentCredentials = {
        address: wallet.address,
        tokenId: 1,
        signature: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        timestamp: Date.now()
      }

      const result = await authManager.authenticate(credentials)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.sessionToken).toBeUndefined()
    })

    test('should reject authentication with expired timestamp', async () => {
      const expiredTimestamp = Date.now() - (10 * 60 * 1000) // 10 minutes ago
      const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${expiredTimestamp}`
      const signature = await wallet.signMessage(message)

      const credentials: AgentCredentials = {
        address: wallet.address,
        tokenId: 1,
        signature,
        timestamp: expiredTimestamp
      }

      const result = await authManager.authenticate(credentials)
      expect(result.success).toBe(false)
      expect(result.error).toContain('expired')
    })

    test('should reject authentication with future timestamp', async () => {
      const futureTimestamp = Date.now() + (10 * 60 * 1000) // 10 minutes in future
      const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${futureTimestamp}`
      const signature = await wallet.signMessage(message)

      const credentials: AgentCredentials = {
        address: wallet.address,
        tokenId: 1,
        signature,
        timestamp: futureTimestamp
      }

      const result = await authManager.authenticate(credentials)
      expect(result.success).toBe(false)
      expect(result.error).toContain('expired')
    })

    test('should reject authentication with mismatched address', async () => {
      const timestamp = Date.now()
      const differentAddress = '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'
      const message = `A2A Authentication\n\nAddress: ${differentAddress}\nToken ID: 1\nTimestamp: ${timestamp}`
      const signature = await wallet.signMessage(message)

      const credentials: AgentCredentials = {
        address: differentAddress,
        tokenId: 1,
        signature,
        timestamp
      }

      const result = await authManager.authenticate(credentials)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid signature')
    })
  })

  describe('Session Management', () => {
    test('should create valid session token', async () => {
      const timestamp = Date.now()
      const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
      const signature = await wallet.signMessage(message)

      const credentials: AgentCredentials = {
        address: wallet.address,
        tokenId: 1,
        signature,
        timestamp
      }

      const result = await authManager.authenticate(credentials)
      expect(result.sessionToken).toBeDefined()
      expect(result.sessionToken!.length).toBeGreaterThan(0)
    })

    test('should verify valid session token', async () => {
      const timestamp = Date.now()
      const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
      const signature = await wallet.signMessage(message)

      const credentials: AgentCredentials = {
        address: wallet.address,
        tokenId: 1,
        signature,
        timestamp
      }

      const result = await authManager.authenticate(credentials)
      const isValid = authManager.verifySession(result.sessionToken!)
      expect(isValid).toBe(true)
    })

    test('should reject invalid session token', () => {
      const isValid = authManager.verifySession('invalid-token')
      expect(isValid).toBe(false)
    })

    test('should get session information', async () => {
      const timestamp = Date.now()
      const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
      const signature = await wallet.signMessage(message)

      const credentials: AgentCredentials = {
        address: wallet.address,
        tokenId: 1,
        signature,
        timestamp
      }

      const result = await authManager.authenticate(credentials)
      const session = authManager.getSession(result.sessionToken!)

      expect(session).toBeDefined()
      expect(session!.address).toBe(wallet.address)
      expect(session!.tokenId).toBe(1)
    })

    test('should return null for invalid session token', () => {
      const session = authManager.getSession('invalid-token')
      expect(session).toBeNull()
    })

    test('should revoke session', async () => {
      const timestamp = Date.now()
      const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
      const signature = await wallet.signMessage(message)

      const credentials: AgentCredentials = {
        address: wallet.address,
        tokenId: 1,
        signature,
        timestamp
      }

      const result = await authManager.authenticate(credentials)
      authManager.revokeSession(result.sessionToken!)

      const isValid = authManager.verifySession(result.sessionToken!)
      expect(isValid).toBe(false)
    })

    test('should clean up expired sessions', async () => {
      // This is a time-based test that would need to manipulate time
      // For now, we just verify the method exists and doesn't throw
      expect(() => authManager.cleanupExpiredSessions()).not.toThrow()
    })
  })

  describe('Multiple Sessions', () => {
    test('should handle multiple concurrent sessions', async () => {
      const wallet1 = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890123')
      const wallet2 = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890124')

      const timestamp = Date.now()

      const message1 = `A2A Authentication\n\nAddress: ${wallet1.address}\nToken ID: 1\nTimestamp: ${timestamp}`
      const signature1 = await wallet1.signMessage(message1)

      const message2 = `A2A Authentication\n\nAddress: ${wallet2.address}\nToken ID: 2\nTimestamp: ${timestamp}`
      const signature2 = await wallet2.signMessage(message2)

      const result1 = await authManager.authenticate({
        address: wallet1.address,
        tokenId: 1,
        signature: signature1,
        timestamp
      })

      const result2 = await authManager.authenticate({
        address: wallet2.address,
        tokenId: 2,
        signature: signature2,
        timestamp
      })

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.sessionToken).not.toBe(result2.sessionToken)

      expect(authManager.verifySession(result1.sessionToken!)).toBe(true)
      expect(authManager.verifySession(result2.sessionToken!)).toBe(true)
    })
  })
})
