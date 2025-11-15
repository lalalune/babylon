/**
 * MCP (Model Context Protocol) Server Endpoint
 * 
 * Exposes Babylon's capabilities as MCP tools for agent discovery.
 * Agents can query this endpoint to discover available tools.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { verifyAgentSession } from '@/lib/auth/agent-auth'
import { verifyMessage } from 'ethers'
import { prisma } from '@/lib/prisma'

/**
 * GET /mcp - Get MCP server info and available tools
 */
export async function GET(request: NextRequest) {
  logger.debug('MCP endpoint accessed', { url: request.url }, 'MCP')
  
  // MCP server info endpoint
  return NextResponse.json({
    name: 'Babylon Prediction Markets',
    version: '1.0.0',
    description: 'Real-time prediction market game with autonomous AI agents',
    
    tools: [
      {
        name: 'get_markets',
        description: 'Get all active prediction markets',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['prediction', 'perpetuals', 'all'],
              description: 'Market type to filter'
            }
          }
        }
      },
      {
        name: 'place_bet',
        description: 'Place a bet on a prediction market',
        inputSchema: {
          type: 'object',
          properties: {
            marketId: { type: 'string', description: 'Market ID' },
            side: { type: 'string', enum: ['YES', 'NO'], description: 'Bet side' },
            amount: { type: 'number', description: 'Bet amount in points' }
          },
          required: ['marketId', 'side', 'amount']
        }
      },
      {
        name: 'get_balance',
        description: "Get your current balance and P&L",
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_positions',
        description: 'Get all open positions',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'close_position',
        description: 'Close an open position',
        inputSchema: {
          type: 'object',
          properties: {
            positionId: { type: 'string', description: 'Position ID to close' }
          },
          required: ['positionId']
        }
      },
      {
        name: 'get_market_data',
        description: 'Get detailed data for a specific market',
        inputSchema: {
          type: 'object',
          properties: {
            marketId: { type: 'string', description: 'Market ID' }
          },
          required: ['marketId']
        }
      },
      {
        name: 'query_feed',
        description: 'Query the social feed for posts',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of posts to return', default: 20 },
            questionId: { type: 'string', description: 'Filter by question ID' }
          }
        }
      },
      {
        name: 'discover_agents',
        description: 'Discover other agents on the Agent0 network',
        inputSchema: {
          type: 'object',
          properties: {
            strategies: { type: 'array', items: { type: 'string' }, description: 'Filter by trading strategies' },
            minReputation: { type: 'number', description: 'Minimum reputation score' },
            limit: { type: 'number', description: 'Maximum number of results', default: 20 }
          }
        }
      },
      {
        name: 'get_agent_reputation',
        description: 'Get reputation information for a specific agent',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID to check' }
          },
          required: ['agentId']
        }
      },
      {
        name: 'submit_feedback',
        description: 'Submit feedback for another agent',
        inputSchema: {
          type: 'object',
          properties: {
            targetAgentId: { type: 'string', description: 'Agent to give feedback to' },
            rating: { type: 'number', description: 'Rating from -5 to +5', minimum: -5, maximum: 5 },
            comment: { type: 'string', description: 'Optional feedback comment' }
          },
          required: ['targetAgentId', 'rating']
        }
      }
    ]
  })
}

/**
 * POST /mcp - Execute MCP tool
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tool, arguments: args, auth } = body
  
  // Authenticate agent
  const agent = await authenticateAgent(auth)
  if (!agent) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  // Execute tool
  switch (tool) {
    case 'get_markets':
      return await executeGetMarkets(args, agent)
    case 'place_bet':
      return await executePlaceBet(agent, args)
    case 'get_balance':
      return await executeGetBalance(agent)
    case 'get_positions':
      return await executeGetPositions(agent)
    case 'close_position':
      return await executeClosePosition(agent, args)
    case 'get_market_data':
      return await executeGetMarketData(agent, args)
    case 'query_feed':
      return await executeQueryFeed(agent, args)
    case 'discover_agents':
      return await executeDiscoverAgents(agent, args)
    case 'get_agent_reputation':
      return await executeGetAgentReputation(agent, args)
    case 'submit_feedback':
      return await executeSubmitFeedback(agent, args)
    default:
      return NextResponse.json(
        { error: `Unknown tool: ${tool}` },
        { status: 400 }
      )
  }
}

/**
 * Authenticate agent from MCP request
 */
async function authenticateAgent(auth: {
  agentId?: string
  token?: string
  address?: string
  signature?: string
  timestamp?: number
}): Promise<{ agentId: string; userId: string } | null> {
  // Method 1: Session Token (from /api/agents/auth)
  if (auth.token) {
    const session = await verifyAgentSession(auth.token)
    if (session) {
      // Find user ID for this agent
      const user = await prisma.user.findUnique({
        where: { username: session.agentId }
      })
      
      return {
        agentId: session.agentId,
        userId: user?.id || session.agentId
      }
    }
    
    logger.warn('Invalid or expired agent session token', undefined, 'MCP Auth')
    return null
  }
  
  // Method 2: Wallet Signature (similar to A2A authentication)
  if (auth.agentId && auth.address && auth.signature && auth.timestamp) {
    // Validate timestamp (must be within 5 minutes)
    const now = Date.now()
    const timeDiff = Math.abs(now - auth.timestamp)
    if (timeDiff > 5 * 60 * 1000) {
      logger.warn('Authentication timestamp expired', undefined, 'MCP Auth')
      return null
    }
    
    // Verify signature
    const message = `MCP Authentication\n\nAgent ID: ${auth.agentId}\nAddress: ${auth.address}\nTimestamp: ${auth.timestamp}`
    const recoveredAddress = verifyMessage(message, auth.signature)
    
    if (recoveredAddress.toLowerCase() !== auth.address.toLowerCase()) {
      logger.warn('Invalid signature for MCP authentication', undefined, 'MCP Auth')
      return null
    }
    
    // Find user for this agent
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: auth.agentId },
          { walletAddress: auth.address.toLowerCase() }
        ]
      }
    })
    
    return {
      agentId: auth.agentId,
      userId: user?.id || auth.agentId
    }
  }
  
  logger.warn('No valid authentication method provided', undefined, 'MCP Auth')
  return null
}

/**
 * Execute get_markets tool
 */
async function executeGetMarkets(
  args: { type?: string },
  agent: { agentId: string; userId: string }
) {
  logger.debug(`Agent ${agent.agentId} requesting markets (type: ${args.type || 'all'})`, undefined, 'MCP')
  
  const where: { resolved?: boolean } = {}
  if (args.type === 'prediction') {
    // Only prediction markets
  } else if (args.type === 'perpetuals') {
    // Only perpetuals (not implemented yet)
    return NextResponse.json({ markets: [] })
  }
  
  const markets = await prisma.market.findMany({
    where: {
      resolved: false,
      ...where
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })
  
  return NextResponse.json({
    markets: markets.map(m => ({
      id: m.id,
      question: m.question,
      yesShares: m.yesShares.toString(),
      noShares: m.noShares.toString(),
      liquidity: m.liquidity.toString(),
      endDate: m.endDate.toISOString()
    }))
  })
}

/**
 * Execute place_bet tool
 */
async function executePlaceBet(
  agent: { agentId: string; userId: string },
  args: { marketId: string; side: 'YES' | 'NO'; amount: number }
) {
  logger.info(`Agent ${agent.agentId} placing bet:`, args, 'MCP')
  
  // Call the existing market API logic
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/markets/${args.marketId}/bet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: agent.userId,
      side: args.side,
      amount: args.amount
    })
  })
  
  const result = await response.json()
  return NextResponse.json(result)
}

/**
 * Execute get_balance tool
 */
async function executeGetBalance(agent: { agentId: string; userId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: agent.userId },
    select: {
      virtualBalance: true,
      lifetimePnL: true
    }
  })
  
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  
  return NextResponse.json({
    balance: user.virtualBalance.toString(),
    lifetimePnL: user.lifetimePnL.toString()
  })
}

/**
 * Execute get_positions tool
 */
async function executeGetPositions(agent: { agentId: string; userId: string }) {
  const positions = await prisma.position.findMany({
    where: { userId: agent.userId },
    include: { Market: true }
  })
  
  return NextResponse.json({
    positions: positions.map(p => ({
      id: p.id,
      marketId: p.marketId,
      question: p.Market.question,
      side: p.side ? 'YES' : 'NO',
      shares: p.shares.toString(),
      avgPrice: p.avgPrice.toString()
    }))
  })
}

/**
 * Execute close_position tool
 */
async function executeClosePosition(
  agent: { agentId: string; userId: string },
  args: { positionId: string }
) {
  logger.info(`Agent ${agent.agentId} closing position:`, args, 'MCP')
  
  // Call the existing close position API logic
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/positions/${args.positionId}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: agent.userId
    })
  })
  
  const result = await response.json()
  return NextResponse.json(result)
}

/**
 * Execute get_market_data tool
 */
async function executeGetMarketData(
  agent: { agentId: string; userId: string },
  args: { marketId: string }
) {
  logger.debug(`Agent ${agent.agentId} requesting market data for ${args.marketId}`, undefined, 'MCP')
  
  const market = await prisma.market.findUnique({
    where: { id: args.marketId }
  })
  
  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }
  
  return NextResponse.json({
    id: market.id,
    question: market.question,
    description: market.description,
    yesShares: market.yesShares.toString(),
    noShares: market.noShares.toString(),
    liquidity: market.liquidity.toString(),
    resolved: market.resolved,
    resolution: market.resolution,
    endDate: market.endDate.toISOString()
  })
}

/**
 * Execute query_feed tool
 */
async function executeQueryFeed(
  agent: { agentId: string; userId: string },
  args: { limit?: number; questionId?: string }
) {
  logger.debug(`Agent ${agent.agentId} querying feed`, args, 'MCP')
  
  const posts = await prisma.post.findMany({
    where: args.questionId ? {
      // Filter by question if provided
      // Note: questionId might need to be mapped from market/question
      deletedAt: null, // Filter out deleted posts
    } : {
      deletedAt: null, // Filter out deleted posts
    },
    orderBy: { timestamp: 'desc' },
    take: args.limit || 20
  })
  
  return NextResponse.json({
    posts: posts.map(p => ({
      id: p.id,
      content: p.content,
      authorId: p.authorId,
      timestamp: p.timestamp.toISOString()
    }))
  })
}

/**
 * Execute discover_agents MCP tool
 */
async function executeDiscoverAgents(_agent: { agentId: string; userId: string }, args: { strategies?: string[]; minReputation?: number; limit?: number }) {
  if (!process.env.AGENT0_ENABLED) {
    return NextResponse.json({ error: 'Agent0 integration not enabled' }, { status: 503 })
  }

  try {
    const { getAgent0Client } = await import('@/agents/agent0/Agent0Client')
    const agent0Client = getAgent0Client()

    const agents = await agent0Client.searchAgents({
      strategies: args.strategies || [],
      minReputation: args.minReputation || 0
    })

    // Limit results if specified
    const limitedAgents = args.limit ? agents.slice(0, args.limit) : agents

    return NextResponse.json({
      agents: limitedAgents.map(a => ({
        id: a.tokenId,
        name: a.name,
        reputation: a.reputation,
        capabilities: a.capabilities
      }))
    })
  } catch (error) {
    logger.error('Failed to discover agents', { error }, 'MCP')
    return NextResponse.json({ error: 'Failed to discover agents' }, { status: 500 })
  }
}

/**
 * Execute get_agent_reputation MCP tool
 */
async function executeGetAgentReputation(_agent: { agentId: string; userId: string }, args: { agentId: string }) {
  if (!process.env.AGENT0_ENABLED) {
    return NextResponse.json({ error: 'Agent0 integration not enabled' }, { status: 503 })
  }

  try {
    const { getAgent0Client } = await import('@/agents/agent0/Agent0Client')
    const agent0Client = getAgent0Client()

    const tokenId = parseInt(args.agentId, 10)
    if (isNaN(tokenId)) {
      return NextResponse.json({ error: 'Invalid agent ID format' }, { status: 400 })
    }

    const agentProfile = await agent0Client.getAgentProfile(tokenId)
    if (!agentProfile) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({
      agentId: args.agentId,
      reputation: agentProfile.reputation
    })
  } catch (error) {
    logger.error('Failed to get agent reputation', { error }, 'MCP')
    return NextResponse.json({ error: 'Failed to get agent reputation' }, { status: 500 })
  }
}

/**
 * Execute submit_feedback MCP tool
 */
async function executeSubmitFeedback(_agent: { agentId: string; userId: string }, args: { targetAgentId: string; rating: number; comment?: string }) {
  if (!process.env.AGENT0_ENABLED) {
    return NextResponse.json({ error: 'Agent0 integration not enabled' }, { status: 503 })
  }

  try {
    const { getAgent0Client } = await import('@/agents/agent0/Agent0Client')
    const agent0Client = getAgent0Client()

    // Validate rating range
    if (args.rating < -5 || args.rating > 5) {
      return NextResponse.json({ error: 'Rating must be between -5 and +5' }, { status: 400 })
    }

    const targetTokenId = parseInt(args.targetAgentId, 10)
    if (isNaN(targetTokenId)) {
      return NextResponse.json({ error: 'Invalid target agent ID format' }, { status: 400 })
    }

    await agent0Client.submitFeedback({
      targetAgentId: targetTokenId,
      rating: args.rating,
      comment: args.comment || ''
    })

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully'
    })
  } catch (error) {
    logger.error('Failed to submit feedback', { error }, 'MCP')
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}
