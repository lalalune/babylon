/**
 * Participation Service
 *
 * Tracks off-chain user participation metrics:
 * - Posts created
 * - Comments made
 * - Shares made
 * - Reactions given
 * - Markets participated
 * - Total activity score
 * - Last activity timestamp
 */

import { prisma } from '@/lib/database-service'


export interface ParticipationStats {
  postsCreated: number
  commentsMade: number
  sharesMade: number
  reactionsGiven: number
  marketsParticipated: number
  totalActivity: number
  lastActivityAt: Date
}

export class ParticipationService {
  /**
   * Get participation statistics for a user
   */
  static async getStats(userId: string): Promise<ParticipationStats | null> {
    // Get all counts in parallel
    const [
      postsCreated,
      commentsMade,
      sharesMade,
      reactionsGiven,
      marketsParticipated,
      lastPost,
      lastComment,
      lastShare,
      lastReaction,
      lastPosition,
    ] = await Promise.all([
      prisma.post.count({
        where: {
          authorId: userId,
        },
      }),
      prisma.comment.count({
        where: {
          authorId: userId,
        },
      }),
      prisma.share.count({
        where: {
          userId,
        },
      }),
      prisma.reaction.count({
        where: {
          userId,
        },
      }),
      prisma.position.count({
        where: {
          userId,
        },
      }),
      prisma.post.findFirst({
        where: {
          authorId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.comment.findFirst({
        where: {
          authorId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.share.findFirst({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.reaction.findFirst({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.position.findFirst({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
    ])

    // Calculate total activity score
    // Weighted scoring: posts=10, comments=5, shares=3, reactions=1, markets=5
    const totalActivity =
      postsCreated * 10 +
      commentsMade * 5 +
      sharesMade * 3 +
      reactionsGiven * 1 +
      marketsParticipated * 5

    // Find the most recent activity timestamp
    const activityTimestamps = [
      lastPost?.createdAt,
      lastComment?.createdAt,
      lastShare?.createdAt,
      lastReaction?.createdAt,
      lastPosition?.createdAt,
    ].filter((date): date is Date => date !== null && date !== undefined)

    const lastActivityAt =
      activityTimestamps.length > 0
        ? new Date(Math.max(...activityTimestamps.map((d) => d.getTime())))
        : new Date() // Default to now if no activity

    return {
      postsCreated,
      commentsMade,
      sharesMade,
      reactionsGiven,
      marketsParticipated,
      totalActivity,
      lastActivityAt,
    }
  }
}

