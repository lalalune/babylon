/**
 * Analysis Service
 * 
 * Manages shared market analyses with persistence and cleanup.
 * Can be extended to use database or Redis for production.
 */

import type { MarketAnalysis } from '../types'
import { logger } from '@/lib/logger'

export class AnalysisService {
  private analyses: Map<string, MarketAnalysis[]> = new Map()
  private readonly MAX_ANALYSES_PER_MARKET = 100
  private readonly ANALYSIS_TTL = 24 * 60 * 60 * 1000 // 24 hours
  
  /**
   * Store analysis for a market
   */
  storeAnalysis(marketId: string, analysis: MarketAnalysis): string {
    if (!this.analyses.has(marketId)) {
      this.analyses.set(marketId, [])
    }
    
    const analysisId = `analysis-${analysis.analyst}-${Date.now()}`
    this.analyses.get(marketId)!.push(analysis)
    
    // Trim old analyses if exceeded max
    const marketAnalyses = this.analyses.get(marketId)!
    if (marketAnalyses.length > this.MAX_ANALYSES_PER_MARKET) {
      this.analyses.set(marketId, marketAnalyses.slice(-this.MAX_ANALYSES_PER_MARKET))
    }
    
    logger.debug(`Stored analysis ${analysisId} for market ${marketId}`, undefined, 'AnalysisService')
    return analysisId
  }
  
  /**
   * Get analyses for a market
   */
  getAnalyses(marketId: string, limit: number = 50): MarketAnalysis[] {
    const analyses = this.analyses.get(marketId) || []
    return analyses.slice(-limit) // Get most recent
  }
  
  /**
   * Get all analyses across all markets
   */
  getAllAnalyses(): Map<string, MarketAnalysis[]> {
    return new Map(this.analyses)
  }
  
  /**
   * Get analysis count for a market
   */
  getAnalysisCount(marketId: string): number {
    return this.analyses.get(marketId)?.length || 0
  }
  
  /**
   * Clear old analyses (called periodically)
   */
  cleanupOldAnalyses(): void {
    const now = Date.now()
    let totalCleaned = 0
    
    for (const [marketId, analyses] of this.analyses.entries()) {
      const validAnalyses = analyses.filter(a => 
        now - a.timestamp < this.ANALYSIS_TTL
      )
      
      if (validAnalyses.length !== analyses.length) {
        totalCleaned += analyses.length - validAnalyses.length
        this.analyses.set(marketId, validAnalyses)
      }
      
      // Remove market entry if no analyses left
      if (validAnalyses.length === 0) {
        this.analyses.delete(marketId)
      }
    }
    
    if (totalCleaned > 0) {
      logger.info(`Cleaned up ${totalCleaned} old analyses`, undefined, 'AnalysisService')
    }
  }
  
  /**
   * Get analysis statistics
   */
  getStatistics(): {
    totalMarkets: number
    totalAnalyses: number
    averagePerMarket: number
  } {
    const totalMarkets = this.analyses.size
    const totalAnalyses = Array.from(this.analyses.values())
      .reduce((sum, analyses) => sum + analyses.length, 0)
    
    return {
      totalMarkets,
      totalAnalyses,
      averagePerMarket: totalMarkets > 0 ? totalAnalyses / totalMarkets : 0
    }
  }
}

/**
 * Singleton instance
 */
let analysisServiceInstance: AnalysisService | null = null

export function getAnalysisService(): AnalysisService {
  if (!analysisServiceInstance) {
    analysisServiceInstance = new AnalysisService()
    
    // Setup periodic cleanup (every hour)
    setInterval(() => {
      analysisServiceInstance?.cleanupOldAnalyses()
    }, 60 * 60 * 1000)
  }
  
  return analysisServiceInstance
}

