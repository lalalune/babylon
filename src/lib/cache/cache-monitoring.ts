/**
 * Cache Monitoring
 * 
 * Tracks cache hits and misses for performance monitoring
 */

import { logger } from '@/lib/logger'

class CacheMonitoring {
  private stats: Map<string, { hits: number; misses: number; totalResponseTime: number }> = new Map()

  recordHit(cacheKey: string, responseTime: number): void {
    const current = this.stats.get(cacheKey) || { hits: 0, misses: 0, totalResponseTime: 0 }
    current.hits++
    current.totalResponseTime += responseTime
    this.stats.set(cacheKey, current)
    
    logger.debug(`Cache hit for ${cacheKey} (${responseTime}ms)`, undefined, 'CacheMonitoring')
  }

  recordMiss(cacheKey: string, responseTime: number): void {
    const current = this.stats.get(cacheKey) || { hits: 0, misses: 0, totalResponseTime: 0 }
    current.misses++
    current.totalResponseTime += responseTime
    this.stats.set(cacheKey, current)
    
    logger.debug(`Cache miss for ${cacheKey} (${responseTime}ms)`, undefined, 'CacheMonitoring')
  }

  getStats(cacheKey: string) {
    return this.stats.get(cacheKey)
  }

  getAllStats() {
    const result: Record<string, { hits: number; misses: number; hitRate: number; avgResponseTime: number }> = {}
    
    this.stats.forEach((value, key) => {
      const total = value.hits + value.misses
      result[key] = {
        hits: value.hits,
        misses: value.misses,
        hitRate: total > 0 ? value.hits / total : 0,
        avgResponseTime: total > 0 ? value.totalResponseTime / total : 0,
      }
    })
    
    return result
  }

  reset(): void {
    this.stats.clear()
  }
}

export const cacheMonitoring = new CacheMonitoring()







