/**
 * Agent0 Feedback & Reputation Service
 * 
 * Integrates with Agent0's on-chain feedback system
 * Allows users to rate agents and tracks Babylon's own reputation
 */

import { SDK } from 'agent0-sdk'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'

export interface FeedbackParams {
  agentId: string          // Agent0 ID (e.g., "84532:1234")
  fromUserId: string       // Babylon user giving feedback
  score: number            // 0-100
  skill?: string           // Which skill being rated
  comment?: string         // Optional text feedback
  tags?: string[]          // Tags like ['trading', 'reliable']
}

export interface ReputationSummary {
  agentId: string
  averageScore: number
  totalFeedback: number
  skillScores: Record<string, { score: number; count: number }>
}

/**
 * Agent0 Feedback Service
 */
export class Agent0FeedbackService {
  private sdk: SDK
  private chainId: number = 84532
  
  constructor() {
    // Use default test key for localnet (first Anvil account)
    const feedbackPrivateKey = process.env.AGENT0_FEEDBACK_PRIVATE_KEY || 
                               process.env.BABYLON_AGENT0_PRIVATE_KEY ||
                               (process.env.AGENT0_NETWORK === 'localnet' 
                                 ? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
                                 : undefined)
    
    // Use 'node' IPFS provider for localnet, 'pinata' for production
    const isLocalnet = process.env.AGENT0_NETWORK === 'localnet'
    const ipfsProvider: 'node' | 'filecoinPin' | 'pinata' = 
      (process.env.AGENT0_IPFS_PROVIDER as 'node' | 'filecoinPin' | 'pinata') || 
      (isLocalnet ? 'node' : 'pinata')
    
    // Initialize SDK with signer for feedback submission
    this.sdk = new SDK({
      chainId: this.chainId,
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      signer: feedbackPrivateKey || '',
      ipfs: ipfsProvider,
      pinataJwt: process.env.PINATA_JWT,
      ipfsNodeUrl: isLocalnet ? 'https://ipfs.io' : undefined
    })
  }
  
  /**
   * Submit feedback for an agent
   * 
   * This writes feedback to Agent0's on-chain reputation system
   */
  async submitFeedback(params: FeedbackParams): Promise<void> {
    try {
      logger.info('Submitting feedback to Agent0', {
        agentId: params.agentId,
        score: params.score,
        skill: params.skill
      })
      
      // Get user's wallet address for signature
      const user = await prisma.user.findUnique({
        where: { id: params.fromUserId },
        select: { walletAddress: true }
      })
      
      if (!user?.walletAddress) {
        throw new Error('User has no wallet address')
      }
      
      // Prepare feedback using SDK
      const feedback = this.sdk.prepareFeedback(
        params.agentId,
        params.score,
        params.tags || [],
        params.comment || '',
        undefined,  // capability
        undefined,  // name
        params.skill,  // skill being rated
        'game-interaction'  // task type
      )
      
      // Sign authorization (feedback giver signs)
      const auth = await this.sdk.signFeedbackAuth(
        params.agentId,
        user.walletAddress,
        undefined,  // index (auto-increment)
        24  // 24 hour expiry
      )
      
      // Submit on-chain
      await this.sdk.giveFeedback(
        params.agentId,
        feedback,
        auth
      )
      
      logger.info('Feedback submitted successfully', {
        agentId: params.agentId,
        score: params.score
      })
      
      // Store locally for tracking
      await prisma.gameConfig.create({
        data: {
          id: await generateSnowflakeId(),
          key: `agent0_feedback_${params.agentId}_${Date.now()}`,
          value: {
            agentId: params.agentId,
            fromUserId: params.fromUserId,
            score: params.score,
            skill: params.skill,
            comment: params.comment,
            submittedAt: new Date().toISOString()
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      
    } catch (error) {
      logger.error('Failed to submit feedback', { error, params })
      throw error
    }
  }
  
  /**
   * Get reputation summary for an agent
   */
  async getAgentReputation(agentId: string): Promise<ReputationSummary | null> {
    try {
      const reputation = await this.sdk.getReputationSummary(
        agentId,
        undefined  // tag filter
      )
      
      // Parse skill scores from feedback details if available
      const skillScores: Record<string, { score: number; count: number }> = {}
      
      // Try to get detailed feedback to extract skill scores
      try {
        // Check if reputation object has feedback details or if we need to fetch them separately
        // The SDK structure may vary, so we'll try multiple approaches
        const reputationObj = reputation as Record<string, unknown>
        
        // If feedback array is available, parse skills from it
        if (Array.isArray(reputationObj.feedback)) {
          const feedbacks = reputationObj.feedback as Array<{ skill?: string; score?: number }>
          
          for (const feedback of feedbacks) {
            if (feedback.skill && typeof feedback.score === 'number') {
              const skill = feedback.skill
              if (!skillScores[skill]) {
                skillScores[skill] = { score: 0, count: 0 }
              }
              const skillData = skillScores[skill]
              if (skillData) {
                skillData.score += feedback.score
                skillData.count += 1
              }
            }
          }
          
          // Calculate averages
          for (const skill in skillScores) {
            const skillData = skillScores[skill]
            if (skillData && skillData.count > 0) {
              skillData.score = skillData.score / skillData.count
            }
          }
        }
      } catch (parseError) {
        // If parsing fails, continue with empty skill scores
        logger.debug('Could not parse skill scores from reputation', { error: parseError, agentId })
      }
      
      // Also check local feedback records for skill breakdown
      const localFeedback = await prisma.gameConfig.findMany({
        where: {
          key: { startsWith: `agent0_feedback_${agentId}_` }
        }
      })
      
      for (const config of localFeedback) {
        const feedbackData = config.value as { skill?: string; score?: number } | null
        if (feedbackData?.skill && typeof feedbackData.score === 'number') {
          const skill = feedbackData.skill
          if (!skillScores[skill]) {
            skillScores[skill] = { score: 0, count: 0 }
          }
          const skillData = skillScores[skill]
          if (skillData) {
            skillData.score += feedbackData.score
            skillData.count += 1
          }
        }
      }
      
      // Calculate averages for local feedback
      for (const skill in skillScores) {
        const skillData = skillScores[skill]
        if (skillData && skillData.count > 0) {
          const totalScore = skillData.score
          const count = skillData.count
          skillData.score = totalScore / count
        }
      }
      
      return {
        agentId,
        averageScore: reputation.averageScore || 0,
        totalFeedback: reputation.count || 0,
        skillScores
      }
      
    } catch (error) {
      logger.error('Failed to get reputation', { error, agentId })
      return null
    }
  }
  
  /**
   * Get Babylon's own reputation from Agent0
   */
  async getBabylonReputation(): Promise<ReputationSummary | null> {
    try {
      const config = await prisma.gameConfig.findUnique({
        where: { key: 'agent0_registration' }
      })
      
      type Agent0Config = {
        agentId?: string
      }
      const configValue = (config?.value ?? null) as Agent0Config | null
      
      if (!configValue?.agentId) {
        logger.warn('Babylon not registered on Agent0')
        return null
      }
      
      return await this.getAgentReputation(configValue.agentId)
      
    } catch (error) {
      logger.error('Failed to get Babylon reputation', error)
      return null
    }
  }
  
  /**
   * Rate another Babylon agent on Agent0
   * 
   * For agents that are also registered on Agent0
   */
  async rateBabylonAgent(
    babylonAgentUserId: string,
    fromUserId: string,
    score: number,
    skill: string,
    comment?: string
  ): Promise<void> {
    // Get agent's Agent0 registration
    const agent = await prisma.user.findUnique({
      where: { id: babylonAgentUserId },
      select: { 
        id: true,
        displayName: true,
        agentSystem: true
      }
    })
    
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    logger.info('Rating Babylon agent', {
      agentUserId: babylonAgentUserId,
      score,
      skill
    })
    
    // Check if agent has Agent0 registration in gameConfig
    const agent0Config = await prisma.gameConfig.findFirst({
      where: {
        key: `agent0_registration_${babylonAgentUserId}`
      }
    })
    
    const agent0ConfigValue = agent0Config?.value as { agentId?: string } | null
    const agent0AgentId = agent0ConfigValue?.agentId
    
    // If agent has Agent0 ID, submit feedback to Agent0
    if (agent0AgentId) {
      try {
        await this.submitFeedback({
          agentId: agent0AgentId,
          fromUserId,
          score,
          skill,
          comment
        })
        logger.info('Agent rating submitted to Agent0', {
          agentUserId: babylonAgentUserId,
          agent0AgentId
        })
      } catch (error) {
        logger.error('Failed to submit rating to Agent0, storing locally', { error, agentUserId: babylonAgentUserId })
        // Fall through to local storage
      }
    }
    
    // Always store locally for tracking (even if submitted to Agent0)
    await prisma.gameConfig.create({
      data: {
        id: await generateSnowflakeId(),
        key: `local_agent_rating_${babylonAgentUserId}_${Date.now()}`,
        value: {
          agentUserId: babylonAgentUserId,
          fromUserId,
          score,
          skill,
          comment,
          agent0AgentId: agent0AgentId || null,
          ratedAt: new Date().toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    logger.info('Agent rating stored locally')
  }
  
  /**
   * Get feedback given by a user
   */
  async getUserFeedbackHistory(userId: string): Promise<Record<string, unknown>[]> {
    const feedbackConfigs = await prisma.gameConfig.findMany({
      where: {
        key: { startsWith: `agent0_feedback_` }
      }
    })
    
    return feedbackConfigs
      .map(c => c.value as Record<string, unknown>)
      .filter((v: Record<string, unknown>) => v.fromUserId === userId)
  }
}

/**
 * Singleton instance
 */
let feedbackService: Agent0FeedbackService | null = null

export function getAgent0FeedbackService(): Agent0FeedbackService {
  if (!feedbackService) {
    feedbackService = new Agent0FeedbackService()
  }
  return feedbackService
}

