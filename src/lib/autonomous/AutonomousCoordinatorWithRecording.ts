/**
 * Autonomous Coordinator with Trajectory Recording
 * 
 * Integrates trajectory recording into the autonomous tick system.
 * Records EVERY decision for RL training.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { IAgentRuntime } from '@elizaos/core';
import { trajectoryRecorder } from '../training/TrajectoryRecorder';
import { WalletService } from '@/lib/services/wallet-service';
import { agentRuntimeManager } from '../agents/runtime/AgentRuntimeManager';
import { setTrajectoryContext } from '../agents/plugins/plugin-trajectory-logger/src/action-interceptor';

// Import existing services
import { autonomousA2AService } from '../agents/autonomous/AutonomousA2AService';
import { autonomousBatchResponseService } from '../agents/autonomous/AutonomousBatchResponseService';
import { autonomousTradingService } from '../agents/autonomous/AutonomousTradingService';
import { autonomousPostingService } from '../agents/autonomous/AutonomousPostingService';
import { autonomousCommentingService } from '../agents/autonomous/AutonomousCommentingService';

// Use the canonical AutonomousTickResult from AutonomousCoordinator
// This version extends it with trajectory info
export interface AutonomousTickResultWithTrajectory {
  success: boolean;
  actionsExecuted: {
    trades: number;
    posts: number;
    comments: number;
    messages: number;
    groupMessages: number;
    engagements: number;
  };
  method: 'a2a' | 'database';
  duration: number;
  trajectoryId?: string;
}

export class AutonomousCoordinatorWithRecording {
  /**
   * Execute autonomous tick with FULL trajectory recording
   */
  async executeAutonomousTick(
    agentUserId: string,
    runtime: IAgentRuntime
  ): Promise<AutonomousTickResultWithTrajectory> {
    const startTime = Date.now();

    // START TRAJECTORY RECORDING
    const trajId = await trajectoryRecorder.startTrajectory({
      agentId: agentUserId,
      metadata: {
        tickType: 'autonomous',
        startTime
      }
    });

    // Set trajectory context on runtime for action/provider logging
    const trajectoryLogger = agentRuntimeManager.getTrajectoryLogger(agentUserId);
    if (trajectoryLogger) {
      setTrajectoryContext(runtime, trajId, trajectoryLogger);
      // Also set current trajectory ID on runtime for LLM call logging
      (runtime as unknown as { currentTrajectoryId?: string }).currentTrajectoryId = trajId;
    }

    const result: AutonomousTickResultWithTrajectory = {
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
      duration: 0,
      trajectoryId: trajId
    };

    try {
      logger.info(`Starting autonomous tick for agent ${agentUserId}`, undefined, 'AutonomousCoordinator');

      // Get agent config
      const agent = await prisma.user.findUnique({
        where: { id: agentUserId },
        select: {
          isAgent: true,
          autonomousTrading: true,
          autonomousPosting: true,
          autonomousCommenting: true,
          autonomousDMs: true,
          autonomousGroupChats: true
        }
      });

      if (!agent || !agent.isAgent) {
        throw new Error('Agent not found');
      }

      const useA2A = (runtime as { a2aClient?: { isConnected: () => boolean } }).a2aClient?.isConnected() || false;
      result.method = useA2A ? 'a2a' : 'database';

      // === RESPONSES ===
      const responses = await autonomousBatchResponseService.processBatch(agentUserId, runtime);
      result.actionsExecuted.comments += responses;
      result.actionsExecuted.messages += responses;

      // === TRADING ===
      if (agent.autonomousTrading) {
        // Capture initial state before trading
        const initialState = await this.captureEnvironmentState(agentUserId);
        trajectoryRecorder.startStep(trajId, initialState);

        let tradeInfo: { marketId?: string; ticker?: string; side?: string; marketType?: 'prediction' | 'perp' } = {};
        
        if (useA2A) {
          const tradeResult = await autonomousA2AService.executeA2ATrade(agentUserId, runtime);
          if (tradeResult.success) {
            result.actionsExecuted.trades++;
            tradeInfo = {
              marketId: tradeResult.marketId,
              ticker: tradeResult.ticker,
              side: tradeResult.side,
              marketType: tradeResult.marketType
            };
          }
        } else {
          const tradeResult = await autonomousTradingService.executeTrades(agentUserId, runtime);
          result.actionsExecuted.trades += tradeResult.tradesExecuted;
          tradeInfo = {
            marketId: tradeResult.marketId,
            ticker: tradeResult.ticker,
            side: tradeResult.side,
            marketType: tradeResult.marketType
          };
        }

        // Capture state after trading to calculate reward
        const afterState = await this.captureEnvironmentState(agentUserId);
        
        // Calculate reward based on P&L change
        // Note: lifetimePnL updates asynchronously, so immediate reward may be 0
        // The RewardBackpropagationService will update rewards when outcomes are known
        const pnlChange = afterState.agentPnL - initialState.agentPnL;
        
        // For immediate reward, use a small positive reward if trade executed successfully
        // The actual P&L-based reward will be backpropagated when market outcomes are known
        let reward = 0;
        if (result.actionsExecuted.trades > 0) {
          // Small positive reward for taking action (encourages exploration)
          // Actual reward will be calculated later based on outcomes
          reward = 0.1;
          
          // If we can detect immediate P&L change, use it (but it's usually 0)
          if (pnlChange !== 0) {
            // Normalize: scale by 1000 to get meaningful rewards (e.g., $10 P&L = 0.01 reward)
            // Cap at -1 to 1 range
            reward = Math.max(-1, Math.min(1, pnlChange / 1000));
          }
        }

        // COMPLETE STEP with calculated reward and market identifiers
        trajectoryRecorder.completeStep(trajId, {
          actionType: 'TRADING_DECISION',
          parameters: { 
            method: useA2A ? 'a2a' : 'database',
            pnlChange,
            initialPnL: initialState.agentPnL,
            finalPnL: afterState.agentPnL,
            // Include market identifiers for reward backpropagation
            marketId: tradeInfo.marketId,
            ticker: tradeInfo.ticker,
            side: tradeInfo.side,
            marketType: tradeInfo.marketType
          },
          success: result.actionsExecuted.trades > 0
        }, reward);
      }

      // === POSTING ===
      if (agent.autonomousPosting) {
        // START STEP
        const initialState = await this.captureEnvironmentState(agentUserId);
        trajectoryRecorder.startStep(trajId, initialState);

        const postId = await autonomousPostingService.createAgentPost(agentUserId, runtime);
        if (postId) {
          result.actionsExecuted.posts++;
        }

        // Calculate reward based on engagement (if post was created)
        // For now, use small positive reward for successful post creation
        // In future, can enhance with actual engagement metrics (likes, comments, shares)
        let reward = 0;
        if (postId) {
          // Small positive reward for creating content (encourages participation)
          // Will be enhanced later with actual engagement metrics
          reward = 0.1;
        }

        // COMPLETE STEP
        trajectoryRecorder.completeStep(trajId, {
          actionType: 'CREATE_POST',
          parameters: { postId },
          success: !!postId,
          result: postId ? { postId } : undefined
        }, reward);
      }

      // === COMMENTING ===
      if (agent.autonomousCommenting) {
        // START STEP
        const initialState = await this.captureEnvironmentState(agentUserId);
        trajectoryRecorder.startStep(trajId, initialState);

        const commentId = await autonomousCommentingService.createAgentComment(agentUserId, runtime);
        if (commentId) {
          result.actionsExecuted.comments++;
        }

        // Calculate reward based on engagement
        // Small positive reward for creating content
        let reward = 0;
        if (commentId) {
          // Small positive reward for engagement (encourages participation)
          // Will be enhanced later with actual engagement metrics
          reward = 0.05;
        }

        // COMPLETE STEP
        trajectoryRecorder.completeStep(trajId, {
          actionType: 'CREATE_COMMENT',
          parameters: { commentId },
          success: !!commentId,
          result: commentId ? { commentId } : undefined
        }, reward);
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      // GET FINAL STATE
      const finalState = await this.captureEnvironmentState(agentUserId);

      // END TRAJECTORY with game knowledge
      await trajectoryRecorder.endTrajectory(trajId, {
        finalBalance: finalState.agentBalance,
        finalPnL: finalState.agentPnL,
        gameKnowledge: {
          // Add any known outcomes here
          trueProbabilities: {},
          actualOutcomes: {}
        }
      });

      logger.info('Autonomous tick completed', {
        agentId: agentUserId,
        duration: result.duration,
        actions: result.actionsExecuted,
        trajectoryId: trajId
      });

      return result;
    } finally {
      // Always try to end the trajectory
      if (!result.success) {
        result.duration = Date.now() - startTime;
        const finalState = await this.captureEnvironmentState(agentUserId);
        await trajectoryRecorder.endTrajectory(trajId, {
          finalBalance: finalState.agentBalance,
          finalPnL: finalState.agentPnL
        });
      }
    }
  }

  /**
   * Capture current environment state
   */
  private async captureEnvironmentState(agentUserId: string) {
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: {
        virtualBalance: true,
        lifetimePnL: true,
        reputationPoints: true
      }
    });

    const balance = await WalletService.getBalance(agentUserId);

    const [positions, perpPositions] = await Promise.all([
      prisma.position.count({ where: { userId: agentUserId, status: 'active' } }),
      prisma.perpPosition.count({ where: { userId: agentUserId, closedAt: null } })
    ]);

    const activeMarkets = await prisma.market.count({
      where: { resolved: false, endDate: { gte: new Date() } }
    });

    return {
      agentBalance: Number(balance.balance),
      agentPnL: Number(agent?.lifetimePnL ?? 0),
      openPositions: positions + perpPositions,
      activeMarkets,
      timestamp: Date.now()
    };
  }
}

export const autonomousCoordinatorWithRecording = new AutonomousCoordinatorWithRecording();

