/**
 * Polyfill implementations of cacheTag and cacheLife for Next.js 15
 * 
 * These functions provide compatibility with Next.js 16+ cache APIs
 * by using AsyncLocalStorage to track tags in the execution context
 * and integrating with Next.js 15's revalidateTag system.
 */

import { AsyncLocalStorage } from 'async_hooks'
import { logger } from '../logger'

// Create an AsyncLocalStorage instance to track cache tags in the current execution context
const cacheContextStorage = new AsyncLocalStorage<{
  tags: Set<string>
  expireTime?: number
}>()

/**
 * Run a function within a cache context that tracks tags
 */
export function withCacheContext<T>(
  fn: () => T,
  initialTags: string[] = []
): T {
  const context = {
    tags: new Set<string>(initialTags),
    expireTime: undefined as number | undefined,
  }
  
  return cacheContextStorage.run(context, fn)
}

/**
 * Get the current cache context
 */
function getCacheContext(): { tags: Set<string>; expireTime?: number } | undefined {
  return cacheContextStorage.getStore()
}

/**
 * Polyfill for Next.js 16+ cacheTag function
 * Associates cache tags with the current cache context
 * 
 * In Next.js 15, we track tags in AsyncLocalStorage so they can be
 * used for revalidation via revalidateTag()
 * 
 * @param tags - One or more cache tag strings
 */
export function cacheTag(...tags: string[]): void {
  const context = getCacheContext()
  
  if (context) {
    // Add tags to the current execution context
    tags.forEach(tag => context.tags.add(tag))
  } else {
    // If no context, we're not in a cached function
    // Still track for reference/debugging
    // In production, this might indicate a misuse
    if (process.env.NODE_ENV === 'development') {
      logger.warn(
        `cacheTag called outside of cache context: ${tags.join(', ')}. Tags will not be associated with any cache entry.`,
        { tags },
        'cache-polyfill'
      )
    }
  }
  
  // Note: In Next.js 15, 'use cache' directives don't natively support tags
  // However, revalidateTag() will work to invalidate caches by tag
  // The tags tracked here are for documentation and future compatibility
}

/**
 * Polyfill for Next.js 16+ cacheLife function
 * Sets cache expiration time
 * 
 * @param options - Cache life options with expire time in seconds
 */
export function cacheLife(options: { expire: number }): void {
  const context = getCacheContext()
  
  if (context) {
    // Store expiration time in the context
    // Calculate expiration timestamp (current time + expire seconds)
    context.expireTime = Date.now() + (options.expire * 1000)
  } else {
    // If no context, we're not in a cached function
    if (process.env.NODE_ENV === 'development') {
      logger.warn(
        `cacheLife called outside of cache context with expire: ${options.expire}s. Expiration will not be applied.`,
        { expire: options.expire },
        'cache-polyfill'
      )
    }
  }
  
  // Note: In Next.js 15, 'use cache' directives don't support expiration
  // The cache is revalidated on-demand via revalidateTag/revalidatePath
  // The expiration time tracked here is for documentation and future compatibility
}

/**
 * Get tags from the current cache context
 * Useful for debugging and monitoring
 */
export function getCurrentCacheTags(): string[] {
  const context = getCacheContext()
  return context ? Array.from(context.tags) : []
}

/**
 * Get expiration time from the current cache context
 */
export function getCurrentCacheExpireTime(): number | undefined {
  const context = getCacheContext()
  return context?.expireTime
}
