/**
 * Safe JSON parsing utilities with proper error handling
 * Replaces the dangerous `.catch(() => ({}))` pattern
 */

import { logger } from '@/lib/logger'

export interface ParseResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Safely parse JSON from a Response object
 * Returns typed result instead of silently swallowing errors
 */
export async function parseJsonResponse<T = unknown>(
  response: Response,
  context?: string
): Promise<ParseResult<T>> {
  try {
    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse JSON'
    logger.warn('JSON parse failed', {
      context,
      status: response.status,
      contentType: response.headers.get('content-type'),
      error: errorMessage
    })
    return { success: false, error: errorMessage }
  }
}

/**
 * Parse JSON string with proper error handling
 */
export function parseJsonString<T = unknown>(
  jsonString: string | null | undefined,
  context?: string
): ParseResult<T> {
  if (!jsonString) {
    return { success: false, error: 'Empty or null input' }
  }

  try {
    const data = JSON.parse(jsonString)
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse JSON'
    logger.warn('JSON string parse failed', {
      context,
      preview: jsonString.substring(0, 100),
      error: errorMessage
    })
    return { success: false, error: errorMessage }
  }
}

/**
 * Parse JSON with fallback value
 * Use this ONLY when a fallback is truly acceptable
 */
export function parseJsonWithFallback<T>(
  jsonString: string | null | undefined,
  fallback: T,
  context?: string
): T {
  const result = parseJsonString<T>(jsonString, context)
  if (result.success && result.data !== undefined) {
    return result.data
  }
  return fallback
}

