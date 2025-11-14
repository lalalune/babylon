/**
 * Trajectory Logger Service
 * 
 * Core service for collecting agent interaction trajectories for RL training
 */

import type { 
  Trajectory, 
  TrajectoryStep, 
  LLMCall, 
  ProviderAccess, 
  ActionAttempt, 
  EnvironmentState,
  RewardComponents 
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class TrajectoryLoggerService {
  private activeTrajectories: Map<string, Trajectory> = new Map();

  /**
   * Start a new trajectory
   */
  startTrajectory(
    agentId: string,
    options: {
      scenarioId?: string;
      episodeId?: string;
      batchId?: string;
      groupIndex?: number;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    const trajectoryId = uuidv4();
    const now = Date.now();

    const trajectory: Trajectory = {
      trajectoryId: trajectoryId as any,
      agentId: agentId as any,
      startTime: now,
      endTime: now,
      durationMs: 0,
      episodeId: options.episodeId,
      scenarioId: options.scenarioId,
      batchId: options.batchId,
      groupIndex: options.groupIndex,
      steps: [],
      totalReward: 0,
      rewardComponents: {
        environmentReward: 0,
      },
      metrics: {
        episodeLength: 0,
        finalStatus: 'completed',
      },
      metadata: options.metadata || {},
    };

    this.activeTrajectories.set(trajectoryId, trajectory);
    return trajectoryId;
  }

  /**
   * Start a new step in the trajectory
   */
  startStep(trajectoryId: string, envState: EnvironmentState): string {
    const stepId = uuidv4();
    const trajectory = this.activeTrajectories.get(trajectoryId);
    
    if (!trajectory) {
      throw new Error(`Trajectory ${trajectoryId} not found`);
    }

    const step: TrajectoryStep = {
      stepId: stepId as any,
      stepNumber: trajectory.steps.length,
      timestamp: envState.timestamp,
      environmentState: envState,
      observation: {},
      llmCalls: [],
      providerAccesses: [],
      action: {
        attemptId: '',
        timestamp: 0,
        actionType: 'pending',
        actionName: 'pending',
        parameters: {},
        success: false,
      },
      reward: 0,
      done: false,
    };

    trajectory.steps.push(step);
    return stepId;
  }

  /**
   * Log an LLM call
   */
  logLLMCall(stepId: string, llmCall: Omit<LLMCall, 'callId' | 'timestamp'>): void {
    const trajectory = this.findTrajectoryByStepId(stepId);
    if (!trajectory) return;

    const step = trajectory.steps.find(s => s.stepId === stepId);
    if (!step) return;

    const fullLLMCall: LLMCall = {
      callId: uuidv4() as any,
      timestamp: Date.now(),
      ...llmCall,
    };

    step.llmCalls.push(fullLLMCall);
  }

  /**
   * Log provider access
   */
  logProviderAccess(stepId: string, access: Omit<ProviderAccess, 'providerId' | 'timestamp'>): void {
    const trajectory = this.findTrajectoryByStepId(stepId);
    if (!trajectory) return;

    const step = trajectory.steps.find(s => s.stepId === stepId);
    if (!step) return;

    const fullAccess: ProviderAccess = {
      providerId: uuidv4(),
      timestamp: Date.now(),
      ...access,
    };

    step.providerAccesses.push(fullAccess);
  }

  /**
   * Complete a step with action and reward
   */
  completeStep(
    trajectoryId: string,
    stepId: string,
    action: Omit<ActionAttempt, 'attemptId' | 'timestamp'>,
    rewardInfo?: { reward?: number; components?: Partial<RewardComponents> }
  ): void {
    const trajectory = this.activeTrajectories.get(trajectoryId);
    if (!trajectory) return;

    const step = trajectory.steps.find(s => s.stepId === stepId);
    if (!step) return;

    step.action = {
      attemptId: uuidv4() as any,
      timestamp: Date.now(),
      ...action,
    };

    if (rewardInfo?.reward !== undefined) {
      step.reward = rewardInfo.reward;
      trajectory.totalReward += rewardInfo.reward;
    }

    if (rewardInfo?.components) {
      trajectory.rewardComponents = {
        ...trajectory.rewardComponents,
        ...rewardInfo.components,
      };
    }
  }

  /**
   * End trajectory
   */
  async endTrajectory(
    trajectoryId: string,
    status: 'completed' | 'terminated' | 'error' | 'timeout',
    finalMetrics?: Record<string, any>
  ): Promise<void> {
    const trajectory = this.activeTrajectories.get(trajectoryId);
    if (!trajectory) return;

    trajectory.endTime = Date.now();
    trajectory.durationMs = trajectory.endTime - trajectory.startTime;
    trajectory.metrics.finalStatus = status;
    trajectory.metrics.episodeLength = trajectory.steps.length;

    if (finalMetrics) {
      trajectory.metrics = {
        ...trajectory.metrics,
        ...finalMetrics,
      };
    }

    // In a real implementation, this would save to database
    // For now, keep in memory for tests
    this.activeTrajectories.delete(trajectoryId);
    
    // Store completed trajectory for retrieval
    this.activeTrajectories.set(trajectoryId, trajectory);
  }

  /**
   * Get active trajectory
   */
  getActiveTrajectory(trajectoryId: string): Trajectory | null {
    return this.activeTrajectories.get(trajectoryId) || null;
  }

  /**
   * Helper to find trajectory by step ID
   */
  private findTrajectoryByStepId(stepId: string): Trajectory | null {
    for (const trajectory of this.activeTrajectories.values()) {
      if (trajectory.steps.some(s => s.stepId === stepId)) {
        return trajectory;
      }
    }
    return null;
  }
}

