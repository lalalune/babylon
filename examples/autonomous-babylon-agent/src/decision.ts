/**
 * Agent Decision Maker
 * 
 * Uses LLM (Groq, Claude, or OpenAI) to make autonomous decisions based on context
 * Falls back through providers in order: Groq -> Claude -> OpenAI
 */

import { createGroq } from '@ai-sdk/groq'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type { MemoryEntry } from './memory.js'

export interface DecisionContext {
  portfolio: { balance: number; positions: any[]; pnl: number }
  markets: { predictions: any[]; perps: any[] }
  feed: { posts: any[] }
  memory: MemoryEntry[]
}

export interface Decision {
  action: 'BUY_YES' | 'BUY_NO' | 'SELL' | 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_POSITION' | 'CREATE_POST' | 'CREATE_COMMENT' | 'HOLD'
  params?: any
  reasoning?: string
}

export interface DecisionMakerConfig {
  strategy: 'conservative' | 'balanced' | 'aggressive' | 'social'
  groqApiKey?: string
  anthropicApiKey?: string
  openaiApiKey?: string
}

export class AgentDecisionMaker {
  private config: DecisionMakerConfig
  private model: any
  private providerName: string

  constructor(config: DecisionMakerConfig) {
    this.config = config
    
    // Initialize provider in order: Groq -> Claude -> OpenAI
    if (config.groqApiKey) {
      const groq = createGroq({ apiKey: config.groqApiKey })
      this.model = groq.languageModel('openai/gpt-oss-120b')  // Fast evaluation model
      this.providerName = 'Groq (openai/gpt-oss-120b)'
    } else if (config.anthropicApiKey) {
      const anthropic = createAnthropic({ apiKey: config.anthropicApiKey })
      this.model = anthropic('claude-3-5-sonnet-20241022')
      this.providerName = 'Claude (claude-3-5-sonnet)'
    } else if (config.openaiApiKey) {
      const openai = createOpenAI({ apiKey: config.openaiApiKey })
      this.model = openai('gpt-4o-mini')
      this.providerName = 'OpenAI (gpt-4o-mini)'
    } else {
      throw new Error('At least one LLM API key is required (GROQ_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)')
    }

    console.log(`🤖 Using LLM provider: ${this.providerName}`)
  }

  /**
   * Get the current provider name
   */
  getProvider(): string {
    return this.providerName
  }

  /**
   * Make decision based on current context
   */
  async decide(context: DecisionContext): Promise<Decision> {
    const prompt = this.buildPrompt(context)

    const { text } = await generateText({
      model: this.model,
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1000
    })

    return this.parseDecision(text)
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(context: DecisionContext): string {
    const strategyInstructions = {
      conservative: 'Only trade with high confidence. Prefer holding cash. Risk tolerance: Low.',
      balanced: 'Balance risk and reward. Trade moderately. Risk tolerance: Medium.',
      aggressive: 'Seek maximum returns. Trade actively. Risk tolerance: High.',
      social: 'Focus on social engagement. Post and comment frequently. Trade occasionally.'
    }

    return `You are an autonomous trading agent for Babylon prediction markets.

Strategy: ${this.config.strategy}
${strategyInstructions[this.config.strategy]}

Current Portfolio:
- Balance: $${context.portfolio.balance}
- Open Positions: ${context.portfolio.positions.length}
- P&L: $${context.portfolio.pnl}

Available Prediction Markets (top 3):
${context.markets.predictions.slice(0, 3).map(m => 
  `- "${m.question}" (YES: ${((m.yesShares / (m.yesShares + m.noShares)) * 100).toFixed(0)}%)`
).join('\n') || 'None'}

Available Perp Markets (top 3):
${context.markets.perps.slice(0, 3).map(p => 
  `- ${p.name} @ $${p.currentPrice}`
).join('\n') || 'None'}

Recent Feed Activity:
${context.feed.posts.slice(0, 3).map(p => 
  `- "${p.content.substring(0, 80)}..."`
).join('\n') || 'None'}

Recent Memory (last 3 actions):
${context.memory.map(m => `- ${m.action}: ${JSON.stringify(m.result).substring(0, 60)}`).join('\n') || 'No recent actions'}

Decision Task:
Analyze the above context and decide what action to take this tick.

Respond in JSON format:
{
  "action": "BUY_YES" | "BUY_NO" | "SELL" | "OPEN_LONG" | "OPEN_SHORT" | "CLOSE_POSITION" | "CREATE_POST" | "CREATE_COMMENT" | "HOLD",
  "params": {
    "marketId": "...",
    "amount": 50,
    "content": "...",
    etc.
  },
  "reasoning": "Brief explanation of why"
}

Examples:
- If you see underpriced opportunity: {"action": "BUY_YES", "params": {"marketId": "...", "amount": 50}, "reasoning": "YES undervalued at 35%"}
- If no good opportunities: {"action": "HOLD", "reasoning": "No clear opportunities"}
- If social strategy: {"action": "CREATE_POST", "params": {"content": "..."}, "reasoning": "Share market insights"}

Your decision (JSON only):`
  }

  /**
   * Parse LLM response into Decision
   */
  private parseDecision(text: string): Decision {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)!
    const decision = JSON.parse(jsonMatch[0])
    return {
      action: decision.action,
      params: decision.params,
      reasoning: decision.reasoning
    }
  }
}

