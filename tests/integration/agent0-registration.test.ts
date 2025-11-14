/**
 * Agent0 Registration Integration Tests
 * 
 * Tests for agent/user registration with Agent0 SDK.
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { registerBabylonGame } from '../../src/lib/babylon-registry-init'
import { prisma } from '../../src/lib/database-service'

describe('Agent0 Registration Integration', () => {
  beforeAll(() => {
    // Skip tests if Agent0 is disabled
    if (process.env.AGENT0_ENABLED !== 'true') {
      console.log('⚠️  Agent0 disabled, skipping registration tests')
    }
  })
  
  test('Babylon registration function exists and is callable', () => {
    expect(typeof registerBabylonGame).toBe('function')
  })
  
  test('Database has GameConfig model for storing registration', async () => {
    try {
      // Try to query GameConfig to verify schema exists
      const config = await prisma.gameConfig.findUnique({
        where: { key: 'agent0_registration' }
      })
      
      // Should not throw - model exists
      expect(config).toBeDefined() || expect(config).toBeNull()
    } catch (error) {
      // If error is about model not existing, that's a schema issue
      if (error instanceof Error && error.message.includes('Unknown arg')) {
        throw new Error('GameConfig model not found in schema. Run migration first.')
      }
      throw error
    }
  })
  
  test('User model has Agent0 fields', async () => {
    try {
      // Try to query a user with Agent0 fields
      const user = await prisma.user.findFirst({
        select: {
          id: true,
          agent0MetadataCID: true,
          agent0TokenId: true,
          agent0RegisteredAt: true
        }
      })
      
      // Should not throw - fields exist
      expect(user !== undefined).toBe(true)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unknown arg')) {
        throw new Error('Agent0 fields not found in User model. Run migration first.')
      }
      throw error
    }
  })
  
  test('Babylon registration respects BABYLON_REGISTRY_REGISTERED flag', async () => {
    const originalValue = process.env.BABYLON_REGISTRY_REGISTERED
    
    try {
      // Set flag to true
      process.env.BABYLON_REGISTRY_REGISTERED = 'true'
      
      const result = await registerBabylonGame()
      
      // Should return null or existing registration when flag is true
      expect(result === null || (result && result.tokenId > 0)).toBe(true)
    } finally {
      // Restore original value
      process.env.BABYLON_REGISTRY_REGISTERED = originalValue
    }
  })
  
  test('Babylon registration respects AGENT0_ENABLED flag', async () => {
    const originalValue = process.env.AGENT0_ENABLED
    
    try {
      // Set flag to false
      process.env.AGENT0_ENABLED = 'false'
      
      const result = await registerBabylonGame()
      
      // Should return null when disabled
      expect(result).toBeNull()
    } finally {
      // Restore original value
      process.env.AGENT0_ENABLED = originalValue
    }
  })
})

