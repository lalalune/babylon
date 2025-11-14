/**
 * Direct Groq LLM calls - bypassing @elizaos/core
 * 
 * Since @elizaos/core's useModel() requires initialize() which needs SQL plugin,
 * we call Groq directly here for autonomous agents.
 */

import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'

export async function callGroqDirect(params: {
  prompt: string
  system?: string
  modelSize?: 'small' | 'large'
  temperature?: number
  maxTokens?: number
}): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not set')
  }

  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
  })

  // Default to openai/gpt-oss-120b for fast evaluation if WANDB not configured
  // For larger tasks, use qwen3-32b
  const model = params.modelSize === 'large' 
    ? 'qwen/qwen3-32b'
    : 'openai/gpt-oss-120b' 

  const result = await generateText({
    model: groq.languageModel(model),
    prompt: params.prompt,
    system: params.system,
    temperature: params.temperature ?? 0.7,
    maxOutputTokens: params.maxTokens ?? 8192,
    maxRetries: 2
  })
  
  return result.text
}

