/**
 * Prisma Client Singleton - Serverless Optimized
 * 
 * Ensures only one Prisma Client instance exists across the application.
 * Prevents connection pool exhaustion in serverless environments.
 * 
 * Features:
 * - Automatic retry with exponential backoff on connection failures
 * - Connection pooling optimized for serverless (limited connections)
 * - Automatic connection cleanup and timeout handling
 * - Detailed error logging
 * 
 * Serverless Best Practices:
 * - Limits connection pool size to prevent exhaustion
 * - Aggressive connection timeout to release stale connections
 * - Reuses single instance across invocations (via global)
 * - Graceful connection lifecycle management
 */

import { PrismaClient } from '@prisma/client';
import { createRetryProxy } from './prisma-retry';
import { createMonitoredPrismaClient } from './db/monitored-prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaWithRetry: ReturnType<typeof createRetryProxy<PrismaClient>> | undefined;
};

// Check if we're in Next.js build phase
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Serverless-optimized connection pool settings
 * 
 * These are configured via DATABASE_URL query parameters:
 * - connection_limit=5: Max connections per Prisma Client instance
 * - pool_timeout=20: Max seconds to wait for a connection from the pool
 * - connect_timeout=10: Max seconds to establish initial connection
 * 
 * Example:
 * DATABASE_URL="postgresql://...?connection_limit=5&pool_timeout=20&connect_timeout=10"
 */

/**
 * Enforce optimal connection pool parameters
 * Adds or overrides connection pool settings to ensure optimal performance
 */
function enforceConnectionPoolParams(url: string): string {
  if (!url) return url;

  const urlObj = new URL(url);
  const params = urlObj.searchParams;

  // Optimal connection pool settings for high concurrency
  // These are enforced programmatically to prevent misconfiguration
  const optimalParams = {
    connection_limit: '50',      // High enough for 2000+ CCU
    pool_timeout: '30',          // 30 seconds to wait for connection
    connect_timeout: '10',       // 10 seconds to establish connection
  };

  // Apply optimal parameters (override existing if present)
  for (const [key, value] of Object.entries(optimalParams)) {
    params.set(key, value);
  }

  // Return the optimized URL
  return urlObj.toString();
}

/**
 * Create a new Prisma Client with serverless-optimized settings
 */
function createPrismaClient() {
  // Support Vercel Prisma integration: prefer PRISMA_DATABASE_URL, fallback to DATABASE_URL
  // This allows the Vercel Prisma integration to work while maintaining compatibility
  let databaseUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl && process.env.NODE_ENV === 'production') {
    console.error('[Prisma] ERROR: Neither PRISMA_DATABASE_URL nor DATABASE_URL is set');
  }
  
  // Set DATABASE_URL if using PRISMA_DATABASE_URL (for Prisma CLI commands)
  if (process.env.PRISMA_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL;
  }

  // CRITICAL: Enforce optimal connection pool parameters
  // This ensures we can handle high concurrent load regardless of .env configuration
  if (databaseUrl) {
    databaseUrl = enforceConnectionPoolParams(databaseUrl);
    console.log('[Prisma] Enforced connection pool settings: connection_limit=50, pool_timeout=30, connect_timeout=10');
  }
  
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    
    // Serverless connection optimization
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    
    // These are internal Prisma settings that help with connection management
    // Note: Some of these are set via DATABASE_URL query params for better control
  });

  // Wrap with query monitoring in development and test environments
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_QUERY_MONITORING === 'true') {
    return createMonitoredPrismaClient(baseClient);
  }

  return baseClient;
}

/**
 * Get or create the base Prisma client
 */
function getPrismaClient(): PrismaClient | null {
  // Skip Prisma initialization during Next.js build time
  if (isBuildTime) {
    if (!globalForPrisma.prisma) {
      console.log('[Prisma] Build time detected - skipping Prisma initialization');
    }
    return null;
  }
  
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    
    // Add connection lifecycle logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Prisma] Created new Prisma Client instance');
    }
  }
  
  return globalForPrisma.prisma;
}

// Get base Prisma client (will be null during build time)
const basePrismaClient = getPrismaClient();

// Export base client for operations that need full type inference
// (e.g., when retry proxy loses type information for complex union types)
// During build time, this will be null but won't be called
export const prismaBase = basePrismaClient as PrismaClient;

// Wrap with retry logic and explicitly type as PrismaClient to preserve types through proxy
// During build time, basePrismaClient is null, so we skip retry proxy creation
export const prisma: PrismaClient = (basePrismaClient 
  ? (globalForPrisma.prismaWithRetry ?? createRetryProxy(basePrismaClient, {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      jitter: true,
    })) as PrismaClient
  : null as unknown as PrismaClient // Type cast for build time
);

if (process.env.NODE_ENV !== 'production' && basePrismaClient) {
  globalForPrisma.prismaWithRetry = prisma as ReturnType<typeof createRetryProxy<PrismaClient>>;
}

/**
 * Gracefully disconnect Prisma on process termination
 * 
 * Note: Signal handlers are NOT set up here because this file is imported by
 * instrumentation.ts which runs in Edge Runtime. Edge Runtime's static analysis
 * will flag ANY use of process.on, even in conditionals.
 * 
 * For serverless/Vercel, connection cleanup happens automatically when the
 * Lambda/function terminates, so explicit cleanup handlers are not critical.
 * 
 * If you need explicit cleanup in long-running Node.js processes, add handlers
 * in a separate Node.js-only file (not imported by instrumentation.ts).
 */

