/**
 * Farcaster Frame API Route
 * Handles Frame actions and returns Frame responses
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    logger.info('Frame action received', { body }, 'FrameAPI')

    // Validate Frame message
    const { untrustedData, trustedData } = body

    if (!untrustedData || !trustedData) {
      return NextResponse.json(
        { error: 'Invalid frame message' },
        { status: 400 }
      )
    }

    // Get the action from the button index
    const buttonIndex = untrustedData.buttonIndex
    const fid = untrustedData.fid

    logger.info('Processing frame action', { 
      buttonIndex, 
      fid,
      castId: untrustedData.castId 
    }, 'FrameAPI')

    // Build the frame response
    const frameResponse = {
      version: 'next',
      image: 'https://babylon.market/assets/images/og-image.png',
      buttons: [
        {
          label: 'Open Babylon',
          action: 'link',
          target: `https://babylon.market?fid=${fid}&fc_frame=true`,
        },
      ],
    }

    return NextResponse.json(frameResponse)
  } catch (error) {
    logger.error('Frame action error', { error }, 'FrameAPI')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return Frame metadata for GET requests
  return new NextResponse(
    `<!DOCTYPE html>
<html>
  <head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="https://babylon.market/assets/images/og-image.png" />
    <meta property="fc:frame:button:1" content="Launch Babylon" />
    <meta property="fc:frame:button:1:action" content="link" />
    <meta property="fc:frame:button:1:target" content="https://babylon.market" />
    <meta property="og:image" content="https://babylon.market/assets/images/og-image.png" />
    <meta property="og:title" content="Babylon" />
    <meta property="og:description" content="In a world where everything is predicted, what really matters? " />
  </head>
  <body>
    <h1>Babylon Frame</h1>
    <p>This is a Farcaster Frame. Open in Warpcast to interact.</p>
  </body>
</html>`,
    {
      headers: {
        'content-type': 'text/html',
      },
    }
  )
}

