/**
 * Query Performance Monitoring
 * 
 * Tracks database query performance and logs slow queries.
 * Helps identify optimization opportunities under load.
 */

import { logger } from '@/lib/logger';

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  model: string;
  operation: string;
}

interface SlowQueryStats {
  count: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  queries: QueryMetrics[];
}

class QueryMonitor {
  private slowQueries: Map<string, SlowQueryStats> = new Map();
  private queryLog: QueryMetrics[] = [];
  private readonly SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 100;
  private readonly MAX_LOG_SIZE = 1000;
  private readonly STATS_WINDOW_MS = 60000; // 1 minute

  /**
   * Record a database query execution
   */
  recordQuery(metrics: QueryMetrics): void {
    // Add to rolling log
    this.queryLog.push(metrics);
    if (this.queryLog.length > this.MAX_LOG_SIZE) {
      this.queryLog.shift();
    }

    // Track slow queries
    if (metrics.duration >= this.SLOW_QUERY_THRESHOLD_MS) {
      this.recordSlowQuery(metrics);
      
      // Log slow query immediately
      logger.warn('Slow query detected', {
        model: metrics.model,
        operation: metrics.operation,
        duration: `${metrics.duration}ms`,
        threshold: `${this.SLOW_QUERY_THRESHOLD_MS}ms`,
        query: this.sanitizeQuery(metrics.query),
      }, 'QueryMonitor');
    }
  }

  /**
   * Record a slow query for aggregation
   */
  private recordSlowQuery(metrics: QueryMetrics): void {
    const key = `${metrics.model}:${metrics.operation}`;
    const existing = this.slowQueries.get(key);

    if (existing) {
      existing.count++;
      existing.totalDuration += metrics.duration;
      existing.avgDuration = existing.totalDuration / existing.count;
      existing.maxDuration = Math.max(existing.maxDuration, metrics.duration);
      existing.queries.push(metrics);
      
      // Keep only last 10 examples
      if (existing.queries.length > 10) {
        existing.queries.shift();
      }
    } else {
      this.slowQueries.set(key, {
        count: 1,
        totalDuration: metrics.duration,
        avgDuration: metrics.duration,
        maxDuration: metrics.duration,
        queries: [metrics],
      });
    }
  }

  /**
   * Get slow query statistics
   */
  getSlowQueryStats(): Record<string, SlowQueryStats> {
    const stats: Record<string, SlowQueryStats> = {};
    
    for (const [key, value] of this.slowQueries.entries()) {
      stats[key] = value;
    }

    return stats;
  }

  /**
   * Get recent queries
   */
  getRecentQueries(limit: number = 100): QueryMetrics[] {
    return this.queryLog.slice(-limit);
  }

  /**
   * Get query statistics for a time window
   */
  getQueryStats(windowMs: number = this.STATS_WINDOW_MS): {
    totalQueries: number;
    slowQueries: number;
    avgDuration: number;
    p95Duration: number;
    p99Duration: number;
  } {
    const cutoff = Date.now() - windowMs;
    const recentQueries = this.queryLog.filter(
      q => q.timestamp.getTime() >= cutoff
    );

    if (recentQueries.length === 0) {
      return {
        totalQueries: 0,
        slowQueries: 0,
        avgDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
      };
    }

    const durations = recentQueries.map(q => q.duration).sort((a, b) => a - b);
    const slowCount = recentQueries.filter(
      q => q.duration >= this.SLOW_QUERY_THRESHOLD_MS
    ).length;

    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      totalQueries: recentQueries.length,
      slowQueries: slowCount,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Duration: durations[p95Index] || 0,
      p99Duration: durations[p99Index] || 0,
    };
  }

  /**
   * Clear old data
   */
  cleanup(olderThanMs: number = 300000): void {
    const cutoff = Date.now() - olderThanMs;
    
    // Clean query log
    this.queryLog = this.queryLog.filter(
      q => q.timestamp.getTime() >= cutoff
    );

    // Clean slow query examples
    for (const [key, stats] of this.slowQueries.entries()) {
      stats.queries = stats.queries.filter(
        q => q.timestamp.getTime() >= cutoff
      );
      
      if (stats.queries.length === 0) {
        this.slowQueries.delete(key);
      }
    }
  }

  /**
   * Reset all stats
   */
  reset(): void {
    this.slowQueries.clear();
    this.queryLog = [];
  }

  /**
   * Sanitize query string for logging (remove sensitive data, truncate)
   */
  private sanitizeQuery(query: string): string {
    // Truncate very long queries
    if (query.length > 500) {
      return query.substring(0, 500) + '...';
    }
    
    // Remove potential sensitive data (email, phone, passwords, etc.)
    return query
      .replace(/email\s*=\s*['"][^'"]+['"]/gi, 'email=***')
      .replace(/password\s*=\s*['"][^'"]+['"]/gi, 'password=***')
      .replace(/phone\s*=\s*['"][^'"]+['"]/gi, 'phone=***')
      .replace(/token\s*=\s*['"][^'"]+['"]/gi, 'token=***');
  }

  /**
   * Log summary statistics
   */
  logSummary(): void {
    const stats = this.getQueryStats();
    const slowQueryStats = this.getSlowQueryStats();
    const slowQueryCount = Object.keys(slowQueryStats).length;

    logger.info('Query performance summary', {
      totalQueries: stats.totalQueries,
      slowQueries: stats.slowQueries,
      slowQueryPercentage: stats.totalQueries > 0 
        ? `${((stats.slowQueries / stats.totalQueries) * 100).toFixed(2)}%`
        : '0%',
      avgDuration: `${stats.avgDuration.toFixed(2)}ms`,
      p95Duration: `${stats.p95Duration.toFixed(2)}ms`,
      p99Duration: `${stats.p99Duration.toFixed(2)}ms`,
      uniqueSlowQueries: slowQueryCount,
    }, 'QueryMonitor');

    // Log top 5 slowest query types
    if (slowQueryCount > 0) {
      const sortedSlowQueries = Object.entries(slowQueryStats)
        .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
        .slice(0, 5);

      logger.info('Top 5 slowest query types', {
        queries: sortedSlowQueries.map(([key, value]) => ({
          query: key,
          count: value.count,
          avgDuration: `${value.avgDuration.toFixed(2)}ms`,
          maxDuration: `${value.maxDuration.toFixed(2)}ms`,
        })),
      }, 'QueryMonitor');
    }
  }
}

// Singleton instance
export const queryMonitor = new QueryMonitor();

// Periodic cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    queryMonitor.cleanup();
  }, 300000);
}

// Log summary every minute in development
if (process.env.NODE_ENV === 'development' && typeof setInterval !== 'undefined') {
  setInterval(() => {
    queryMonitor.logSummary();
  }, 60000);
}

