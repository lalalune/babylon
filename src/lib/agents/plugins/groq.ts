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

function getBaseURL(runtime: { getSetting: (key: string) => string | undefined }): string {
  return (
    runtime.getSetting('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1'
  )
}

function findModelName(model: ModelTypeName): TiktokenModel {
  const name =
    model === ModelType.TEXT_SMALL
      ? (process.env.SMALL_GROQ_MODEL ?? 'openai/gpt-oss-120b')
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
  },
) {
  const { text: groqResponse } = await generateText({
    model: groq.languageModel(model),
    prompt: params.prompt,
    system: params.system,
    temperature: params.temperature,
    maxOutputTokens: params.maxTokens,
    frequencyPenalty: params.frequencyPenalty,
    presencePenalty: params.presencePenalty,
    stopSequences: params.stopSequences,
  })
  return groqResponse
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
    SMALL_GROQ_MODEL: process.env.SMALL_GROQ_MODEL || 'openai/gpt-oss-120b',
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
        'openai/gpt-oss-120b'

      return await generateGroqText(groq, model, {
        prompt,
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens: max_response_length,
        frequencyPenalty: frequency_penalty,
        presencePenalty: presence_penalty,
        stopSequences,
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
      const model =
        runtime.getSetting('GROQ_LARGE_MODEL') ??
        runtime.getSetting('LARGE_MODEL') ??
        'qwen/qwen3-32b'
      const baseURL = getBaseURL(runtime)
      const groq = createGroq({
        apiKey: runtime.getSetting('GROQ_API_KEY'),
        fetch: runtime.fetch,
        baseURL,
      })

      return await generateGroqText(groq, model, {
        prompt,
        system: runtime.character.system ?? undefined,
        temperature,
        maxTokens,
        frequencyPenalty,
        presencePenalty,
        stopSequences,
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
        'openai/gpt-oss-120b'

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
