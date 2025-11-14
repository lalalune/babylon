/**
 * Agent P&L Service
 * 
 * Handles P&L tracking, trade recording, and rollup to user accounts
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

export class AgentPnLService {
  /**
   * Record a trade for an agent
   */
  async recordTrade(params: {
    agentId: string
    userId: string
    marketType: 'prediction' | 'perp'
    marketId?: string
    ticker?: string
    action: 'open' | 'close'
    side?: 'long' | 'short' | 'yes' | 'no'
    amount: number
    price: number
    pnl?: number
    reasoning?: string
  }): Promise<void> {
    const { agentId, userId, marketType, marketId, ticker, action, side, amount, price, pnl, reasoning } = params

    await prisma.$transaction(async (tx) => {
      // Create trade record
      await tx.agentTrade.create({
        data: {
          id: uuidv4(),
          agentUserId: agentId,
          marketType,
          marketId,
          ticker,
          action,
          side,
          amount,
          price,
          pnl,
          reasoning
        }
      })

      // Update agent P&L if provided
      if (pnl !== undefined && pnl !== null) {
        await tx.user.update({
          where: { id: agentId },
          data: {
            lifetimePnL: {
              increment: pnl
            }
          }
        })

        // Roll up to manager's totalAgentPnL
        await tx.user.update({
          where: { id: userId },
          data: {
            totalAgentPnL: {
              increment: pnl
            }
          }
        })
      }

      // Log the trade
      await tx.agentLog.create({
        data: {
          id: uuidv4(),
          agentUserId: agentId,
          type: 'trade',
          level: 'info',
          message: `Trade executed: ${action} ${side || ''} ${amount} @ ${price}`,
          metadata: {
            marketType,
            marketId,
            ticker,
            pnl,
            reasoning
          }
        }
      })
    })

    logger.info(`Trade recorded for agent ${agentId}`, undefined, 'AgentPnLService')
  }

  /**
   * Get agent trades
   */
  async getAgentTrades(agentUserId: string, limit = 50) {
    return prisma.agentTrade.findMany({
      where: { agentUserId },
      orderBy: { executedAt: 'desc' },
      take: limit
    })
  }

  async getUserAgentPnL(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalAgentPnL: true }
    })

    return user ? Number(user.totalAgentPnL) : 0
  }

  async syncUserAgentPnL(userId: string): Promise<void> {
    const agents = await prisma.user.findMany({
      where: { isAgent: true, managedBy: userId },
      select: { lifetimePnL: true }
    })

    const totalPnL = agents.reduce((sum, agent) => sum + Number(agent.lifetimePnL), 0)

    await prisma.user.update({
      where: { id: userId },
      data: { totalAgentPnL: { set: totalPnL } }
    })

    logger.info(`Synced agent P&L for user ${userId}: ${totalPnL}`, undefined, 'AgentPnLService')
  }
}

export const agentPnLService = new AgentPnLService()

