/**
 * Autonomous Coordinator with Trajectory Recording
 * 
 * Integrates trajectory recording into the autonomous tick system.
 * Records EVERY decision for RL training.
 */

import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';
import type { IAgentRuntime } from '@elizaos/core';
import { trajectoryRecorder } from '../training/TrajectoryRecorder';
import { WalletService } from '@/lib/services/wallet-service';

// Import existing services
import { autonomousA2AService } from '../agents/autonomous/AutonomousA2AService';
import { autonomousBatchResponseService } from '../agents/autonomous/AutonomousBatchResponseService';
import { autonomousTradingService } from '../agents/autonomous/AutonomousTradingService';
import { autonomousPostingService } from '../agents/autonomous/AutonomousPostingService';
import { autonomousCommentingService } from '../agents/autonomous/AutonomousCommentingService';

export interface AutonomousTickResult {
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
  ): Promise<AutonomousTickResult> {
    const startTime = Date.now();

    // START TRAJECTORY RECORDING
    const trajId = await trajectoryRecorder.startTrajectory({
      agentId: agentUserId,
      metadata: {
        tickType: 'autonomous',
        startTime
      }
    });

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
        // START STEP for trading
        trajectoryRecorder.startStep(trajId, await this.captureEnvironmentState(agentUserId));

        if (useA2A) {
          const tradeResult = await autonomousA2AService.executeA2ATrade(agentUserId, runtime);
          if (tradeResult.success) {
            result.actionsExecuted.trades++;
          }
        } else {
          const tradesExecuted = await autonomousTradingService.executeTrades(agentUserId, runtime);
          result.actionsExecuted.trades += tradesExecuted;
        }

        // COMPLETE STEP
        trajectoryRecorder.completeStep(trajId, {
          actionType: 'TRADING_DECISION',
          parameters: { method: useA2A ? 'a2a' : 'database' },
          success: result.actionsExecuted.trades > 0
        }, result.actionsExecuted.trades > 0 ? 0.5 : 0);
      }

      // === POSTING ===
      if (agent.autonomousPosting) {
        // START STEP
        trajectoryRecorder.startStep(trajId, await this.captureEnvironmentState(agentUserId));

        const postId = await autonomousPostingService.createAgentPost(agentUserId, runtime);
        if (postId) {
          result.actionsExecuted.posts++;
        }

        // COMPLETE STEP
        trajectoryRecorder.completeStep(trajId, {
          actionType: 'CREATE_POST',
          parameters: { postId },
          success: !!postId,
          result: postId ? { postId } : undefined
        }, postId ? 0.3 : 0);
      }

      // === COMMENTING ===
      if (agent.autonomousCommenting) {
        // START STEP
        trajectoryRecorder.startStep(trajId, await this.captureEnvironmentState(agentUserId));

        const commentId = await autonomousCommentingService.createAgentComment(agentUserId, runtime);
        if (commentId) {
          result.actionsExecuted.comments++;
        }

        // COMPLETE STEP
        trajectoryRecorder.completeStep(trajId, {
          actionType: 'CREATE_COMMENT',
          parameters: { commentId },
          success: !!commentId,
          result: commentId ? { commentId } : undefined
        }, commentId ? 0.2 : 0);
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

