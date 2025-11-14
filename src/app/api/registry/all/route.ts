/**
 * Enhanced Registry API Route
 *
 * Fetches ALL entities from the ERC8004 registry and database:
 * - Users (both regular users and those with on-chain registration)
 * - Actors (NPCs from the game)
 * - Agents (from Agent0 network)
 * - Apps (game platforms and services)
 */

import { SubgraphClient } from '@/agents/agent0/SubgraphClient'
import { optionalAuth } from '@/lib/api/auth-middleware'
import { asPublic } from '@/lib/db/context'
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import type { PrismaClient } from '@prisma/client'
import type { NextRequest } from 'next/server'

/**
 * GET /api/registry/all
 * Fetch all registry entities: users, actors, agents, and apps
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('type') // 'users' | 'actors' | 'agents' | 'apps' | 'all'
  const search = searchParams.get('search') || ''
  const onChainOnly = searchParams.get('onChainOnly') === 'true'

  // Optional auth - registry is public
  await optionalAuth(request).catch(() => null)

  // Initialize subgraph client for agent data
  const subgraphClient = new SubgraphClient()

  // Fetch users from database
  const fetchUsers = async () => {
    try {
      const dbOperation = async (db: PrismaClient) => {
      const where: Record<string, unknown> = {}
      if (onChainOnly) {
        where.onChainRegistered = true
      }
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { bio: { contains: search, mode: 'insensitive' } }
        ]
      }

      const users = await db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          profileImageUrl: true,
          walletAddress: true,
          isActor: true,
          onChainRegistered: true,
          nftTokenId: true,
          agent0TokenId: true,
          agent0MetadataCID: true,
          registrationTxHash: true,
          registrationTimestamp: true,
          createdAt: true,
          virtualBalance: true,
          reputationPoints: true,
          _count: {
            select: {
              Position: true,
              Comment: true,
              Reaction: true,
              Follow_Follow_followerIdToUser: true,
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      })

      return users.map(user => ({
        type: 'user',
        id: user.id,
        name: user.displayName || user.username || 'Unknown',
        username: user.username,
        bio: user.bio,
        imageUrl: user.profileImageUrl,
        walletAddress: user.walletAddress,
        isActor: user.isActor,
        onChainRegistered: user.onChainRegistered,
        nftTokenId: user.nftTokenId,
        agent0TokenId: user.agent0TokenId,
        agent0MetadataCID: user.agent0MetadataCID,
        registrationTxHash: user.registrationTxHash,
        registrationTimestamp: user.registrationTimestamp,
        createdAt: user.createdAt,
        balance: user.virtualBalance.toString(),
        reputationPoints: user.reputationPoints,
          stats: {
            positions: user._count.Position,
            comments: user._count.Comment,
            reactions: user._count.Reaction,
            followers: user._count.Follow_Follow_followingIdToUser,
            following: user._count.Follow_Follow_followerIdToUser,
          },
        }))
      }

      return await asPublic(dbOperation)
    } catch (error) {
      logger.error('Failed to fetch users from database', { error }, 'GET /api/registry/all')
      return []
    }
  }

  // Fetch actors (NPCs) from database
  const fetchActors = async () => {
    try {
      const dbOperation = async (db: PrismaClient) => {
      const where: Record<string, unknown> = {}
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { role: { contains: search, mode: 'insensitive' } }
        ]
      }

      const actors = await db.actor.findMany({
        where,
        orderBy: { reputationPoints: 'desc' },
        take: 100,
        select: {
          id: true,
          name: true,
          description: true,
          domain: true,
          personality: true,
          tier: true,
          role: true,
          profileImageUrl: true,
          tradingBalance: true,
          reputationPoints: true,
          hasPool: true,
          createdAt: true,
          _count: {
            select: {
              Pool: true,
              NPCTrade: true,
              ActorFollow_ActorFollow_followingIdToActor: true,
              ActorFollow_ActorFollow_followerIdToActor: true,
            },
          },
        },
      })

      return actors.map(actor => ({
        type: 'actor',
        id: actor.id,
        name: actor.name,
        description: actor.description,
        imageUrl: actor.profileImageUrl,
        domain: actor.domain,
        personality: actor.personality,
        tier: actor.tier,
        role: actor.role,
        balance: actor.tradingBalance.toString(),
        reputationPoints: actor.reputationPoints,
        hasPool: actor.hasPool,
        createdAt: actor.createdAt,
        stats: {
          pools: actor._count.Pool,
          trades: actor._count.NPCTrade,
          followers: actor._count.ActorFollow_ActorFollow_followingIdToActor,
          following: actor._count.ActorFollow_ActorFollow_followerIdToActor,
        },
      }))
    }

      return await asPublic(dbOperation)
    } catch (error) {
      logger.error('Failed to fetch actors from database', { error }, 'GET /api/registry/all')
      return []
    }
  }

  const fetchAgents = async () => {
    try {
      const agents = await subgraphClient.searchAgents({
        type: 'agent',
        limit: 100
      })

      return agents.map(agent => {
        let parsedCapabilities: unknown = {}
        if (agent.capabilities) {
          try {
            parsedCapabilities = JSON.parse(agent.capabilities)
          } catch {
            parsedCapabilities = {}
          }
        }

        return {
          type: 'agent',
          id: `agent0-${agent.tokenId}`,
          tokenId: agent.tokenId,
          name: agent.name,
          walletAddress: agent.walletAddress,
          metadataCID: agent.metadataCID,
          mcpEndpoint: agent.mcpEndpoint,
          a2aEndpoint: agent.a2aEndpoint,
          capabilities: parsedCapabilities,
          reputation: agent.reputation,
        }
      })
    } catch (error) {
      logger.error('Failed to fetch agents from subgraph', { error }, 'GET /api/registry/all')
      return []
    }
  }

  const fetchApps = async () => {
    try {
      const apps = await subgraphClient.getGamePlatforms({
        minTrustScore: 0
      })

      return apps.map(app => {
        let parsedCapabilities: unknown = {}
        if (app.capabilities) {
          try {
            parsedCapabilities = JSON.parse(app.capabilities)
          } catch {
            parsedCapabilities = {}
          }
        }

        return {
          type: 'app',
          id: `app-${app.tokenId}`,
          tokenId: app.tokenId,
          name: app.name,
          walletAddress: app.walletAddress,
          metadataCID: app.metadataCID,
          mcpEndpoint: app.mcpEndpoint,
          a2aEndpoint: app.a2aEndpoint,
          capabilities: parsedCapabilities,
          reputation: app.reputation || 0,
        }
      })
    } catch (error) {
      logger.error('Failed to fetch apps from subgraph', { error }, 'GET /api/registry/all')
      return []
    }
  }

  // Fetch based on entity type
  let users: Awaited<ReturnType<typeof fetchUsers>> = []
  let actors: Awaited<ReturnType<typeof fetchActors>> = []
  let agents: Awaited<ReturnType<typeof fetchAgents>> = []
  let apps: Awaited<ReturnType<typeof fetchApps>> = []

  if (!entityType || entityType === 'all' || entityType === 'users') {
    users = await fetchUsers()
  }
  if (!entityType || entityType === 'all' || entityType === 'actors') {
    actors = await fetchActors()
  }
  if (!entityType || entityType === 'all' || entityType === 'agents') {
    agents = await fetchAgents()
  }
  if (!entityType || entityType === 'all' || entityType === 'apps') {
    apps = await fetchApps()
  }

  const result = {
    users,
    actors,
    agents,
    apps,
    totals: {
      users: users.length,
      actors: actors.length,
      agents: agents.length,
      apps: apps.length,
      total: users.length + actors.length + agents.length + apps.length,
    }
  }

  logger.info('Registry fetched successfully', result.totals, 'GET /api/registry/all')

  return successResponse(result)
})


