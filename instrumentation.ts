/**
 * Next.js Instrumentation
 * 
 * Runs on server startup to register Babylon in Agent0 registry and initialize Sentry.
 * For Next.js 16.0.1, this file handles server-side Sentry initialization.
 * 
 * Note: Client-side Sentry is initialized via instrumentation-client.ts
 */

import * as Sentry from '@sentry/nextjs'

const sentryDisabled =
  process.env.DISABLE_SENTRY === 'true' ||
  process.env.NEXT_PUBLIC_DISABLE_SENTRY === 'true'

export async function register() {
  // Skip instrumentation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return
  }
  
  if (sentryDisabled && process.env.NODE_ENV === 'development') {
    console.info('[Sentry] Disabled via DISABLE_SENTRY flag')
  }
  
  // Initialize Sentry for server-side (Node.js runtime)
  if (!sentryDisabled && process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  
  // Register Babylon on Agent0 registry (ERC-8004) on startup
  // Only if Agent0 is enabled and we're in Node.js runtime
  if (
    process.env.AGENT0_ENABLED === 'true' &&
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NODE_ENV === 'production'  // Only in production to avoid blocking dev
  ) {
    const { registerBabylonGame } = await import('./src/lib/babylon-registry-init')
    await registerBabylonGame().catch((error: Error) => {
      // Don't fail startup if registration fails - log and continue
      console.error('Failed to register Babylon game on Agent0 registry:', error)
      // Capture error in Sentry if available
      if (!sentryDisabled && (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)) {
        Sentry.captureException(error)
      }
    })
  }
}

// Export request error handler for Next.js App Router
export const onRequestError = Sentry.captureRequestError
