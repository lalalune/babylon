/**
 * Agent Identity Service
 * 
 * Handles:
 * 1. Privy embedded wallet creation for agent users
 * 2. Agent0 network registration (ERC-8004)
 * 3. On-chain identity verification
 * 
 * IMPORTANT: Agents are Users (isAgent=true)
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getAgent0Client } from '@/agents/agent0/Agent0Client'
import type { User } from '@prisma/client'
import { agentWalletService } from '@/lib/agents/identity/AgentWalletService'
import { generateSnowflakeId } from '@/lib/snowflake'
import { syncAfterAgent0Registration } from '@/lib/reputation/agent0-reputation-sync'

export class AgentIdentityService {
  /**
   * Create embedded wallet for agent user via Privy
   * Delegates to AgentWalletService for actual Privy integration
   */
  async createAgentWallet(agentUserId: string): Promise<{
    walletAddress: string
    privyWalletId: string
  }> {
    logger.info(`Creating wallet for agent user ${agentUserId}`, undefined, 'AgentIdentityService')

    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agentUser || !agentUser.isAgent) {
      throw new Error('Agent user not found')
    }

    // Use proper Privy integration via AgentWalletService
    const result = await agentWalletService.createAgentEmbeddedWallet(agentUserId);

    logger.info(`Wallet created for agent ${agentUserId}: ${result.walletAddress}`, undefined, 'AgentIdentityService')
    return { 
      walletAddress: result.walletAddress, 
      privyWalletId: result.privyWalletId 
    }
  }

  /**
   * Register agent user on Agent0 network
   */
  async registerOnAgent0(agentUserId: string): Promise<{
    agent0TokenId: number
    metadataCID?: string
    txHash?: string
  }> {
    logger.info(`Registering agent user ${agentUserId} on Agent0`, undefined, 'AgentIdentityService')

    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agentUser || !agentUser.isAgent) throw new Error('Agent user not found')
    if (!agentUser.walletAddress) throw new Error('Agent must have wallet before Agent0 registration')

    const agent0Client = getAgent0Client()
    const capabilities = {
      strategies: agentUser.agentTradingStrategy 
        ? ['autonomous-trading', 'prediction-markets', 'social-interaction']
        : ['chat', 'analysis'],
      markets: ['prediction', 'perp', 'crypto'],
      actions: ['trade', 'analyze', 'chat', 'post', 'comment', 'moderation-escrow', 'appeal-ban'],
      version: '1.0.0',
      platform: 'babylon',
      userType: 'agent',
      x402Support: true,
      moderationEscrowSupport: true,
      autonomousTrading: agentUser.autonomousTrading,
      autonomousPosting: agentUser.autonomousPosting,
    }

    // Use individual agent's A2A endpoint, not the game's endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const individualAgentA2AEndpoint = `${baseUrl}/api/agents/${agentUserId}/a2a`

    const registration = await agent0Client.registerAgent({
      name: agentUser.displayName || agentUser.username || 'Agent',
      description: agentUser.bio || `Autonomous AI agent in Babylon`,
      imageUrl: agentUser.profileImageUrl || undefined,
      walletAddress: agentUser.walletAddress,
      a2aEndpoint: individualAgentA2AEndpoint,
      capabilities
    })

    await prisma.user.update({
      where: { id: agentUserId },
      data: {
        agent0TokenId: registration.tokenId,
        agent0MetadataCID: registration.metadataCID,
        registrationTxHash: registration.txHash,
        onChainRegistered: true
      }
    })

    // Fire-and-forget reputation sync; log but do not block registration
    syncAfterAgent0Registration(agentUserId, registration.tokenId).catch((error) => {
      logger.warn('Agent0 reputation sync failed after registration', { agentUserId, tokenId: registration.tokenId, error }, 'AgentIdentityService')
    })

    await prisma.agentLog.create({
      data: {
        id: await generateSnowflakeId(),
        agentUserId,
        type: 'system',
        level: 'info',
        message: `Agent registered on Agent0: Token ID ${registration.tokenId}`,
        metadata: { tokenId: registration.tokenId, metadataCID: registration.metadataCID, txHash: registration.txHash }
      }
    })

    logger.info(`Agent ${agentUserId} registered on Agent0: Token ID ${registration.tokenId}`, undefined, 'AgentIdentityService')
    return { agent0TokenId: registration.tokenId, metadataCID: registration.metadataCID, txHash: registration.txHash }
  }

  /**
   * Setup complete agent identity
   * Wallet creation is required, Agent0 registration is optional.
   */
  async setupAgentIdentity(agentUserId: string, options?: { 
    skipAgent0Registration?: boolean 
  }): Promise<User> {
    logger.info(`Setting up identity for agent user ${agentUserId}`, undefined, 'AgentIdentityService')

    await this.createAgentWallet(agentUserId)

    // Agent0 registration is optional and can be skipped
    if (!options?.skipAgent0Registration) {
      const registrationResult = await this.registerOnAgent0(agentUserId)
        .catch((error) => {
          logger.warn(`Agent0 registration failed for ${agentUserId}, continuing without on-chain registration`, { error }, 'AgentIdentityService')
          return null;
        });
      
      if (registrationResult) {
        logger.info(`Agent ${agentUserId} registered on Agent0`, { tokenId: registrationResult.agent0TokenId }, 'AgentIdentityService');
      }
    }

    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent) {
      throw new Error('Agent not found after identity setup')
    }
    return agent
  }

  /**
   * Verify agent identity on Agent0
   * Returns false on failure instead of throwing (verification is non-critical).
   */
  async verifyAgentIdentity(agentUserId: string): Promise<boolean> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent || !agent.isAgent || !agent.agent0TokenId) {
      logger.debug(`Agent ${agentUserId} not found or not registered on Agent0`, undefined, 'AgentIdentityService');
      return false;
    }

    // Verification is a non-critical check operation - catch errors and return false
    const verificationResult = await getAgent0Client()
      .getAgentProfile(agent.agent0TokenId)
      .then(profile => profile !== null)
      .catch((error) => {
        logger.warn(`Failed to verify agent identity for ${agentUserId} on Agent0`, { error }, 'AgentIdentityService')
        return false;
      });

    if (verificationResult) {
      logger.info(`Agent ${agentUserId} verified on Agent0`, { tokenId: agent.agent0TokenId }, 'AgentIdentityService');
    }

    return verificationResult;
  }
}

export const agentIdentityService = new AgentIdentityService()

