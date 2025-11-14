/**
 * Autonomous Coordinator
 * 
 * Central orchestrator for all autonomous agent behaviors.
 * Eliminates duplication and ensures proper coordination between services.
 * 
 * Strategy:
 * 1. Prefer A2A when connected (better protocol compliance)
 * 2. Fallback to direct DB when A2A unavailable
 * 3. Batch operations for efficiency
 * 4. Smart response prioritization
 */

import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import type { IAgentRuntime } from '@elizaos/core'
import type { BabylonRuntime } from '../plugins/babylon/types'

// Import services
import { autonomousA2AService } from './AutonomousA2AService'
import { autonomousBatchResponseService } from './AutonomousBatchResponseService'
import { autonomousTradingService } from './AutonomousTradingService'
import { autonomousPostingService } from './AutonomousPostingService'
import { autonomousCommentingService } from './AutonomousCommentingService'
// import { autonomousDMService } from './AutonomousDMService' // Not used yet
import { autonomousGroupChatService } from './AutonomousGroupChatService'
import { autonomousPlanningCoordinator } from './AutonomousPlanningCoordinator'

export interface AutonomousTickResult {
  success: boolean
  actionsExecuted: {
    trades: number
    posts: number
    comments: number
    messages: number
    groupMessages: number
    engagements: number
  }
  method: 'a2a' | 'database' | 'planning_coordinator'
  duration: number
}

export class AutonomousCoordinator {
  /**
   * Execute complete autonomous tick for an agent
   * Now uses goal-oriented multi-action planning when goals are configured
   */
  async executeAutonomousTick(
    agentUserId: string,
    runtime: IAgentRuntime
  ): Promise<AutonomousTickResult> {
    const startTime = Date.now()
    const result: AutonomousTickResult = {
      success: false,
      actionsExecuted: {
        trades: 0,
        posts: 0,
        comments: 0,
        messages: 0,
        groupMessages: 0,
        engagements: 0
      },
      method: 'database',
      duration: 0
    }

    logger.info(`Starting autonomous tick for agent ${agentUserId}`, undefined, 'AutonomousCoordinator')

    // Get agent config
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: {
        isAgent: true,
        autonomousTrading: true,
        autonomousPosting: true,
        autonomousCommenting: true,
        autonomousDMs: true,
        autonomousGroupChats: true,
        agentPlanningHorizon: true,
        agentGoals: true
      }
    })

    if (!agent || !agent.isAgent) {
      throw new Error('Agent not found or not an agent')
    }
    
    // Check if agent has goals configured
    const hasGoals = await prisma.agentGoal.count({
      where: {
        agentUserId,
        status: 'active'
      }
    }) > 0
    
    // Use planning coordinator if agent has goals and multi-action planning enabled
    if (hasGoals && agent.agentPlanningHorizon === 'multi') {
      logger.info('Using goal-oriented planning coordinator', undefined, 'AutonomousCoordinator')
      
      try {
        // Generate comprehensive action plan
        const plan = await autonomousPlanningCoordinator.generateActionPlan(agentUserId, runtime)
        
        // Execute the plan
        const executionResult = await autonomousPlanningCoordinator.executePlan(agentUserId, runtime, plan)
        
        // Map results to standard format
        for (const actionResult of executionResult.results) {
          if (actionResult.success) {
            switch (actionResult.action.type) {
              case 'trade':
                result.actionsExecuted.trades++
                break
              case 'post':
                result.actionsExecuted.posts++
                break
              case 'comment':
              case 'respond':
                result.actionsExecuted.comments++
                break
              case 'message':
                result.actionsExecuted.messages++
                break
            }
          }
        }
        
        result.success = executionResult.successful > 0
        result.method = 'planning_coordinator'
        result.duration = Date.now() - startTime
        
        logger.info('Completed autonomous tick via planning coordinator', {
          agentId: agentUserId,
          planned: executionResult.planned,
          executed: executionResult.executed,
          successful: executionResult.successful,
          duration: result.duration
        }, 'AutonomousCoordinator')
        
        return result
      } catch (error) {
        logger.error('Planning coordinator failed, falling back to legacy mode', error, 'AutonomousCoordinator')
        // Fall through to legacy mode
      }
    }

    // Check if A2A client is connected
    const useA2A = !!(runtime as BabylonRuntime).a2aClient?.isConnected()

    logger.info(`Using ${useA2A ? 'A2A protocol' : 'direct database'} for autonomous actions`, undefined, 'AutonomousCoordinator')
    result.method = useA2A ? 'a2a' : 'database'

    // === PRIORITY 1: RESPONSES (Always do first) ===
    // Use batch response service for intelligent response handling
    const responses = await autonomousBatchResponseService.processBatch(agentUserId, runtime)
    result.actionsExecuted.comments += responses // Comments include replies
    result.actionsExecuted.messages += responses // Messages include DM responses

    // === PRIORITY 2: TRADING ===
    if (agent.autonomousTrading) {
      if (useA2A) {
        const tradeResult = await autonomousA2AService.executeA2ATrade(agentUserId, runtime)
        if (tradeResult.success) {
          result.actionsExecuted.trades++
        }
      } else {
        const tradesExecuted = await autonomousTradingService.executeTrades(agentUserId, runtime)
        result.actionsExecuted.trades += tradesExecuted
      }
    }

    // === PRIORITY 3: SOCIAL (Posting) ===
    if (agent.autonomousPosting) {
      if (useA2A) {
        const trendingResult = await autonomousA2AService.engageWithTrending(agentUserId, runtime)
        result.actionsExecuted.engagements += trendingResult.engagements
      }
      
      const postId = await autonomousPostingService.createAgentPost(agentUserId, runtime)
      if (postId) {
        result.actionsExecuted.posts++
      }
    }

    // === PRIORITY 4: ENGAGEMENT (Commenting) ===
    if (agent.autonomousCommenting) {
      const commentId = await autonomousCommentingService.createAgentComment(agentUserId, runtime)
      if (commentId) {
        result.actionsExecuted.comments++
      }
    }

    // === PRIORITY 5: POSITION MONITORING ===
    if (agent.autonomousTrading && useA2A) {
      // Use A2A for position monitoring (better data access)
      const monitorResult = await autonomousA2AService.monitorPositions(agentUserId, runtime)
      result.actionsExecuted.trades += monitorResult.actionsTaken
    }

    // === PRIORITY 6: COMMUNITY (DMs handled by batch, groups separate) ===
    if (agent.autonomousGroupChats) {
      // Group chats use direct DB (batch service doesn't handle groups yet)
      const groupMessages = await autonomousGroupChatService.participateInGroupChats(agentUserId, runtime)
      result.actionsExecuted.groupMessages += groupMessages
    }

    // NOTE: DMs are handled by batch response service above
    // No need for separate DM service - avoiding duplication

    result.success = true
    result.duration = Date.now() - startTime

    logger.info(`Autonomous tick completed for agent ${agentUserId}`, {
      duration: result.duration,
      actions: result.actionsExecuted,
      method: result.method
    }, 'AutonomousCoordinator')

    return result
  }

  /**
   * Execute autonomous tick for all active agents
   */
  async executeTickForAllAgents(runtime: IAgentRuntime): Promise<{
    agentsProcessed: number
    totalActions: number
    errors: number
  }> {
    // Get all agents with autonomous features enabled
    const activeAgents = await prisma.user.findMany({
      where: {
        isAgent: true,
        OR: [
          { autonomousTrading: true },
          { autonomousPosting: true },
          { autonomousCommenting: true },
          { autonomousDMs: true },
          { autonomousGroupChats: true }
        ]
      },
      select: { id: true, displayName: true }
    })

    logger.info(`Processing ${activeAgents.length} active agents`, undefined, 'AutonomousCoordinator')

    let totalActions = 0
    let errors = 0

    for (const agent of activeAgents) {
      // Keep try/catch here to continue processing other agents if one fails
      try {
        const result = await this.executeAutonomousTick(agent.id, runtime)
        
        if (result.success) {
          const actionCount = Object.values(result.actionsExecuted).reduce((sum, count) => sum + count, 0)
          totalActions += actionCount
          
          logger.info(`Agent ${agent.displayName}: ${actionCount} actions in ${result.duration}ms`, undefined, 'AutonomousCoordinator')
        } else {
          errors++
        }

        // Small delay between agents to avoid overwhelming system
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        logger.error(`Failed to process agent ${agent.id}`, error, 'AutonomousCoordinator')
        errors++
      }
    }

    return {
      agentsProcessed: activeAgents.length,
      totalActions,
      errors
    }
  }
}

export const autonomousCoordinator = new AutonomousCoordinator()
