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
import { enhanceRuntimeWithBabylon } from '../plugins/babylon/integration'
import { experiencePlugin } from '../plugins/plugin-experience/src'

// Global runtime cache for warm container reuse
const globalRuntimes = new Map<string, AgentRuntime>()

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

    const parseStyle = (): Record<string, unknown> | undefined => {
      if (!agentUser.agentStyle) {
        return undefined
      }
      
      try {
        return JSON.parse(agentUser.agentStyle as string) as Record<string, unknown>
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

    // Load wandb model configuration from system settings
    let wandbModel: string | undefined
    try {
      const { getAIModelConfig } = await import('@/lib/ai-model-config')
      const aiConfig = await getAIModelConfig()
      if (aiConfig.wandbEnabled && aiConfig.wandbModel) {
        wandbModel = aiConfig.wandbModel
        logger.info(`Agent will use wandb model: ${wandbModel}`, { agentId: agentUserId }, 'AgentRuntimeManager')
      }
    } catch (error) {
      logger.warn('Could not load AI model config for agent', { error }, 'AgentRuntimeManager')
    }

    // Build character from agent user config
    const character: Character = {
      name: agentUser.displayName || agentUser.username || 'Agent',
      system: agentUser.agentSystem || 'You are a helpful AI agent',
      bio: parseBio(),
      messageExamples: [],
      style: parseStyle(),
      plugins: [],
      settings: {
        // Use WANDB if available, otherwise fallback to GROQ
        WANDB_API_KEY: process.env.WANDB_API_KEY || '',
        WANDB_MODEL: wandbModel || 'OpenPipe/Qwen3-14B-Instruct',
        GROQ_API_KEY: process.env.GROQ_API_KEY || '',
        SMALL_GROQ_MODEL: 'openai/gpt-oss-120b',  // Fast evaluation model
        LARGE_GROQ_MODEL: agentUser.agentModelTier === 'pro' ? 'qwen/qwen3-32b' : 'openai/gpt-oss-120b',
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

    // Create runtime with groq and experience plugins (no SQL - we use Prisma)
    // Type cast plugins to ensure compatibility across different @elizaos/core versions
    const plugins: Plugin[] = [groqPlugin as Plugin, experiencePlugin as Plugin]
    
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

    // Enhance with Babylon plugin
    await enhanceRuntimeWithBabylon(runtime, agentUserId)

    // Cache runtime
    globalRuntimes.set(agentUserId, runtime)

    logger.info(`Runtime created for agent user ${agentUserId}`, undefined, 'AgentRuntimeManager')

    return runtime
  }

  /**
   * Remove runtime from cache
   */
  public clearRuntime(agentUserId: string): void {
    if (globalRuntimes.has(agentUserId)) {
      globalRuntimes.delete(agentUserId)
      logger.info(`Runtime cleared for agent ${agentUserId}`, undefined, 'AgentRuntimeManager')
    }
  }

  public clearAllRuntimes(): void {
    globalRuntimes.clear()
    logger.info('All runtimes cleared', undefined, 'AgentRuntimeManager')
  }

  public getRuntimeCount(): number {
    return globalRuntimes.size
  }

  public hasRuntime(agentUserId: string): boolean {
    return globalRuntimes.has(agentUserId)
  }
}

// Export singleton instance
export const agentRuntimeManager = AgentRuntimeManager.getInstance()

