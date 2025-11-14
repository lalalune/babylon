/**
 * PostHog Server Client
 * Server-side analytics and event tracking for API routes
 */

import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export const getPostHogServerClient = (): PostHog | null => {
  // Only initialize on server
  if (typeof window !== 'undefined') return null

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!apiKey) {
    console.warn('PostHog Server: API key not found. Server-side analytics will be disabled.')
    return null
  }

  // Singleton pattern
  if (!posthogClient) {
    posthogClient = new PostHog(apiKey, {
      host: apiHost,
      flushAt: 20, // Flush after 20 events
      flushInterval: 10000, // Flush every 10 seconds
      
      // Important: Always shutdown gracefully to ensure events are sent
      // Use in API routes: await posthog.shutdown() before returning
    })
  }

  return posthogClient
}

/**
 * Track server-side event
 */
export const trackServerEvent = async (
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) => {
  const client = getPostHogServerClient()
  if (!client) return

  client.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Identify user on server
 */
export const identifyServerUser = async (
  distinctId: string,
  properties: Record<string, unknown>
) => {
  const client = getPostHogServerClient()
  if (!client) return

  client.identify({
    distinctId,
    properties,
  })
}

/**
 * Track API error
 */
export const trackServerError = async (
  distinctId: string | null,
  error: Error,
  context: {
    endpoint: string
    method: string
    statusCode?: number
    [key: string]: unknown
  }
) => {
  const client = getPostHogServerClient()
  if (!client) return

  const { endpoint, method, statusCode, ...otherContext } = context
  
  client.capture({
    distinctId: distinctId || 'anonymous',
    event: '$exception',
    properties: {
      $exception_type: error.name || 'Error',
      $exception_message: error.message,
      $exception_stack: error.stack,
      endpoint,
      method,
      statusCode,
      ...otherContext,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Flush all pending events (important for serverless functions)
 */
export const flushPostHog = async () => {
  const client = getPostHogServerClient()
  if (!client) return

  await client.flush()
}

/**
 * Shutdown PostHog client gracefully
 */
export const shutdownPostHog = async () => {
  if (posthogClient) {
    await posthogClient.shutdown()
    posthogClient = null
  }
}

