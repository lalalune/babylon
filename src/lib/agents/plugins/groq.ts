/**
 * Groq Plugin for Babylon Agents
 * Provides access to Groq's fast LLM inference  
 * Based on working otc-agent implementation
 */

import { createGroq } from '@ai-sdk/groq'
import type {
  ModelTypeName,
  ObjectGenerationParams,
  Plugin,
} from '@elizaos/core'
import {
  type DetokenizeTextParams,
  type GenerateTextParams,
  ModelType,
  type TokenizeTextParams,
} from '@elizaos/core'
import { generateObject, generateText } from 'ai'
import { type TiktokenModel, encodingForModel } from 'js-tiktoken'
import type { TrajectoryLoggerService } from './plugin-trajectory-logger/src/TrajectoryLoggerService'

function getBaseURL(runtime: { getSetting: (key: string) => string | undefined }): string {
  return (
    runtime.getSetting('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1'
  )
}

function findModelName(model: ModelTypeName): TiktokenModel {
  const name =
    model === ModelType.TEXT_SMALL
      ? (process.env.SMALL_GROQ_MODEL ?? 'llama-3.1-8b-instant')
      : (process.env.LARGE_GROQ_MODEL ?? 'qwen/qwen3-32b')
  return name as TiktokenModel
}

async function tokenizeText(model: ModelTypeName, prompt: string) {
  const encoding = encodingForModel(findModelName(model))
  const tokens = encoding.encode(prompt)
  return tokens
}

async function detokenizeText(model: ModelTypeName, tokens: number[]) {
  const modelName = findModelName(model)
  const encoding = encodingForModel(modelName)
  return encoding.decode(tokens)
}

async function generateGroqText(
  groq: ReturnType<typeof createGroq>,
  model: string,
  params: {
    prompt: string
    system?: string
    temperature: number
    maxTokens: number
    frequencyPenalty: number
    presencePenalty: number
    stopSequences: string[]
    trajectoryLogger?: TrajectoryLoggerService
    trajectoryId?: string
    purpose?: 'action' | 'reasoning' | 'evaluation' | 'response' | 'other'
    actionType?: string
    modelVersion?: string // RL model version if using trained model
  },
) {
  const startTime = Date.now()
  const result = await generateText({
    model: groq.languageModel(model),
    prompt: params.prompt,
    system: params.system,
    temperature: params.temperature,
    maxOutputTokens: params.maxTokens,
    frequencyPenalty: params.frequencyPenalty,
    presencePenalty: params.presencePenalty,
    stopSequences: params.stopSequences,
  })
  const latencyMs = Date.now() - startTime

  // Log to trajectory if available
  if (params.trajectoryLogger && params.trajectoryId) {
    const stepId = params.trajectoryLogger.getCurrentStepId(params.trajectoryId)
    if (stepId) {
      params.trajectoryLogger.logLLMCall(stepId, {
        model,
        modelVersion: params.modelVersion, // Use passed modelVersion
        systemPrompt: params.system || '',
        userPrompt: params.prompt,
        response: result.text,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        purpose: params.purpose || 'action',
        actionType: params.actionType,
        latencyMs,
        promptTokens: undefined, // Token counts not available from Groq SDK
        completionTokens: undefined,
      })
    }
  }

  return result.text
}

async function generateGroqObject(
  groq: ReturnType<typeof createGroq>,
  model: string,
  params: ObjectGenerationParams,
) {
  const { object } = await generateObject({
    model: groq.languageModel(model),
    output: 'no-schema',
    prompt: params.prompt,
    temperature: params.temperature,
  })
  return object
}

export const groqPlugin: Plugin = {
  name: 'groq',
  description: 'Groq plugin for Babylon agents',
  config: {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    SMALL_GROQ_MODEL: process.env.SMALL_GROQ_MODEL || 'llama-3.1-8b-instant',
    LARGE_GROQ_MODEL: process.env.LARGE_GROQ_MODEL || 'qwen/qwen3-32b',
  },
  async init() {
    if (!process.env.GROQ_API_KEY) {
      throw Error('Missing GROQ_API_KEY in environment variables')
    }
  },
  models: {
    [ModelType.TEXT_TOKENIZER_ENCODE]: async (
      _runtime,
      { prompt, modelType = ModelType.TEXT_LARGE }: TokenizeTextParams,
    ) => {
      return await tokenizeText(modelType ?? ModelType.TEXT_LARGE, prompt)
    },
    [ModelType.TEXT_TOKENIZER_DECODE]: async (
      _runtime,
      { tokens, modelType = ModelType.TEXT_LARGE }: DetokenizeTextParams,
    ) => {
      return await detokenizeText(modelType ?? ModelType.TEXT_LARGE, tokens)
    },
    [ModelType.TEXT_SMALL]: async (
      runtime,
      { prompt, stopSequences = [] }: GenerateTextParams,
    ) => {
      const temperature = 0.7
      const frequency_penalty = 0.7
      const presence_penalty = 0.7
      const max_response_length = 8000
      const baseURL = getBaseURL(runtime)
      const groq = createGroq({
        apiKey: runtime.getSetting('GROQ_API_KEY'),
        fetch: runtime.fetch,
        baseURL,
      })

      const model =
        runtime.getSetting('GROQ_SMALL_MODEL') ??
        runtime.getSetting('SMALL_MODEL') ??
        'llama-3.1-8b-instant'

      // Get trajectory logger from runtime if available
      const trajectoryLogger = (runtime as unknown as { trajectoryLogger?: TrajectoryLoggerService }).trajectoryLogger
      const trajectoryId = (runtime as unknown as { currentTrajectoryId?: string }).currentTrajectoryId
      // Extract model version from runtime if available
      const modelVersion = (runtime as unknown as { currentModelVersion?: string }).currentModelVersion

      return await generateGroqText(groq, model, {
        prompt,
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens: max_response_length,
        frequencyPenalty: frequency_penalty,
        presencePenalty: presence_penalty,
        stopSequences,
        trajectoryLogger,
        trajectoryId,
        purpose: 'action',
        modelVersion,
      })
    },
    [ModelType.TEXT_LARGE]: async (
      runtime,
      {
        prompt,
        stopSequences = [],
        maxTokens = 8192,
        temperature = 0.7,
        frequencyPenalty = 0.7,
        presencePenalty = 0.7,
      }: GenerateTextParams,
    ) => {
      // Check if WANDB is enabled and model is available
      const wandbEnabled = runtime.getSetting('WANDB_ENABLED') === 'true'
      const wandbApiKey = runtime.getSetting('WANDB_API_KEY')
      const wandbModel = runtime.getSetting('WANDB_MODEL')
      
      let model: string
      let baseURL: string
      let apiKey: string
      
      if (wandbEnabled && wandbApiKey && wandbModel) {
        // Use WANDB inference API
        model = wandbModel
        baseURL = 'https://api.inference.wandb.ai/v1'
        apiKey = wandbApiKey
      } else {
        // Fallback to GROQ qwen 32b
        model = runtime.getSetting('GROQ_LARGE_MODEL') ??
          runtime.getSetting('LARGE_MODEL') ??
          'qwen/qwen3-32b'
        baseURL = getBaseURL(runtime)
        apiKey = runtime.getSetting('GROQ_API_KEY') || ''
      }
      
      const groq = createGroq({
        apiKey,
        fetch: runtime.fetch,
        baseURL,
      })
      
      // Determine if using W&B model (before logging)
      const isWandbModel = wandbEnabled && wandbApiKey && wandbModel;
      
      // Verify W&B API is being used
      if (isWandbModel && baseURL === 'https://api.inference.wandb.ai/v1') {
        // This confirms we're using W&B inference API, not Groq
        // The model parameter will be passed to W&B API which expects W&B model identifiers
      }

      // Get trajectory logger from runtime if available
      const trajectoryLogger = (runtime as unknown as { trajectoryLogger?: TrajectoryLoggerService }).trajectoryLogger
      const trajectoryId = (runtime as unknown as { currentTrajectoryId?: string }).currentTrajectoryId
      // Extract model version from runtime if available
      const modelVersion = (runtime as unknown as { currentModelVersion?: string }).currentModelVersion
      
      // Log which model is being used (for verification)
      const logger = (await import('@/lib/logger')).logger;
      
      // Always log at INFO level for W&B model usage verification
      if (isWandbModel) {
        logger.info('Using W&B RL model for inference', {
          model,
          modelSource: 'wandb',
          modelVersion,
          baseURL,
          wandbModel,
        }, 'GroqPlugin');
      } else {
        logger.debug('Using Groq model for inference', {
          model,
          modelSource: 'groq',
          groqModel: model,
        }, 'GroqPlugin');
      }

      return await generateGroqText(groq, model, {
        prompt,
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens,
        frequencyPenalty,
        presencePenalty,
        stopSequences,
        trajectoryLogger,
        trajectoryId,
        purpose: 'action',
        modelVersion,
      })
    },
    [ModelType.OBJECT_SMALL]: async (
      runtime,
      params: ObjectGenerationParams,
    ) => {
      const baseURL = getBaseURL(runtime)
      const groq = createGroq({
        apiKey: runtime.getSetting('GROQ_API_KEY'),
        baseURL,
      })
      const model =
        runtime.getSetting('GROQ_SMALL_MODEL') ??
        runtime.getSetting('SMALL_MODEL') ??
        'llama-3.1-8b-instant'

      return await generateGroqObject(groq, model, params)
    },
    [ModelType.OBJECT_LARGE]: async (
      runtime,
      params: ObjectGenerationParams,
    ) => {
      const baseURL = getBaseURL(runtime)
      const groq = createGroq({
        apiKey: runtime.getSetting('GROQ_API_KEY'),
        baseURL,
      })
      const model =
        runtime.getSetting('GROQ_LARGE_MODEL') ??
        runtime.getSetting('LARGE_MODEL') ??
        'qwen/qwen3-32b'

      return await generateGroqObject(groq, model, params)
    },
  },
}
