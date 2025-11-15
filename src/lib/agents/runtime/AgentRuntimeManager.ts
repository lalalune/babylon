/**
 * Multi-Agent Runtime Manager
 * 
 * Manages multiple concurrent Eliza agent runtimes in a serverless environment.
 * Each agent gets its own isolated runtime instance with its own character configuration.
 */

import { AgentRuntime, type Character, type UUID, type Plugin } from '@elizaos/core'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { groqPlugin } from '../plugins/groq'
import { babylonPlugin } from '../plugins/babylon'
import { enhanceRuntimeWithBabylon } from '../plugins/babylon/integration'
import { experiencePlugin } from '../plugins/plugin-experience/src'
import { trajectoryLoggerPlugin } from '../plugins/plugin-trajectory-logger/src'
import { TrajectoryLoggerService } from '../plugins/plugin-trajectory-logger/src/TrajectoryLoggerService'
import { wrapPluginActions, wrapPluginProviders } from '../plugins/plugin-trajectory-logger/src/action-interceptor'
import type { JsonValue } from '@/types/common'

// Global runtime cache for warm container reuse
const globalRuntimes = new Map<string, AgentRuntime>()
// Global trajectory logger instances per agent
const trajectoryLoggers = new Map<string, TrajectoryLoggerService>()

export class AgentRuntimeManager {
  private static instance: AgentRuntimeManager

  private constructor() {
    logger.info('AgentRuntimeManager initialized', undefined, 'AgentRuntimeManager')
  }

  public static getInstance(): AgentRuntimeManager {
    if (!AgentRuntimeManager.instance) {
      AgentRuntimeManager.instance = new AgentRuntimeManager()
    }
    return AgentRuntimeManager.instance
  }

  /**
   * Get or create a runtime for a specific agent (agent is a User with isAgent=true)
   */
  public async getRuntime(agentUserId: string): Promise<AgentRuntime> {
    // Check cache first
    if (globalRuntimes.has(agentUserId)) {
      const runtime = globalRuntimes.get(agentUserId)!
      logger.info(`Using cached runtime for agent ${agentUserId}`, undefined, 'AgentRuntimeManager')
      return runtime
    }

    // Fetch agent user from database
    const agentUser = await prisma.user.findUnique({
      where: { id: agentUserId }
    })

    if (!agentUser) {
      throw new Error(`Agent user ${agentUserId} not found`)
    }

    if (!agentUser.isAgent) {
      throw new Error(`User ${agentUserId} is not an agent`)
    }

    const parseBio = (): string[] => {
      if (!agentUser.agentMessageExamples) {
        return [agentUser.bio || '']
      }
      
      try {
        const parsed = JSON.parse(agentUser.agentMessageExamples as string)
        if (Array.isArray(parsed)) {
          return parsed
        }
        logger.warn('agentMessageExamples is not an array, using bio', {
          agentId: agentUser.id,
          type: typeof parsed
        }, 'AgentRuntimeManager')
        return [agentUser.bio || '']
      } catch (error) {
        const exampleValue = agentUser.agentMessageExamples
        const displayValue = typeof exampleValue === 'string' 
          ? exampleValue.substring(0, 50) 
          : String(exampleValue)
        
        logger.warn('Failed to parse agentMessageExamples, using bio', {
          agentId: agentUser.id,
          value: displayValue,
          error: error instanceof Error ? error.message : String(error)
        }, 'AgentRuntimeManager')
        return [agentUser.bio || '']
      }
    }

    const parseStyle = (): Record<string, JsonValue> | undefined => {
      if (!agentUser.agentStyle) {
        return undefined
      }
      
      try {
        return JSON.parse(agentUser.agentStyle as string) as Record<string, JsonValue>
      } catch (error) {
        const styleValue = agentUser.agentStyle
        const displayValue = typeof styleValue === 'string' 
          ? styleValue.substring(0, 50) 
          : String(styleValue)
        
        logger.warn('Failed to parse agentStyle, using defaults', {
          agentId: agentUser.id,
          value: displayValue,
          error: error instanceof Error ? error.message : String(error)
        }, 'AgentRuntimeManager')
        return undefined
      }
    }

    // Determine model: always use qwen 32b, but check for latest WANDB trained model if available
    let wandbModel: string | undefined
    let useWandb = false
    
    if (process.env.WANDB_API_KEY) {
      try {
        // First check system settings for configured WANDB model
        const { getAIModelConfig } = await import('@/lib/ai-model-config')
        const aiConfig = await getAIModelConfig()
        if (aiConfig.wandbEnabled) {
          wandbModel = aiConfig.wandbModel || process.env.WANDB_MODEL || 'OpenPipe/Qwen3-14B-Instruct'
          useWandb = true
          logger.info(`Agent will use configured WANDB model: ${wandbModel}`, { agentId: agentUserId }, 'AgentRuntimeManager')
        }
        if (!useWandb) {
          // Check for latest trained RL model from database
          const { getLatestRLModel } = await import('@/lib/training/WandbModelFetcher')
          const latestModel = await getLatestRLModel()
          if (latestModel && latestModel.modelPath) {
            // modelPath contains the WANDB model identifier (entity/project/model-name:step)
            // This is the format WANDB API expects for inference
            wandbModel = latestModel.modelPath
            useWandb = true
            logger.info(`Agent will use latest trained RL model: ${latestModel.modelPath} (v${latestModel.version})`, { 
              agentId: agentUserId,
              modelId: latestModel.modelPath,
              version: latestModel.version,
              avgReward: latestModel.metadata.avgReward
            }, 'AgentRuntimeManager')
          }
        }
        // Fall back to env model if no DB/systems entry but WANDB key exists
        if (!useWandb && process.env.WANDB_MODEL) {
          wandbModel = process.env.WANDB_MODEL
          useWandb = true
          logger.info(`Agent will use WANDB model from env: ${wandbModel}`, { agentId: agentUserId }, 'AgentRuntimeManager')
        }
      } catch (error) {
        logger.warn('Could not load WANDB model config, falling back to qwen 32b', { error }, 'AgentRuntimeManager')
      }
    }

    // Get model version if using RL model
    let modelVersion: string | undefined;
    if (useWandb && wandbModel) {
      const { getLatestRLModel } = await import('@/lib/training/WandbModelFetcher');
      const latestModel = await getLatestRLModel();
      if (latestModel && latestModel.modelPath === wandbModel) {
        modelVersion = latestModel.version;
        
        // Log model usage for verification
        logger.info('Agent using trained RL model', {
          agentId: agentUserId,
          modelPath: wandbModel,
          modelVersion: latestModel.version,
          avgReward: latestModel.metadata.avgReward,
        }, 'AgentRuntimeManager');
      }
    } else {
      // Log when using base model (for verification)
      logger.info('Agent using base model (not trained RL model)', {
        agentId: agentUserId,
        model: wandbModel || 'groq-qwen-32b',
        reason: useWandb ? 'W&B model not available' : 'W&B disabled',
      }, 'AgentRuntimeManager');
    }

    // Build character from agent user config
    // Always use qwen 32b (TEXT_LARGE) - free chat, 1pt per tick
    const character: Character = {
      name: agentUser.displayName || agentUser.username || 'Agent',
      system: agentUser.agentSystem || 'You are a helpful AI agent',
      bio: parseBio(),
      messageExamples: [],
      style: parseStyle(),
      plugins: [],
      settings: {
        // WANDB configuration (if available)
        WANDB_API_KEY: useWandb ? (process.env.WANDB_API_KEY || '') : '',
        ...(wandbModel ? { WANDB_MODEL: wandbModel } : {}),
        WANDB_ENABLED: useWandb ? 'true' : 'false',
        // Model version for tracking
        ...(modelVersion ? { MODEL_VERSION: modelVersion } : {}),
        // GROQ fallback (always available)
        GROQ_API_KEY: process.env.GROQ_API_KEY || '',
        // Prefer RL model for both slots; fall back to Groq tiers only when WANDB unavailable
        LARGE_GROQ_MODEL: useWandb
          ? (wandbModel || process.env.WANDB_MODEL || 'OpenPipe/Qwen3-14B-Instruct')
          : 'qwen/qwen3-32b',
        SMALL_GROQ_MODEL: useWandb
          ? (wandbModel || process.env.WANDB_MODEL || 'OpenPipe/Qwen3-14B-Instruct')
          : 'llama-3.1-8b-instant',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      },
    }

    // Database configuration
    const dbPort = process.env.POSTGRES_DEV_PORT || 5432
    const postgresUrl = 
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      `postgres://postgres:password@localhost:${dbPort}/babylon`

    logger.info(`Creating runtime for agent user ${agentUserId}`, undefined, 'AgentRuntimeManager')

    // Initialize Groq plugin (no-op for this version)
    // groqPlugin.init requires runtime context in some versions

    // Create trajectory logger service for this agent
    const trajectoryLogger = new TrajectoryLoggerService()
    trajectoryLoggers.set(agentUserId, trajectoryLogger)

    // Create runtime with groq, experience, and trajectory logger plugins
    // Type cast plugins to ensure compatibility across different @elizaos/core versions
    const plugins: Plugin[] = [
      groqPlugin as Plugin,
      experiencePlugin as Plugin,
      trajectoryLoggerPlugin as Plugin
    ]
    
    const runtimeConfig = {
      character,
      agentId: agentUserId as UUID,
      plugins,
      settings: {
        ...character.settings,
        POSTGRES_URL: postgresUrl,
      },
    }

    const runtime = new AgentRuntime(runtimeConfig)

    // Store model version on runtime for LLM call logging (after runtime is created)
    if (modelVersion) {
      (runtime as unknown as { currentModelVersion?: string }).currentModelVersion = modelVersion;
    }
    (runtime as unknown as { currentModel?: string }).currentModel = wandbModel || (useWandb ? 'wandb' : 'groq')

    // Configure logger
    if (!runtime.logger || !runtime.logger.log) {
      const customLogger = {
        log: (msg: string) => logger.info(msg, undefined, `Agent[${agentUser.displayName}]`),
        info: (msg: string) => logger.info(msg, undefined, `Agent[${agentUser.displayName}]`),
        warn: (msg: string) => logger.warn(msg, undefined, `Agent[${agentUser.displayName}]`),
        error: (msg: string) => logger.error(msg, new Error(msg), `Agent[${agentUser.displayName}]`),
        debug: (msg: string) => logger.debug(msg, undefined, `Agent[${agentUser.displayName}]`),
        success: (msg: string) => logger.info(`✓ ${msg}`, undefined, `Agent[${agentUser.displayName}]`),
        notice: (msg: string) => logger.info(msg, undefined, `Agent[${agentUser.displayName}]`),
        level: 'info' as const,
        trace: (msg: string) => logger.debug(msg, undefined, `Agent[${agentUser.displayName}]`),
        fatal: (msg: string) => logger.error(msg, new Error(msg), `Agent[${agentUser.displayName}]`),
        progress: (msg: string) => logger.info(msg, undefined, `Agent[${agentUser.displayName}]`),
        clear: () => console.clear ? console.clear() : undefined,
        child: () => customLogger
      }
      runtime.logger = customLogger as unknown as typeof runtime.logger
    }

    // Cannot call initialize() without SQL plugin - manually register models instead
    // CRITICAL: Must set modelDelegates, not models Map  
    // This is what runtime.initialize() does internally
    if (groqPlugin.models) {
      const modelDelegates = (runtime as unknown as Record<string, unknown>).modelDelegates as Record<string, unknown> || {}
      for (const [type, handler] of Object.entries(groqPlugin.models)) {
        modelDelegates[type] = handler
      }
      (runtime as unknown as Record<string, unknown>).modelDelegates = modelDelegates
      logger.info(`Registered ${Object.keys(modelDelegates).length} Groq model handlers`, { 
        agentUserId,
        types: Object.keys(modelDelegates)
      })
    }

    // Wrap Babylon plugin BEFORE registering (so wrapped version is used)
    // This ensures all actions and provider accesses are logged when executed
    let wrappedBabylonPlugin = babylonPlugin
    if (babylonPlugin.actions) {
      wrappedBabylonPlugin = wrapPluginActions(wrappedBabylonPlugin, trajectoryLogger)
    }
    if (babylonPlugin.providers) {
      wrappedBabylonPlugin = wrapPluginProviders(wrappedBabylonPlugin, trajectoryLogger)
    }

    // Enhance with wrapped Babylon plugin (so wrapped version is registered)
    await enhanceRuntimeWithBabylon(runtime, agentUserId, wrappedBabylonPlugin)

    // Store trajectory logger reference on runtime for easy access
    // This allows actions/providers to access the logger
    ;(runtime as unknown as { trajectoryLogger?: TrajectoryLoggerService }).trajectoryLogger = trajectoryLogger

    // Cache runtime
    globalRuntimes.set(agentUserId, runtime)

    logger.info(`Runtime created for agent user ${agentUserId}`, undefined, 'AgentRuntimeManager')

    return runtime
  }

  /**
   * Get trajectory logger for an agent
   */
  public getTrajectoryLogger(agentUserId: string): TrajectoryLoggerService | null {
    return trajectoryLoggers.get(agentUserId) || null
  }

  /**
   * Remove runtime from cache
   */
  public clearRuntime(agentUserId: string): void {
    if (globalRuntimes.has(agentUserId)) {
      globalRuntimes.delete(agentUserId)
      trajectoryLoggers.delete(agentUserId)
      logger.info(`Runtime cleared for agent ${agentUserId}`, undefined, 'AgentRuntimeManager')
    }
  }

  public clearAllRuntimes(): void {
    globalRuntimes.clear()
    trajectoryLoggers.clear()
    logger.info('All runtimes cleared', undefined, 'AgentRuntimeManager')
  }

  public getRuntimeCount(): number {
    return globalRuntimes.size
  }

  public hasRuntime(agentUserId: string): boolean {
    return globalRuntimes.has(agentUserId)
  }
}

// Export singleton instance (lazy initialization to avoid circular dependencies)
let _agentRuntimeManagerInstance: AgentRuntimeManager | null = null

function getManagerInstance(): AgentRuntimeManager {
  if (!_agentRuntimeManagerInstance) {
    _agentRuntimeManagerInstance = AgentRuntimeManager.getInstance()
  }
  return _agentRuntimeManagerInstance
}

export const agentRuntimeManager = {
  getInstance(): AgentRuntimeManager {
    return getManagerInstance()
  },
  async getRuntime(agentUserId: string) {
    return getManagerInstance().getRuntime(agentUserId)
  },
  getTrajectoryLogger(agentUserId: string) {
    return getManagerInstance().getTrajectoryLogger(agentUserId)
  },
  clearRuntime(agentUserId: string) {
    return getManagerInstance().clearRuntime(agentUserId)
  },
  clearAllRuntimes() {
    return getManagerInstance().clearAllRuntimes()
  },
  getRuntimeCount() {
    return getManagerInstance().getRuntimeCount()
  },
  hasRuntime(agentUserId: string) {
    return getManagerInstance().hasRuntime(agentUserId)
  }
} as AgentRuntimeManager & { getInstance(): AgentRuntimeManager }

