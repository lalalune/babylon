/**
 * Database Context
 * 
 * Provides database access with Row Level Security (RLS) context.
 * These functions set the PostgreSQL session variable `app.current_user_id`
 * which RLS policies use to filter queries automatically.
 * 
 * Usage:
 *   import { asUser, asSystem } from '@/lib/db/context'
 *   
 *   // User-scoped operation
 *   const authUser = await authenticate(request)
 *   const positions = await asUser(authUser, async (db) => {
 *     return await db.position.findMany()
 *   })
 *   
 *   // System operation (bypasses RLS)
 *   const allUsers = await asSystem(async (db) => {
 *     return await db.user.findMany()
 *   })
 */

import { prisma } from '@/lib/prisma'
import { Prisma, type PrismaClient } from '@prisma/client'
import type { AuthenticatedUser } from '@/lib/api/auth-middleware'
import { logger } from '@/lib/logger'

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/**
 * Internal: Execute a Prisma operation with RLS context
 * Sets the current user ID for the duration of the transaction
 */
async function executeWithRLS<T>(
  client: PrismaClient,
  userId: string,
  operation: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  // Validate userId format to prevent injection
  // Accept either UUID or Privy DID format (did:privy:xxxxx)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const privyDidRegex = /^did:privy:[a-z0-9]+$/i
  
  if (!uuidRegex.test(userId) && !privyDidRegex.test(userId)) {
    throw new Error(`Invalid userId format: ${userId}. Must be a valid UUID or Privy DID.`)
  }

  // Execute within a transaction to ensure session variable is scoped
  return await client.$transaction(async (tx: TransactionClient) => {
    // TEMPORARILY DISABLED: Force RLS even for table owners (Neon uses owner role for connections)
    // TODO: Re-enable once RLS policies are properly defined in migrations
    // await tx.$executeRaw(Prisma.sql`SET LOCAL row_security = on`)
    
    // Set the current user ID using PostgreSQL's set_config function which supports parameterization
    // This is more secure than string interpolation and works with Prisma v6
    await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_user_id', ${userId}, true)`)

    // Execute the operation
    return await operation(tx as PrismaClient)
  })
}

/**
 * Internal: Execute a Prisma operation as system (bypass RLS)
 * Sets the context to 'system' which system policies should recognize
 */
async function executeAsSystem<T>(
  client: PrismaClient,
  operation: (tx: PrismaClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  // Log system operation for security audit
  const startTime = Date.now()
  const stack = new Error().stack?.split('\n')[3]?.trim() // Get caller
  
  logger.warn('System operation initiated', {
    operation: operationName || 'unknown',
    caller: stack,
    timestamp: new Date().toISOString(),
  }, 'RLS Security')

  try {
    // Execute within a transaction with system context
    const result = await client.$transaction(async (tx: TransactionClient) => {
      // TEMPORARILY DISABLED: Force RLS even for table owners (but system policies will allow access)
      // TODO: Re-enable once RLS policies are properly defined in migrations
      // await tx.$executeRaw(Prisma.sql`SET LOCAL row_security = on`)
      
      // Set system context marker (policies should check for 'system')
      await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_user_id', 'system', true)`)

      // Execute the operation
      return await operation(tx as PrismaClient)
    })

    const duration = Date.now() - startTime
    logger.info('System operation completed', {
      operation: operationName || 'unknown',
      duration: `${duration}ms`,
    }, 'RLS Security')

    return result
  } catch (error) {
    logger.error('System operation failed', error, 'RLS Security')
    throw error
  }
}

/**
 * Internal: Execute a Prisma operation as public (unauthenticated)
 * Uses empty string to indicate no user context
 */
async function executeAsPublic<T>(
  client: PrismaClient,
  operation: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  // Execute within a transaction with no user context
  return await client.$transaction(async (tx: TransactionClient) => {
    // TEMPORARILY DISABLED: Force RLS even for table owners
    // TODO: Re-enable once RLS policies are properly defined in migrations
    // await tx.$executeRaw(Prisma.sql`SET LOCAL row_security = on`)
    
    // Empty string indicates public/unauthenticated access
    await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_user_id', '', true)`)

    // Execute the operation
    return await operation(tx as PrismaClient)
  })
}

/**
 * Execute a database operation as a user (with RLS)
 * 
 * Sets the PostgreSQL session variable `app.current_user_id` to the authenticated
 * user's ID, which RLS policies use to filter queries automatically.
 * 
 * SECURITY: This function requires a valid authenticated user. If authUser is null/undefined,
 * it will throw an error. Use asPublic() for unauthenticated access or asSystem() for
 * admin/system operations.
 * 
 * @param authUser - The authenticated user (from authenticate())
 * @param operation - The database operation to execute with RLS context
 * 
 * @throws {Error} If authUser is null or undefined
 * 
 * @example
 * // Authenticated route
 * const authUser = await authenticate(request)
 * const positions = await asUser(authUser, async (db) => {
 *   return await db.position.findMany() // Only returns user's positions
 * })
 */
export async function asUser<T>(
  authUser: AuthenticatedUser | null | undefined,
  operation: (db: typeof prisma) => Promise<T>
): Promise<T> {
  if (!authUser) {
    throw new Error(
      'asUser() requires an authenticated user. ' +
      'Use asPublic() for unauthenticated access or asSystem() for admin operations.'
    )
  }
  return await executeWithRLS(prisma, authUser.userId, operation)
}

/**
 * Execute a database operation as public (unauthenticated user)
 * 
 * Use this for operations that should work without authentication but still
 * respect RLS policies for public data access.
 * 
 * Common use cases:
 * - Reading public posts/profiles
 * - Browsing public markets
 * - Viewing leaderboards
 * 
 * @param operation - The database operation to execute without user context
 * 
 * @example
 * // Public route
 * const posts = await asPublic(async (db) => {
 *   return await db.post.findMany() // Returns only public posts per RLS
 * })
 */
export async function asPublic<T>(
  operation: (db: typeof prisma) => Promise<T>
): Promise<T> {
  return await executeAsPublic(prisma, operation)
}

/**
 * Execute a database operation as system (bypass RLS completely)
 * 
 * Use this for operations that need full database access:
 * - Admin operations
 * - Background jobs
 * - Cron tasks
 * - System-level operations
 * 
 * WARNING: This bypasses all RLS policies. Only use when necessary.
 * All system operations are logged for security auditing.
 * 
 * @param operation - The database operation to execute without RLS
 * @param operationName - Optional name for logging/auditing purposes
 * 
 * @example
 * // Admin route
 * const allUsers = await asSystem(async (db) => {
 *   return await db.user.findMany() // Returns ALL users
 * }, 'admin-list-all-users')
 */
export async function asSystem<T>(
  operation: (db: typeof prisma) => Promise<T>,
  operationName?: string
): Promise<T> {
  return await executeAsSystem(prisma, operation, operationName)
}

