/**
 * Shared test helpers for integration tests
 */

import { test } from 'bun:test'

/**
 * Check if a server is available at the given URL
 * @param url - The base URL to check
 * @param timeout - Timeout in milliseconds (default: 2000)
 * @returns true if server is available, false otherwise
 */
export async function isServerAvailable(url: string, timeout = 2000): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) })
    return response.status < 500
  } catch {
    return false
  }
}

/**
 * Get base URL for API tests from environment or default
 */
export function getTestBaseUrl(): string {
  return process.env.TEST_API_URL || 'http://localhost:3000'
}

/**
 * Conditionally run a test only if condition is true, otherwise skip it
 * Use this when condition is known at test definition time.
 * 
 * @param condition - Whether to run the test
 * @returns test or test.skip
 * 
 * @example
 * const skipIfNoServer = testIf(serverAvailable)
 * skipIfNoServer('API test', async () => { ... })
 */
export function testIf(condition: boolean) {
  return condition ? test : test.skip
}

