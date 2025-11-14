/**
 * Agent Wallet Service
 * 
 * Handles agent wallet creation and on-chain registration with ZERO user interaction
 * - Creates Privy embedded wallets for agents
 * - Signs transactions server-side
 * - Handles gas fees automatically
 * - Registers on ERC-8004 identity registry
 */

import { PrivyClient } from '@privy-io/server-auth'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { getAgent0Client } from '@/agents/agent0/Agent0Client'
import { v4 as uuidv4 } from 'uuid'
import { ethers } from 'ethers'

// Type definitions for Privy SDK (not exported by package)
interface PrivyWallet {
  address: string;
  id: string;
}

interface PrivyUser {
  id: string;
  wallet?: PrivyWallet;
}

interface PrivyCreateUserParams {
  create_embedded_wallet: boolean;
  linked_accounts: unknown[];
}

interface PrivySignTransactionParams {
  wallet_id: string;
  transaction: {
    to: string;
    value: string;
    data: string;
  };
}

interface PrivySignedTransaction {
  signed_transaction: string;
}

// Extended Privy client with additional methods
interface ExtendedPrivyClient extends PrivyClient {
  createUser(params: PrivyCreateUserParams): Promise<PrivyUser>;
  signTransaction(params: PrivySignTransactionParams): Promise<PrivySignedTransaction>;
}

// Initialize Privy server client
const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
) as ExtendedPrivyClient

export class AgentWalletService {
  /**
   * Create embedded wallet for agent via Privy (server-side, no user interaction)
   * Falls back to dev wallet in development if Privy is not configured.
   */
  async createAgentEmbeddedWallet(agentUserId: string): Promise<{
    walletAddress: string
    privyUserId: string
    privyWalletId: string
  }> {
    logger.info(`Creating Privy embedded wallet for agent ${agentUserId}`, undefined, 'AgentWalletService')

    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent || !agent.isAgent) {
      throw new Error('Agent user not found')
    }

    // Keep try/catch - Privy integration needs fallback to dev wallet
    try {
      // Step 1: Create Privy user for the agent (server-side)
      // Privy allows server-side user creation without user interaction
      const privyUser = await privy.createUser({
        create_embedded_wallet: true,
        linked_accounts: []
      })

      if (!privyUser.wallet) {
        throw new Error('Failed to create embedded wallet')
      }

      const walletAddress = privyUser.wallet.address
      const privyUserId = privyUser.id
      const privyWalletId = privyUser.wallet.id

      // Step 2: Update agent user with wallet info
      await prisma.user.update({
        where: { id: agentUserId },
        data: {
          walletAddress,
          privyId: privyUserId
        }
      })

      // Step 3: Log wallet creation
      await prisma.agentLog.create({
        data: {
          id: uuidv4(),
          agentUserId,
          type: 'system',
          level: 'info',
          message: `Privy embedded wallet created: ${walletAddress}`,
          metadata: {
            privyUserId,
            privyWalletId,
            walletAddress
          }
        }
      })

      logger.info(`Privy wallet created for agent ${agentUserId}: ${walletAddress}`, undefined, 'AgentWalletService')
      
      return { walletAddress, privyUserId, privyWalletId }
      
    } catch (error) {
      logger.error(`Failed to create Privy wallet for agent ${agentUserId}`, error, 'AgentWalletService')
      
      // Fallback: Create deterministic wallet address for development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Using development wallet (not production-ready)', undefined, 'AgentWalletService')
        
        const devWallet = ethers.Wallet.createRandom()
        const walletAddress = devWallet.address
        const privyUserId = `dev_${agentUserId}`
        const privyWalletId = `dev_wallet_${agentUserId}`
        
        await prisma.user.update({
          where: { id: agentUserId },
          data: {
            walletAddress,
            privyId: privyUserId
          }
        })
        
        return { walletAddress, privyUserId, privyWalletId }
      }
      
      throw error
    }
  }

  /**
   * Register agent on ERC-8004 identity registry (server-side signing, gas handled)
   */
  async registerAgentOnChain(agentUserId: string): Promise<{
    tokenId: number
    txHash: string
    metadataCID?: string
  }> {
    logger.info(`Registering agent ${agentUserId} on-chain`, undefined, 'AgentWalletService')

    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent || !agent.isAgent) {
      throw new Error('Agent user not found')
    }

    if (!agent.walletAddress) {
      throw new Error('Agent must have wallet before on-chain registration')
    }

    // Step 1: Prepare agent metadata
    const capabilities = {
      strategies: agent.agentTradingStrategy
        ? ['autonomous-trading', 'prediction-markets', 'social-interaction']
        : ['chat', 'analysis'],
      markets: ['prediction', 'perp', 'crypto'],
      actions: ['trade', 'analyze', 'chat', 'post', 'comment'],
      version: '1.0.0',
      platform: 'babylon',
      userType: 'agent',
      autonomousTrading: agent.autonomousTrading,
      autonomousPosting: agent.autonomousPosting,
    }

    // Step 2: Register via Agent0Client (handles signing and gas server-side)
    const agent0Client = getAgent0Client()
    
    const registration = await agent0Client.registerAgent({
      name: agent.displayName || agent.username || 'Agent',
      description: agent.bio || `Autonomous AI agent in Babylon`,
      imageUrl: agent.profileImageUrl || undefined,
      walletAddress: agent.walletAddress,
      a2aEndpoint: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/a2a`
        : undefined,
      capabilities
    })

    // Step 3: Update agent with on-chain data
    await prisma.user.update({
      where: { id: agentUserId },
      data: {
        agent0TokenId: registration.tokenId,
        agent0MetadataCID: registration.metadataCID,
        registrationTxHash: registration.txHash,
        onChainRegistered: true
      }
    })

    // Step 4: Log registration
    await prisma.agentLog.create({
      data: {
        id: uuidv4(),
        agentUserId,
        type: 'system',
        level: 'info',
        message: `Agent registered on-chain: Token ID ${registration.tokenId}`,
        metadata: {
          tokenId: registration.tokenId,
          txHash: registration.txHash,
          metadataCID: registration.metadataCID
        }
      }
    })

    logger.info(`Agent ${agentUserId} registered on-chain: Token ID ${registration.tokenId}`, undefined, 'AgentWalletService')
    
    return {
      tokenId: registration.tokenId,
      txHash: registration.txHash,
      metadataCID: registration.metadataCID
    }
  }

  /**
   * Complete setup: Create wallet + register on-chain (fully automated)
   * Wallet creation is required, on-chain registration is optional.
   */
  async setupAgentIdentity(agentUserId: string): Promise<{
    walletAddress: string
    tokenId?: number
    onChainRegistered: boolean
  }> {
    logger.info(`Setting up complete identity for agent ${agentUserId}`, undefined, 'AgentWalletService')

    // Step 1: Create Privy embedded wallet (server-side, no user interaction)
    const wallet = await this.createAgentEmbeddedWallet(agentUserId)
    
    // Step 2: Register on-chain (server signs and pays gas)
    // Keep try/catch - on-chain registration is optional
    try {
      const registration = await this.registerAgentOnChain(agentUserId)
      
      return {
        walletAddress: wallet.walletAddress,
        tokenId: registration.tokenId,
        onChainRegistered: true
      }
    } catch (registrationError) {
      // Wallet created successfully but on-chain registration failed
      // Agent can still function without on-chain identity
      logger.warn(`Agent ${agentUserId} has wallet but on-chain registration failed`, registrationError, 'AgentWalletService')
      
      return {
        walletAddress: wallet.walletAddress,
        onChainRegistered: false
      }
    }
  }

  /**
   * Sign transaction for agent (server-side, no user interaction)
   */
  async signTransaction(agentUserId: string, transactionData: {
    to: string
    value: string
    data: string
  }): Promise<string> {
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: {
        id: true,
        isAgent: true,
        privyId: true
      }
    })
    
    if (!agent || !agent.isAgent) {
      throw new Error('Agent not found')
    }

    if (!agent.privyId) {
      throw new Error('Agent does not have Privy wallet')
    }

    // Use Privy server client to sign transaction (no user interaction needed)
    // Privy handles the private key management and signing server-side
    const signedTx = await privy.signTransaction({
      wallet_id: agent.privyId,
      transaction: transactionData
    })

    logger.info(`Transaction signed for agent ${agentUserId}`, undefined, 'AgentWalletService')
    
    return signedTx.signed_transaction
  }

  /**
   * Verify agent has valid on-chain identity
   * Returns false on failure instead of throwing.
   */
  async verifyOnChainIdentity(agentUserId: string): Promise<boolean> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    
    if (!agent || !agent.isAgent || !agent.agent0TokenId) {
      return false
    }

    // Keep try/catch - verification should return false, not throw
    try {
      // Verify with Agent0 network
      const agent0Client = getAgent0Client()
      const profile = await agent0Client.getAgentProfile(agent.agent0TokenId)
      
      return profile !== null
    } catch (error) {
      logger.error(`Failed to verify agent identity for ${agentUserId}`, error, 'AgentWalletService')
      return false
    }
  }
}

export const agentWalletService = new AgentWalletService()

