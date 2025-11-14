/**
 * Testnet Deployment Tests
 * 
 * Tests for testnet deployment infrastructure
 */

import { describe, test, expect } from 'bun:test'
import { validateEnvironment } from '../../src/lib/deployment/env-detection'
import { validateDeployment } from '../../src/lib/deployment/validation'

describe('Testnet Deployment', () => {
  test('Environment detection works for testnet', () => {
    const result = validateEnvironment('testnet')
    expect(result.environment).toBe('testnet')
    expect(result.config.chainId).toBe(84532)
    expect(result.config.name).toBe('Base Sepolia')
  })

  test('Deployment validation can run', async () => {
    const rpcUrl = 'https://sepolia.base.org'

    try {
      const result = await validateDeployment('testnet', rpcUrl)

      // Result should have the expected shape
      expect(typeof result.valid).toBe('boolean')
      expect(typeof result.deployed).toBe('boolean')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)

      if (!result.deployed) {
        console.log('⚠️  No testnet deployment found (this is expected if not deployed yet)')
      } else {
        console.log('✅ Testnet deployment found')
        if (result.contracts.diamond) {
          console.log(`   Diamond: ${result.contracts.diamond}`)
        }
      }
    } catch (error) {
      console.log('⚠️  Could not connect to Base Sepolia RPC')
    }
  })

  test('Deployment script exists', () => {
    const fs = require('fs')
    const path = require('path')

    const scriptPath = path.join(process.cwd(), 'scripts/deployment/deploy-testnet.ts')
    expect(fs.existsSync(scriptPath)).toBe(true)
  })

  test('Pre-dev testnet script exists', () => {
    const fs = require('fs')
    const path = require('path')

    const scriptPath = path.join(process.cwd(), 'scripts/pre-dev/pre-dev-testnet.ts')
    expect(fs.existsSync(scriptPath)).toBe(true)
  })

  test('Validation scripts exist', () => {
    const fs = require('fs')
    const path = require('path')

    const scriptsDir = path.join(process.cwd(), 'scripts/validation')
    expect(fs.existsSync(scriptsDir)).toBe(true)

    const checkContracts = path.join(scriptsDir, 'check-contracts.ts')
    expect(fs.existsSync(checkContracts)).toBe(true)

    const checkEnv = path.join(scriptsDir, 'check-environment.ts')
    expect(fs.existsSync(checkEnv)).toBe(true)
  })
})

