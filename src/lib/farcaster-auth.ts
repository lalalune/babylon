/**
 * Farcaster Authentication Utilities
 * Handles Sign In With Farcaster (SIWF) flow
 */

export interface FarcasterAuthConfig {
  domain: string
  siweUri: string
  nonce: string
}

export interface FarcasterUser {
  fid: number
  username: string
  displayName?: string
  pfpUrl?: string
  bio?: string
  verifications: string[]
}

/**
 * Generate a Farcaster auth configuration
 */
export function generateFarcasterAuthConfig(): FarcasterAuthConfig {
  return {
    domain: process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '') || 'babylon.game',
    siweUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/farcaster/callback`,
    nonce: Math.random().toString(36).substring(7),
  }
}

/**
 * Verify Farcaster auth message and signature
 */
export async function verifyFarcasterAuth(
  message: string,
  signature: string,
  fid: number
): Promise<boolean> {
  try {
    // Use Neynar API for verification
    if (!process.env.NEYNAR_API_KEY) {
      console.warn('No Neynar API key configured')
      return false
    }

    const response = await fetch('https://api.neynar.com/v2/farcaster/verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': process.env.NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        message,
        signature,
        fid,
      }),
    })

    if (!response.ok) {
      console.error('Neynar verification failed:', await response.text())
      return false
    }

    const data = await response.json()
    return data.valid === true
  } catch (error) {
    console.error('Farcaster verification error:', error)
    return false
  }
}

/**
 * Get Farcaster user info from Neynar
 */
export async function getFarcasterUser(fid: number): Promise<FarcasterUser | null> {
  try {
    if (!process.env.NEYNAR_API_KEY) {
      console.warn('No Neynar API key configured')
      return null
    }

    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        'api_key': process.env.NEYNAR_API_KEY,
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const user = data.users?.[0]

    if (!user) {
      return null
    }

    return {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      bio: user.profile?.bio?.text,
      verifications: user.verifications || [],
    }
  } catch (error) {
    console.error('Failed to get Farcaster user:', error)
    return null
  }
}



