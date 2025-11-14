#!/usr/bin/env bun
/**
 * Babylon Status Tool
 * 
 * Unified status checker for all Babylon systems:
 * - Game status (running/paused, tick info)
 * - Database health (actors, posts, markets)
 * - Agent0 registration status
 * - Wallet status (balance, nonce, pending txs)
 * 
 * Usage:
 *   bun run scripts/status.ts              # Show all status
 *   bun run scripts/status.ts game         # Game status only
 *   bun run scripts/status.ts wallet       # Wallet status only
 *   bun run scripts/status.ts registration # Agent0 registration only
 */

import { prisma } from '@/lib/prisma'
import { ethers } from 'ethers'
import { execSync } from 'child_process'

const command = process.argv[2] || 'all'

async function checkGameStatus() {
  console.log('\n' + '═'.repeat(70))
  console.log('🎮 GAME STATUS')
  console.log('═'.repeat(70))

  await prisma.$connect().catch(() => {
    console.error('❌ Database connection failed')
    process.exit(1)
  })
  console.log('✅ Database connected')

  const actorCount = await prisma.actor.count()
  console.log(`Actors: ${actorCount}`)
  
  if (actorCount === 0) {
    console.error('❌ No actors in database! Run: bun run db:seed')
  }

  const questionCount = await prisma.question.count()
  const activeQuestions = await prisma.question.count({ where: { status: 'active' } })
  console.log(`Questions: ${questionCount} total, ${activeQuestions} active`)

  const postCount = await prisma.post.count()
  const recentPosts = await prisma.post.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000),
      },
    },
  })
  console.log(`Posts: ${postCount} total, ${recentPosts} in last 5 minutes`)
  
  if (recentPosts === 0 && postCount > 0) {
    console.log('⚠️  No recent posts - game tick might not be running')
    console.log('   Make sure `bun run dev` is running for local development')
  } else if (recentPosts > 0) {
    console.log('✅ Content is being generated!')
  }

  const game = await prisma.game.findFirst({ where: { isContinuous: true } })
  if (game) {
    console.log('\nGame State:')
    console.log(`  Status: ${game.isRunning ? '✅ RUNNING' : '⏸️  PAUSED'}`)
    console.log(`  Current Day: ${game.currentDay}`)
    console.log(`  Current Date: ${game.currentDate.toLocaleString()}`)
    console.log(`  Active Questions: ${game.activeQuestions}`)
    console.log(`  Speed: ${game.speed}ms between ticks`)
    console.log(`  Last Tick: ${game.lastTickAt ? game.lastTickAt.toLocaleString() : 'Never'}`)
    
    if (!game.isRunning) {
      console.log('\n💡 To start: bun run game:start')
    }
  } else {
    console.log('⚠️  No game state found')
  }

  const eventCount = await prisma.worldEvent.count()
  const recentEvents = await prisma.worldEvent.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000),
      },
    },
  })
  console.log(`\nEvents: ${eventCount} total, ${recentEvents} in last 5 minutes`)

  const orgCount = await prisma.organization.count()
  const companiesWithPrices = await prisma.organization.count({
    where: {
      type: 'company',
      currentPrice: { not: null },
    },
  })
  console.log(`Organizations: ${orgCount} total, ${companiesWithPrices} companies with prices`)
}

async function checkWalletStatus() {
  console.log('\n' + '═'.repeat(70))
  console.log('💳 WALLET STATUS')
  console.log('═'.repeat(70))

  const gamePrivateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
  const gameWalletAddress = process.env.BABYLON_GAME_WALLET_ADDRESS

  if (!gamePrivateKey || !gameWalletAddress) {
    console.error('❌ Missing BABYLON_GAME_PRIVATE_KEY or BABYLON_GAME_WALLET_ADDRESS')
    return
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(gamePrivateKey, provider)

  console.log(`Wallet: ${wallet.address}`)
  console.log(`Expected: ${gameWalletAddress}`)

  const balance = await provider.getBalance(wallet.address)
  console.log(`\n💰 Balance: ${ethers.formatEther(balance)} ETH`)

  const nonce = await provider.getTransactionCount(wallet.address, 'latest')
  const pendingNonce = await provider.getTransactionCount(wallet.address, 'pending')

  console.log(`📊 Nonce (confirmed): ${nonce}`)
  console.log(`📊 Nonce (pending): ${pendingNonce}`)

  if (pendingNonce > nonce) {
    console.log(`⚠️  ${pendingNonce - nonce} pending transaction(s) detected!`)
  } else {
    console.log(`✅ No pending transactions`)
  }

  const feeData = await provider.getFeeData()
  console.log(`\n⛽ Current Gas Price:`)
  console.log(`   Max Fee: ${feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : 'N/A'} gwei`)
  console.log(`   Max Priority Fee: ${feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : 'N/A'} gwei`)

  const blockNumber = await provider.getBlockNumber()
  const block = await provider.getBlock(blockNumber)
  console.log(`\n🌐 Network Status:`)
  console.log(`   Latest Block: ${blockNumber}`)
  console.log(`   Block Time: ${new Date(block!.timestamp * 1000).toISOString()}`)
  console.log(`   Base Fee: ${block!.baseFeePerGas ? ethers.formatUnits(block!.baseFeePerGas, 'gwei') : 'N/A'} gwei`)
}

async function checkRegistration() {
  console.log('\n' + '═'.repeat(70))
  console.log('🔗 AGENT0 REGISTRATION STATUS')
  console.log('═'.repeat(70))

  console.log('\n📋 Environment Variables:')
  console.log(`   AGENT0_ENABLED: ${process.env.AGENT0_ENABLED}`)
  console.log(`   AGENT0_NETWORK: ${process.env.AGENT0_NETWORK}`)
  console.log(`   BABYLON_REGISTRY_REGISTERED: ${process.env.BABYLON_REGISTRY_REGISTERED}`)
  console.log(`   BABYLON_GAME_WALLET_ADDRESS: ${process.env.BABYLON_GAME_WALLET_ADDRESS}`)
  console.log(`   PINATA_JWT: ${process.env.PINATA_JWT ? '✅ Set' : '❌ Not set'}`)

  let tokenId: number | undefined
  
  try {
    const config = await prisma.gameConfig.findUnique({
      where: { key: 'agent0_registration' }
    })
    
    if (config?.value && typeof config.value === 'object' && 'tokenId' in config.value) {
      console.log('\n✅ Database Registration Found:')
      console.log(`   Token ID: ${config.value.tokenId}`)
      console.log(`   Metadata CID: ${config.value.metadataCID}`)
      console.log(`   Registered At: ${config.value.registeredAt}`)
      
      tokenId = Number(config.value.tokenId)
      
      const registryAddress = '0x8004a6090Cd10A7288092483047B097295Fb8847'
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
      
      console.log('\n🔗 Checking On-Chain Registration:')
      console.log(`   Registry: ${registryAddress}`)
      console.log(`   Token ID: ${tokenId}`)
      
      const owner = execSync(
        `cast call ${registryAddress} "ownerOf(uint256)(address)" ${tokenId} --rpc-url ${rpcUrl}`,
        { encoding: 'utf-8' }
      ).toString().trim()
      
      console.log('✅ On-chain registration confirmed!')
      console.log(`   Owner: ${owner}`)
      
      if (owner.toLowerCase() === process.env.BABYLON_GAME_WALLET_ADDRESS?.toLowerCase()) {
        console.log('✅ Owner matches BABYLON_GAME_WALLET_ADDRESS')
      } else {
        console.log('⚠️  Owner does NOT match BABYLON_GAME_WALLET_ADDRESS')
        console.log(`   Expected: ${process.env.BABYLON_GAME_WALLET_ADDRESS}`)
      }
      
      const tokenURI = execSync(
        `cast call ${registryAddress} "tokenURI(uint256)(string)" ${tokenId} --rpc-url ${rpcUrl}`,
        { encoding: 'utf-8' }
      ).toString().trim().replace(/"/g, '')
      
      console.log('\n📄 Token URI:')
      console.log(`   ${tokenURI}`)
      
      const cid = tokenURI.replace('ipfs://', '')
      console.log('\n🌐 View metadata:')
      console.log(`   https://ipfs.io/ipfs/${cid}`)
      console.log(`   https://gateway.pinata.cloud/ipfs/${cid}`)
    } else {
      console.log('\n⚠️  No registration found in database')
      console.log('   Run: bun run agent0:setup')
    }
  } catch (error) {
    console.log('⚠️  Database not available (this is OK for checking on-chain status)')
  }
}

async function checkAgent0Config() {
  console.log('\n' + '═'.repeat(70))
  console.log('🤖 AGENT0 CONFIGURATION')
  console.log('═'.repeat(70))

  const requiredVars = [
    'AGENT0_ENABLED',
    'BASE_SEPOLIA_RPC_URL',
    'BABYLON_GAME_PRIVATE_KEY'
  ]

  const missing = requiredVars.filter(v => !process.env[v])

  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:')
    missing.forEach(v => console.log(`   ${v}`))
    console.log('\n💡 Agent0 integration will not work without these variables')
    return
  }

  console.log('✅ Required environment variables present')

  if (process.env.AGENT0_ENABLED !== 'true') {
    console.log('⚠️  AGENT0_ENABLED is not set to "true"')
    console.log('   Agent0 integration is disabled')
    return
  }

  if (process.env.AGENT0_SUBGRAPH_URL) {
    console.log(`✅ Subgraph URL configured: ${process.env.AGENT0_SUBGRAPH_URL}`)
  } else {
    console.log('⚠️  AGENT0_SUBGRAPH_URL not set')
    console.log('   Agent discovery may not work')
  }

  const ipfsProvider = process.env.AGENT0_IPFS_PROVIDER || 'node'
  console.log(`IPFS Provider: ${ipfsProvider}`)

  if (ipfsProvider === 'pinata' && !process.env.PINATA_JWT) {
    console.log('⚠️  PINATA_JWT not set (required for Pinata IPFS)')
  }
}

async function showAll() {
  await checkGameStatus()
  await checkWalletStatus()
  await checkRegistration()
  await checkAgent0Config()
  
  console.log('\n' + '═'.repeat(70))
  console.log('✅ STATUS CHECK COMPLETE')
  console.log('═'.repeat(70))
}

async function main() {
  switch (command) {
    case 'game':
      await checkGameStatus()
      break
    case 'wallet':
      await checkWalletStatus()
      break
    case 'registration':
      await checkRegistration()
      break
    case 'agent0':
      await checkAgent0Config()
      break
    case 'all':
    default:
      await showAll()
      break
  }
  
  await prisma.$disconnect()
}

main()

