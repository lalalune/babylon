/**
 * Direct Groq LLM calls - bypassing @elizaos/core
 * 
 * Since @elizaos/core's useModel() requires initialize() which needs SQL plugin,
 * we call Groq directly here for autonomous agents.
 * 
 * All LLM calls are automatically logged to trajectory logger if available.
 */

import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import type { TrajectoryLoggerService } from '../plugins/plugin-trajectory-logger/src/TrajectoryLoggerService'

export async function callGroqDirect(params: {
  prompt: string
  system?: string
  modelSize?: 'small' | 'large'
  temperature?: number
  maxTokens?: number
  trajectoryLogger?: TrajectoryLoggerService
  trajectoryId?: string
  purpose?: 'action' | 'reasoning' | 'evaluation' | 'response' | 'other'
  actionType?: string
}): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not set')
  }

  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
  })

  // Default to llama-3.1-8b-instant for fast evaluation (free tier)
  // For larger tasks, use qwen3-32b
  const model = params.modelSize === 'large' 
    ? 'qwen/qwen3-32b'
    : 'llama-3.1-8b-instant' 

  const startTime = Date.now()
  const result = await generateText({
    model: groq.languageModel(model),
    prompt: params.prompt,
    system: params.system,
    temperature: params.temperature ?? 0.7,
    maxOutputTokens: params.maxTokens ?? 8192,
    maxRetries: 2
  })
  const latencyMs = Date.now() - startTime

  // Log to trajectory if available
  if (params.trajectoryLogger && params.trajectoryId) {
    const stepId = params.trajectoryLogger.getCurrentStepId(params.trajectoryId)
    if (stepId) {
      params.trajectoryLogger.logLLMCall(stepId, {
        model,
        systemPrompt: params.system || '',
        userPrompt: params.prompt,
        response: result.text,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens ?? 8192,
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

