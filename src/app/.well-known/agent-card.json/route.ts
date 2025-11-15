/**
 * Official A2A Agent Card Endpoint
 * Standard location: /.well-known/agent-card.json
 */

import { NextResponse } from 'next/server'
import { babylonAgentCard } from '@/lib/a2a/babylon-agent-card'

export async function GET() {
  return NextResponse.json(babylonAgentCard, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

export const dynamic = 'force-dynamic'
