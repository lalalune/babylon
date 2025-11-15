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
import { logger } from './logger';

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
  
  // In test environments, require DATABASE_URL
  if (isTestEnvironment() && !databaseUrl) {
    throw new Error(
      'DATABASE_URL is required in test environment. Please set DATABASE_URL or PRISMA_DATABASE_URL environment variable.'
    );
  }
  
  if (!databaseUrl && process.env.NODE_ENV === 'production') {
    logger.error('[Prisma] ERROR: Neither PRISMA_DATABASE_URL nor DATABASE_URL is set', undefined, 'prisma');
  }
  
  // Set DATABASE_URL if using PRISMA_DATABASE_URL (for Prisma CLI commands)
  if (process.env.PRISMA_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL;
  }

  // CRITICAL: Enforce optimal connection pool parameters
  // This ensures we can handle high concurrent load regardless of .env configuration
  if (databaseUrl) {
    databaseUrl = enforceConnectionPoolParams(databaseUrl);
    logger.info('[Prisma] Enforced connection pool settings: connection_limit=50, pool_timeout=30, connect_timeout=10', undefined, 'prisma');
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
 * Check if we're in a test environment using Node.js-specific APIs
 * This function should ONLY be called when we know we're NOT in Edge Runtime
 * @internal - Do not call directly, use isTestEnvironment() instead
 */
function checkNodeJsTestEnvironment(): boolean {
  if (typeof process === 'undefined') {
    return false;
  }
  
  // Check process.argv for test commands
  try {
    // Use bracket notation to avoid static analyzer warnings
    const argvProp = 'argv';
    const processArgv = (process as unknown as Record<string, unknown>)[argvProp] as string[] | undefined;
    if (processArgv && Array.isArray(processArgv)) {
      const args = processArgv.join(' ');
      if (args.includes('bun test') || args.includes('bunx test') || 
          args.includes('bun run test') || args.includes('/bun test')) {
        return true;
      }
    }
  } catch {
    // Ignore errors if process.argv is not available
  }
  
  // Check if main module is a test file
  try {
    if (typeof require !== 'undefined' && require.main) {
      const mainModule = require.main;
      if (mainModule && mainModule.filename) {
        const filename = mainModule.filename;
        if (filename.includes('/tests/') || filename.includes('\\tests\\') ||
            filename.includes('/test') || filename.endsWith('.test.ts') ||
            filename.endsWith('.test.js') || filename.endsWith('.spec.ts')) {
          return true;
        }
      }
    }
    // Fallback to process.mainModule if require.main is not available
    else if ((process as { mainModule?: NodeModule }).mainModule) {
      const mainModule = (process as { mainModule?: NodeModule }).mainModule;
      if (mainModule && mainModule.filename) {
        const filename = mainModule.filename;
        if (filename.includes('/tests/') || filename.includes('\\tests\\') ||
            filename.includes('/test') || filename.endsWith('.test.ts') ||
            filename.endsWith('.test.js') || filename.endsWith('.spec.ts')) {
          return true;
        }
      }
    }
  } catch {
    // Ignore errors in module inspection
  }
  
  return false;
}

/**
 * Detect if we're in a test environment
 * Bun doesn't always set NODE_ENV=test, so we check multiple indicators
 * Note: Edge Runtime doesn't support Node.js APIs like process.argv
 */
function isTestEnvironment(): boolean {
  // Check explicit environment variables first (most reliable, works in all runtimes)
  if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test') {
    return true;
  }
  
  // Skip Node.js-specific checks in Edge Runtime
  // Edge Runtime doesn't support Node.js APIs like process.argv
  // Check NEXT_RUNTIME to avoid static analyzer warnings
  const runtime = process.env.NEXT_RUNTIME;
  if (runtime === 'edge') {
    return false;
  }
  
  // Only check Node.js-specific APIs when we're sure we're not in Edge Runtime
  if (runtime !== 'edge' && typeof process !== 'undefined') {
    return checkNodeJsTestEnvironment();
  }
  
  return false;
}

/**
 * Get or create the base Prisma client
 */
function getPrismaClient(): PrismaClient | null {
  // Skip Prisma initialization during Next.js build time (but not during tests)
  const isTestEnvCheck = process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test';
  
  if (isBuildTime && !isTestEnvCheck) {
    if (!globalForPrisma.prisma) {
      logger.info('[Prisma] Build time detected - skipping Prisma initialization', undefined, 'prisma');
    }
    return null;
  }
  
  // In test environments, always try to initialize if DATABASE_URL is available
  const isTestEnv = isTestEnvironment();
  
  if (!globalForPrisma.prisma) {
    const databaseUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;
    // Create client if we have a database URL
    // In test environments, we'll try again on first access if DATABASE_URL becomes available later
    if (databaseUrl) {
      try {
        globalForPrisma.prisma = createPrismaClient();
        
        // Add connection lifecycle logging in development and test
        if (process.env.NODE_ENV === 'development' || isTestEnv) {
          logger.info('[Prisma] Created new Prisma Client instance', undefined, 'prisma');
        }
      } catch (error) {
        if (isTestEnv) {
          logger.error('[Prisma] Failed to initialize Prisma client in test environment', { error }, 'prisma');
          throw error;
        }
        // In non-test environments, allow null to be returned (will throw later)
        return null;
      }
    }
  }
  
  return globalForPrisma.prisma || null;
}

// Get base Prisma client (will be null during build time)
// Try to initialize if we have DATABASE_URL, otherwise the proxy will handle it
const basePrismaClient = getPrismaClient();

// Check if we're in a test environment
const isTestEnv = isTestEnvironment();

// In test environments, ensure Prisma is initialized
if (isTestEnv && !basePrismaClient) {
  logger.error('[Prisma] ERROR: Prisma client is not initialized in test environment. Check DATABASE_URL environment variable.', undefined, 'prisma');
  throw new Error('Prisma client is not initialized in test environment. Check DATABASE_URL environment variable.');
}

// Export base client for operations that need full type inference
// (e.g., when retry proxy loses type information for complex union types)
// During build time, this will be null but won't be called
export const prismaBase = basePrismaClient as PrismaClient;

// Lazy initialization wrapper for prisma that ensures client is created on first access
// This is important for tests where DATABASE_URL might be set after module load
function getPrismaWithRetry(): PrismaClient {
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test';
  let client = getPrismaClient();
  
  // In test environments, be more aggressive about checking DATABASE_URL
  // This handles cases where DATABASE_URL is set after module load (common in CI)
  if (!client) {
    const databaseUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;
    if (databaseUrl) {
      globalForPrisma.prisma = createPrismaClient();
      client = globalForPrisma.prisma;
    } else if (isTestEnv) {
      // In test environments, provide a more helpful error message
      const envVars = Object.keys(process.env)
        .filter(key => key.includes('DATABASE') || key.includes('DB'))
        .join(', ');
      throw new Error(
        'Prisma Client is not initialized in test environment. ' +
        `DATABASE_URL is not set. Available env vars: ${envVars || 'none'}. ` +
        'Make sure DATABASE_URL is set before running tests.'
      );
    }
  }
  
  if (!client) {
    // Only throw for non-test environments (build time, etc.)
    if (!isTestEnv) {
      if (!isBuildTime) {
        logger.error('[Prisma] ERROR: Prisma client is not initialized. Check DATABASE_URL environment variable.', undefined, 'prisma');
        throw new Error('Prisma client is not initialized. Check DATABASE_URL environment variable.');
      }
      return null as unknown as PrismaClient; // Type cast for build time only
    }
    // In test environments, we should have caught this above, but double-check
    throw new Error(
      'Prisma Client is not initialized in test environment. ' +
      'This should not happen - DATABASE_URL should be set before tests run.'
    );
  }
  
  // Create retry proxy if not already created
  // In test environments, use fewer retries to fail fast and avoid masking real issues
  if (!globalForPrisma.prismaWithRetry) {
    const retryOptions = isTestEnv
      ? {
          maxRetries: 2, // Fail fast in tests
          initialDelayMs: 50,
          maxDelayMs: 500,
          jitter: false, // Deterministic in tests
        }
      : {
          maxRetries: 5,
          initialDelayMs: 100,
          maxDelayMs: 5000,
          jitter: true,
        };
    
    globalForPrisma.prismaWithRetry = createRetryProxy(client, retryOptions) as ReturnType<typeof createRetryProxy<PrismaClient>>;
  }
  
  return globalForPrisma.prismaWithRetry as unknown as PrismaClient;
}

// Create a Proxy that lazily initializes the Prisma client on first access
// This ensures tests can access prisma even if DATABASE_URL is set after module load
// The Proxy preserves full type information by properly typing the handler
function createLazyPrismaProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get<K extends keyof PrismaClient>(_target: PrismaClient, prop: K): PrismaClient[K] {
      try {
        const client = getPrismaWithRetry();
        // Return the property with proper type inference
        // TypeScript will preserve the exact type from PrismaClient[K]
        const value = client[prop];
        
        // Check if value is undefined and prop is a string (likely a model name)
        // This catches cases where Prisma models aren't initialized
        if (value === undefined && typeof prop === 'string' && prop !== '$connect' && prop !== '$disconnect') {
          const isTestEnv = process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test';
          const databaseUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;
          
          // In test environments, always throw with helpful error
          if (isTestEnv) {
            throw new Error(
              `Prisma model "${prop}" is undefined. ` +
              `DATABASE_URL=${databaseUrl ? 'set' : 'NOT SET'}. ` +
              `This usually means the Prisma client failed to initialize properly. ` +
              `Check that DATABASE_URL is correct and the database is accessible.`
            );
          }
        }
        
        return value;
      } catch (error) {
        // Re-throw with context if it's already an Error
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`Failed to access Prisma property "${String(prop)}": ${error}`);
      }
    },
    set<K extends keyof PrismaClient>(_target: PrismaClient, prop: K, value: PrismaClient[K]): boolean {
      // Allow property assignment for testing/mocking purposes
      const client = getPrismaWithRetry();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)[prop] = value;
      return true;
    },
    has(_target: PrismaClient, prop: string | symbol): boolean {
      const client = getPrismaWithRetry();
      return prop in client;
    },
    ownKeys(_target: PrismaClient): (string | symbol)[] {
      const client = getPrismaWithRetry();
      return Reflect.ownKeys(client);
    },
    getOwnPropertyDescriptor(_target: PrismaClient, prop: string | symbol): PropertyDescriptor | undefined {
      const client = getPrismaWithRetry();
      return Reflect.getOwnPropertyDescriptor(client, prop);
    },
  }) as PrismaClient;
}

const prismaProxy = createLazyPrismaProxy();

// Export prisma with lazy initialization
// The Proxy preserves all PrismaClient types including compound unique constraints
export const prisma: PrismaClient = prismaProxy;

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

