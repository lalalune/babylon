/**
 * Token Counter Utility
 * 
 * Provides accurate token counting for different LLM models
 * Uses tiktoken for OpenAI models and approximations for others
 */

import type { Tiktoken } from 'tiktoken';

// Lazy-load encoding to avoid startup overhead
let encoding: Tiktoken | null = null;

/**
 * Get the tiktoken encoding (lazy-loaded)
 */
async function getEncoding(): Promise<Tiktoken> {
  if (!encoding) {
    const tiktoken = await import('tiktoken');
    encoding = tiktoken.encoding_for_model('gpt-4');
  }
  return encoding;
}

/**
 * Count tokens in text
 * Falls back to character-based approximation if tiktoken is unavailable
 */
export async function countTokens(text: string): Promise<number> {
  const enc = await getEncoding();
  const tokens = enc.encode(text);
  return tokens.length;
}

/**
 * Count tokens in text (synchronous approximation)
 * Use this when you need a quick estimate without async overhead
 */
export function countTokensSync(text: string): number {
  // Approximation: 1 token per 4 characters (conservative)
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit
 * Returns truncated text and actual token count
 */
export async function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  options: {
    ellipsis?: boolean;
    preserveEnd?: boolean;
  } = {}
): Promise<{ text: string; tokens: number }> {
  const { ellipsis = true, preserveEnd = false } = options;
  
  const currentTokens = await countTokens(text);
  
  if (currentTokens <= maxTokens) {
    return { text, tokens: currentTokens };
  }
  
  // Binary search to find the right length
  const ellipsisText = ellipsis ? '...' : '';
  const ellipsisTokens = ellipsis ? await countTokens(ellipsisText) : 0;
  const targetTokens = maxTokens - ellipsisTokens;
  
  let low = 0;
  let high = text.length;
  let bestLength = 0;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const slice = preserveEnd 
      ? text.slice(text.length - mid)
      : text.slice(0, mid);
    const tokens = await countTokens(slice);
    
    if (tokens <= targetTokens) {
      bestLength = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  const truncated = preserveEnd
    ? ellipsisText + text.slice(text.length - bestLength)
    : text.slice(0, bestLength) + ellipsisText;
  
  const finalTokens = await countTokens(truncated);
  
  return { text: truncated, tokens: finalTokens };
}

/**
 * Truncate text to fit within token limit (synchronous approximation)
 */
export function truncateToTokenLimitSync(
  text: string,
  maxTokens: number,
  options: {
    ellipsis?: boolean;
    preserveEnd?: boolean;
  } = {}
): { text: string; tokens: number } {
  const { ellipsis = true, preserveEnd = false } = options;
  
  const currentTokens = countTokensSync(text);
  
  if (currentTokens <= maxTokens) {
    return { text, tokens: currentTokens };
  }
  
  const ellipsisText = ellipsis ? '...' : '';
  const ellipsisTokens = ellipsis ? countTokensSync(ellipsisText) : 0;
  const targetTokens = maxTokens - ellipsisTokens;
  
  // Approximate character length based on token limit
  const targetChars = Math.floor(targetTokens * 4); // 4 chars per token
  
  const truncated = preserveEnd
    ? ellipsisText + text.slice(text.length - targetChars)
    : text.slice(0, targetChars) + ellipsisText;
  
  const finalTokens = countTokensSync(truncated);
  
  return { text: truncated, tokens: finalTokens };
}

/**
 * Model-specific INPUT CONTEXT token limits
 * Note: Output limits are separate (see comments for each model)
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // OpenAI (input context)
  'gpt-4o': 128000,        // 128k input, separate output limit
  'gpt-4o-mini': 128000,   // 128k input, separate output limit
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  
  // Current Strategy Models - INPUT CONTEXT LIMITS (output is separate!)
  'moonshotai/kimi-k2-instruct-0905': 262144,  // 260k INPUT, 16k OUTPUT (separate)
  'moonshotai/Kimi-K2-Instruct-0905': 262144,  // 260k INPUT, 16k OUTPUT (separate)
  'qwen/qwen3-32b': 131072,                    // 130k INPUT, 32k OUTPUT (separate)
  'openai/gpt-oss-120b': 131072,               // 130k INPUT, 32k OUTPUT (separate)
  'OpenPipe/Qwen3-14B-Instruct': 131072,       // 130k INPUT, 32k OUTPUT (separate)
  
  // Groq Models - INPUT CONTEXT
  'llama-3.3-70b-versatile': 131072,  // 130k INPUT, 32k OUTPUT (separate)
  'llama-3.1-70b-versatile': 131072,  // 130k INPUT, 32k OUTPUT (separate)
  'llama-3.1-8b-instant': 131072,     // 130k INPUT, 130k OUTPUT (special case!)
  'mixtral-8x7b-32768': 32768,
  'gemma-7b-it': 8192,
  
  // Anthropic (for reference)
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3-5-sonnet-20241022': 200000,
};

/**
 * Get maximum token limit for a model
 * Returns a safe default if model is unknown
 */
export function getModelTokenLimit(model: string): number {
  return MODEL_TOKEN_LIMITS[model] || 8192; // Conservative default
}

/**
 * Calculate safe context limit with safety margin
 * Note: Input and output are SEPARATE limits on modern models
 * @param model Model name
 * @param outputTokens Expected output tokens (unused - kept for backwards compatibility)
 * @param safetyMargin Safety margin to reserve (default: 10%)
 */
export function getSafeContextLimit(
  model: string,
  _outputTokens = 8000, // Kept for API compatibility, but input/output are separate
  safetyMargin = 0.1
): number {
  const inputLimit = getModelTokenLimit(model);
  // Apply safety margin to input context (reserve 10% for overhead)
  const safeLimit = Math.floor(inputLimit * (1 - safetyMargin));
  
  return Math.max(1000, safeLimit); // Minimum 1000 tokens
}

/**
 * Budget tokens across multiple sections
 * Returns token allocation per section
 */
export function budgetTokens(
  totalTokens: number,
  sections: Array<{ name: string; priority: number; minTokens?: number }>
): Record<string, number> {
  const budget: Record<string, number> = {};
  
  // First, allocate minimum tokens to each section
  let remaining = totalTokens;
  const minAllocations: Array<{ name: string; min: number }> = [];
  
  for (const section of sections) {
    const min = section.minTokens || 0;
    minAllocations.push({ name: section.name, min });
    remaining -= min;
    budget[section.name] = min;
  }
  
  // If we're already over budget, scale down proportionally
  if (remaining < 0) {
    const scale = totalTokens / (totalTokens - remaining);
    for (const section of sections) {
      budget[section.name] = Math.floor((section.minTokens || 0) * scale);
    }
    return budget;
  }
  
  // Distribute remaining tokens by priority
  const totalPriority = sections.reduce((sum, s) => sum + s.priority, 0);
  
  for (const section of sections) {
    const share = (section.priority / totalPriority) * remaining;
    budget[section.name] = (budget[section.name] || 0) + Math.floor(share);
  }
  
  return budget;
}

