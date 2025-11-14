/**
 * Farcaster Sign-In utilities for onboarding
 * Handles Warpcast popup flow and profile data fetching
 */

import { logger } from './logger'

export interface FarcasterOnboardingProfile {
  fid: number
  username: string
  displayName?: string
  pfpUrl?: string
  bio?: string
}

interface WarpcastAuthResponse {
  message: string
  signature: string
  fid: number
  username: string
  displayName?: string
  pfpUrl?: string
  bio?: string
}

/**
 * Open Warpcast Sign-In popup and handle authentication
 */
export async function openFarcasterOnboardingPopup(
  userId: string
): Promise<FarcasterOnboardingProfile> {
  return new Promise((resolve, reject) => {
    // Generate state for verification
    const state = `onboarding:${userId}:${Date.now()}:${Math.random().toString(36).substring(7)}`
    
    // Build Warpcast auth URL
    const authUrl = new URL('https://warpcast.com/~/sign-in-with-farcaster')
    authUrl.searchParams.set('redirect_url', window.location.origin)
    authUrl.searchParams.set('state', state)
    
    // Open popup
    const width = 500
    const height = 700
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2
    
    const popup = window.open(
      authUrl.toString(),
      'Farcaster Sign In',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    )

    if (!popup) {
      reject(new Error('Failed to open popup. Please allow popups for this site.'))
      return
    }

    // Listen for message from popup
    const handleMessage = async (event: MessageEvent) => {
      // Security: verify origin
      if (event.origin !== window.location.origin) {
        return
      }

      const data = event.data as WarpcastAuthResponse & { type?: string }

      if (data.type !== 'farcaster_auth') {
        return
      }

      logger.info('Received Farcaster auth message', { fid: data.fid }, 'FarcasterOnboarding')

      popup?.close()
      window.removeEventListener('message', handleMessage)

      const response = await fetch('/api/auth/onboarding/farcaster/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: data.message,
          signature: data.signature,
          fid: data.fid,
          username: data.username,
          displayName: data.displayName,
          pfpUrl: data.pfpUrl,
          bio: data.bio,
          state,
        }),
      })

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to verify Farcaster authentication')
      }

      await response.json()
      
      resolve({
        fid: data.fid,
        username: data.username,
        displayName: data.displayName,
        pfpUrl: data.pfpUrl,
        bio: data.bio,
      })
    }

    // Listen for popup close without authentication
    const checkPopupClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopupClosed)
        window.removeEventListener('message', handleMessage)
        reject(new Error('Authentication cancelled'))
      }
    }, 500)

    // Add message listener
    window.addEventListener('message', handleMessage)

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkPopupClosed)
      window.removeEventListener('message', handleMessage)
      if (popup && !popup.closed) {
        popup.close()
      }
      reject(new Error('Authentication timeout'))
    }, 5 * 60 * 1000)
  })
}

/**
 * Alternative: Use Neynar's Farcaster auth widget (simpler integration)
 */
export async function openNeynarFarcasterAuth(
  userId: string
): Promise<FarcasterOnboardingProfile> {
  // This would use Neynar's auth widget if available
  // For now, we'll use the custom Warpcast flow above
  return openFarcasterOnboardingPopup(userId)
}

/**
 * Fetch additional Farcaster profile data from Neynar API
 */
export async function fetchFarcasterProfile(fid: number): Promise<FarcasterOnboardingProfile | null> {
  const response = await fetch(`/api/farcaster/profile/${fid}`)
  
  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.profile
}

