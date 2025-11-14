/**
 * LLM Client for Babylon Game Generation
 * Supports Groq (fast) and OpenAI (fallback)
 * Wrapper with retry logic and error handling
 * 
 * IMPORTANT: Always requires an API key - never falls back to mock mode
 */

import OpenAI from 'openai';
import 'dotenv/config';
import type { JsonValue } from '@/types/common';
import { logger } from '@/lib/logger';

type LLMProvider = 'groq' | 'openai';

/**
 * Simple JSON schema for validation
 */
interface JSONSchema {
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
}

interface JsonSchemaProperty {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
}

export class BabylonLLMClient {
  private client: OpenAI;
  private provider: LLMProvider;
  private groqKey: string | undefined;
  private openaiKey: string | undefined;
  private readonly maxAttempts = 3;
  private readonly maxBackoffMs = 5000;
  
  constructor(apiKey?: string) {
    // Priority: Groq > OpenAI
    this.groqKey = process.env.GROQ_API_KEY;
    this.openaiKey = apiKey || process.env.OPENAI_API_KEY;
    
    if (this.groqKey) {
      logger.info('Using Groq (primary, fast inference)', undefined, 'BabylonLLMClient');
      this.client = new OpenAI({
        apiKey: this.groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      this.provider = 'groq';
    } else if (this.openaiKey) {
      logger.info('Using OpenAI (fallback)', undefined, 'BabylonLLMClient');
      this.client = new OpenAI({ apiKey: this.openaiKey });
      this.provider = 'openai';
    } else {
      throw new Error(
        '❌ No API key found!\n' +
        '   Set GROQ_API_KEY (primary) or OPENAI_API_KEY (fallback) environment variable.\n' +
        '   Example: export GROQ_API_KEY=your_key_here'
      );
    }
  }

  /**
   * Generate completion with JSON response
   * ALWAYS retries on failure - never gives up without exhausting all retries
   */
  async generateJSON<T>(
    prompt: string,
    schema?: JSONSchema,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.maxAttempts) {
      attempt++;
      try {
        const defaultModel = this.provider === 'groq'
          ? 'llama-3.3-70b-versatile'
          : 'gpt-4o-mini';

        const {
          model = defaultModel,
          temperature = 0.7,
          maxTokens = 16000,
        } = options;

        const useJsonFormat = this.provider === 'openai' ? { type: 'json_object' as const } : undefined;

        const messages = [
          {
            role: 'system' as const,
            content: 'You are a JSON-only assistant. You must respond ONLY with valid JSON. No explanations, no markdown, no other text.',
          },
          {
            role: 'user' as const,
            content: prompt,
          },
        ];

        const response = await this.client.chat.completions.create({
          model,
          messages,
          ...(useJsonFormat ? { response_format: useJsonFormat } : {}),
          temperature,
          max_tokens: maxTokens,
        });

        const content = response.choices[0]?.message.content;
        const finishReason = response.choices[0]?.finish_reason;

        if (finishReason === 'length') {
          throw new Error(`Response truncated at ${maxTokens} tokens.`);
        }

        if (!content) {
          throw new Error('Empty response from LLM');
        }

        let jsonContent = content.trim();
        if (jsonContent.startsWith('```')) {
          const lines = jsonContent.split('\n');
          const jsonStartIndex = lines.findIndex(line => line.trim().startsWith('{') || line.trim().startsWith('['));
          if (jsonStartIndex !== -1) {
            jsonContent = lines.slice(jsonStartIndex).join('\n');
          }
          jsonContent = jsonContent.replace(/```\s*$/, '').trim();
        }

        if (!jsonContent.startsWith('{') && !jsonContent.startsWith('[')) {
          const jsonMatch = jsonContent.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
          if (jsonMatch && jsonMatch[1]) {
            jsonContent = jsonMatch[1];
          }
        }

        const parsed: Record<string, JsonValue> = JSON.parse(jsonContent);

        if (schema && !this.validateSchema(parsed, schema)) {
          throw new Error(`Response does not match schema. Missing required fields: ${schema.required?.join(', ')}`);
        }

        return parsed as T;
      } catch (error) {
        lastError = error;

        if (this.switchToFallbackProvider()) {
          logger.warn('LLM request failed on Groq, switching to OpenAI fallback', { attempt }, 'BabylonLLMClient');
          attempt--;
          continue;
        }

        if (attempt >= this.maxAttempts) {
          break;
        }

        const delay = Math.min(2 ** (attempt - 1) * 500, this.maxBackoffMs);
        logger.warn('LLM request failed, retrying with backoff', { attempt, delay }, 'BabylonLLMClient');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`LLM request failed after ${this.maxAttempts} attempts: ${errorMessage}`);
  }

  /**
   * Simple schema validation
   */
  private validateSchema(data: Record<string, JsonValue>, schema: JSONSchema): boolean {
    // Basic validation - check required fields exist
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          logger.error(`Missing required field: ${field}`, undefined, 'BabylonLLMClient');
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Attempt to switch to the fallback provider (OpenAI) when Groq fails.
   */
  private switchToFallbackProvider(): boolean {
    if (this.provider === 'groq' && this.openaiKey) {
      this.client = new OpenAI({ apiKey: this.openaiKey });
      this.provider = 'openai';
      return true;
    }
    return false;
  }

  /**
   * Get provider info
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Get token usage stats
   */
  getStats() {
    return {
      provider: this.provider,
      totalTokens: 0,
      totalCost: 0,
    };
  }
}
