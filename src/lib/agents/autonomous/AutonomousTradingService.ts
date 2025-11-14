/**
 * Autonomous Trading Service
 * 
 * Handles agents making REAL trades on prediction markets and perps
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { IAgentRuntime } from '@elizaos/core'
import { callGroqDirect } from '../llm/direct-groq'
import { PerpTradeService } from '@/lib/services/perp-trade-service'
import { WalletService } from '@/lib/services/wallet-service'
import { PredictionPricing } from '@/lib/prediction-pricing'
import { asUser } from '@/lib/db/context'
import { generateSnowflakeId } from '@/lib/snowflake'
import { Prisma } from '@prisma/client'
import { agentPnLService } from '../services/AgentPnLService'
import { generateRandomMarketContext, formatRandomContext } from '@/lib/prompts/random-context'
import { shuffleArray } from '@/lib/utils/randomization'

export class AutonomousTradingService {
  /**
   * Evaluate and execute trades for an agent
   * TODO: Removed outer try/catch - let errors propagate. Kept inner try/catch for individual trade execution to continue processing.
   */
  async executeTrades(agentUserId: string, _runtime: IAgentRuntime): Promise<number> {
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId }
    })

    if (!agent?.isAgent) {
      throw new Error('Agent not found')
    }

    // Get agent's positions separately
    const positions = await prisma.position.findMany({
      where: { userId: agentUserId, status: 'active' }
    })

    const perpPositions = await prisma.perpPosition.findMany({
      where: { userId: agentUserId, closedAt: null }
    })

    // Get current markets
    const predictionMarkets = await prisma.market.findMany({
      where: {
        resolved: false,
        endDate: { gte: new Date() }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    const perpMarkets = await prisma.organization.findMany({
      where: { type: 'org' },
      orderBy: { currentPrice: 'desc' },
      take: 10
    })

    const balance = await WalletService.getBalance(agentUserId)

    // Shuffle markets to add variety to prompts
    const shuffledPredictions = shuffleArray(predictionMarkets)
    const shuffledPerps = shuffleArray(perpMarkets)

    // Get random market context for variety
    const marketContext = await generateRandomMarketContext({
      includeGainers: true,
      includeLosers: true,
      includeQuestions: true,
      includePosts: false,
      includeEvents: true,
    })
    const contextString = formatRandomContext(marketContext)

    // Build trading decision prompt
    const prompt = `${agent.agentSystem}

You are ${agent.displayName}, an autonomous trading agent.

Trading Strategy: ${agent.agentTradingStrategy || 'General market analysis'}

Current Status:
- Balance: $${balance.balance}
- P&L: ${agent.lifetimePnL}
- Open Positions: ${positions.length + perpPositions.length}

Available Prediction Markets:
${shuffledPredictions.slice(0, 5).map(m => `- ${m.question} (YES: ${m.yesShares}, NO: ${m.noShares})`).join('\n')}

Available Perp Markets:
${shuffledPerps.slice(0, 5).map(o => `- ${o.name} @ $${o.currentPrice}`).join('\n')}

Your Open Positions:
${positions.map(p => `- Prediction: ${p.marketId}, ${p.side ? 'YES' : 'NO'}, ${p.shares} shares`).join('\n') || 'None'}
${perpPositions.map(p => `- Perp: ${p.ticker}, ${p.side}, $${p.size}, ${p.leverage}x`).join('\n') || 'None'}

Decide if you should make any trades this tick.
Respond in JSON format:
{
  "action": "trade" | "hold",
  "trade": {
    "type": "prediction" | "perp",
    "market": "id or ticker",
    "action": "buy_yes" | "buy_no" | "sell" | "open_long" | "open_short" | "close",
    "amount": number,
    "reasoning": "why"
  }
}

Only trade if you have strong conviction and sufficient balance.
${contextString}`

    // Use large model (qwen3-32b) for trading decisions (background processing)
    const decision = await callGroqDirect({
      prompt,
      system: agent.agentSystem || undefined,
      modelSize: 'large',  // Background operation, use qwen3-32b
      temperature: 0.7,
      maxTokens: 300
    })

    const jsonMatch = decision.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return 0
    }
    const tradeDecision = JSON.parse(jsonMatch[0]) as { action: string; trade?: {type: string; market: string; action: string; amount: number; reasoning?: string } }

    if (tradeDecision.action !== 'trade' || !tradeDecision.trade) {
      return 0 // Agent decided to hold
    }

    const trade = tradeDecision.trade
    let tradesExecuted = 0

    // Execute the trade based on type
    if (trade.type === 'prediction' && predictionMarkets.length > 0) {
      const market = predictionMarkets.find(m => m.id === trade.market || m.question.includes(trade.market))
      if (market && trade.amount <= Number(balance.balance)) {
        // Keep try/catch for individual trade execution
        try {
          if (trade.action === 'buy_yes' || trade.action === 'buy_no') {
            const side = trade.action === 'buy_yes'
            
            // Execute buy via internal service
            const result = await asUser({ userId: agentUserId, walletAddress: agent.walletAddress || undefined }, async (db) => {
              // Calculate shares and pricing
              const calculation = PredictionPricing.calculateBuyWithFees(
                Number(market.yesShares),
                Number(market.noShares),
                side ? 'yes' : 'no',
                trade.amount
              )

              // Debit amount from balance
              await WalletService.debit(
                agentUserId,
                trade.amount,
                'pred_buy',
                `Bought ${calculation.sharesBought} ${side ? 'YES' : 'NO'} shares: ${market.question}`,
                market.id
              )

              // Update market shares
              await db.market.update({
                where: { id: market.id },
                data: {
                  yesShares: side 
                    ? { increment: calculation.sharesBought }
                    : new Prisma.Decimal(calculation.newYesShares),
                  noShares: side
                    ? new Prisma.Decimal(calculation.newNoShares)
                    : { increment: calculation.sharesBought }
                }
              })

              // Create or update position
              const existingPosition = await db.position.findFirst({
                where: {
                  userId: agentUserId,
                  marketId: market.id
                }
              })

              const position = existingPosition ? await db.position.update({
                where: { id: existingPosition.id },
                data: {
                  shares: { increment: calculation.sharesBought },
                  amount: { increment: trade.amount },
                  updatedAt: new Date()
                }
              }) : await db.position.create({
                data: {
                  id: await generateSnowflakeId(),
                  userId: agentUserId,
                  marketId: market.id,
                  side,
                  shares: new Prisma.Decimal(calculation.sharesBought),
                  avgPrice: new Prisma.Decimal(calculation.avgPrice),
                  amount: new Prisma.Decimal(trade.amount),
                  status: 'active',
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              })

              return { position, calculation }
            })

            // Record in AgentTrade
            await agentPnLService.recordTrade({
              agentId: agentUserId,
              userId: agent.managedBy || agentUserId,
              marketType: 'prediction',
              marketId: market.id,
              action: 'open',
              side: side ? 'yes' : 'no',
              amount: trade.amount,
              price: result.calculation.avgPrice,
              reasoning: trade.reasoning || undefined
            })

            tradesExecuted++
            logger.info(`Agent ${agent.displayName} bought ${side ? 'YES' : 'NO'} on ${market.question}`, undefined, 'AutonomousTrading')
          }
        } catch (error) {
          logger.error(`Trade execution failed for agent ${agentUserId}`, error, 'AutonomousTrading')
        }
      }
    } else if (trade.type === 'perp' && perpMarkets.length > 0) {
      const org = perpMarkets.find(o => o.name.toLowerCase().includes(trade.market.toLowerCase()))
      if (org && trade.amount <= Number(balance.balance)) {
        // Keep try/catch for individual trade execution
        try {
          if (trade.action === 'open_long' || trade.action === 'open_short') {
            const side = trade.action === 'open_long' ? 'long' : 'short'
            
            // Execute via PerpTradeService
            const perpResult = await PerpTradeService.openPosition(
              { userId: agentUserId, walletAddress: agent.walletAddress || undefined },
              {
                ticker: org.name,
                side,
                size: trade.amount,
                leverage: 2 // Conservative leverage for agents
              }
            )

            // Record in AgentTrade
            await agentPnLService.recordTrade({
              agentId: agentUserId,
              userId: agent.managedBy || agentUserId,
              marketType: 'perp',
              ticker: org.name,
              action: 'open',
              side,
              amount: trade.amount,
              price: perpResult.position.entryPrice,
              reasoning: trade.reasoning ?? undefined
            })

            tradesExecuted++
            logger.info(`Agent ${agent.displayName} opened ${side} position on ${org.name}`, undefined, 'AutonomousTrading')
          }
        } catch (error) {
          logger.error(`Perp trade execution failed for agent ${agentUserId}`, error, 'AutonomousTrading')
        }
      }
    }

    return tradesExecuted
  }
}

export const autonomousTradingService = new AutonomousTradingService()
