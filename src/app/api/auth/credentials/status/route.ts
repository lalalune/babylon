/**
 * Check availability of OAuth credentials
 * Returns which social platforms are configured
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

