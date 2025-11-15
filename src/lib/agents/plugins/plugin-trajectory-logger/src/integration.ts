/**
 * Manual Instrumentation Helpers
 * 
 * Advanced manual control for trajectory logging
 */

import type { TrajectoryLoggerService } from './TrajectoryLoggerService';
import type { EnvironmentState } from './types';
import { logger } from '@/lib/logger';

/**
 * Start an autonomous tick (creates a new trajectory)
 */
export function startAutonomousTick(
  trajectoryLogger: TrajectoryLoggerService,
  context: {
    agentId: string;
    scenarioId?: string;
    episodeId?: string;
    batchId?: string;
    metadata?: Record<string, unknown>;
  }
): string {
  const trajectoryId = trajectoryLogger.startTrajectory(context.agentId, {
    scenarioId: context.scenarioId,
    episodeId: context.episodeId,
    batchId: context.batchId,
    metadata: context.metadata,
  });

  // Start first step
  const envState: EnvironmentState = {
    timestamp: Date.now(),
    agentBalance: 0,
    agentPoints: 0,
    agentPnL: 0,
    openPositions: 0,
  };

  trajectoryLogger.startStep(trajectoryId, envState);

  logger.info('Started autonomous tick trajectory', {
    trajectoryId,
    agentId: context.agentId,
  }, 'TrajectoryIntegration');

  return trajectoryId;
}

/**
 * End an autonomous tick (ends trajectory)
 */
export async function endAutonomousTick(
  trajectoryLogger: TrajectoryLoggerService,
  trajectoryId: string,
  status: 'completed' | 'terminated' | 'error' | 'timeout' = 'completed',
  finalMetrics?: Record<string, unknown>
): Promise<void> {
  await trajectoryLogger.endTrajectory(trajectoryId, status, finalMetrics);

  logger.info('Ended autonomous tick trajectory', {
    trajectoryId,
    status,
  }, 'TrajectoryIntegration');
}

/**
 * Logged LLM call (wrapper that logs and executes)
 */
export async function loggedLLMCall(
  trajectoryLogger: TrajectoryLoggerService,
  trajectoryId: string,
  options: {
    model: string;
    modelVersion?: string; // RL model version if using trained model
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    purpose?: 'action' | 'reasoning' | 'evaluation' | 'response' | 'other';
    actionType?: string;
  },
  llmCallFn: () => Promise<{ text: string; reasoning?: string; tokens?: { prompt?: number; completion?: number }; latencyMs?: number }>
): Promise<string> {
  const stepId = trajectoryLogger.getCurrentStepId(trajectoryId);
  if (!stepId) {
    logger.warn('No active step for LLM call', { trajectoryId });
    // Execute anyway without logging
    const result = await llmCallFn();
    return result.text;
  }

  const startTime = Date.now();
  const result = await llmCallFn();
  const latencyMs = Date.now() - startTime;

  // Log the LLM call with model version
  trajectoryLogger.logLLMCall(stepId, {
    model: options.model,
    modelVersion: options.modelVersion,
    systemPrompt: options.systemPrompt,
    userPrompt: options.userPrompt,
    response: result.text,
    reasoning: result.reasoning,
    temperature: options.temperature || 0.7,
    maxTokens: options.maxTokens || 8192,
    purpose: options.purpose || 'action',
    actionType: options.actionType,
    promptTokens: result.tokens?.prompt,
    completionTokens: result.tokens?.completion,
    latencyMs: result.latencyMs || latencyMs,
  });

  return result.text;
}

/**
 * Log provider access
 */
export function logProviderAccess(
  trajectoryLogger: TrajectoryLoggerService,
  trajectoryId: string,
  access: {
    providerName: string;
    data: Record<string, unknown>;
    purpose: string;
    query?: Record<string, unknown>;
  }
): void {
  trajectoryLogger.logProviderAccessByTrajectoryId(trajectoryId, access);
}

/**
 * Wrap function with trajectory logging
 */
export function withTrajectoryLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  trajectoryLogger: TrajectoryLoggerService,
  trajectoryId: string,
  context: {
    actionType?: string;
    purpose?: string;
  } = {}
): T {
  return (async (...args: unknown[]) => {
    const stepId = trajectoryLogger.getCurrentStepId(trajectoryId);
    if (!stepId) {
      // No active step - execute without logging
      return fn(...args);
    }

    let success = false;
    let error: string | undefined;
    let result: unknown;

    try {
      result = await fn(...args);
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      // Log as action attempt
      trajectoryLogger.completeStep(
        trajectoryId,
        stepId,
        {
          actionType: context.actionType || 'function_call',
          actionName: fn.name || 'anonymous',
          parameters: { args: JSON.parse(JSON.stringify(args)) },
          success,
          result: success ? { result: JSON.parse(JSON.stringify(result)) } : { error },
        },
        {
          reward: success ? 0.05 : -0.05,
        }
      );
    }
  }) as T;
}

