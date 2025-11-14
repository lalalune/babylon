/**
 * OAuth Credentials Status API
 * 
 * @route GET /api/auth/credentials/status
 * @access Public
 * 
 * @description
 * Checks the availability of OAuth credentials for social platform integrations.
 * Returns configuration status for Twitter and Farcaster authentication flows.
 * Used by the frontend to conditionally display social login options based on
 * server configuration.
 * 
 * **Platform Detection:**
 * - Twitter: Requires `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`
 * - Farcaster: Requires `NEYNAR_API_KEY`
 * 
 * **Use Cases:**
 * - Frontend conditional rendering of social login buttons
 * - Feature detection for social integrations
 * - Admin monitoring of OAuth configuration status
 * - Graceful degradation when credentials are not configured
 * 
 * **GET /api/auth/credentials/status - Check Credentials**
 * 
 * @returns {object} Credentials status
 * @property {boolean} twitter - Twitter OAuth 2.0 configured
 * @property {boolean} farcaster - Farcaster authentication configured
 * 
 * @example
 * ```typescript
 * const status = await fetch('/api/auth/credentials/status')
 *   .then(r => r.json());
 * 
 * if (status.twitter) {
 *   // Show Twitter login button
 * }
 * 
 * if (status.farcaster) {
 *   // Show Farcaster login button
 * }
 * ```
 * 
 * @see {@link /api/auth/twitter/initiate} Twitter OAuth initiation
 * @see {@link /api/auth/farcaster/callback} Farcaster callback
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const twitterAvailable = Boolean(
    process.env.TWITTER_CLIENT_ID && 
    process.env.TWITTER_CLIENT_SECRET
  )
  
  const farcasterAvailable = Boolean(
    process.env.NEYNAR_API_KEY
  )

  return NextResponse.json({
    twitter: twitterAvailable,
    farcaster: farcasterAvailable,
  })
}

