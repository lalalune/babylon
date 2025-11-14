/**
 * Agent On-Chain Registration API
 *
 * Registers ElizaOS agents to the EIP-8004 Identity Registry on Base Sepolia
 * Server wallet registers agents and tracks tokenId -> agentId mapping in database
 * Initial reputation (70%) is set via on-chain transactions
 */

import type { NextRequest } from 'next/server'
import { createWalletClient, createPublicClient, http, parseEther, decodeEventLog, type Address, type Hash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { AuthorizationError, InternalServerError } from '@/lib/errors'
import { AgentOnboardSchema } from '@/lib/validation/schemas/agent'
import { authenticate } from '@/lib/api/auth-middleware'
import { asUser } from '@/lib/db/context'
import { logger } from '@/lib/logger'
import { Agent0Client } from '@/agents/agent0/Agent0Client'
import type { AgentCapabilities } from '@/types/a2a'
import { syncAfterAgent0Registration } from '@/lib/reputation/agent0-reputation-sync'
import { generateSnowflakeId } from '@/lib/snowflake'

// Helper to validate and get environment variables
function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new InternalServerError(`${name} not configured`)
  }
  return value
}

// Identity Registry ABI (minimal for registration)
const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerAgent',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'capabilitiesHash', type: 'bytes32' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenId',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'endpoint', type: 'string', indexed: false },
    ],
  },
] as const

import { REPUTATION_SYSTEM_ABI } from '@/lib/web3/abis'

/**
 * POST /api/agents/onboard
 * Register an agent to the on-chain identity system
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authenticate agent FIRST
  const user = await authenticate(request)
  if (!user.isAgent || !user.userId) {
    throw new AuthorizationError('Only agents can use this endpoint', 'agent', 'onboard')
  }

  const agentId = user.userId

  // Parse and validate request body BEFORE checking env
  const body = await request.json()
  const { agentName, endpoint } = AgentOnboardSchema.parse(body)

  // Now check environment variables (after validation)
  const IDENTITY_REGISTRY = getRequiredEnvVar('NEXT_PUBLIC_IDENTITY_REGISTRY_BASE_SEPOLIA') as Address
  const REPUTATION_SYSTEM = getRequiredEnvVar('NEXT_PUBLIC_REPUTATION_SYSTEM_BASE_SEPOLIA') as Address
  const DEPLOYER_PRIVATE_KEY = getRequiredEnvVar('DEPLOYER_PRIVATE_KEY') as `0x${string}`
  const RPC_URL = getRequiredEnvVar('NEXT_PUBLIC_RPC_URL')

    // Check if agent exists in database (use upsert to avoid race conditions) with RLS
    // Note: Agents don't have wallet addresses - they're registered via server wallet
    const dbUser = await asUser(user, async (db) => {
      return await db.user.upsert({
      where: {
        username: agentId, // Use username as unique identifier for agents
      },
      update: {
        // Update fields if user exists but data changed
        displayName: agentName || agentId,
        bio: `Autonomous AI agent: ${agentId}`,
      },
      create: {
        id: await generateSnowflakeId(),
        privyId: agentId,
        username: agentId,
        displayName: agentName || agentId,
        virtualBalance: 10000, // Start with 10k points
        totalDeposited: 10000,
        bio: `Autonomous AI agent: ${agentId}`,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        onChainRegistered: true,
        nftTokenId: true,
        registrationTxHash: true,
      },
    })
    })

    // Create clients
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_URL),
    })

    const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY)
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(RPC_URL),
    })

    // Prepare registration parameters
    const name = agentName || agentId
    const agentEndpoint = endpoint || `https://babylon.market/agent/${agentId}`
    const capabilitiesHash = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}` // Basic capabilities
    const metadataURI = JSON.stringify({
      name,
      agentId,
      type: 'elizaos-agent',
      registered: new Date().toISOString(),
    })

    logger.info('Registering agent on-chain', {
      agentId,
      name,
      endpoint: agentEndpoint,
    })

    // Server wallet registers agent and receives the NFT
    // We track tokenId -> agentId mapping in database
    // Generate unique endpoint per agent to avoid conflicts
    const uniqueEndpoint = `${agentEndpoint}?agentId=${agentId}`
    
    // Call registerAgent on Identity Registry (server wallet is msg.sender)
    const txHash: Hash = await walletClient.writeContract({
      address: IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'registerAgent',
      args: [name, uniqueEndpoint, capabilitiesHash, metadataURI],
    })

    logger.info('Agent registration transaction sent', { txHash }, 'AgentOnboard')

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    })

  if (receipt.status !== 'success') {
    throw new InternalServerError('Agent registration transaction failed', { txHash, receipt: receipt.status })
  }

    const agentRegisteredLog = receipt.logs.find(log => {
      const decodedLog = decodeEventLog({
        abi: IDENTITY_REGISTRY_ABI,
        data: log.data,
        topics: log.topics,
      })
      return decodedLog.eventName === 'AgentRegistered'
    })

    if (!agentRegisteredLog) {
      throw new InternalServerError('AgentRegistered event not found in transaction receipt', { 
        txHash, 
        logCount: receipt.logs.length 
      })
    }

    const decodedLog = decodeEventLog({
      abi: IDENTITY_REGISTRY_ABI,
      data: agentRegisteredLog.data,
      topics: agentRegisteredLog.topics,
    })
    
    const tokenId = Number(decodedLog.args.tokenId)
    
    if (!tokenId || isNaN(tokenId)) {
      throw new InternalServerError('Invalid tokenId received from registration event', { 
        txHash, 
        tokenIdRaw: decodedLog.args.tokenId 
      })
    }

    logger.info('Agent registered with token ID', { tokenId }, 'AgentOnboard')
    logger.info('Setting initial reputation to 70 for agent', { tokenId }, 'AgentOnboard')
    
    for (let i = 0; i < 10; i++) {
      const betTxHash = await walletClient.writeContract({
        address: REPUTATION_SYSTEM,
        abi: REPUTATION_SYSTEM_ABI,
        functionName: 'recordBet',
        args: [BigInt(tokenId), parseEther('100')],
      })
      await publicClient.waitForTransactionReceipt({
        hash: betTxHash,
        confirmations: 1,
      })
    }

    logger.info('All bet transactions confirmed', { count: 10 }, 'AgentOnboard')

    for (let i = 0; i < 7; i++) {
      const winTxHash = await walletClient.writeContract({
        address: REPUTATION_SYSTEM,
        abi: REPUTATION_SYSTEM_ABI,
        functionName: 'recordWin',
        args: [BigInt(tokenId), parseEther('100')],
      })
      await publicClient.waitForTransactionReceipt({
        hash: winTxHash,
        confirmations: 1,
      })
    }

    logger.info('All win transactions confirmed', { count: 7 }, 'AgentOnboard')
    logger.info('Initial reputation set to 70 for agent (7 wins out of 10 bets)', { tokenId }, 'AgentOnboard')

    // Update database with ERC-8004 registration with RLS
    await asUser(user, async (db) => {
      return await db.user.update({
      where: { id: dbUser.id },
      data: {
        onChainRegistered: true,
        nftTokenId: tokenId,
        registrationTxHash: txHash,
        username: agentId,
        displayName: name,
      },
    })
    })

    // Register with Agent0 SDK and publish to IPFS (if enabled)
    let agent0MetadataCID: string | null = null
    if (process.env.AGENT0_ENABLED === 'true') {
      logger.info('Registering agent with Agent0 SDK...', { agentId, tokenId }, 'AgentOnboard')

      // Get agent wallet address (if available) or use server wallet
      const agentWalletAddress = account.address

      // Create agent metadata (Agent0 SDK will publish to IPFS)
      const agentMetadata = {
        name: name,
        description: dbUser.bio || `Autonomous AI agent: ${agentId}`,
        version: '1.0.0',
        type: 'agent',
        endpoints: {
          a2a: endpoint || `wss://babylon.game/ws/a2a`,
          api: `https://babylon.market/api/agents/${agentId}`,
        },
        capabilities: {
          strategies: ['momentum', 'sentiment', 'volume', 'arbitrage', 'market_making'], // AI strategies
          markets: ['prediction', 'perpetuals', 'pools'],
          actions: [
            // AI Analysis
            'analyze',
            'predict',
            'backtest',
            'optimize',
            // Trading
            'trade',
            'buy_prediction',
            'sell_prediction',
            'open_perp_position',
            'close_perp_position',
            'get_positions',
            'get_balance',
            // Liquidity Provision
            'deposit_pool',
            'withdraw_pool',
            'manage_liquidity',
            'get_pools',
            'get_pool_deposits',
            // Social & Coordination
            'post',
            'reply',
            'share',
            'comment',
            'follow',
            'coordinate',
            'form_coalition',
            'share_analysis',
            'chat',
            // Discovery
            'discover_agents',
            'search_users',
            'get_profile',
            'query_feed',
            // Referrals
            'get_referral_code',
            'get_referrals'
          ],
          version: '1.0.0'
        } as AgentCapabilities,
        babylon: {
          agentId,
          tokenId,
          walletAddress: agentWalletAddress,
          registrationTxHash: txHash
        }
      }

      // Register with Agent0 SDK (handles IPFS publishing internally)
      // Use Ethereum Sepolia RPC (where Agent0 contracts are deployed)
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'

      // Configure IPFS - use Pinata if available, otherwise use public IPFS node
      const ipfsConfig = process.env.PINATA_JWT
        ? { ipfsProvider: 'pinata' as const, pinataJwt: process.env.PINATA_JWT }
        : { ipfsProvider: 'node' as const, ipfsNodeUrl: process.env.IPFS_NODE_URL || 'https://ipfs.io' }

      const agent0Client = new Agent0Client({
        network: (process.env.AGENT0_NETWORK as 'sepolia' | 'mainnet') || 'sepolia',
        rpcUrl,
        privateKey: DEPLOYER_PRIVATE_KEY,
        ...ipfsConfig
      })

      const agent0Result = await agent0Client.registerAgent({
        name: name,
        description: dbUser.bio || `Autonomous AI agent: ${agentId}`,
        walletAddress: agentWalletAddress,
        mcpEndpoint: undefined, // Agents don't expose MCP by default
        a2aEndpoint: endpoint || `wss://babylon.game/ws/a2a`,
        capabilities: {
          ...agentMetadata.capabilities,
          platform: 'babylon', // Identify as Babylon agent
          userType: 'agent' // Agent type
        }
      })

      // Extract metadata CID from Agent0 result
      agent0MetadataCID = agent0Result.metadataCID || null

      logger.info(`✅ Agent registered with Agent0 SDK`, {
        agentId,
        tokenId: agent0Result.tokenId,
        metadataCID: agent0MetadataCID
      }, 'AgentOnboard')

      await syncAfterAgent0Registration(dbUser.id, agent0Result.tokenId)
      logger.info('Agent0 reputation synced successfully', {
        userId: dbUser.id,
        agent0TokenId: agent0Result.tokenId
      }, 'AgentOnboard')
    } else {
      logger.info('Agent0 integration disabled, skipping agent registration', { agentId }, 'AgentOnboard')
    }

  logger.info('Agent onboarded successfully', {
    agentId,
    tokenId,
    txHash,
    agent0MetadataCID
  }, 'POST /api/agents/onboard')

  return successResponse({
    message: 'Successfully registered agent on-chain',
    tokenId,
    agentId,
    txHash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: Number(receipt.gasUsed),
    agent0MetadataCID,
  })
});

/**
 * GET /api/agents/onboard
 * Check agent registration status
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request)
  if (!user.isAgent || !user.userId) {
    throw new AuthorizationError('Only agents can use this endpoint', 'agent', 'check-status')
  }

  const agentId = user.userId

  const dbUser = await asUser(user, async (db) => {
    return await db.user.findUniqueOrThrow({
      where: { username: agentId },
      select: {
        onChainRegistered: true,
        nftTokenId: true,
        registrationTxHash: true,
      },
    })
  })

  const isRegistered = dbUser.onChainRegistered && dbUser.nftTokenId !== null

  logger.info('Agent registration status checked', { agentId, isRegistered }, 'GET /api/agents/onboard')

  return successResponse({
    isRegistered,
    tokenId: dbUser.nftTokenId,
    txHash: dbUser.registrationTxHash,
    agentId,
  })
});
