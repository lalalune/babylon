/**
 * Batch Operations Utility
 * 
 * Provides utilities for batching async operations with concurrency control
 * to prevent connection pool exhaustion.
 */

/**
 * Execute async operations in batches with controlled concurrency
 * 
 * @param items - Array of items to process
 * @param batchSize - Number of items to process concurrently (default: 10)
 * @param operation - Async function to execute for each item
 * @returns Promise that resolves when all operations complete
 * 
 * @example
 * ```ts
 * await batchExecute(
 *   organizations,
 *   10, // Process 10 at a time
 *   async (org) => await db.upsertOrganization(org)
 * );
 * ```
 */
export async function batchExecute<T>(
  items: T[],
  batchSize: number,
  operation: (item: T) => Promise<void>
): Promise<void> {
  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(item => operation(item))
    );
  }
}

/**
 * Execute async operations in batches with controlled concurrency and return results
 * 
 * @param items - Array of items to process
 * @param batchSize - Number of items to process concurrently (default: 10)
 * @param operation - Async function to execute for each item
 * @returns Promise that resolves with array of PromiseSettledResult
 * 
 * @example
 * ```ts
 * const results = await batchExecuteWithResults(
 *   users,
 *   10,
 *   async (user) => await processUser(user)
 * );
 * ```
 */
export async function batchExecuteWithResults<T, R>(
  items: T[],
  batchSize: number,
  operation: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const allResults: PromiseSettledResult<R>[] = [];
  
  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => operation(item))
    );
    allResults.push(...batchResults);
  }
  
  return allResults;
}

