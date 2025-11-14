/**
 * Market Decision Engine - NPC Trading Decision Generator
 * 
 * @module engine/MarketDecisionEngine
 * 
 * @description
 * Generates autonomous trading decisions for all NPCs using LLM-powered analysis.
 * Creates realistic market behavior where NPCs trade based on information, relationships,
 * and personality rather than following predetermined patterns.
 * 
 * **Core Functionality:**
 * - Generates trading decisions for all trading-enabled NPCs
 * - Uses LLM to analyze market context and make human-like decisions
 * - Batches NPCs together to minimize LLM costs (90% reduction vs individual calls)
 * - Token-aware with automatic chunking for large batches
 * - Validates decisions against constraints (balance, market availability)
 * 
 * **Decision Types:**
 * - `open_long` / `open_short` - Open perpetual futures positions
 * - `buy_yes` / `buy_no` - Buy prediction market shares
 * - `close_position` - Close existing position
 * - `hold` - No action this tick
 * 
 * **Context Provided to LLM:**
 * - NPC profile (personality, tier, balance)
 * - Relationships with other NPCs (allies/rivals affect decisions)
 * - Recent posts and articles (public information)
 * - Group chat messages (insider information)
 * - Recent events (world developments)
 * - Available markets (perps and predictions)
 * - Current positions (P&L, sizing)
 * 
 * **Batching Strategy:**
 * - Groups NPCs into batches that fit token limits
 * - Typical: 5-15 NPCs per batch depending on context size
 * - Preserves individual context for each NPC
 * - LLM generates array of decisions (one per NPC)
 * 
 * **Validation:**
 * - Rejects trades exceeding NPC balance
 * - Verifies market/ticker existence
 * - Validates action types
 * - Checks position ownership for closes
 * - Returns only valid decisions
 * 
 * @see {@link TradeExecutionService} - Executes validated decisions
 * @see {@link MarketContextService} - Builds NPC context
 * @see {@link GameEngine} - Calls generateBatchDecisions() each tick
 * 
 * @example
 * ```typescript
 * const engine = new MarketDecisionEngine(llm, contextService);
 * 
 * // Generate decisions for all NPCs
 * const decisions = await engine.generateBatchDecisions();
 * // => [
 * //   { npcId: 'alice', action: 'buy_yes', marketId: 5, amount: 100, ... },
 * //   { npcId: 'bob', action: 'hold', ... },
 * //   { npcId: 'charlie', action: 'open_long', ticker: 'TECH', amount: 500, ... }
 * // ]
 * 
 * // Execute the trades
 * await tradeExecutionService.executeDecisionBatch(decisions);
 * ```
 */

import { logger } from '@/lib/logger';
import type { BabylonLLMClient } from '@/generator/llm/openai-client';
import type { MarketContextService } from '@/lib/services/market-context-service';
import { renderPrompt, npcMarketDecisions } from '@/prompts';
import type { TradingDecision } from '@/types/market-decisions';
import type { NPCMarketContext } from '@/types/market-context';
import { countTokensSync, getSafeContextLimit, truncateToTokenLimitSync } from '@/lib/token-counter';

/**
 * Token management configuration
 * 
 * @interface TokenConfig
 * 
 * @property model - LLM model name (e.g., 'qwen/qwen3-32b' for Groq)
 * @property maxContextTokens - Maximum tokens for prompt context
 * @property maxOutputTokens - Maximum tokens for LLM response
 * @property tokensPerNPC - Estimated tokens per NPC context section
 */
interface TokenConfig {
  model: string;
  maxContextTokens: number;
  maxOutputTokens: number;
  tokensPerNPC: number;
}

/**
 * Market Decision Engine
 * 
 * @class MarketDecisionEngine
 * 
 * @description
 * Generates trading decisions for NPCs using LLM-powered market analysis.
 * Automatically handles batching and token management to process all NPCs
 * efficiently while staying within model context limits.
 * 
 * **Key Responsibilities:**
 * - Generate realistic trading decisions based on NPC context
 * - Batch NPCs to minimize LLM API costs
 * - Manage token budgets automatically
 * - Validate all decisions against constraints
 * - Handle both individual and batch generation
 * 
 * **Architecture:**
 * - Uses `qwen/qwen3-32b` on Groq for speed and reliability (130k context)
 * - Dynamically calculates batch sizes based on token limits
 * - Falls back to individual processing if batches fail
 * - Strict validation prevents invalid trades
 * 
 * @usage
 * Created once by GameEngine and called each tick to generate NPC trading decisions.
 */
export class MarketDecisionEngine {
  private tokenConfig: TokenConfig;
  
  /**
   * Create a new MarketDecisionEngine
   * 
   * @param llm - Babylon LLM client for decision generation
   * @param contextService - Service for building NPC market context
   * @param options - Optional configuration overrides
   * @param options.model - LLM model to use (default: 'qwen/qwen3-32b' on Groq)
   * @param options.maxOutputTokens - Maximum tokens for response (default: 32k for qwen3-32b, 16k for Kimi)
   * 
   * @description
   * Initializes the engine with token management configuration. Automatically
   * calculates safe context limits based on model and output requirements.
   * 
   * **Model Selection:**
   * - Default: `qwen/qwen3-32b` on Groq (fast, 130k context)
   * - Alternative: Kimi models for high-quality content generation
   * - Fallback: OpenAI gpt-4o-mini (only if no Groq API key)
   * 
   * **Token Budget:**
   * - Automatically calculated from model INPUT limits (output is separate)
   * - qwen3-32b: 130k INPUT (117k after safety), 32k OUTPUT (separate)
   * - Estimates ~400 tokens per NPC context
   * - Can handle 294 NPCs per batch (117k ÷ 400), typically processes 64 NPCs easily
   * 
   * @example
   * ```typescript
   * const engine = new MarketDecisionEngine(
   *   llmClient,
   *   contextService,
   *   { 
   *     model: 'qwen/qwen3-32b',  // Default - uses Groq
   *     maxOutputTokens: 32000      // 32k for qwen, 16k for Kimi
   *   }
   * );
   * ```
   */
  constructor(
    private llm: BabylonLLMClient,
    private contextService: MarketContextService,
    options: {
      model?: string;
      maxOutputTokens?: number;
    } = {}
  ) {
    // Use qwen3-32b for background trading operations - fast and reliable on Groq
    const model = options.model || 'qwen/qwen3-32b';
    
    // Set output token limits based on model:
    // Note: Input and output are SEPARATE limits on modern models
    // - Kimi models: 260k INPUT (separate from 16k OUTPUT)
    // - qwen3-32b: 130k INPUT (separate from 32k OUTPUT)
    const isKimiModel = model.toLowerCase().includes('kimi');
    const defaultMaxOutput = isKimiModel ? 16000 : 32000;
    const maxOutputTokens = options.maxOutputTokens || defaultMaxOutput;
    
    this.tokenConfig = {
      model,
      maxContextTokens: getSafeContextLimit(model, maxOutputTokens),
      maxOutputTokens,
      tokensPerNPC: 400, // Reduced from 800 to avoid token limit errors
    };
    
    logger.info('MarketDecisionEngine initialized', {
      model,
      maxContextTokens: this.tokenConfig.maxContextTokens,
      maxOutputTokens,
    }, 'MarketDecisionEngine');
  }
  
  /**
   * Generate trading decisions for all NPCs
   * 
   * @returns Array of validated trading decisions
   * 
   * @description
   * Main entry point for NPC decision generation. Automatically handles:
   * - Fetching context for all trading-enabled NPCs
   * - Splitting into batches if needed for token limits
   * - Generating decisions via LLM
   * - Validating all decisions
   * - Fallback to individual processing on batch failure
   * 
   * **Process:**
   * 1. Fetch context for all NPCs via MarketContextService
   * 2. Calculate batch size based on token budget
   * 3. Process NPCs in batches via LLM
   * 4. Validate each decision against constraints
   * 5. Return only valid decisions
   * 
   * **Performance:**
   * - Typical: 1 LLM call for 64 NPCs (single batch with 130k context)
   * - Fallback: Individual calls if batching fails (rare)
   * - ~5-10 seconds for full decision generation on qwen3-32b
   * 
   * **Error Handling:**
   * - Batch failures trigger individual retry
   * - Individual failures logged but don't fail entire generation
   * - Always returns best-effort decision array
   * 
   * @example
   * ```typescript
   * const decisions = await engine.generateBatchDecisions();
   * 
   * console.log(`Generated ${decisions.length} decisions`);
   * console.log(`Trades: ${decisions.filter(d => d.action !== 'hold').length}`);
   * console.log(`Holds: ${decisions.filter(d => d.action === 'hold').length}`);
   * ```
   */
  async generateBatchDecisions(): Promise<TradingDecision[]> {
    const startTime = Date.now();
    
    // Get context for all NPCs
    const contexts = await this.contextService.buildContextForAllNPCs();
    
    if (contexts.size === 0) {
      logger.warn('No NPCs with trading enabled found', {}, 'MarketDecisionEngine');
      return [];
    }
    
    logger.info(`Generating decisions for ${contexts.size} NPCs`, { npcCount: contexts.size }, 'MarketDecisionEngine');
    
    // Convert contexts to array
    const npcs = Array.from(contexts.values());
    
    // Calculate how many NPCs we can process per batch
    const maxNPCsPerBatch = Math.max(1, Math.floor(this.tokenConfig.maxContextTokens / this.tokenConfig.tokensPerNPC));
    
    logger.info('Token budget allocation', {
      maxContextTokens: this.tokenConfig.maxContextTokens,
      tokensPerNPC: this.tokenConfig.tokensPerNPC,
      maxNPCsPerBatch,
      totalNPCs: npcs.length,
      batchesNeeded: Math.ceil(npcs.length / maxNPCsPerBatch),
    }, 'MarketDecisionEngine');
    
    // Process NPCs in batches if needed
    const allDecisions: TradingDecision[] = [];
    
    for (let i = 0; i < npcs.length; i += maxNPCsPerBatch) {
      const batch = npcs.slice(i, i + maxNPCsPerBatch);
      const batchNum = Math.floor(i / maxNPCsPerBatch) + 1;
      const totalBatches = Math.ceil(npcs.length / maxNPCsPerBatch);
      
      logger.info(`Processing batch ${batchNum}/${totalBatches}`, {
        batchSize: batch.length,
        npcNames: batch.map(n => n.npcName).join(', '),
      }, 'MarketDecisionEngine');
      
      const batchDecisions = await this.generateDecisionsForContexts(batch);
      allDecisions.push(...batchDecisions);
    }
    
    // Validate all decisions
    const validDecisions = this.validateDecisions(allDecisions, contexts);
    
    const duration = Date.now() - startTime;
    const tradeCount = validDecisions.filter(d => d.action !== 'hold').length;
    const holdCount = validDecisions.filter(d => d.action === 'hold').length;
    
    logger.info(`Generated ${validDecisions.length} decisions in ${duration}ms`, {
      total: validDecisions.length,
      trades: tradeCount,
      holds: holdCount,
      durationMs: duration,
    }, 'MarketDecisionEngine');
    
    return validDecisions;
  }
  
  /**
   * Generate decisions for specific NPCs
   */
  async generateDecisionsForNPCs(npcIds: string[]): Promise<TradingDecision[]> {
    const contexts: NPCMarketContext[] = [];
    
    for (const npcId of npcIds) {
      const context = await this.contextService.buildContextForNPC(npcId);
      contexts.push(context);
    }
    
    const decisions = await this.generateDecisionsForContexts(contexts);
    
    const contextsMap = new Map(contexts.map(c => [c.npcId, c]));
    return this.validateDecisions(decisions, contextsMap);
  }
  
  /**
   * Generate decisions for an array of contexts using LLM with token validation
   */
  private async generateDecisionsForContexts(contexts: NPCMarketContext[]): Promise<TradingDecision[]> {
    if (contexts.length === 0) return [];
    
    // Format NPCs data as string (existing prompts use pre-formatted strings)
    let npcsList = this.formatNPCsList(contexts);
    
    // Build the full prompt
    let prompt = renderPrompt(npcMarketDecisions, {
      npcCount: contexts.length.toString(),
      npcsList,
    });
    
    // Count tokens and enforce limit
    let promptTokens = countTokensSync(prompt);
    
    logger.info('Prompt token count', {
      npcs: contexts.length,
      promptTokens,
      limit: this.tokenConfig.maxContextTokens,
      withinLimit: promptTokens <= this.tokenConfig.maxContextTokens,
    }, 'MarketDecisionEngine');
    
    // If prompt exceeds limit, truncate intelligently
    if (promptTokens > this.tokenConfig.maxContextTokens) {
      logger.warn('Prompt exceeds token limit, truncating', {
        currentTokens: promptTokens,
        maxTokens: this.tokenConfig.maxContextTokens,
        npcs: contexts.length,
      }, 'MarketDecisionEngine');
      
      // Truncate the npcsList section while preserving prompt structure
      const promptPrefix = renderPrompt(npcMarketDecisions, {
        npcCount: contexts.length.toString(),
        npcsList: '',
      });
      const prefixTokens = countTokensSync(promptPrefix);
      const availableForNPCs = this.tokenConfig.maxContextTokens - prefixTokens;
      
      const truncated = truncateToTokenLimitSync(npcsList, availableForNPCs, { ellipsis: true });
      npcsList = truncated.text;
      
      prompt = renderPrompt(npcMarketDecisions, {
        npcCount: contexts.length.toString(),
        npcsList,
      });
      
      promptTokens = countTokensSync(prompt);
      
      logger.info('Truncated prompt to fit limit', {
        newTokens: promptTokens,
        truncatedChars: npcsList.length,
      }, 'MarketDecisionEngine');
    }
    
    // Use XML format for more robust parsing (handles truncation better than JSON)
    const rawResponse = await this.llm.generateJSON<TradingDecision[] | { decisions: TradingDecision[] | {decision: TradingDecision[]} } | { decision: TradingDecision[] }>(
      prompt,
      undefined,
      { 
        temperature: 0.8, 
        maxTokens: this.tokenConfig.maxOutputTokens,
        model: this.tokenConfig.model,
        format: 'xml', // Use XML for robustness
      }
    );
    
    // Extract decisions array - handle XML structure: <decisions><decision>...</decision></decisions>
    let response: TradingDecision[];
    if (Array.isArray(rawResponse)) {
      response = rawResponse;
    } else if (rawResponse && typeof rawResponse === 'object') {
      // Handle XML structure: { decisions: { decision: [...] } }
      if ('decisions' in rawResponse) {
        const decisionsObj = rawResponse.decisions;
        if (Array.isArray(decisionsObj)) {
          // Direct array
          response = decisionsObj;
        } else if (decisionsObj && typeof decisionsObj === 'object' && 'decision' in decisionsObj) {
          // Nested structure from XML
          const innerDecisions = (decisionsObj as Record<string, unknown>).decision;
          response = Array.isArray(innerDecisions) ? innerDecisions : [innerDecisions];
        } else {
          logger.error('Invalid decisions structure', { decisionsObj }, 'MarketDecisionEngine');
          return [];
        }
        logger.debug('Extracted decisions from XML', { 
          decisionsCount: response.length 
        }, 'MarketDecisionEngine');
      } else if ('decision' in rawResponse && Array.isArray(rawResponse.decision)) {
        response = rawResponse.decision;
        logger.debug('Extracted decisions from flat XML structure', { 
          decisionsCount: response.length 
        }, 'MarketDecisionEngine');
      } else {
        logger.error('LLM returned object without decisions', { 
          response: rawResponse,
          keys: Object.keys(rawResponse)
        }, 'MarketDecisionEngine');
        return [];
      }
    } else {
      // Type assertion needed since rawResponse could be anything
      const responsePreview = typeof rawResponse === 'string' 
        ? (rawResponse as string).substring(0, 200) 
        : rawResponse;
        
      logger.error('LLM returned invalid response type', { 
        response: responsePreview,
        type: typeof rawResponse
      }, 'MarketDecisionEngine');
      
      // If LLM returned a string explanation, log it
      if (typeof rawResponse === 'string') {
        logger.error('LLM ignored XML format and returned text explanation', {
          explanation: (rawResponse as string).substring(0, 300)
        }, 'MarketDecisionEngine');
      }
      
      return [];
    }
    
    logger.info(`Processed ${response.length} decisions for ${contexts.length} NPCs`, { 
      responseLength: response.length,
      npcCount: contexts.length,
      sampleDecision: response.length > 0 ? response[0] : null
    }, 'MarketDecisionEngine');
    
    if (response.length === 0) {
      logger.warn('LLM returned empty array for batch decisions', { npcCount: contexts.length }, 'MarketDecisionEngine');
    }
    
    return response;
  }
  
  /**
   * Format NPCs data as a readable string for the prompt with relationships
   * Applies intelligent truncation to stay within token budgets
   */
  private formatNPCsList(contexts: NPCMarketContext[]): string {
    return contexts.map((ctx, index) => {
      let section = `## NPC ${index + 1}: ${ctx.npcName}\n\n`;
      section += `**Profile:**\n`;
      section += `- ID: ${ctx.npcId}\n`;
      section += `- Personality: ${ctx.personality}\n`;
      section += `- Tier: ${ctx.tier}\n`;
      section += `- Available Balance: $${ctx.availableBalance.toLocaleString()}\n\n`;
      
      // Relationships (limit to top 5 strongest)
      if (ctx.relationships && ctx.relationships.length > 0) {
        section += `**Relationships:**\n`;
        const topRelationships = ctx.relationships
          .sort((a, b) => b.strength - a.strength)
          .slice(0, 5);
        
        topRelationships.forEach(rel => {
          const sentimentDesc = rel.sentiment > 0.5 ? '✅' : rel.sentiment < -0.5 ? '❌' : '➖';
          section += `- ${rel.relationshipType} with ${rel.actorName} (${sentimentDesc})`;
          if (rel.history && rel.history.length < 50) section += `: ${rel.history}`;
          section += `\n`;
        });
        section += `Rule: Rivals (❌) bet opposite, Allies (✅) bet same\n\n`;
      }
      
      section += `**Information Access:**\n\n`;
      
      // Recent Posts (reduced to 8 to save tokens)
      section += `Recent Posts (Last 8):\n`;
      ctx.recentPosts.slice(0, 8).forEach(post => {
        // Truncate long posts to save tokens
        const content = post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content;
        section += `- [@${post.authorName}]: ${content}`;
        if (post.articleTitle) section += ` [${post.articleTitle}]`;
        section += `\n`;
      });
      
      // Group Chat Messages (reduced to 5 to save tokens)
      if (ctx.groupChatMessages.length > 0) {
        section += `\n🔒 Insider Info (Last 5):\n`;
        ctx.groupChatMessages.slice(0, 5).forEach(msg => {
          const message = msg.message.length > 100 ? msg.message.substring(0, 100) + '...' : msg.message;
          section += `- [${msg.fromName}]: ${message}\n`;
        });
      }
      
      // Recent Events (reduced to 5 to save tokens)
      section += `\nRecent Events (Last 5):\n`;
      ctx.recentEvents.slice(0, 5).forEach(event => {
        section += `- ${event.description} (${event.type})`;
        if (event.relatedQuestion) section += ` [Q${event.relatedQuestion}]`;
        section += `\n`;
      });
      
      section += `\n---\n\n`;
      section += `**Markets:**\n\n`;
      
      // Perp Markets (limit to 5 to save tokens)
      section += `Perpetual Futures (Top 5):\n`;
      ctx.perpMarkets.slice(0, 5).forEach(market => {
        const sign = market.changePercent24h > 0 ? '+' : '';
        section += `- ${market.ticker}: $${market.currentPrice.toFixed(2)} (${sign}${market.changePercent24h.toFixed(1)}%)\n`;
      });
      
      // Prediction Markets (limit to 5)
      section += `\nPrediction Markets (Top 5):\n`;
      ctx.predictionMarkets.slice(0, 5).forEach(market => {
        section += `- Q${market.id}: ${market.text}\n`;
        section += `  YES: ${market.yesPrice.toFixed(0)}% | NO: ${market.noPrice.toFixed(0)}% | ${market.daysUntilResolution}d\n`;
      });
      
      section += `\n---\n\n`;
      
      // Current Positions (all, usually few)
      section += `**Positions:**\n`;
      if (ctx.currentPositions.length > 0) {
        ctx.currentPositions.forEach(pos => {
          const symbol = pos.ticker || `Q${pos.marketId}`;
          section += `- ${pos.marketType} ${symbol} ${pos.side}: P&L $${pos.unrealizedPnL.toFixed(0)}\n`;
        });
      } else {
        section += `None\n`;
      }
      
      section += `\n**DECISION:**\n`;
      section += `Balance: $${ctx.availableBalance.toLocaleString()} (MAX)\n`;
      section += `Actions: open_long, open_short, buy_yes, buy_no, close_position, hold\n\n`;
      
      return section;
    }).join('\n\n');
  }
  
  /**
   * Validate decisions against constraints
   */
  private validateDecisions(
    decisions: TradingDecision[],
    contexts: Map<string, NPCMarketContext>
  ): TradingDecision[] {
    logger.info(`Validating ${decisions.length} raw LLM decisions`, { 
      decisionsCount: decisions.length,
      contextsCount: contexts.size,
      sampleDecisionAction: decisions[0]?.action,
      sampleNpcName: decisions[0]?.npcName
    }, 'MarketDecisionEngine');
    
    const valid: TradingDecision[] = [];
    const rejectionReasons: Record<string, number> = {};
    
    for (const decision of decisions) {
      const context = contexts.get(decision.npcId);
      
      if (!context) {
        rejectionReasons['no_context'] = (rejectionReasons['no_context'] || 0) + 1;
        logger.warn(`Decision for unknown NPC: ${decision.npcId}`, {}, 'MarketDecisionEngine');
        continue;
      }
      
      // Validate hold action
      if (decision.action === 'hold') {
        logger.info(`${decision.npcName} chose to HOLD`, {}, 'MarketDecisionEngine');
        valid.push({
          ...decision,
          marketType: null,
          amount: 0,
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      
      // Validate close_position action
      if (decision.action === 'close_position') {
        if (!decision.positionId) {
          logger.warn(`Close position decision missing positionId for ${decision.npcName}`, {}, 'MarketDecisionEngine');
          continue;
        }
        
        const position = context.currentPositions.find(p => p.id === decision.positionId);
        if (!position) {
          logger.warn(`Position ${decision.positionId} not found for ${decision.npcName}`, {}, 'MarketDecisionEngine');
          continue;
        }
        
        valid.push({
          ...decision,
          marketType: position.marketType,
          amount: 0,
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      
      // Validate trading actions
      if (decision.amount <= 0) {
        logger.warn(`Invalid amount ${decision.amount} for ${decision.npcName}`, {}, 'MarketDecisionEngine');
        continue;
      }
      
      if (decision.amount > context.availableBalance) {
        logger.warn(
          `LLM suggested amount exceeds balance for ${decision.npcName}: $${decision.amount.toLocaleString()} > $${context.availableBalance.toLocaleString()} - REJECTING`,
          {},
          'MarketDecisionEngine'
        );
        // REJECT the decision instead of scaling - this forces LLM to respect constraints
        continue;
      }
      
      // Validate market type
      if (!decision.marketType) {
        logger.warn(`Trading decision missing marketType for ${decision.npcName}`, {}, 'MarketDecisionEngine');
        continue;
      }
      
      // Validate perp actions
      if (decision.action === 'open_long' || decision.action === 'open_short') {
        if (decision.marketType !== 'perp') {
          logger.warn(`Perp action with non-perp market type for ${decision.npcName}`, {}, 'MarketDecisionEngine');
          continue;
        }
        
        if (!decision.ticker) {
          logger.warn(`Perp decision missing ticker for ${decision.npcName}`, {}, 'MarketDecisionEngine');
          continue;
        }
        
        // Verify ticker exists
        const perpExists = context.perpMarkets.find(p => p.ticker === decision.ticker);
        if (!perpExists) {
          logger.warn(`Unknown perp ticker ${decision.ticker} for ${decision.npcName}`, {}, 'MarketDecisionEngine');
          continue;
        }
      }
      
      // Validate prediction actions
      if (decision.action === 'buy_yes' || decision.action === 'buy_no') {
        if (decision.marketType !== 'prediction') {
          logger.warn(`Prediction action with non-prediction market type for ${decision.npcName}`, {}, 'MarketDecisionEngine');
          continue;
        }
        
        if (!decision.marketId) {
          logger.warn(`Prediction decision missing marketId for ${decision.npcName}`, {}, 'MarketDecisionEngine');
          continue;
        }
        
        // Verify market exists
        const marketExists = context.predictionMarkets.find(p => p.id === decision.marketId);
        if (!marketExists) {
          logger.warn(`Unknown prediction market ${decision.marketId} for ${decision.npcName}`, {}, 'MarketDecisionEngine');
          continue;
        }
      }
      
      // Validate confidence
      if (decision.confidence < 0 || decision.confidence > 1) {
        decision.confidence = Math.max(0, Math.min(1, decision.confidence));
      }
      
      // Add timestamp
      valid.push({
        ...decision,
        timestamp: new Date().toISOString(),
      });
    }
    
    logger.info(`Validated ${valid.length}/${decisions.length} decisions`, {
      valid: valid.length,
      total: decisions.length,
      filtered: decisions.length - valid.length,
      rejectionReasons,
    }, 'MarketDecisionEngine');
    
    return valid;
  }
  
  /**
   * Fallback: Generate decision for a single NPC
   */
  async generateSingleDecision(npcId: string): Promise<TradingDecision> {
    const context = await this.contextService.buildContextForNPC(npcId);
    const decisions = await this.generateDecisionsForContexts([context]);
    
    if (decisions.length === 0) {
      return {
        npcId: context.npcId,
        npcName: context.npcName,
        action: 'hold',
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'No trading opportunities identified',
        timestamp: new Date().toISOString(),
      };
    }
    
    return decisions[0]!;
  }
}

