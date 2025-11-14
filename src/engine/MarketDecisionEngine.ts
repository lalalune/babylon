/**
 * Market Decision Engine
 * 
 * Uses LLM to generate trading decisions for all NPCs based on their market context.
 * Batches NPCs together to minimize LLM calls while preserving individual decision-making.
 */

import { logger } from '@/lib/logger';
import type { BabylonLLMClient } from '@/generator/llm/openai-client';
import type { MarketContextService } from '@/lib/services/market-context-service';
import { renderPrompt, npcMarketDecisions } from '@/prompts';
import type { TradingDecision } from '@/types/market-decisions';
import type { NPCMarketContext } from '@/types/market-context';

export class MarketDecisionEngine {
  constructor(
    private llm: BabylonLLMClient,
    private contextService: MarketContextService
  ) {}
  
  /**
   * Generate trading decisions for all NPCs in one batched LLM call
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
    
    // Convert contexts to prompt format
    const npcs = Array.from(contexts.values());
    
    // Generate batched decisions
    const decisions = await this.generateDecisionsForContexts(npcs);
    
    // Validate decisions
    const validDecisions = this.validateDecisions(decisions, contexts);
    
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
   * Generate decisions for an array of contexts using LLM
   */
  private async generateDecisionsForContexts(contexts: NPCMarketContext[]): Promise<TradingDecision[]> {
    if (contexts.length === 0) return [];
    
    // Format NPCs data as string (existing prompts use pre-formatted strings)
    const npcsList = this.formatNPCsList(contexts);
    
    const prompt = renderPrompt(npcMarketDecisions, {
      npcCount: contexts.length.toString(),
      npcsList,
    });
    
    const response = await this.llm.generateJSON<TradingDecision[]>(
      prompt,
      undefined,
      { temperature: 0.8, maxTokens: 8000 }
    );
    
    // Validate response is array
    if (!Array.isArray(response)) {
      logger.error('LLM returned non-array response for batch decisions', { response }, 'MarketDecisionEngine');
      return [];
    }
    
    return response;
  }
  
  /**
   * Format NPCs data as a readable string for the prompt with relationships
   */
  private formatNPCsList(contexts: NPCMarketContext[]): string {
    return contexts.map((ctx, index) => {
      let section = `## NPC ${index + 1}: ${ctx.npcName}\n\n`;
      section += `**Profile:**\n`;
      section += `- ID: ${ctx.npcId}\n`;
      section += `- Personality: ${ctx.personality}\n`;
      section += `- Tier: ${ctx.tier}\n`;
      section += `- Available Balance: $${ctx.availableBalance.toLocaleString()}\n\n`;
      
      if (ctx.relationships && ctx.relationships.length > 0) {
        section += `**Relationships:**\n`;
        ctx.relationships.forEach(rel => {
          const sentimentDesc = rel.sentiment > 0.5 ? '✅ respect' : rel.sentiment < -0.5 ? '❌ beef' : '➖ neutral';
          const strengthDesc = rel.strength > 0.7 ? 'STRONG' : rel.strength > 0.4 ? 'moderate' : 'weak';
          section += `- ${strengthDesc} ${rel.relationshipType} with ${rel.actorName} (${sentimentDesc})`;
          if (rel.history) section += `: ${rel.history}`;
          section += `\n`;
        });
        section += `\nRELATIONSHIP TRADING RULES:\n`;
        section += `- Rivals (❌): Bet OPPOSITE to them\n`;
        section += `- Allies (✅): Bet SAME as them\n`;
        section += `- Strong relationships: Weight heavily in decisions\n\n`;
      }
      
      section += `**Information Access:**\n\n`;
      section += `Recent Posts They've Seen (Last 20):\n`;
      ctx.recentPosts.slice(0, 20).forEach(post => {
        // Truncate long posts to save tokens
        const content = post.content.length > 150 ? post.content.slice(0, 150) + '...' : post.content;
        section += `- [@${post.authorName}]: ${content}`;
        if (post.articleTitle) section += ` [${post.articleTitle.slice(0, 50)}]`;
        section += `\n`;
      });
      
      if (ctx.groupChatMessages.length > 0) {
        section += `\n🔒 INSIDER INFO (Private Group Chats - Last 10):\n`;
        ctx.groupChatMessages.slice(0, 10).forEach(msg => {
          const message = msg.message.length > 100 ? msg.message.slice(0, 100) + '...' : msg.message;
          section += `- [${msg.fromName} in "${msg.chatName}"]: ${message}\n`;
        });
      }
      
      section += `\nRecent Events (Last 10):\n`;
      ctx.recentEvents.slice(0, 10).forEach(event => {
        const desc = event.description.length > 100 ? event.description.slice(0, 100) + '...' : event.description;
        section += `- ${desc} (${event.type})`;
        if (event.relatedQuestion) section += ` [Q${event.relatedQuestion}]`;
        if (event.pointsToward) section += ` [→${event.pointsToward}]`;
        section += `\n`;
      });
      
      section += `\n---\n\n`;
      section += `**Available Markets:**\n\n`;
      section += `Perpetual Futures (${ctx.perpMarkets.length} available - showing top 10):\n`;
      ctx.perpMarkets.slice(0, 10).forEach(market => {
        const sign = market.changePercent24h > 0 ? '+' : '';
        section += `- ${market.ticker}: $${market.currentPrice.toFixed(2)} (${sign}${market.changePercent24h.toFixed(1)}% 24h)\n`;
      });
      
      section += `\nPrediction Markets (${ctx.predictionMarkets.length} available):\n`;
      ctx.predictionMarkets.forEach(market => {
        section += `- Q${market.id}: ${market.text}\n`;
        section += `  YES: ${market.yesPrice.toFixed(1)}% | NO: ${market.noPrice.toFixed(1)}%\n`;
        section += `  Resolves in ${market.daysUntilResolution} days | Volume: $${market.totalVolume.toFixed(0)}\n`;
      });
      
      section += `\n---\n\n`;
      section += `**Current Positions:**\n`;
      if (ctx.currentPositions.length > 0) {
        ctx.currentPositions.forEach(pos => {
          const symbol = pos.ticker || `Q${pos.marketId}`;
          section += `- ${pos.marketType} ${symbol} ${pos.side}: Entry $${pos.entryPrice.toFixed(2)}, Current $${pos.currentPrice.toFixed(2)}, P&L $${pos.unrealizedPnL.toFixed(2)} (Size: $${pos.size.toFixed(2)})\n`;
        });
      } else {
        section += `No open positions\n`;
      }
      
      section += `\n---\n\n`;
      section += `**DECISION TIME for ${ctx.npcName}:**\n\n`;
      section += `⚠️ BALANCE LIMIT: $${ctx.availableBalance.toLocaleString()} (DO NOT EXCEED THIS)\n`;
      section += `Recommended position size: $${(ctx.availableBalance * 0.2).toLocaleString()} (20% of balance)\n\n`;
      section += `Consider:\n`;
      section += `1. Their personality (${ctx.personality}) and risk tolerance\n`;
      section += `2. Information they have access to (especially insider group chat info)\n`;
      section += `3. Current market conditions and price trends\n`;
      section += `4. ⚠️ MAXIMUM trade amount: $${ctx.availableBalance.toLocaleString()} (their available balance)\n`;
      section += `5. Their tier/expertise level (${ctx.tier})\n`;
      section += `6. Time until prediction market resolutions\n`;
      section += `7. Their existing positions (close any? take profits? cut losses?)\n`;
      section += `8. What specific posts, events, or messages would influence their decision\n\n`;
      
      section += `Possible actions:\n`;
      section += `- open_long: Buy perpetual long position\n`;
      section += `- open_short: Sell perpetual short position\n`;
      section += `- buy_yes: Buy YES shares in prediction market\n`;
      section += `- buy_no: Buy NO shares in prediction market\n`;
      section += `- close_position: Close existing position (must specify positionId)\n`;
      section += `- hold: Do nothing this tick (valid choice!)\n\n`;
      
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
    const valid: TradingDecision[] = [];
    
    for (const decision of decisions) {
      const context = contexts.get(decision.npcId);
      
      if (!context) {
        logger.warn(`Decision for unknown NPC: ${decision.npcId}`, {}, 'MarketDecisionEngine');
        continue;
      }
      
      // Validate hold action
      if (decision.action === 'hold') {
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

