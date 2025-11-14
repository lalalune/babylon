/**
 * AI Field Generation API
 * 
 * @route POST /api/agents/generate-field
 * @access Public
 * 
 * @description
 * AI-powered content generation for agent configuration fields using Claude
 * (Anthropic). Generates contextually appropriate content for agent profiles,
 * personalities, system prompts, trading strategies, and other configuration
 * fields. Used during agent creation and editing workflows.
 * 
 * **Supported Fields:**
 * - `name` - Creative agent names
 * - `description` - Agent descriptions (1-2 sentences)
 * - `system` - System prompts defining behavior
 * - `bio` - Three short bio points (pipe-separated)
 * - `personality` - Personality descriptions
 * - `tradingStrategy` - Trading strategy descriptions
 * 
 * **Features:**
 * - Context-aware generation using existing field values
 * - Field-specific prompts optimized for each use case
 * - Temperature tuning for creative yet coherent output
 * - Auto-completion and enhancement of partial inputs
 * - Clean output without quotes or formatting artifacts
 * 
 * **POST /api/agents/generate-field - Generate Field Content**
 * 
 * @param {string} fieldName - Field to generate (required)
 * @param {string} [currentValue] - Current/partial value for enhancement
 * @param {object} [context] - Context for generation
 * @param {string} [context.name] - Agent name
 * @param {string} [context.description] - Agent description
 * @param {string} [context.system] - System prompt
 * 
 * @returns {object} Generated content response
 * @property {boolean} success - Generation success status
 * @property {string} value - Generated content
 * 
 * @throws {400} Bad Request - Missing field name
 * @throws {500} Internal Server Error - AI generation failed
 * @throws {503} Service Unavailable - ANTHROPIC_API_KEY not configured
 * 
 * @example
 * ```typescript
 * // Generate agent name
 * const name = await fetch('/api/agents/generate-field', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ fieldName: 'name' })
 * }).then(r => r.json());
 * 
 * // Generate system prompt with context
 * const system = await fetch('/api/agents/generate-field', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     fieldName: 'system',
 *     context: {
 *       name: 'TraderBot',
 *       description: 'A conservative trading agent'
 *     }
 *   })
 * }).then(r => r.json());
 * 
 * // Enhance partial input
 * const enhanced = await fetch('/api/agents/generate-field', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     fieldName: 'description',
 *     currentValue: 'An agent that focuses on',
 *     context: { name: 'MarketMaker' }
 *   })
 * }).then(r => r.json());
 * ```
 * 
 * @see {@link /src/app/agents/create/page.tsx} Agent creation UI
 * @see {@link https://www.anthropic.com/api} Anthropic API
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const { fieldName, currentValue, context } = await req.json()

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY!
  const anthropic = new Anthropic({ apiKey: anthropicApiKey })

  const prompt = buildPromptForField(fieldName, currentValue, context)
  const systemPrompt = `You are a helpful assistant that generates agent configurations. Be concise, professional, and authentic.`

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 300,
    temperature: 0.8,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  const firstContent = message.content[0]!
  logger.error('Unexpected Anthropic response format', { content: message.content }, 'generate-field')

  const generatedValue = (firstContent as { text: string }).text.trim()
  const cleanedValue = generatedValue.replace(/^["']|["']$/g, '')

  return NextResponse.json({
    success: true,
    value: cleanedValue
  })
}

function buildPromptForField(
  fieldName: string,
  currentValue: string | undefined,
  context: Record<string, string | undefined>
): string {
  const hasCurrentValue = currentValue && currentValue.length > 0

  // Build context summary
  let contextSummary = ''
  if (context.name) contextSummary += `Name: ${context.name}\n`
  if (context.description) contextSummary += `Description: ${context.description}\n`

  switch (fieldName) {
    case 'name':
      return `Generate a creative, memorable name for an AI agent. It should sound intelligent and professional. Just return the name, nothing else.`

    case 'description':
      if (hasCurrentValue) {
        return `Complete or enhance this agent description:\n"${currentValue}"\n${
          contextSummary ? `\nContext:\n${contextSummary}` : ''
        }\nProvide a natural, complete description (1-2 sentences). Just return the enhanced text, no quotes or explanations.`
      }
      return `Write a brief, natural description (1-2 sentences) for an AI agent${
        context.name ? ` named ${context.name}` : ''
      }. Describe what makes this agent unique and useful. Just return the description, no quotes or explanations.`

    case 'system':
      return `Write a system prompt for an AI agent${context.name ? ` named ${context.name}` : ''}${
        context.description ? ` that is ${context.description}` : ''
      }. The system prompt should define the agent's role, personality, and how it should behave. Keep it 2-3 sentences. Just return the system prompt starting with "You are...", no quotes or explanations.`

    case 'bio':
      return `Generate 3 short bio points (separated by |) for an AI agent${context.name ? ` named ${context.name}` : ''}${
        context.description ? ` that is ${context.description}` : ''
      }. Each point should be 3-5 words highlighting a key trait or capability. Format: "Point 1|Point 2|Point 3". Just return the points, nothing else.`

    case 'personality':
      return `Write a personality description (2-3 sentences) for an AI agent${context.name ? ` named ${context.name}` : ''}${
        context.description ? ` that is ${context.description}` : ''
      }${context.system ? `\n\nSystem prompt: ${context.system}` : ''}. Describe how the agent communicates and interacts. Just return the personality description, no quotes or explanations.`

    case 'tradingStrategy':
      return `Write a trading strategy description (2-3 sentences) for an AI trading agent${context.name ? ` named ${context.name}` : ''}${
        context.description ? ` that is ${context.description}` : ''
      }. Describe the agent's approach to trading, risk management, and decision-making. Just return the strategy description, no quotes or explanations.`

    default:
      return `Generate a value for ${fieldName}${contextSummary ? ` using this context:\n${contextSummary}` : ''}.`
  }
}

