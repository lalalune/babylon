/**
 * A2A Authentication Manager
 * Handles agent authentication via ERC-8004 signatures
 */

import { verifyMessage, hexlify, randomBytes } from 'ethers'
import type { AgentCredentials } from '../types'
import type { RegistryClient } from '@/types/a2a-server'
import type { IAgent0Client } from '@/agents/agent0/types'
import { logger } from '../utils/logger'

interface AuthResult {
  success: boolean
  sessionToken?: string
  error?: string
}

export class AuthManager {
  private sessions: Map<string, { address: string; tokenId: number; expiresAt: number }> = new Map()
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private registryClient: RegistryClient | null = null
  private agent0Client: IAgent0Client | null = null // Agent0Client - optional for external agent verification

  constructor(registryClient?: RegistryClient, agent0Client?: IAgent0Client | null) {
    this.registryClient = registryClient || null
    this.agent0Client = agent0Client || null
  }

  /**
   * Authenticate agent credentials via signature verification
   */
  async authenticate(credentials: AgentCredentials): Promise<AuthResult> {
    const now = Date.now()
    const timeDiff = Math.abs(now - credentials.timestamp)
    if (timeDiff > 5 * 60 * 1000) {
      return { success: false, error: 'Timestamp expired' }
    }

    const message = this.createAuthMessage(credentials.address, credentials.tokenId, credentials.timestamp)
    const recoveredAddress = verifyMessage(message, credentials.signature)

    if (recoveredAddress.toLowerCase() !== credentials.address.toLowerCase()) {
      return { success: false, error: 'Invalid signature' }
    }

    let isValid = false
    
    if (this.registryClient?.verifyAgent) {
      isValid = await this.registryClient.verifyAgent(credentials.address, credentials.tokenId)
      
      if (isValid) {
        logger.debug(`Agent verified via ERC-8004: ${credentials.address}:${credentials.tokenId}`)
      }
    }
    
    if (!isValid && this.agent0Client) {
      const profile = await this.agent0Client.getAgentProfile(credentials.tokenId)
      
      if (profile?.walletAddress?.toLowerCase() === credentials.address.toLowerCase()) {
        isValid = true
        logger.debug(`Agent verified via Agent0: ${credentials.address}:${credentials.tokenId}`)
      }
    }
    
    if (!this.registryClient && !this.agent0Client) {
      logger.warn('No registry client or Agent0 client available - skipping agent verification (development mode)')
      isValid = true
    }
    
    if (!isValid) {
      return { success: false, error: 'Agent does not own the specified token ID' }
    }

    const sessionToken = this.generateSessionToken()
    const expiresAt = now + this.SESSION_DURATION

    this.sessions.set(sessionToken, {
      address: credentials.address,
      tokenId: credentials.tokenId,
      expiresAt
    })

    return { success: true, sessionToken }
  }

  /**
   * Verify session token is valid
   */
  verifySession(sessionToken: string): boolean {
    const session = this.sessions.get(sessionToken)
    if (!session) return false

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken)
      return false
    }

    return true
  }

  /**
   * Get session info
   */
  getSession(sessionToken: string): { address: string; tokenId: number } | null {
    const session = this.sessions.get(sessionToken)
    if (!session || Date.now() > session.expiresAt) {
      return null
    }

    return {
      address: session.address,
      tokenId: session.tokenId
    }
  }

  /**
   * Revoke a session
   */
  revokeSession(sessionToken: string): void {
    this.sessions.delete(sessionToken)
  }

  /**
   * Create authentication message for signing
   */
  private createAuthMessage(address: string, tokenId: number, timestamp: number): string {
    return `A2A Authentication\n\nAddress: ${address}\nToken ID: ${tokenId}\nTimestamp: ${timestamp}`
  }

  /**
   * Generate random session token
   */
  private generateSessionToken(): string {
    return hexlify(randomBytes(32))
  }

  /**
   * Clean up expired sessions (should be called periodically)
   */
  cleanupExpiredSessions(): void {
    const now = Date.now()
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token)
      }
    }
  }
}
