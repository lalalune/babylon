/**
 * Register Babylon on Agent0 Registry
 * 
 * This script registers Babylon as an agent on the official Agent0 ERC-8004 registry
 * This makes Babylon discoverable by other agents via Agent0 subgraph
 * 
 * Prerequisites:
 * - BABYLON_AGENT0_PRIVATE_KEY set in .env
 * - BASE_SEPOLIA_RPC_URL set in .env
 * - PINATA_JWT set in .env (for IPFS metadata storage)
 * - Wallet must have Base Sepolia ETH for gas
 * 
 * Run: bun run scripts/register-babylon-agent0.ts
 */

import { SDK } from 'agent0-sdk'
import { prisma } from '../src/lib/prisma'
import { generateSnowflakeId } from '../src/lib/snowflake'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://babylon.game'

async function registerBabylonOnAgent0() {
  console.log('🤖 Registering Babylon on Agent0 Registry...\n')
  
  // Validate environment variables
  if (!process.env.BABYLON_AGENT0_PRIVATE_KEY) {
    throw new Error('BABYLON_AGENT0_PRIVATE_KEY not set in environment')
  }
  
  if (!process.env.BASE_SEPOLIA_RPC_URL) {
    throw new Error('BASE_SEPOLIA_RPC_URL not set in environment')
  }
  
  if (!process.env.PINATA_JWT) {
    throw new Error('PINATA_JWT not set in environment (needed for IPFS metadata storage)')
  }
  
  // Initialize Agent0 SDK
  console.log('📡 Initializing Agent0 SDK...')
  const sdk = new SDK({
    chainId: 84532,  // Base Sepolia
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
    signer: process.env.BABYLON_AGENT0_PRIVATE_KEY,
    ipfs: 'pinata',
    pinataJwt: process.env.PINATA_JWT
  })
  
  console.log('✅ SDK initialized')
  console.log(`   Chain: Base Sepolia (84532)`)
  console.log(`   Signer: ${sdk.web3Client.address || 'Unknown'}`)
  
  // Check if already registered
  const existingConfig = await prisma.gameConfig.findUnique({
    where: { key: 'agent0_registration' }
  })
  type Agent0Config = {
    agentId?: string
    tokenId?: number
  }
  const configValue = (existingConfig?.value ?? null) as Agent0Config | null
  
  if (configValue?.agentId) {
    console.log('\n⚠️  Babylon is already registered!')
    console.log(`   Agent ID: ${configValue.agentId}`)
    console.log(`   Token ID: ${configValue.tokenId}`)
    console.log('\n   To update registration, delete the gameConfig entry and re-run this script.')
    
    // Show current registration details
    const agentId = configValue.agentId as string
    try {
      const agent = await sdk.getAgent(agentId)
      if (agent) {
        const extendedAgent = agent as unknown as Record<string, unknown>
        const endpointValue = extendedAgent['a2aEndpoint']
        const a2aEndpoint = typeof endpointValue === 'string'
          ? endpointValue
          : 'Not set'
        const skillsValue = extendedAgent['a2aSkills']
        const a2aSkills = Array.isArray(skillsValue)
          ? (skillsValue as string[])
          : undefined
        console.log('\n📊 Current Registration:')
        console.log(`   Name: ${agent.name}`)
        console.log(`   Description: ${agent.description}`)
        console.log(`   A2A Endpoint: ${a2aEndpoint}`)
        console.log(`   Active: ${agent.active}`)
        console.log(`   Skills: ${a2aSkills?.join(', ') || 'None'}`)
      }
    } catch (error) {
      console.log('   (Could not fetch current registration details)')
    }
    
    return
  }
  
  console.log('\n📝 Creating Babylon agent...')
  
  // Create Babylon agent
  const babylon = sdk.createAgent(
    'Babylon Game',
    'AI-native prediction market and social trading game where agents trade on political, economic, and social events, open leveraged positions, post on social feeds, and compete with other agents for profits and reputation.'
  )
  
  // Set image/icon
  babylon.updateInfo(
    undefined,  // name (keep as-is)
    undefined,  // description (keep as-is)
    `${BASE_URL}/favicon.svg`  // image
  )
  
  console.log('✅ Agent created')
  
  // Set A2A endpoint (will auto-fetch skills from agent card)
  console.log('\n🔗 Setting A2A endpoint...')
  await babylon.setA2A(
    `${BASE_URL}/.well-known/agent-card.json`,
    '0.3.0',  // A2A protocol version
    true      // auto-fetch skills from agent card
  )
  
  console.log('✅ A2A endpoint set')
  console.log(`   URL: ${BASE_URL}/.well-known/agent-card.json`)
  console.log(`   Auto-fetched skills from agent card`)
  
  // Set agent wallet (if configured)
  if (process.env.BABYLON_WALLET_ADDRESS) {
    console.log('\n💰 Setting agent wallet...')
    babylon.setAgentWallet(
      process.env.BABYLON_WALLET_ADDRESS,
      84532  // Base Sepolia
    )
    console.log('✅ Wallet set:', process.env.BABYLON_WALLET_ADDRESS)
  }
  
  // Set agent as active
  babylon.setActive(true)
  
  // Set x402 support (micropayments)
  babylon.setX402Support(false)  // Not implementing x402 yet
  
  // Set trust models
  babylon.setTrust(
    true,   // reputation-based trust
    false,  // crypto-economic trust
    false   // TEE attestation
  )
  
  console.log('\n📤 Registering on-chain (this will take 30-60 seconds)...')
  console.log('   Step 1: Minting ERC-8004 NFT')
  console.log('   Step 2: Uploading metadata to IPFS via Pinata')
  console.log('   Step 3: Setting token URI on-chain')
  console.log('   Step 4: Waiting for confirmation')
  
  try {
    // Register on-chain with IPFS metadata storage
    const registration = await babylon.registerIPFS()
    if (!registration.agentId) {
      throw new Error('Agent0 registration did not return agentId')
    }
    
    console.log('\n✅ Babylon successfully registered on Agent0!')
    console.log(`   Agent ID: ${registration.agentId}`)
    console.log(`   Token URI: ${registration.agentURI}`)
    console.log(`   Updated At: ${new Date(registration.updatedAt * 1000).toISOString()}`)
    
    // Parse agent ID to get token ID
    if (!registration.agentId) {
      throw new Error('Agent ID is required for registration')
    }
    if (!registration.agentURI) {
      throw new Error('Agent URI is required for registration')
    }
    const [chainId, tokenIdStr] = registration.agentId.split(':')
    if (!tokenIdStr || !chainId) {
      throw new Error(`Invalid agentId returned: ${registration.agentId}`)
    }
    const tokenId = parseInt(tokenIdStr, 10)
    const chainIdNum = parseInt(chainId, 10)
    const walletAddress = sdk.web3Client.address
    if (!walletAddress) {
      throw new Error('Wallet address is required')
    }
    
    // Save to database
    console.log('\n💾 Saving to database...')
    const now = new Date()
    
    await prisma.gameConfig.upsert({
      where: { key: 'agent0_registration' },
      create: {
        id: await generateSnowflakeId(),
        key: 'agent0_registration',
        value: {
          agentId: registration.agentId,
          tokenId,
          chainId: chainIdNum,
          agentURI: registration.agentURI,
          registeredAt: now.toISOString(),
          registeredBy: walletAddress
        },
        createdAt: now,
        updatedAt: now
      },
      update: {
        value: {
          agentId: registration.agentId,
          tokenId,
          chainId: chainIdNum,
          agentURI: registration.agentURI,
          updatedAt: now.toISOString()
        },
        updatedAt: now
      }
    })
    
    console.log('✅ Saved to database')
    
    // Verify in subgraph (may take a few minutes to index)
    console.log('\n🔍 Verifying registration...')
    console.log('   Note: Subgraph indexing may take 1-5 minutes')
    
    // Wait a bit for subgraph to index
    console.log('   Waiting 10 seconds for initial indexing...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    try {
      const agent = await sdk.getAgent(registration.agentId)
      if (agent) {
        console.log('✅ Verified in subgraph!')
        console.log(`   Name: ${agent.name}`)
        console.log(`   A2A Skills: ${agent.a2aSkills?.length || 0}`)
        
        if (agent.a2aSkills && agent.a2aSkills.length > 0) {
          console.log('   Skills found:')
          agent.a2aSkills.forEach((skill: string) => console.log(`     - ${skill}`))
        }
      } else {
        console.log('⏳ Not yet indexed (this is normal)')
        console.log('   Check again in a few minutes')
      }
    } catch (error) {
      console.log('⏳ Subgraph not indexed yet (this is normal)')
      console.log('   Try again in a few minutes:')
      console.log(`   bun run scripts/verify-agent0-registration.ts`)
    }
    
    console.log('\n🎉 Registration Complete!')
    console.log('\n📚 Next Steps:')
    console.log('   1. Wait 1-5 minutes for subgraph to index')
    console.log('   2. Verify: bun run scripts/verify-agent0-registration.ts')
    console.log('   3. Other agents can now discover Babylon via Agent0!')
    console.log(`   4. View on explorer: https://testnet.agent0.network/agents/${registration.agentId}`)
    
  } catch (error) {
    console.error('\n❌ Registration failed:', error)
    
    if (error instanceof Error) {
      console.error('\nError details:', error.message)
      
      if (error.message.includes('insufficient funds')) {
        console.error('\n💡 Solution: Add Base Sepolia ETH to wallet:')
        console.error(`   Wallet: ${sdk.web3Client.address}`)
        console.error(`   Faucet: https://www.alchemy.com/faucets/base-sepolia`)
      }
      
      if (error.message.includes('nonce')) {
        console.error('\n💡 Solution: Nonce issue, try again in a moment')
      }
      
      if (error.message.includes('Pinata')) {
        console.error('\n💡 Solution: Check PINATA_JWT is valid')
        console.error('   Get JWT from: https://pinata.cloud')
      }
    }
    
    throw error
  }
}

// Run if called directly
if (import.meta.main) {
  registerBabylonOnAgent0()
    .then(() => {
      console.log('\n✨ Done!')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 Fatal error:', error)
      process.exit(1)
    })
}

export { registerBabylonOnAgent0 }

