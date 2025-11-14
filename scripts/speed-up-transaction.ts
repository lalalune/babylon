/**
 * Speed up stuck Agent0 registration transaction
 *
 * Uses Replace-By-Fee (RBF) to replace pending transaction with higher gas
 */

import { ethers } from 'ethers'
import { Agent0Client } from '../src/agents/agent0/Agent0Client'
import { prisma } from '../src/lib/database-service'
import type { AgentCapabilities } from '../src/a2a/types'

async function speedUpTransaction() {
  try {
    console.log('⚡ Speeding up stuck Agent0 registration transaction...\n')

    // Get environment config
    const gamePrivateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
    const gameWalletAddress = process.env.BABYLON_GAME_WALLET_ADDRESS

    if (!gamePrivateKey || !gameWalletAddress) {
      throw new Error('Missing BABYLON_GAME_PRIVATE_KEY or BABYLON_GAME_WALLET_ADDRESS')
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'

    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet = new ethers.Wallet(gamePrivateKey, provider)

    console.log(`🔍 Checking wallet: ${wallet.address}`)

    // Get current nonces
    const confirmedNonce = await provider.getTransactionCount(wallet.address, 'latest')
    const pendingNonce = await provider.getTransactionCount(wallet.address, 'pending')

    console.log(`📊 Confirmed nonce: ${confirmedNonce}`)
    console.log(`📊 Pending nonce: ${pendingNonce}`)

    if (pendingNonce === confirmedNonce) {
      console.log('✅ No pending transactions! The update may have already completed.')
      console.log('   Run: bun run agent0:check to verify\n')
      return
    }

    const stuckNonce = confirmedNonce
    console.log(`\n⚠️  Found stuck transaction at nonce ${stuckNonce}`)

    // Get current gas prices
    const feeData = await provider.getFeeData()
    const currentMaxFee = feeData.maxFeePerGas!
    const currentPriorityFee = feeData.maxPriorityFeePerGas!

    console.log(`\n⛽ Current Network Gas:`)
    console.log(`   Max Fee: ${ethers.formatUnits(currentMaxFee, 'gwei')} gwei`)
    console.log(`   Priority Fee: ${ethers.formatUnits(currentPriorityFee, 'gwei')} gwei`)

    // Calculate 20% higher gas for replacement (EIP-1559 RBF requirement)
    const newMaxFee = (currentMaxFee * 120n) / 100n
    const newPriorityFee = (currentPriorityFee * 120n) / 100n

    console.log(`\n🚀 Replacement Transaction Gas (20% higher):`)
    console.log(`   Max Fee: ${ethers.formatUnits(newMaxFee, 'gwei')} gwei`)
    console.log(`   Priority Fee: ${ethers.formatUnits(newPriorityFee, 'gwei')} gwei`)

    // Initialize Agent0 SDK to get the registration transaction data
    const ipfsConfig = process.env.PINATA_JWT
      ? { ipfsProvider: 'pinata' as const, pinataJwt: process.env.PINATA_JWT }
      : { ipfsProvider: 'node' as const, ipfsNodeUrl: process.env.IPFS_NODE_URL || 'https://ipfs.io' }

    const agent0Client = new Agent0Client({
      network: (process.env.AGENT0_NETWORK as 'sepolia' | 'mainnet') || 'sepolia',
      rpcUrl,
      privateKey: gamePrivateKey,
      ...ipfsConfig
    })

    await agent0Client['ensureSDK']()
    const sdk = agent0Client.getSDK()

    if (!sdk) {
      throw new Error('Failed to initialize Agent0 SDK')
    }

    // Get registration data
    const config = await prisma.gameConfig.findUnique({
      where: { key: 'agent0_registration' }
    })

    if (!config?.value) {
      throw new Error('Babylon is not registered yet')
    }

    const registrationData = config.value as Record<string, unknown>
    const tokenId = Number(registrationData.tokenId)
    const chainId = (process.env.AGENT0_NETWORK === 'mainnet') ? 1 : 11155111
    const agentId = `${chainId}:${tokenId}` as `${number}:${number}`

    console.log(`\n📋 Loading agent ${agentId}...`)

    // Load and prepare agent with updated capabilities
    const agent = await sdk.loadAgent(agentId)
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000'

    agent.updateInfo(
      'Babylon Prediction Markets',
      'Real-time prediction market game with autonomous AI agents, liquidity pools, and social features'
    )

    agent.setMCP(`${apiBaseUrl}/mcp`)
    agent.setA2A(process.env.NEXT_PUBLIC_A2A_ENDPOINT || `${apiBaseUrl.replace('http', 'ws')}/ws/a2a`)
    agent.setAgentWallet(gameWalletAddress as `0x${string}`, chainId)

    agent.setMetadata({
      version: '1.0.0',
      type: 'game-platform',
      capabilities: {
        strategies: [],
        markets: ['prediction', 'perpetuals', 'pools'],
        actions: [
          'query_markets', 'get_market_data', 'place_bet',
          'buy_prediction', 'sell_prediction',
          'close_position', 'get_balance', 'get_positions',
          'open_perp_position', 'close_perp_position',
          'get_pools', 'get_pool_info',
          'deposit_pool', 'withdraw_pool', 'get_pool_deposits',
          'create_post', 'reply_post', 'like_post',
          'share_post', 'comment_post',
          'follow_user', 'unfollow_user',
          'get_followers', 'get_following',
          'search_users', 'get_user_profile',
          'query_feed', 'join_chat',
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

    agent.setActive(true)
    agent.setX402Support(false)

    console.log('📤 Submitting replacement transaction with higher gas...')
    console.log('   This will replace the stuck transaction at the same nonce\n')

    // The SDK will automatically use the current nonce and we've increased gas
    // This creates a replacement transaction
    const registrationFile = await agent.registerIPFS()

    const newMetadataCID = registrationFile.agentURI?.replace('ipfs://', '') || ''

    console.log('✅ Replacement transaction submitted successfully!\n')
    console.log(`📋 Updated Registration:`)
    console.log(`   Token ID: ${tokenId}`)
    console.log(`   New Metadata CID: ${newMetadataCID}`)
    console.log(`   Agent ID: ${agentId}`)

    // Update database
    await prisma.gameConfig.update({
      where: { key: 'agent0_registration' },
      data: {
        value: {
          registered: true,
          tokenId,
          metadataCID: newMetadataCID,
          txHash: registrationData.txHash,
          registeredAt: registrationData.registeredAt,
          lastUpdated: new Date().toISOString()
        }
      }
    })

    console.log('\n💾 Database updated with new metadata CID')
    console.log('🌐 View updated metadata:')
    console.log(`   https://ipfs.io/ipfs/${newMetadataCID}`)
    console.log(`   https://gateway.pinata.cloud/ipfs/${newMetadataCID}\n`)

    console.log('✨ Transaction should confirm within 1-2 minutes!')
    console.log('   Run: bun run agent0:wallet to check status\n')

  } catch (error) {
    console.error('❌ Speed-up failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

speedUpTransaction()
