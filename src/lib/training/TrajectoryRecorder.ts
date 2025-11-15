/**
 * Production Trajectory Recorder
 * 
 * Records agent decisions with EVERYTHING needed for ART/GRPO/RULER.
 * Integrates directly with Babylon's autonomous agents.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { getCurrentWindowId } from './window-utils';
import type { TrajectoryStep, EnvironmentState, ProviderAccess, LLMCall, Action } from './types';

export type { TrajectoryStep, EnvironmentState, ProviderAccess, LLMCall, Action };

// Legacy exports for backward compatibility
export type RecordedLLMCall = LLMCall;
export type RecordedStep = TrajectoryStep;

interface ActiveTrajectory {
  trajectoryId: string;
  agentId: string;
  scenarioId?: string;
  startTime: number;
  steps: TrajectoryStep[];
  currentStep?: Partial<TrajectoryStep>;
}

export class TrajectoryRecorder {
  private activeTrajectories: Map<string, ActiveTrajectory> = new Map();

  /**
   * Start recording a new trajectory
   */
  async startTrajectory(options: {
    agentId: string;
    scenarioId?: string;
    windowId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const trajectoryId = await generateSnowflakeId();
    
    // Ensure window_id is always set (critical for RL training!)
    const windowId = options.windowId || getCurrentWindowId();
    
    this.activeTrajectories.set(trajectoryId, {
      trajectoryId,
      agentId: options.agentId,
      scenarioId: options.scenarioId || windowId, // Use windowId as scenarioId if not provided
      startTime: Date.now(),
      steps: []
    });

    logger.info('Started trajectory recording', {
      trajectoryId,
      agentId: options.agentId,
      scenarioId: options.scenarioId,
      windowId  // Log window_id for debugging
    });

    return trajectoryId;
  }

  /**
   * Start a new step
   */
  startStep(trajectoryId: string, environmentState: EnvironmentState): void {
    const traj = this.activeTrajectories.get(trajectoryId);
    if (!traj) {
      logger.warn('Trajectory not found for startStep', { trajectoryId });
      return;
    }

    traj.currentStep = {
      stepNumber: traj.steps.length,
      timestamp: Date.now(),
      environmentState,
      providerAccesses: [],
      llmCalls: [],
      reward: 0
    };
  }

  /**
   * Log provider access
   */
  logProviderAccess(trajectoryId: string, access: {
    providerName: string;
    data: Record<string, unknown>;
    purpose: string;
  }): void {
    const traj = this.activeTrajectories.get(trajectoryId);
    if (!traj?.currentStep) {
      logger.warn('No current step for provider access', { trajectoryId });
      return;
    }

    if (!traj.currentStep.providerAccesses) {
      traj.currentStep.providerAccesses = [];
    }
    traj.currentStep.providerAccesses.push(access);
  }

  /**
   * Log LLM call
   */
  logLLMCall(trajectoryId: string, llmCall: RecordedLLMCall): void {
    const traj = this.activeTrajectories.get(trajectoryId);
    if (!traj?.currentStep) {
      logger.warn('No current step for LLM call', { trajectoryId });
      return;
    }

    if (!traj.currentStep.llmCalls) {
      traj.currentStep.llmCalls = [];
    }
    traj.currentStep.llmCalls.push(llmCall);
  }

  /**
   * Complete current step
   */
  completeStep(trajectoryId: string, action: Action, reward: number = 0): void {
    const traj = this.activeTrajectories.get(trajectoryId);
    if (!traj?.currentStep) {
      logger.warn('No current step to complete', { trajectoryId });
      return;
    }

    // Merge correctness from action if present
    const finalAction: Action = {
      ...action,
      correctness: action.correctness || undefined
    };

    const completeStep: TrajectoryStep = {
      stepNumber: traj.currentStep.stepNumber!,
      timestamp: traj.currentStep.timestamp!,
      environmentState: traj.currentStep.environmentState!,
      providerAccesses: traj.currentStep.providerAccesses || [],
      llmCalls: traj.currentStep.llmCalls || [],
      action: finalAction,
      reward
    };

    traj.steps.push(completeStep);
    traj.currentStep = undefined;
  }

  /**
   * End trajectory and save to database
   */
  async endTrajectory(trajectoryId: string, options: {
    finalBalance?: number;
    finalPnL?: number;
    windowId?: string;
    gameKnowledge?: {
      trueProbabilities?: Record<string, number>;
      actualOutcomes?: Record<string, unknown>;
      futureOutcomes?: Record<string, unknown>;
    };
  } = {}): Promise<void> {
    const traj = this.activeTrajectories.get(trajectoryId);
    if (!traj) {
      logger.warn('Trajectory not found for end', { trajectoryId });
      return;
    }

    const endTime = Date.now();
    const durationMs = endTime - traj.startTime;
    const totalReward = traj.steps.reduce((sum, step) => sum + step.reward, 0);

    // Calculate metrics
    const tradesExecuted = traj.steps.filter(s => 
      s.action.actionType.includes('BUY') || s.action.actionType.includes('SELL')
    ).length;

    const postsCreated = traj.steps.filter(s => 
      s.action.actionType.includes('POST')
    ).length;

    const errorCount = traj.steps.filter(s => !s.action.success).length;

    // Auto-generate window ID if not provided
    const windowId = options.windowId || getCurrentWindowId();
    
    // Save to database with error handling
    try {
      await prisma.trajectory.create({
        data: {
          id: await generateSnowflakeId(),
          trajectoryId,
          agentId: traj.agentId,
          startTime: new Date(traj.startTime),
          endTime: new Date(endTime),
          durationMs,
          scenarioId: traj.scenarioId || windowId,
          episodeId: traj.scenarioId ? `${traj.scenarioId}-${Date.now()}` : undefined,
          windowId,
          windowHours: 1,
          
          // JSON data
          stepsJson: JSON.stringify(traj.steps),
          rewardComponentsJson: JSON.stringify({ environmentReward: totalReward }),
          metricsJson: JSON.stringify({
            episodeLength: traj.steps.length,
            finalStatus: errorCount > 0 ? 'completed_with_errors' : 'completed',
            finalBalance: options.finalBalance,
            finalPnL: options.finalPnL,
            tradesExecuted,
            postsCreated,
            errorCount
          }),
          metadataJson: JSON.stringify({
            isTrainingData: true,
            gameKnowledge: options.gameKnowledge || {}
          }),
          
          // Quick access
          totalReward,
          episodeLength: traj.steps.length,
          finalStatus: errorCount > 0 ? 'completed_with_errors' : 'completed',
          finalBalance: options.finalBalance,
          finalPnL: options.finalPnL,
          tradesExecuted,
          postsCreated,
          isTrainingData: true,
          isEvaluation: false,
          usedInTraining: false
        }
      });
    } catch (error) {
      logger.error('Failed to save trajectory to database', {
        trajectoryId,
        agentId: traj.agentId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: (error as { code?: string })?.code
      });
      throw error; // Re-throw to let caller handle
    }

    // Save LLM calls separately for analysis
    try {
      for (const step of traj.steps) {
        for (const llmCall of step.llmCalls) {
          await prisma.llmCallLog.create({
            data: {
              id: await generateSnowflakeId(),
              trajectoryId,
              stepId: `${trajectoryId}-step-${step.stepNumber}`,
              callId: `${trajectoryId}-call-${step.stepNumber}-${step.llmCalls.indexOf(llmCall)}`,
              timestamp: new Date(step.timestamp),
              latencyMs: llmCall.latencyMs,
              model: llmCall.model,
              purpose: llmCall.purpose,
              actionType: llmCall.actionType,
              systemPrompt: llmCall.systemPrompt,
              userPrompt: llmCall.userPrompt,
              messagesJson: JSON.stringify([
                { role: 'system', content: llmCall.systemPrompt },
                { role: 'user', content: llmCall.userPrompt }
              ]),
              response: llmCall.response,
              reasoning: llmCall.reasoning,
              temperature: llmCall.temperature,
              maxTokens: llmCall.maxTokens,
              metadata: JSON.stringify({
                modelVersion: llmCall.modelVersion // Store model version in metadata
              })
            }
          });
        }
      }
    } catch (error) {
      // Log but don't fail - trajectory is already saved
      logger.warn('Failed to save some LLM call logs', {
        trajectoryId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    this.activeTrajectories.delete(trajectoryId);

    logger.info('Trajectory saved to database', {
      trajectoryId,
      steps: traj.steps.length,
      reward: totalReward,
      duration: durationMs
    });
  }

  /**
   * Get active trajectory
   */
  getActiveTrajectory(trajectoryId: string) {
    return this.activeTrajectories.get(trajectoryId);
  }
}

// Singleton instance
export const trajectoryRecorder = new TrajectoryRecorder();

