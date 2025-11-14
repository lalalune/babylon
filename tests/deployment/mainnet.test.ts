/**
 * Mainnet Deployment Readiness Tests
 * 
 * Tests to ensure mainnet deployment safety and readiness
 */

import { describe, test, expect } from 'bun:test'
import { validateEnvironment } from '../../src/lib/deployment/env-detection'

describe('Mainnet Deployment Readiness', () => {
  test('Environment detection works for mainnet', () => {
    const result = validateEnvironment('mainnet')
    expect(result.environment).toBe('mainnet')
    expect(result.config.chainId).toBe(8453)
    expect(result.config.name).toBe('Base')
  })

  test('Mainnet deployment script exists', () => {
    const fs = require('fs')
    const path = require('path')

    const scriptPath = path.join(process.cwd(), 'scripts/deployment/deploy-mainnet.ts')
    expect(fs.existsSync(scriptPath)).toBe(true)
  })

  test('Mainnet deployment requires USE_MAINNET=true', () => {
    // Save original value
    const originalValue = process.env.USE_MAINNET

    // Test without USE_MAINNET
    delete process.env.USE_MAINNET
    const result1 = validateEnvironment('mainnet')
    expect(result1.valid).toBe(false)
    expect(result1.errors.some(e => e.includes('USE_MAINNET'))).toBe(true)

    // Test with USE_MAINNET=false
    process.env.USE_MAINNET = 'false'
    const result2 = validateEnvironment('mainnet')
    expect(result2.valid).toBe(false)

    // Restore original value
    if (originalValue) {
      process.env.USE_MAINNET = originalValue
    } else {
      delete process.env.USE_MAINNET
    }
  })

  test('Mainnet requires all critical environment variables', () => {
    const originalEnv = { ...process.env }

    // Set USE_MAINNET
    process.env.USE_MAINNET = 'true'

    // Test with missing variables
    delete process.env.NEXT_PUBLIC_DIAMOND_ADDRESS
    delete process.env.ETHERSCAN_API_KEY

    const result = validateEnvironment('mainnet')
    expect(result.errors.length).toBeGreaterThan(0)

    // Restore environment
    process.env = originalEnv
  })

  test('Deployment safety checks are in place', () => {
    const fs = require('fs')
    const path = require('path')

    const scriptPath = path.join(process.cwd(), 'scripts/deployment/deploy-mainnet.ts')
    const script = fs.readFileSync(scriptPath, 'utf-8')

    // Check for safety features
    expect(script).toContain('USE_MAINNET')
    expect(script).toContain('simulation')
    expect(script).toContain('confirmation')
    expect(script).toContain('DEPLOY TO MAINNET')

    console.log('✅ Mainnet deployment has required safety checks')
  })

  test('Gas estimation is included in mainnet deployment', () => {
    const fs = require('fs')
    const path = require('path')

    const scriptPath = path.join(process.cwd(), 'scripts/deployment/deploy-mainnet.ts')
    const script = fs.readFileSync(scriptPath, 'utf-8')

    expect(script).toContain('gas')
    expect(script).toContain('estimate')

    console.log('✅ Mainnet deployment includes gas estimation')
  })
})

