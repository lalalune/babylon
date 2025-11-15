/**
 * Babylon Agent Executor
 * 
 * Handles all Babylon operations via A2A message/send protocol
 * Parses user messages and executes appropriate Babylon operations
 */

import type {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
} from '@a2a-js/sdk/server'
import type {
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  Message,
  TextPart,
  DataPart
} from '@a2a-js/sdk'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import { cachedDb } from '@/lib/cached-database-service'
import type { JsonValue } from '@/types/common'
import type { JsonRpcRequest } from '@/types/a2a'

/**
 * Main executor implementing all Babylon game operations
 * via A2A protocol
 */
interface BabylonCommand {
  operation: string
  params: Record<string, unknown>
}


export class BabylonAgentExecutor implements AgentExecutor {
  
  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const { taskId, contextId, userMessage, task } = requestContext
    
    try {
      // Extract message text
      const textParts = userMessage.parts.filter((p): p is TextPart => p.kind === 'text')
      const messageText = textParts.map(p => p.text).join(' ')
      
      logger.info('Babylon processing A2A message', { taskId, messageText })
      
      // Create initial task if needed
      if (!task) {
        const initialTask: Task = {
          kind: 'task',
          id: taskId,
          contextId: contextId || uuidv4(),
          status: {
            state: 'submitted',
            timestamp: new Date().toISOString()
          },
          history: [userMessage]
        }
        eventBus.publish(initialTask)
      }
      
      // Update to working state
      const workingUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId: contextId || uuidv4(),
        status: {
          state: 'working',
          timestamp: new Date().toISOString()
        },
        final: false
      }
      eventBus.publish(workingUpdate)
      
      const command = this.parseCommand(userMessage)
      const result = await this.executeOperation(command, requestContext)
      
      // Create artifact with result
      const artifactUpdate: TaskArtifactUpdateEvent = {
        kind: 'artifact-update',
        taskId,
        contextId: contextId || uuidv4(),
        artifact: {
          artifactId: uuidv4(),
          name: 'result.json',
          parts: [
            {
              kind: 'data',
              data: { result: result ?? null } as { [k: string]: unknown }
            }
          ]
        }
      }
      eventBus.publish(artifactUpdate)
      
      // Mark completed
      const completedUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId: contextId || uuidv4(),
        status: {
          state: 'completed',
          timestamp: new Date().toISOString()
        },
        final: true
      }
      eventBus.publish(completedUpdate)
      eventBus.finished()
      
    } catch (error) {
      logger.error('Babylon executor error', error)
      
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId: contextId || uuidv4(),
        status: {
          state: 'failed',
          timestamp: new Date().toISOString(),
          message: {
            kind: 'message',
            messageId: uuidv4(),
            role: 'agent',
            parts: [
              {
                kind: 'text',
                text: `Error: ${(error as Error).message}`
              }
            ]
          }
        },
        final: true
      }
      eventBus.publish(errorUpdate)
      eventBus.finished()
    }
  }
  
  private async executeOperation(command: BabylonCommand, context: RequestContext): Promise<unknown> {
    switch (command.operation) {
      case 'social.create_post':
        return this.createPost(command.params, context)
      case 'social.get_feed':
        return this.getFeed(command.params)
      case 'markets.list_prediction':
        return this.listPredictionMarkets(command.params)
      case 'users.search':
        return this.searchUsers(command.params)
      case 'stats.system':
        return this.getSystemStats()
      case 'stats.leaderboard':
        return this.getLeaderboard(command.params)
      case 'moderation.create_escrow_payment':
        return this.createEscrowPayment(command.params, context)
      case 'moderation.verify_escrow_payment':
        return this.verifyEscrowPayment(command.params, context)
      case 'moderation.refund_escrow_payment':
        return this.refundEscrowPayment(command.params, context)
      case 'moderation.list_escrow_payments':
        return this.listEscrowPayments(command.params, context)
      case 'moderation.appeal_ban_with_escrow':
        return this.appealBanWithEscrow(command.params, context)
      // Basic moderation operations
      case 'moderation.block_user':
        return this.blockUser(command.params, context)
      case 'moderation.unblock_user':
        return this.unblockUser(command.params, context)
      case 'moderation.mute_user':
        return this.muteUser(command.params, context)
      case 'moderation.unmute_user':
        return this.unmuteUser(command.params, context)
      case 'moderation.report_user':
        return this.reportUser(command.params, context)
      case 'moderation.report_post':
        return this.reportPost(command.params, context)
      case 'moderation.get_blocks':
        return this.getBlocks(command.params, context)
      case 'moderation.get_mutes':
        return this.getMutes(command.params, context)
      case 'moderation.check_block_status':
        return this.checkBlockStatus(command.params, context)
      case 'moderation.check_mute_status':
        return this.checkMuteStatus(command.params, context)
      default:
        throw new Error(`Unsupported operation: ${command.operation}`)
    }
  }

  private parseCommand(message: Message): BabylonCommand {
    const dataPart = message.parts.find((part): part is DataPart => part.kind === 'data')

    if (dataPart && dataPart.data && typeof dataPart.data === 'object') {
      const { operation, params } = dataPart.data as Record<string, unknown>
      if (typeof operation !== 'string') {
        throw new Error('Data part must include an "operation" string')
      }
      return {
        operation,
        params: this.ensureRecord(params)
      }
    }

    const textPayload = message.parts
      .filter((part): part is TextPart => part.kind === 'text')
      .map(part => part.text)
      .join(' ')
      .trim()

    if (textPayload.length > 0) {
      try {
        const parsed = JSON.parse(textPayload)
        if (typeof parsed.operation === 'string') {
          return {
            operation: parsed.operation,
            params: this.ensureRecord(parsed.params)
          }
        }
      } catch {
        // fall through
      }
    }

    throw new Error(
      'Structured command required. Provide a data part with { "operation": "...", "params": {...} }'
    )
  }

  private ensureRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    return {}
  }

  private async createPost(params: Record<string, unknown>, context: RequestContext) {
    const content = typeof params.content === 'string' ? params.content.trim() : ''
    if (!content) {
      throw new Error('content is required')
    }

    const post = await prisma.post.create({
      data: {
        id: await generateSnowflakeId(),
        content,
        authorId: context.contextId || context.taskId,
        timestamp: new Date()
      }
    })
    await cachedDb.invalidatePostsCache()
    return { success: true, postId: post.id, content: post.content }
  }

  private async getFeed(params: Record<string, unknown>) {
    const limit = this.parsePositiveInt(params.limit, 20, 100)
    const posts = await cachedDb.getRecentPosts(limit, 0)
    return {
      posts: posts.map(p => ({
        id: p.id,
        content: p.content,
        authorId: p.authorId,
        timestamp: p.timestamp
      }))
    }
  }

  private async listPredictionMarkets(params: Record<string, unknown>) {
    const limit = this.parsePositiveInt(params.limit, 20, 50)
    const markets = await prisma.market.findMany({
      take: limit,
      where: { resolved: false },
      orderBy: { createdAt: 'desc' }
    })
    return {
      markets: markets.map(m => ({
        id: m.id,
        question: m.question,
        yesShares: Number(m.yesShares),
        noShares: Number(m.noShares)
      }))
    }
  }

  private async searchUsers(params: Record<string, unknown>) {
    const query = typeof params.query === 'string' ? params.query.trim() : ''
    if (!query) {
      throw new Error('query is required')
    }

    const limit = this.parsePositiveInt(params.limit, 20, 50)
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: limit,
      select: { id: true, username: true, displayName: true, reputationPoints: true }
    })
    return { users }
  }

  private async getSystemStats() {
    const [userCount, postCount, marketCount] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.market.count()
    ])
    return { users: userCount, posts: postCount, markets: marketCount }
  }

  private async getLeaderboard(params: Record<string, unknown>) {
    const limit = this.parsePositiveInt(params.limit, 10, 50)
    const users = await prisma.user.findMany({
      take: limit,
      orderBy: { reputationPoints: 'desc' },
      select: { id: true, username: true, displayName: true, reputationPoints: true }
    })
    return { leaderboard: users }
  }

  private parsePositiveInt(value: unknown, fallback: number, max: number): number {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback
    }
    return Math.min(parsed, max)
  }
  
  async cancelTask(taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    logger.info('Task cancellation', { taskId })
    
    const cancelUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId: '',
      status: {
        state: 'canceled',
        timestamp: new Date().toISOString()
      },
      final: true
    }
    eventBus.publish(cancelUpdate)
    eventBus.finished()
  }

  // Escrow operations
  private async createEscrowPayment(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const { handleCreateEscrowPayment } = await import('@/lib/a2a/handlers/escrow-handlers')
    const requestParams: Record<string, JsonValue> = {
      recipientId: String(params.recipientId ?? ''),
      amountUSD: Number(params.amountUSD ?? 0),
      recipientWalletAddress: String(params.recipientWalletAddress ?? '')
    }
    if (params.reason) {
      requestParams.reason = String(params.reason)
    }
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'a2a.createEscrowPayment',
      params: requestParams,
      id: 1
    }
    const response = await handleCreateEscrowPayment(agentId, request)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.result
  }

  private async verifyEscrowPayment(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const { handleVerifyEscrowPayment } = await import('@/lib/a2a/handlers/escrow-handlers')
    const request = {
      jsonrpc: '2.0' as const,
      method: 'a2a.verifyEscrowPayment',
      params: {
        escrowId: String(params.escrowId || ''),
        txHash: String(params.txHash || ''),
        fromAddress: String(params.fromAddress || ''),
        toAddress: String(params.toAddress || ''),
        amount: String(params.amount || ''),
      },
      id: 1,
    }
    const response = await handleVerifyEscrowPayment(agentId, request)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.result
  }

  private async refundEscrowPayment(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const { handleRefundEscrowPayment } = await import('@/lib/a2a/handlers/escrow-handlers')
    const requestParams: Record<string, JsonValue> = {
      escrowId: String(params.escrowId ?? ''),
      refundTxHash: String(params.refundTxHash ?? ''),
    }
    if (params.reason) {
      requestParams.reason = String(params.reason)
    }
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'a2a.refundEscrowPayment',
      params: requestParams,
      id: 1
    }
    const response = await handleRefundEscrowPayment(agentId, request)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.result
  }

  private async listEscrowPayments(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const { handleListEscrowPayments } = await import('@/lib/a2a/handlers/escrow-handlers')
    const requestParams: Record<string, JsonValue> = {}
    if (params.recipientId) requestParams.recipientId = String(params.recipientId)
    if (params.adminId) requestParams.adminId = String(params.adminId)
    if (params.status) requestParams.status = String(params.status)
    if (params.limit) requestParams.limit = Number(params.limit)
    if (params.offset) requestParams.offset = Number(params.offset)
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'a2a.listEscrowPayments',
      params: requestParams,
      id: 1
    }
    const response = await handleListEscrowPayments(agentId, request)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.result
  }

  private async appealBanWithEscrow(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const { handleAppealBanWithEscrow } = await import('@/lib/a2a/handlers/escrow-handlers')
    const request = {
      jsonrpc: '2.0' as const,
      method: 'a2a.appealBanWithEscrow',
      params: {
        reason: String(params.reason || ''),
        escrowPaymentTxHash: String(params.escrowPaymentTxHash || ''),
      },
      id: 1,
    }
    const response = await handleAppealBanWithEscrow(agentId, request)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.result
  }

  // Basic Moderation Operations

  private async blockUser(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const targetUserId = String(params.userId ?? '')
    const reason = params.reason ? String(params.reason) : null

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, displayName: true },
    })

    if (!targetUser) {
      throw new Error(`User ${targetUserId} not found`)
    }

    // Check if already blocked
    const existingBlock = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: agentId,
          blockedId: targetUserId,
        },
      },
    })

    if (existingBlock) {
      return { success: false, message: 'User is already blocked' }
    }

    // Create block
    const block = await prisma.userBlock.create({
      data: {
        id: await generateSnowflakeId(),
        blockerId: agentId,
        blockedId: targetUserId,
        reason,
      },
    })

    // Unfollow if following
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: agentId, followingId: targetUserId },
          { followerId: targetUserId, followingId: agentId },
        ],
      },
    })

    return { success: true, message: 'User blocked successfully', block }
  }

  private async unblockUser(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const targetUserId = String(params.userId ?? '')

    const deleted = await prisma.userBlock.deleteMany({
      where: {
        blockerId: agentId,
        blockedId: targetUserId,
      },
    })

    if (deleted.count === 0) {
      return { success: false, message: 'User is not blocked' }
    }

    return { success: true, message: 'User unblocked successfully' }
  }

  private async muteUser(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const targetUserId = String(params.userId ?? '')
    const reason = params.reason ? String(params.reason) : null

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    })

    if (!targetUser) {
      throw new Error(`User ${targetUserId} not found`)
    }

    // Check if already muted
    const existingMute = await prisma.userMute.findUnique({
      where: {
        muterId_mutedId: {
          muterId: agentId,
          mutedId: targetUserId,
        },
      },
    })

    if (existingMute) {
      return { success: false, message: 'User is already muted' }
    }

    // Create mute
    const mute = await prisma.userMute.create({
      data: {
        id: await generateSnowflakeId(),
        muterId: agentId,
        mutedId: targetUserId,
        reason,
      },
    })

    return { success: true, message: 'User muted successfully', mute }
  }

  private async unmuteUser(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const targetUserId = String(params.userId ?? '')

    const deleted = await prisma.userMute.deleteMany({
      where: {
        muterId: agentId,
        mutedId: targetUserId,
      },
    })

    if (deleted.count === 0) {
      return { success: false, message: 'User is not muted' }
    }

    return { success: true, message: 'User unmuted successfully' }
  }

  private async reportUser(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const targetUserId = String(params.userId ?? '')
    const category = String(params.category ?? 'other')
    const reason = String(params.reason ?? '')
    const evidence = params.evidence ? String(params.evidence) : null

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    })

    if (!targetUser) {
      throw new Error(`User ${targetUserId} not found`)
    }

    // Determine priority based on category
    let priority = 'normal'
    if (['hate_speech', 'violence', 'self_harm'].includes(category)) {
      priority = 'high'
    } else if (category === 'spam') {
      priority = 'low'
    }

    // Create report
    const report = await prisma.report.create({
      data: {
        id: await generateSnowflakeId(),
        reporterId: agentId,
        reportedUserId: targetUserId,
        reportType: 'user',
        category,
        reason,
        evidence,
        priority,
        status: 'pending',
      },
    })

    return { success: true, message: 'Report submitted successfully', report }
  }

  private async reportPost(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const postId = String(params.postId ?? '')
    const category = String(params.category ?? 'other')
    const reason = String(params.reason ?? '')
    const evidence = params.evidence ? String(params.evidence) : null

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    })

    if (!post) {
      throw new Error(`Post ${postId} not found`)
    }

    // Determine priority based on category
    let priority = 'normal'
    if (['hate_speech', 'violence', 'self_harm'].includes(category)) {
      priority = 'high'
    } else if (category === 'spam') {
      priority = 'low'
    }

    // Create report
    const report = await prisma.report.create({
      data: {
        id: await generateSnowflakeId(),
        reporterId: agentId,
        reportedPostId: postId,
        reportType: 'post',
        category,
        reason,
        evidence,
        priority,
        status: 'pending',
      },
    })

    return { success: true, message: 'Report submitted successfully', report }
  }

  private async getBlocks(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const limit = params.limit ? Number(params.limit) : 20
    const offset = params.offset ? Number(params.offset) : 0

    const [blocks, total] = await Promise.all([
      prisma.userBlock.findMany({
        where: { blockerId: agentId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
            },
          },
        },
      }),
      prisma.userBlock.count({
        where: { blockerId: agentId },
      }),
    ])

    return {
      blocks,
      pagination: {
        limit,
        offset,
        total,
      },
    }
  }

  private async getMutes(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const limit = params.limit ? Number(params.limit) : 20
    const offset = params.offset ? Number(params.offset) : 0

    const [mutes, total] = await Promise.all([
      prisma.userMute.findMany({
        where: { muterId: agentId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          muted: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
            },
          },
        },
      }),
      prisma.userMute.count({
        where: { muterId: agentId },
      }),
    ])

    return {
      mutes,
      pagination: {
        limit,
        offset,
        total,
      },
    }
  }

  private async checkBlockStatus(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const targetUserId = String(params.userId ?? '')

    const block = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: agentId,
          blockedId: targetUserId,
        },
      },
      select: {
        id: true,
        createdAt: true,
        reason: true,
      },
    })

    return {
      isBlocked: !!block,
      block,
    }
  }

  private async checkMuteStatus(params: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const agentId = context.contextId || context.taskId
    const targetUserId = String(params.userId ?? '')

    const mute = await prisma.userMute.findUnique({
      where: {
        muterId_mutedId: {
          muterId: agentId,
          mutedId: targetUserId,
        },
      },
      select: {
        id: true,
        createdAt: true,
        reason: true,
      },
    })

    return {
      isMuted: !!mute,
      mute,
    }
  }
}
