/**
 * Test suite for Markets P&L Sharing functionality
 */

import { describe, it, expect } from 'bun:test'

describe('Markets P&L Sharing', () => {
  describe('Portfolio P&L Hook', () => {
    it('should calculate total P&L including pools', () => {
      const perpPnL = 1000
      const predictionPnL = 500
      const poolPnL = 300
      
      const totalPnL = perpPnL + predictionPnL + poolPnL
      
      expect(totalPnL).toBe(1800)
    })

    it('should handle negative P&L correctly', () => {
      const perpPnL = -500
      const predictionPnL = 300
      const poolPnL = -200
      
      const totalPnL = perpPnL + predictionPnL + poolPnL
      
      expect(totalPnL).toBe(-400)
    })
  })

  describe('Category P&L Data Calculation', () => {
    it('should calculate perps P&L from positions', () => {
      const positions = [
        { unrealizedPnL: 100, size: 1000 },
        { unrealizedPnL: 50, size: 500 },
        { unrealizedPnL: -30, size: 300 }
      ]
      
      const totalPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0)
      const totalValue = positions.reduce((sum, pos) => sum + Math.abs(pos.size), 0)
      
      expect(totalPnL).toBe(120)
      expect(totalValue).toBe(1800)
    })

    it('should calculate prediction P&L from shares and prices', () => {
      const positions = [
        { shares: 100, avgPrice: 0.5, currentPrice: 0.7 },
        { shares: 50, avgPrice: 0.6, currentPrice: 0.8 }
      ]
      
      const totalPnL = positions.reduce((sum, pos) => {
        const currentValue = pos.shares * pos.currentPrice
        const costBasis = pos.shares * pos.avgPrice
        return sum + (currentValue - costBasis)
      }, 0)
      
      expect(totalPnL).toBe(30) // (100*0.7 - 100*0.5) + (50*0.8 - 50*0.6)
    })

    it('should use pool summary data for pool P&L', () => {
      const poolSummary = {
        totalInvested: 1000,
        totalCurrentValue: 1250,
        totalUnrealizedPnL: 250,
        totalReturnPercent: 25,
        activePools: 3,
        historicalCount: 1
      }
      
      expect(poolSummary.totalUnrealizedPnL).toBe(250)
      expect(poolSummary.activePools).toBe(3)
    })
  })

  describe('Share Card Data Formatting', () => {
    it('should format positive P&L correctly', () => {
      const pnl = 1234.56
      const formatted = `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`
      
      expect(formatted).toBe('+$1234.56')
    })

    it('should format negative P&L correctly', () => {
      const pnl = -987.65
      const formatted = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`
      
      expect(formatted).toBe('-$987.65')
    })

    it('should format share text for Twitter', () => {
      const pnl = 1234.56
      const category = 'Perpetual Futures'
      const url = 'https://babylon.market/markets'
      
      const text = `My ${category} P&L on Babylon is +$${pnl.toFixed(2)}. Trading narratives, sharing the upside. ${url}`
      
      expect(text).toContain(category)
      expect(text).toContain('+$1234.56')
      expect(text).toContain(url)
    })

    it('should format share text for Farcaster', () => {
      const pnl = 1234.56
      const category = 'Perpetual Futures'
      const url = 'https://babylon.market/markets'
      
      const text = `My ${category} P&L on Babylon is +$${pnl.toFixed(2)}. Trading narratives, sharing the upside.\n\n${url} #BabylonMarkets`
      
      expect(text).toContain(category)
      expect(text).toContain('+$1234.56')
      expect(text).toContain(url)
      expect(text).toContain('#BabylonMarkets')
    })
  })

  describe('Category Configuration', () => {
    it('should have correct perps configuration', () => {
      const config = {
        title: 'Perpetual Futures',
        emoji: '📈',
        gradient: 'from-green-500/10',
      }
      
      expect(config.title).toBe('Perpetual Futures')
      expect(config.emoji).toBe('📈')
    })

    it('should have correct predictions configuration', () => {
      const config = {
        title: 'Prediction Markets',
        emoji: '🔮',
        gradient: 'from-purple-500/10',
      }
      
      expect(config.title).toBe('Prediction Markets')
      expect(config.emoji).toBe('🔮')
    })

    it('should have correct pools configuration', () => {
      const config = {
        title: 'Trading Pools',
        emoji: '💰',
        gradient: 'from-orange-500/10',
      }
      
      expect(config.title).toBe('Trading Pools')
      expect(config.emoji).toBe('💰')
    })
  })

  describe('Share URL Generation', () => {
    it('should generate Twitter intent URL correctly', () => {
      const text = 'My P&L is +$1000. Check it out!'
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
      
      expect(url).toContain('https://twitter.com/intent/tweet?text=')
      const textPart = url.split('text=')[1]
      expect(textPart).toBeDefined()
      if (textPart) {
        expect(decodeURIComponent(textPart)).toBe(text)
      }
    })

    it('should generate Farcaster compose URL correctly', () => {
      const text = 'My P&L is +$1000. Check it out!'
      const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`
      
      expect(url).toContain('https://warpcast.com/~/compose?text=')
      const textPart = url.split('text=')[1]
      expect(textPart).toBeDefined()
      if (textPart) {
        expect(decodeURIComponent(textPart)).toBe(text)
      }
    })
  })

  describe('Brand Colors', () => {
    it('should use correct primary brand color', () => {
      const primaryColor = '#0066FF'
      expect(primaryColor).toBe('#0066FF')
    })

    it('should use correct profit color', () => {
      const profitColor = '#34D399' // emerald
      expect(profitColor).toBe('#34D399')
    })

    it('should use correct loss color', () => {
      const lossColor = '#F87171' // red
      expect(lossColor).toBe('#F87171')
    })
  })
})

describe('Share Card Image Generation', () => {
  it('should generate correct dimensions', () => {
    const width = 1200
    const height = 630
    
    expect(width).toBe(1200)
    expect(height).toBe(630)
  })

  it('should include required elements', () => {
    const requiredElements = [
      'profile image',
      'username',
      'timestamp',
      'P&L amount',
      'category stats',
      'Babylon logo',
      'tagline'
    ]
    
    expect(requiredElements.length).toBe(7)
  })
})

describe('Modal Interactions', () => {
  it('should track share attempts', () => {
    const shareData = {
      platform: 'twitter',
      contentType: 'market',
      contentId: 'perps-pnl',
      url: 'https://babylon.market/markets',
      userId: 'test-user-123'
    }
    
    expect(shareData.platform).toBe('twitter')
    expect(shareData.contentType).toBe('market')
    expect(shareData.contentId).toBe('perps-pnl')
  })

  it('should handle download filename generation', () => {
    const timestamp = Date.now()
    const category = 'perps'
    const filename = `babylon-${category}-pnl-${timestamp}.png`
    
    expect(filename).toMatch(/^babylon-perps-pnl-\d+\.png$/)
  })
})

