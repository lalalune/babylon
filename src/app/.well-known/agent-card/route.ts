/**
 * Agent Card Endpoint
 * Standard A2A protocol endpoint
 * GET /.well-known/agent-card.json
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Agent Card type for A2A discovery
interface AgentCard {
  id: string
  name: string
  version: string
  description: string
  endpoint: string
  capabilities: {
    streaming: boolean
    pushNotifications: boolean
    stateTransitionHistory: boolean
  }
  supportedMethods: string[]
  metadata?: Record<string, string>
}

export async function GET() {
  const agentCard: AgentCard = {
    id: 'babylon-platform',
    name: 'Babylon Platform',
    version: '1.0.0',
    description: 'Decentralized prediction markets and perpetual futures platform',
    endpoint: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false
    },
    supportedMethods: [
      // Agent Discovery
      'a2a.discover',
      'a2a.getInfo',
      // Market Operations  
      'a2a.getMarketData',
      'a2a.getMarketPrices',
      'a2a.subscribeMarket',
      // Coalition Operations
      'a2a.proposeCoalition',
      'a2a.joinCoalition',
      'a2a.coalitionMessage',
      'a2a.leaveCoalition',
      // Analysis Sharing
      'a2a.shareAnalysis',
      'a2a.requestAnalysis',
      'a2a.getAnalyses',
      // User Data
      'a2a.getBalance',
      'a2a.getPositions',
      'a2a.getUserWallet'
    ],
    metadata: {
      platform: 'babylon',
      blockchain: 'base-sepolia',
      website: 'https://babylon.game'
    }
  }

  return NextResponse.json(agentCard, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  })
}

