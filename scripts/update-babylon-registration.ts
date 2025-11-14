/**
 * Update Babylon Game Registration in Agent0 Network
 *
 * Updates existing on-chain registration with new capabilities and metadata
 * without minting a new NFT. Uploads new IPFS file and updates tokenURI.
 */

import { Agent0Client } from '../src/agents/agent0/Agent0Client'
import { prisma } from '../src/lib/database-service'
import { logger } from '../src/lib/logger'
import type { AgentCapabilities } from '../src/a2a/types'

async function updateBabylonRegistration() {
  try {
    console.log('🔄 Starting Babylon registration update...\n')

    // Check if already registered
    const config = await prisma.gameConfig.findUnique({
      where: { key: 'agent0_registration' }
    })

    if (!config?.value) {
      throw new Error('Babylon is not registered yet. Run bun run agent0:register first.')
    }

    const registrationData = config.value as Record<string, unknown>
    const tokenId = Number(registrationData.tokenId)

    console.log(`📋 Current Registration:`)
    console.log(`   Token ID: ${tokenId}`)
    console.log(`   Previous CID: ${registrationData.metadataCID}`)
    console.log(`   Registered: ${registrationData.registeredAt}\n`)

    // Initialize Agent0 SDK
    const gamePrivateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
    const gameWalletAddress = process.env.BABYLON_GAME_WALLET_ADDRESS

    if (!gamePrivateKey || !gameWalletAddress) {
      throw new Error('Missing BABYLON_GAME_PRIVATE_KEY or BABYLON_GAME_WALLET_ADDRESS')
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
    const ipfsConfig = process.env.PINATA_JWT
      ? { ipfsProvider: 'pinata' as const, pinataJwt: process.env.PINATA_JWT }
      : { ipfsProvider: 'node' as const, ipfsNodeUrl: process.env.IPFS_NODE_URL || 'https://ipfs.io' }

    const agent0Client = new Agent0Client({
      network: (process.env.AGENT0_NETWORK as 'sepolia' | 'mainnet') || 'sepolia',
      rpcUrl,
      privateKey: gamePrivateKey,
      ...ipfsConfig
    })

    // Ensure SDK is initialized
    await agent0Client['ensureSDK']()
    const sdk = agent0Client.getSDK()

    if (!sdk) {
      throw new Error('Failed to initialize Agent0 SDK')
    }

    console.log('📥 Loading existing agent from registry...')
    const chainId = (process.env.AGENT0_NETWORK === 'mainnet') ? 1 : 11155111
    const agentId = `${chainId}:${tokenId}` as `${number}:${number}`

    // Load existing agent
    const agent = await sdk.loadAgent(agentId)
    console.log(`✅ Loaded agent: ${agent.name}\n`)

    // Update with comprehensive capabilities
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000'

    console.log('🔧 Updating agent information...')

    agent.updateInfo(
      'Babylon Prediction Markets',
      'Real-time prediction market game with autonomous AI agents, liquidity pools, and social features'
    )

    // Update endpoints (with version and flags as per SDK requirements)
    await agent.setMCP(`${apiBaseUrl}/mcp`, '1.0.0', false)
    await agent.setA2A(process.env.NEXT_PUBLIC_A2A_ENDPOINT || `${apiBaseUrl.replace('http', 'ws')}/ws/a2a`, '1.0.0', false)

    // Update wallet
    agent.setAgentWallet(gameWalletAddress as `0x${string}`, chainId)

    // Update metadata with comprehensive capabilities
    agent.setMetadata({
      version: '1.0.0',
      type: 'game-platform',
      capabilities: {
        strategies: [],
        markets: ['prediction', 'perpetuals', 'pools'],
        actions: [
          // Market Operations
          'query_markets', 'get_market_data', 'place_bet',
          'buy_prediction', 'sell_prediction',
          'close_position', 'get_balance', 'get_positions',
          'open_perp_position', 'close_perp_position',
          // Liquidity Pools
          'get_pools', 'get_pool_info',
          'deposit_pool', 'withdraw_pool', 'get_pool_deposits',
          // Social Features
          'create_post', 'reply_post', 'like_post',
          'share_post', 'comment_post',
          'follow_user', 'unfollow_user',
          'get_followers', 'get_following',
          // Discovery & Search
          'search_users', 'get_user_profile',
          'query_feed', 'join_chat',
          // Referrals & Rewards
          'get_referral_code', 'get_referrals'
        ],
        protocols: ['a2a', 'mcp', 'rest'],
        version: '1.0.0'
      } as AgentCapabilities,
      metadata: {
        network: process.env.AGENT0_NETWORK || 'sepolia',
        startingBalance: 1000,
        categories: ['crypto', 'politics', 'sports', 'tech', 'entertainment'],
        updateFrequency: '60s',
        maxLeverage: 100,
        socialFeatures: true,
        realtime: true,
        authentication: ['privy', 'agent-secret', 'wallet-signature']
      }
    })

    // Set status
    agent.setActive(true)
    agent.setX402Support(false) // Free to use

    console.log('📤 Re-registering with updated metadata...')
    console.log('   (This uploads new IPFS file and updates on-chain URI)')
    console.log('   Step 1/3: Uploading metadata to IPFS...')

    // Re-register with timeout (updates IPFS and on-chain URI)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out after 5 minutes')), 5 * 60 * 1000)
    })

    const registrationPromise = (async () => {
      console.log('   Step 2/3: Submitting on-chain transaction...')
      const result = await agent.registerIPFS()
      console.log('   Step 3/3: Waiting for transaction confirmation...')
      return result
    })()

    const registrationFile = await Promise.race([registrationPromise, timeoutPromise])

    const newMetadataCID = registrationFile.agentURI?.replace('ipfs://', '') || ''

    console.log('✅ Registration updated successfully!\n')
    console.log(`📋 Updated Registration:`)
    console.log(`   Token ID: ${tokenId} (unchanged)`)
    console.log(`   New Metadata CID: ${newMetadataCID}`)
    console.log(`   Agent ID: ${agentId}`)
    console.log(`   Active: ${registrationFile.active}`)
    console.log(`   X402 Support: ${registrationFile.x402support}\n`)

    // Update database
    await prisma.gameConfig.update({
      where: { key: 'agent0_registration' },
      data: {
        value: {
          registered: true,
          tokenId,
          metadataCID: newMetadataCID,
          txHash: registrationData.txHash, // Keep original registration tx
          registeredAt: registrationData.registeredAt, // Keep original date
          lastUpdated: new Date().toISOString()
        }
      }
    })

    console.log('💾 Database updated with new metadata CID\n')
    console.log('🌐 View updated metadata:')
    console.log(`   https://ipfs.io/ipfs/${newMetadataCID}`)
    console.log(`   https://gateway.pinata.cloud/ipfs/${newMetadataCID}\n`)

    console.log('✨ All done! Your registration is now up to date.')
    console.log('   Subgraph will automatically index the changes.\n')

  } catch (error) {
    console.error('❌ Update failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateBabylonRegistration()
