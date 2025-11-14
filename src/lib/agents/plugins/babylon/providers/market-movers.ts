/**
 * Market Movers Provider
 * Provides top gainers and losers in the market
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * Provider: Market Movers (Gainers & Losers)
 * Gets top gaining and losing stocks/companies
 */
export const marketMoversProvider: Provider = {
  name: 'BABYLON_MARKET_MOVERS',
  description: 'Get top market gainers and losers (stocks with biggest price changes)',
  
  get: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    try {
      // Get all companies with prices
      const companies = await prisma.organization.findMany({
        where: {
          type: 'company',
          currentPrice: { not: null },
          initialPrice: { not: null },
        },
        select: {
          id: true,
          name: true,
          currentPrice: true,
          initialPrice: true,
        },
        take: 100 // Get more than needed for filtering
      })
      
      if (companies.length === 0) {
        return { text: 'No market data available.' }
      }
      
      // Calculate price changes
      const withChanges = companies.map(c => {
        const current = parseFloat(c.currentPrice?.toString() || '0')
        const initial = parseFloat(c.initialPrice?.toString() || '0')
        const change = initial > 0 ? ((current - initial) / initial) * 100 : 0
        
        // Use first 4-5 chars of name as ticker if not available
        const ticker = c.name.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 5)
        
        return {
          id: c.id,
          name: c.name,
          ticker,
          price: current,
          change
        }
      })
      
      // Get top 5 gainers (positive change)
      const gainers = withChanges
        .filter(c => c.change > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 5)
      
      // Get top 5 losers (negative change)
      const losers = withChanges
        .filter(c => c.change < 0)
        .sort((a, b) => a.change - b.change)
        .slice(0, 5)
      
      const gainersText = gainers.length > 0
        ? gainers.map((g, i) => 
            `${i + 1}. ${g.ticker} - ${g.name} - $${g.price.toFixed(2)} (+${g.change.toFixed(2)}%)`
          ).join('\n')
        : 'No gainers'
      
      const losersText = losers.length > 0
        ? losers.map((l, i) => 
            `${i + 1}. ${l.ticker} - ${l.name} - $${l.price.toFixed(2)} (${l.change.toFixed(2)}%)`
          ).join('\n')
        : 'No losers'
      
      return { 
        text: `Market Movers:

📈 TOP GAINERS:
${gainersText}

📉 TOP LOSERS:
${losersText}`,
        data: {
          gainers: gainers.map(g => ({
            id: g.id,
            name: g.name,
            ticker: g.ticker,
            price: g.price,
            change: g.change
          })),
          losers: losers.map(l => ({
            id: l.id,
            name: l.name,
            ticker: l.ticker,
            price: l.price,
            change: l.change
          }))
        }
      }
    } catch (error) {
      logger.error('Failed to fetch market movers', error, 'MarketMoversProvider')
      return { text: 'Unable to fetch market movers at this time.' }
    }
  }
}

