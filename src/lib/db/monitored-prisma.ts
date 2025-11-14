/**
 * Monitored Prisma Client
 * 
 * Wraps Prisma client to automatically track query performance
 * and log slow queries without manual instrumentation.
 * 
 * NOTE: This uses Prisma middleware which is available via $extends API in Prisma 5+
 * For production use, consider implementing via Prisma's logging callbacks instead.
 */

import type { PrismaClient } from '@prisma/client';
import { queryMonitor } from './query-monitor';

/**
 * Create a Prisma client with automatic query monitoring
 * This wraps the client and intercepts queries to track performance
 */
export function createMonitoredPrismaClient(baseClient: PrismaClient): PrismaClient {
  // Note: Prisma $use middleware may not be available in all Prisma versions
  // This is a development-time monitoring tool
  // For production, use Prisma's built-in logging or APM tools
  
  // Type assertion needed because $use API types vary by Prisma version
  const client = baseClient as PrismaClient & {
    $use?: (middleware: (params: {model?: string; action: string}, next: (params: unknown) => Promise<unknown>) => Promise<unknown>) => void;
  };

  if (typeof client.$use === 'function') {
    client.$use(async (params, next) => {
      const startTime = Date.now();
      const model = params.model ?? 'unknown';
      const operation = params.action;
      
      const result = await next(params);
      const duration = Date.now() - startTime;
      
      // Record query metrics
      queryMonitor.recordQuery({
        query: `${model}.${operation}`,
        duration,
        timestamp: new Date(),
        model,
        operation,
      });
      
      return result;
    });
  }

  return baseClient;
}

