/**
 * Prompt Loader Utility
 *
 * Simplified TypeScript-based prompt system.
 * No bundling required - works natively in Vercel serverless.
 */

import type { PromptDefinition } from './define-prompt';
import type { JsonValue } from '@/types/common';

/**
 * Render a prompt with variable substitution
 * @param prompt - Prompt definition to render
 * @param variables - Variables to substitute in template
 * @param options - Rendering options
 * @returns Rendered prompt string
 * @throws Error if required variables are missing or empty
 */
export function renderPrompt(
  prompt: PromptDefinition,
  variables: Record<string, JsonValue> = {},
  options: {
    /**
     * If true, allows empty string values for variables.
     * If false (default), throws on empty/undefined required variables.
     */
    allowEmpty?: boolean;
    /**
     * List of variable names that are allowed to be empty.
     * Useful for optional contextual data like trendContext.
     */
    optionalVars?: string[];
  } = {}
): string {
  const { allowEmpty = false, optionalVars = ['trendContext', 'previousPostsContext', 'worldActors', 'currentMarkets', 'activePredictions', 'recentTrades'] } = options;
  
  let rendered = prompt.template;
  
  for (const [key, value] of Object.entries(variables)) {
    const stringValue = String(value ?? '');
    
    // Validate non-optional variables are not empty
    if (!allowEmpty && !optionalVars.includes(key)) {
      if (value === undefined || value === null) {
        throw new Error(`Required variable "${key}" is undefined/null in prompt "${prompt.id}"`);
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        throw new Error(`Required variable "${key}" is empty string in prompt "${prompt.id}"`);
      }
    }
    
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(pattern, stringValue);
  }
  
  return rendered;
}

/**
 * Get LLM parameters from prompt definition
 * @param prompt - Prompt definition
 * @returns Temperature and maxTokens for LLM call
 */
export function getPromptParams(prompt: PromptDefinition): {
  temperature?: number;
  maxTokens?: number;
} {
  return {
    temperature: prompt.temperature,
    maxTokens: prompt.maxTokens,
  };
}
