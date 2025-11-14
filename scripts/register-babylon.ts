/**
 * Register Babylon with Agent0
 * 
 * This script registers Babylon as a discoverable entity in the Agent0 registry.
 * It should be run once after deployment.
 */

import { registerBabylonGame } from '../src/lib/babylon-registry-init'
import { logger } from '../src/lib/logger'

async function main() {
  try {
    logger.info('Starting Babylon registration with Agent0...', undefined, 'RegisterScript')
    
    const result = await registerBabylonGame()
    
    if (result) {
      console.log('\n✅ Registration successful!')
      console.log(`   Token ID: ${result.tokenId}`)
      console.log(`   Metadata CID: ${result.metadataCID}`)
      console.log(`   Registered at: ${result.registeredAt}`)
      console.log('\nNext steps:')
      console.log('1. Set BABYLON_REGISTRY_REGISTERED=true in your .env file')
      console.log('2. Verify registration: bun run agent0:check')
      console.log('3. View on IPFS: https://ipfs.io/ipfs/' + result.metadataCID)
    } else {
      console.log('\n⚠️  Registration skipped (already registered or disabled)')
    }
  } catch (error) {
    console.error('\n❌ Registration failed:', error)
    process.exit(1)
  }
}

main()
