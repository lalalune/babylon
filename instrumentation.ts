/**
 * Next.js Instrumentation
 * 
 * Runs on server startup to register Babylon in Agent0 registry.
 * Only runs in Node.js runtime (not Edge).
 */

import { registerBabylonGame } from './src/lib/babylon-registry-init'

export async function register() {
  // Temporarily disabled to prevent blocking dev server
  // Re-enable when agent0-sdk is properly installed
  if (false && process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      // Register Babylon game (will skip if already registered or disabled)
      await registerBabylonGame()
    } catch (error) {
      // Don't fail startup if registration fails
      console.error('Failed to register Babylon game on startup:', error)
    }
  }
}

