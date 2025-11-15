/**
 * Action-Level Instrumentation
 * 
 * Wraps actions with trajectory logging
 */

import type { TrajectoryLoggerService } from './TrajectoryLoggerService';
import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions } from '@elizaos/core';
import type { Plugin } from '@elizaos/core';
import type { JsonValue } from '@/types/common';
import { logger } from '@/lib/logger';

/**
 * Context for trajectory logging during action execution
 */
interface TrajectoryContext {
  trajectoryId: string;
  logger: TrajectoryLoggerService;
}

// Global context storage (per runtime instance)
const trajectoryContexts = new WeakMap<IAgentRuntime, TrajectoryContext>();

/**
 * Set trajectory context for a runtime
 */
export function setTrajectoryContext(
  runtime: IAgentRuntime,
  trajectoryId: string,
  trajectoryLogger: TrajectoryLoggerService
): void {
  trajectoryContexts.set(runtime, { trajectoryId, logger: trajectoryLogger });
}

/**
 * Get trajectory context for a runtime
 */
export function getTrajectoryContext(runtime: IAgentRuntime): TrajectoryContext | null {
  return trajectoryContexts.get(runtime) || null;
}

/**
 * Wrap an action with logging
 */
export function wrapActionWithLogging(
  action: Action,
  _trajectoryLogger: TrajectoryLoggerService
): Action {
  const originalHandler = action.handler;

  return {
    ...action,
    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
      options?: unknown,
      callback?: HandlerCallback
    ): Promise<void> => {
      const context = getTrajectoryContext(runtime);
      if (!context) {
        // No trajectory context - execute without logging
        if (originalHandler) {
          await originalHandler(runtime, message, state, options as HandlerOptions | undefined, callback);
        }
        return;
      }

      const { trajectoryId, logger: loggerService } = context;
      const stepId = loggerService.getCurrentStepId(trajectoryId);

      if (!stepId) {
        logger.warn('No active step for action execution', {
          action: action.name,
          trajectoryId,
        });
        if (originalHandler) {
          await originalHandler(runtime, message, state, options as HandlerOptions | undefined, callback);
        }
        return;
      }

      let success = false;
      let error: string | undefined;
      let result: Record<string, unknown> | undefined;

      try {
        // Execute action
        if (originalHandler) {
          await originalHandler(runtime, message, state, options as HandlerOptions | undefined, callback);
        }
        success = true;
        result = { executed: true };
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        logger.error('Action execution failed', {
          action: action.name,
          trajectoryId,
          error,
        }, 'ActionInterceptor');
        throw err;
      } finally {
        // Complete step with action result
        loggerService.completeStep(
          trajectoryId,
          stepId,
          {
            actionType: action.name,
            actionName: action.name,
            parameters: {
              message: message.content.text || '',
              state: state ? JSON.parse(JSON.stringify(state)) : undefined,
            },
            success,
            result: result || { error },
            reasoning: `Action ${action.name} executed via ${action.description || 'handler'}`,
          },
          {
            reward: success ? 0.1 : -0.1, // Small reward for successful execution
          }
        );
      }
    },
  };
}

/**
 * Wrap all plugin actions
 */
export function wrapPluginActions(
  plugin: Plugin,
  trajectoryLogger: TrajectoryLoggerService
): Plugin {
  if (!plugin.actions || plugin.actions.length === 0) {
    return plugin;
  }

  return {
    ...plugin,
    actions: plugin.actions.map((action) => wrapActionWithLogging(action, trajectoryLogger)),
  };
}

/**
 * Log LLM call from action context
 */
export function logLLMCallFromAction(
  actionContext: Record<string, JsonValue>,
  trajectoryLogger: TrajectoryLoggerService,
  trajectoryId: string
): void {
  const stepId = trajectoryLogger.getCurrentStepId(trajectoryId);
  if (!stepId) {
    logger.warn('No active step for LLM call from action', { trajectoryId });
    return;
  }

  trajectoryLogger.logLLMCall(stepId, {
    model: (actionContext.model as string) || 'unknown',
    systemPrompt: (actionContext.systemPrompt as string) || '',
    userPrompt: (actionContext.userPrompt as string) || '',
    response: (actionContext.response as string) || '',
    reasoning: (actionContext.reasoning as string) || undefined,
    temperature: (actionContext.temperature as number) || 0.7,
    maxTokens: (actionContext.maxTokens as number) || 8192,
    purpose: (actionContext.purpose as 'action' | 'reasoning' | 'evaluation' | 'response' | 'other') || 'action',
    actionType: (actionContext.actionType as string) || undefined,
    promptTokens: (actionContext.promptTokens as number) || undefined,
    completionTokens: (actionContext.completionTokens as number) || undefined,
    latencyMs: (actionContext.latencyMs as number) || undefined,
  });
}

/**
 * Log provider access from action context
 */
export function logProviderFromAction(
  actionContext: Record<string, JsonValue>,
  trajectoryLogger: TrajectoryLoggerService,
  trajectoryId: string
): void {
  const stepId = trajectoryLogger.getCurrentStepId(trajectoryId);
  if (!stepId) {
    logger.warn('No active step for provider access from action', { trajectoryId });
    return;
  }

  trajectoryLogger.logProviderAccess(stepId, {
    providerName: (actionContext.providerName as string) || 'unknown',
    data: (actionContext.data as Record<string, unknown>) || {},
    purpose: (actionContext.purpose as string) || 'action',
    query: (actionContext.query as Record<string, unknown>) || undefined,
  });
}

/**
 * Wrap a provider with trajectory logging
 */
export function wrapProviderWithLogging(
  provider: import('@elizaos/core').Provider,
  _trajectoryLogger: TrajectoryLoggerService
): import('@elizaos/core').Provider {
  const originalGet = provider.get;

  return {
    ...provider,
    get: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: State
    ): Promise<import('@elizaos/core').ProviderResult> => {
      const context = getTrajectoryContext(runtime);
      if (!context) {
        // No trajectory context - execute without logging
        return originalGet?.(runtime, message, state) || { text: '' };
      }

      const { trajectoryId, logger: loggerService } = context;
      const stepId = loggerService.getCurrentStepId(trajectoryId);

      if (!stepId) {
        logger.warn('No active step for provider access', {
          provider: provider.name,
          trajectoryId,
        });
        return originalGet?.(runtime, message, state) || { text: '' };
      }

      let result: import('@elizaos/core').ProviderResult = { text: '' };
      let error: string | undefined;
      let success = false;

      try {
        result = await originalGet?.(runtime, message, state) || { text: '' };
        success = true;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        logger.error('Provider access failed', {
          provider: provider.name,
          trajectoryId,
          error,
        }, 'ProviderInterceptor');
        // Don't throw here - log the error and return empty result
        result = { text: `ERROR: ${error}` };
      } finally {
        // Log provider access (even on error)
        loggerService.logProviderAccess(stepId, {
          providerName: provider.name,
          data: {
            text: result.text || '',
            success,
            error: error || undefined,
          },
          purpose: `Provider ${provider.name} accessed for context`,
          query: {
            message: message.content.text || '',
            state: state ? JSON.parse(JSON.stringify(state)) : undefined,
          },
        });
      }

      // Re-throw error if it occurred (after logging)
      if (error) {
        throw new Error(error);
      }

      return result;
    },
  };
}

/**
 * Wrap all plugin providers with trajectory logging
 */
export function wrapPluginProviders(
  plugin: Plugin,
  trajectoryLogger: TrajectoryLoggerService
): Plugin {
  if (!plugin.providers || plugin.providers.length === 0) {
    return plugin;
  }

  return {
    ...plugin,
    providers: plugin.providers.map((provider) => wrapProviderWithLogging(provider, trajectoryLogger)),
  };
}

