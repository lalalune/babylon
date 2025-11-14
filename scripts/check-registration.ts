/**
 * Check Babylon's Agent0 Registration Status
 * 
 * Verifies that Babylon is properly registered in the Agent0 registry
 */

import { execSync } from 'child_process'
import { prisma } from '../src/lib/database-service'
import { logger } from '../src/lib/logger'

async function main() {
  console.log('🔍 Checking Babylon Registration Status...\n')
  
  // 1. Check environment variables
  console.log('📋 Environment Variables:')
  console.log(`   AGENT0_ENABLED: ${process.env.AGENT0_ENABLED}`)
  console.log(`   AGENT0_NETWORK: ${process.env.AGENT0_NETWORK}`)
  console.log(`   BABYLON_REGISTRY_REGISTERED: ${process.env.BABYLON_REGISTRY_REGISTERED}`)
  console.log(`   BABYLON_GAME_WALLET_ADDRESS: ${process.env.BABYLON_GAME_WALLET_ADDRESS}`)
  console.log(`   PINATA_JWT: ${process.env.PINATA_JWT ? '✅ Set' : '❌ Not set'}`)
  console.log()
  
  // 2. Check database registration (optional - may not be available in all environments)
  let tokenId: number | undefined
  
  try {
    const config = await prisma.gameConfig.findUnique({
      where: { key: 'agent0_registration' }
    })
    
    if (config?.value && typeof config.value === 'object' && 'tokenId' in config.value) {
      console.log('✅ Database Registration Found:')
      console.log(`   Token ID: ${config.value.tokenId}`)
      console.log(`   Metadata CID: ${config.value.metadataCID}`)
      console.log(`   Registered At: ${config.value.registeredAt}`)
      console.log()
      
      tokenId = Number(config.value.tokenId)
      
      // 3. Check on-chain registration (Agent0 official registry)
      // Use Agent0 official registry (hardcoded in SDK)
      const registryAddress = '0x8004a6090Cd10A7288092483047B097295Fb8847'
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
      
      console.log('🔗 Checking On-Chain Registration (Agent0 Official Registry):')
      console.log(`   Registry: ${registryAddress}`)
      console.log(`   Token ID: ${tokenId}`)
      console.log()
      
      try {
        const owner = execSync(
          `cast call ${registryAddress} "ownerOf(uint256)(address)" ${tokenId} --rpc-url ${rpcUrl}`,
          { encoding: 'utf-8' }
        ).trim()
        
        console.log('✅ On-chain registration confirmed!')
        console.log(`   Owner: ${owner}`)
        
        if (owner.toLowerCase() === process.env.BABYLON_GAME_WALLET_ADDRESS?.toLowerCase()) {
          console.log('✅ Owner matches BABYLON_GAME_WALLET_ADDRESS')
        } else {
          console.log('⚠️  Owner does NOT match BABYLON_GAME_WALLET_ADDRESS')
          console.log(`   Expected: ${process.env.BABYLON_GAME_WALLET_ADDRESS}`)
        }
        console.log()
        
        // Get token URI
        const tokenURI = execSync(
          `cast call ${registryAddress} "tokenURI(uint256)(string)" ${tokenId} --rpc-url ${rpcUrl}`,
          { encoding: 'utf-8' }
        ).trim().replace(/"/g, '')
        
        console.log('📄 Token URI:')
        console.log(`   ${tokenURI}`)
        console.log()
        
        // Provide IPFS gateway link
        const cid = tokenURI.replace('ipfs://', '')
        console.log('🌐 View metadata:')
        console.log(`   https://ipfs.io/ipfs/${cid}`)
        console.log(`   https://gateway.pinata.cloud/ipfs/${cid}`)
        console.log()
        
      } catch (error) {
        console.error('❌ On-chain check failed:', error)
      }
    } else {
      console.log('⚠️  No registration found in database')
      console.log('   Run: bun run agent0:register')
      console.log()
    }
  } catch (error) {
    console.log('⚠️  Database not available (this is OK for checking on-chain status)')
    console.log()
    
    // If database is not available, try to get token ID from environment or prompt
    if (process.env.BABYLON_REGISTRY_REGISTERED === 'true') {
      console.log('💡 Checking on-chain with latest known token ID...')
      console.log('   You can also manually check with: cast call 0x8004a6090Cd10A7288092483047B097295Fb8847 "ownerOf(uint256)(address)" <TOKEN_ID> --rpc-url https://ethereum-sepolia-rpc.publicnode.com')
      console.log()
      
      // Try the latest token ID from our registration (989)
      tokenId = 989
      
      const registryAddress = '0x8004a6090Cd10A7288092483047B097295Fb8847'
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
      
      console.log('🔗 Checking On-Chain Registration (Agent0 Official Registry):')
      console.log(`   Registry: ${registryAddress}`)
      console.log(`   Token ID: ${tokenId}`)
      console.log()
      
      try {
        const owner = execSync(
          `cast call ${registryAddress} "ownerOf(uint256)(address)" ${tokenId} --rpc-url ${rpcUrl}`,
          { encoding: 'utf-8' }
        ).trim()
        
        console.log('✅ On-chain registration confirmed!')
        console.log(`   Owner: ${owner}`)
        
        if (owner.toLowerCase() === process.env.BABYLON_GAME_WALLET_ADDRESS?.toLowerCase()) {
          console.log('✅ Owner matches BABYLON_GAME_WALLET_ADDRESS')
        } else {
          console.log('⚠️  Owner does NOT match BABYLON_GAME_WALLET_ADDRESS')
          console.log(`   Expected: ${process.env.BABYLON_GAME_WALLET_ADDRESS}`)
        }
        console.log()
        
        // Get token URI
        const tokenURI = execSync(
          `cast call ${registryAddress} "tokenURI(uint256)(string)" ${tokenId} --rpc-url ${rpcUrl}`,
          { encoding: 'utf-8' }
        ).trim().replace(/"/g, '')
        
        console.log('📄 Token URI:')
        console.log(`   ${tokenURI}`)
        console.log()
        
        // Provide IPFS gateway link
        const cid = tokenURI.replace('ipfs://', '')
        console.log('🌐 View metadata:')
        console.log(`   https://ipfs.io/ipfs/${cid}`)
        console.log(`   https://gateway.pinata.cloud/ipfs/${cid}`)
        console.log()
        
      } catch (error) {
        console.error('❌ On-chain check failed:', error)
      }
    }
  }
  
  try {
    await prisma.$disconnect()
  } catch (error) {
    // Ignore disconnect errors if database was never connected
  }
}

main()
