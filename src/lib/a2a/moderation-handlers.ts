/**
 * A2A Moderation Handlers
 * 
 * Handlers for moderation-related A2A protocol methods
 */

import type { JsonRpcRequest, JsonRpcResponse } from '@/types/a2a';
import { ErrorCode } from '@/types/a2a';
import { prisma } from '@/lib/database-service';
import { generateSnowflakeId } from '@/lib/snowflake';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schemas
const BlockUserParamsSchema = z.object({
  userId: z.string(),
  reason: z.string().max(500).optional(),
});

const UnblockUserParamsSchema = z.object({
  userId: z.string(),
});

const MuteUserParamsSchema = z.object({
  userId: z.string(),
  reason: z.string().max(500).optional(),
});

const UnmuteUserParamsSchema = z.object({
  userId: z.string(),
});

const ReportUserParamsSchema = z.object({
  userId: z.string(),
  category: z.enum([
    'spam',
    'harassment',
    'hate_speech',
    'violence',
    'misinformation',
    'inappropriate',
    'impersonation',
    'self_harm',
    'other',
  ]),
  reason: z.string().min(10).max(2000),
  evidence: z.string().url().optional(),
});

const ReportPostParamsSchema = z.object({
  postId: z.string(),
  category: z.enum([
    'spam',
    'harassment',
    'hate_speech',
    'violence',
    'misinformation',
    'inappropriate',
    'impersonation',
    'self_harm',
    'other',
  ]),
  reason: z.string().min(10).max(2000),
  evidence: z.string().url().optional(),
});

const GetBlocksParamsSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

const GetMutesParamsSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

const CheckBlockStatusParamsSchema = z.object({
  userId: z.string(),
});

const CheckMuteStatusParamsSchema = z.object({
  userId: z.string(),
});

/**
 * Handle block user request
 */
export async function handleBlockUser(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = BlockUserParamsSchema.parse(request.params);
    
    logger.info('A2A Block user request', { agentId, targetUserId: params.userId });

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, isActor: true },
    });

    if (!targetUser) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'User not found',
        },
        id: request.id,
      };
    }

    // Cannot block self
    if (agentId === params.userId) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'Cannot block yourself',
        },
        id: request.id,
      };
    }

    // Cannot block NPCs
    if (targetUser.isActor) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'Cannot block NPCs',
        },
        id: request.id,
      };
    }

    // Check if already blocked
    const existingBlock = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: agentId,
          blockedId: params.userId,
        },
      },
    });

    if (existingBlock) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'User is already blocked',
        },
        id: request.id,
      };
    }

    // Create block
    const block = await prisma.userBlock.create({
      data: {
        id: await generateSnowflakeId(),
        blockerId: agentId,
        blockedId: params.userId,
        reason: params.reason || null,
      },
    });

    // Unfollow if following
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: agentId, followingId: params.userId },
          { followerId: params.userId, followingId: agentId },
        ],
      },
    });

    logger.info('A2A User blocked successfully', { agentId, blockId: block.id });

    return {
      jsonrpc: '2.0',
      result: {
        success: true,
        message: 'User blocked successfully',
        block: {
          id: block.id,
          blockerId: block.blockerId,
          blockedId: block.blockedId,
          reason: block.reason,
          createdAt: block.createdAt.toISOString(),
        },
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Block user error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to block user',
      },
      id: request.id,
    };
  }
}

/**
 * Handle unblock user request
 */
export async function handleUnblockUser(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = UnblockUserParamsSchema.parse(request.params);

    const deleted = await prisma.userBlock.deleteMany({
      where: {
        blockerId: agentId,
        blockedId: params.userId,
      },
    });

    if (deleted.count === 0) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'User is not blocked',
        },
        id: request.id,
      };
    }

    return {
      jsonrpc: '2.0',
      result: {
        success: true,
        message: 'User unblocked successfully',
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Unblock user error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to unblock user',
      },
      id: request.id,
    };
  }
}

/**
 * Handle mute user request
 */
export async function handleMuteUser(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = MuteUserParamsSchema.parse(request.params);

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, isActor: true },
    });

    if (!targetUser) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'User not found',
        },
        id: request.id,
      };
    }

    // Cannot mute self
    if (agentId === params.userId) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'Cannot mute yourself',
        },
        id: request.id,
      };
    }

    // Cannot mute NPCs
    if (targetUser.isActor) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'Cannot mute NPCs',
        },
        id: request.id,
      };
    }

    // Check if already muted
    const existingMute = await prisma.userMute.findUnique({
      where: {
        muterId_mutedId: {
          muterId: agentId,
          mutedId: params.userId,
        },
      },
    });

    if (existingMute) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'User is already muted',
        },
        id: request.id,
      };
    }

    // Create mute
    const mute = await prisma.userMute.create({
      data: {
        id: await generateSnowflakeId(),
        muterId: agentId,
        mutedId: params.userId,
        reason: params.reason || null,
      },
    });

    return {
      jsonrpc: '2.0',
      result: {
        success: true,
        message: 'User muted successfully',
        mute: {
          id: mute.id,
          muterId: mute.muterId,
          mutedId: mute.mutedId,
          reason: mute.reason,
          createdAt: mute.createdAt.toISOString(),
        },
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Mute user error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to mute user',
      },
      id: request.id,
    };
  }
}

/**
 * Handle unmute user request
 */
export async function handleUnmuteUser(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = UnmuteUserParamsSchema.parse(request.params);

    const deleted = await prisma.userMute.deleteMany({
      where: {
        muterId: agentId,
        mutedId: params.userId,
      },
    });

    if (deleted.count === 0) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'User is not muted',
        },
        id: request.id,
      };
    }

    return {
      jsonrpc: '2.0',
      result: {
        success: true,
        message: 'User unmuted successfully',
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Unmute user error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to unmute user',
      },
      id: request.id,
    };
  }
}

/**
 * Handle report user request
 */
export async function handleReportUser(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = ReportUserParamsSchema.parse(request.params);

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    });

    if (!targetUser) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'User not found',
        },
        id: request.id,
      };
    }

    // Cannot report self
    if (agentId === params.userId) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'Cannot report yourself',
        },
        id: request.id,
      };
    }

    // Check for duplicate report (24 hours)
    const recentReport = await prisma.report.findFirst({
      where: {
        reporterId: agentId,
        reportedUserId: params.userId,
        category: params.category,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (recentReport) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'You have already reported this user for this reason recently',
        },
        id: request.id,
      };
    }

    // Determine priority
    let priority = 'normal';
    if (['hate_speech', 'violence', 'self_harm'].includes(params.category)) {
      priority = 'high';
    } else if (params.category === 'spam') {
      priority = 'low';
    }

    // Create report
    const report = await prisma.report.create({
      data: {
        id: await generateSnowflakeId(),
        reporterId: agentId,
        reportedUserId: params.userId,
        reportType: 'user',
        category: params.category,
        reason: params.reason,
        evidence: params.evidence || null,
        priority,
        status: 'pending',
      },
    });

    return {
      jsonrpc: '2.0',
      result: {
        success: true,
        message: 'Report submitted successfully',
        report: {
          id: report.id,
          reporterId: report.reporterId,
          reportedUserId: report.reportedUserId,
          category: report.category,
          reason: report.reason,
          status: report.status,
          priority: report.priority,
          createdAt: report.createdAt.toISOString(),
        },
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Report user error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to report user',
      },
      id: request.id,
    };
  }
}

/**
 * Handle report post request
 */
export async function handleReportPost(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = ReportPostParamsSchema.parse(request.params);

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: params.postId },
      select: { id: true, authorId: true },
    });

    if (!post) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'Post not found',
        },
        id: request.id,
      };
    }

    // Check for duplicate report (24 hours)
    const recentReport = await prisma.report.findFirst({
      where: {
        reporterId: agentId,
        reportedPostId: params.postId,
        category: params.category,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (recentReport) {
      return {
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: 'You have already reported this post for this reason recently',
        },
        id: request.id,
      };
    }

    // Determine priority
    let priority = 'normal';
    if (['hate_speech', 'violence', 'self_harm'].includes(params.category)) {
      priority = 'high';
    } else if (params.category === 'spam') {
      priority = 'low';
    }

    // Create report
    const report = await prisma.report.create({
      data: {
        id: await generateSnowflakeId(),
        reporterId: agentId,
        reportedPostId: params.postId,
        reportType: 'post',
        category: params.category,
        reason: params.reason,
        evidence: params.evidence || null,
        priority,
        status: 'pending',
      },
    });

    return {
      jsonrpc: '2.0',
      result: {
        success: true,
        message: 'Report submitted successfully',
        report: {
          id: report.id,
          reporterId: report.reporterId,
          reportedPostId: report.reportedPostId,
          category: report.category,
          reason: report.reason,
          status: report.status,
          priority: report.priority,
          createdAt: report.createdAt.toISOString(),
        },
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Report post error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to report post',
      },
      id: request.id,
    };
  }
}

/**
 * Handle get blocks request
 */
export async function handleGetBlocks(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = GetBlocksParamsSchema.parse(request.params);

    const [blocks, total] = await Promise.all([
      prisma.userBlock.findMany({
        where: { blockerId: agentId },
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
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
    ]);

    return {
      jsonrpc: '2.0',
      result: {
        blocks: blocks.map(block => ({
          id: block.id,
          blockedId: block.blockedId,
          reason: block.reason,
          createdAt: block.createdAt.toISOString(),
          blocked: block.blocked,
        })),
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total,
        },
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Get blocks error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to get blocks',
      },
      id: request.id,
    };
  }
}

/**
 * Handle get mutes request
 */
export async function handleGetMutes(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = GetMutesParamsSchema.parse(request.params);

    const [mutes, total] = await Promise.all([
      prisma.userMute.findMany({
        where: { muterId: agentId },
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
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
    ]);

    return {
      jsonrpc: '2.0',
      result: {
        mutes: mutes.map(mute => ({
          id: mute.id,
          mutedId: mute.mutedId,
          reason: mute.reason,
          createdAt: mute.createdAt.toISOString(),
          muted: mute.muted,
        })),
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total,
        },
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Get mutes error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to get mutes',
      },
      id: request.id,
    };
  }
}

/**
 * Handle check block status request
 */
export async function handleCheckBlockStatus(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = CheckBlockStatusParamsSchema.parse(request.params);

    const block = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: agentId,
          blockedId: params.userId,
        },
      },
      select: {
        id: true,
        createdAt: true,
        reason: true,
      },
    });

    return {
      jsonrpc: '2.0',
      result: {
        isBlocked: !!block,
        block: block ? {
          id: block.id,
          createdAt: block.createdAt.toISOString(),
          reason: block.reason,
        } : null,
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Check block status error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to check block status',
      },
      id: request.id,
    };
  }
}

/**
 * Handle check mute status request
 */
export async function handleCheckMuteStatus(
  agentId: string,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    const params = CheckMuteStatusParamsSchema.parse(request.params);

    const mute = await prisma.userMute.findUnique({
      where: {
        muterId_mutedId: {
          muterId: agentId,
          mutedId: params.userId,
        },
      },
      select: {
        id: true,
        createdAt: true,
        reason: true,
      },
    });

    return {
      jsonrpc: '2.0',
      result: {
        isMuted: !!mute,
        mute: mute ? {
          id: mute.id,
          createdAt: mute.createdAt.toISOString(),
          reason: mute.reason,
        } : null,
      },
      id: request.id,
    };
  } catch (error) {
    logger.error('A2A Check mute status error', { agentId, error });
    return {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to check mute status',
      },
      id: request.id,
    };
  }
}

