/**
 * Private Cached Server-Side Data Fetchers for User-Specific Data
 *
 * These functions use 'use cache: private' for personalized content
 * that depends on cookies, headers, or user context.
 */
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';
import { getReadyPerpsEngine } from '@/lib/perps-service';
import { ParticipationService } from '@/lib/services/participation-service';
import { ReputationService } from '@/lib/services/reputation-service';
import { WalletService } from '@/lib/services/wallet-service';

import { cacheMonitoring } from './cache-monitoring';
import { cacheLife, cacheTag } from './cache-polyfill';

/**
 * Get user positions (perpetuals and predictions)
 * Uses 'use cache: private' for user-specific caching
 * Cache tag: 'positions' for granular invalidation
 * Cache life: 30 seconds - positions change frequently during trading
 */
export async function getCachedUserPositions(userId: string) {
  'use cache: private';

  const cacheKey = `positions:${userId}`;
  const startTime = Date.now();

  cacheTag('positions', `positions:${userId}`);
  // Cache life: 30 seconds - positions change frequently during trading
  cacheLife({ expire: 30 });

  try {
    // Get perpetual positions
    const perpsEngine = await getReadyPerpsEngine();
    const perpPositions = perpsEngine.getUserPositions(userId);

    // Get prediction market positions
    const predictionPositions = await prisma.position.findMany({
      where: {
        userId,
      },
      include: {
        Market: {
          select: {
            id: true,
            question: true,
            endDate: true,
            resolved: true,
            resolution: true,
            yesShares: true,
            noShares: true,
          },
        },
      },
    });

    const perpStats = {
      totalPositions: perpPositions.length,
      totalPnL: perpPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0),
      totalFunding: perpPositions.reduce((sum, p) => sum + p.fundingPaid, 0),
    };

    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordHit(cacheKey, responseTime);

    return {
      success: true,
      perpetuals: {
        positions: perpPositions.map((p: typeof perpPositions[number]) => ({
          id: p.id,
          ticker: p.ticker,
          side: p.side,
          entryPrice: p.entryPrice,
          currentPrice: p.currentPrice,
          size: p.size,
          leverage: p.leverage,
          unrealizedPnL: p.unrealizedPnL,
          unrealizedPnLPercent: p.unrealizedPnLPercent,
          liquidationPrice: p.liquidationPrice,
          fundingPaid: p.fundingPaid,
          openedAt: p.openedAt,
        })),
        stats: perpStats,
      },
      predictions: {
        positions: predictionPositions.map((p: typeof predictionPositions[number]) => ({
          id: p.id,
          marketId: p.marketId,
          question: p.Market.question,
          side: p.side ? 'YES' : 'NO',
          shares: Number(p.shares),
          avgPrice: Number(p.avgPrice),
          currentPrice: p.side
            ? Number(p.Market.yesShares) /
              (Number(p.Market.yesShares) + Number(p.Market.noShares))
            : Number(p.Market.noShares) /
              (Number(p.Market.yesShares) + Number(p.Market.noShares)),
          resolved: p.Market.resolved,
          resolution: p.Market.resolution,
        })),
        stats: {
          totalPositions: predictionPositions.length,
        },
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordMiss(cacheKey, responseTime);

    logger.error(
      'Error fetching cached user positions:',
      error,
      'getCachedUserPositions'
    );
    return {
      success: false,
      perpetuals: {
        positions: [],
        stats: { totalPositions: 0, totalPnL: 0, totalFunding: 0 },
      },
      predictions: { positions: [], stats: { totalPositions: 0 } },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get following feed posts (user-specific)
 * Uses 'use cache: private' for personalized feed caching
 * Cache tag: 'posts:following' for granular invalidation
 * Cache life: 30 seconds - following feed updates frequently
 */
export async function getCachedFollowingFeed(
  userId: string,
  limit: number = 100,
  offset: number = 0
) {
  'use cache: private';

  const cacheKey = `posts:following:${userId}:${limit}:${offset}`;
  const startTime = Date.now();

  cacheTag('posts:following', `posts:following:${userId}`);
  // Cache life: 30 seconds - following feed updates frequently
  cacheLife({ expire: 30 });

  try {
    // Get list of followed users
    const userFollows = await prisma.follow.findMany({
      where: {
        followerId: userId,
      },
      select: {
        followingId: true,
      },
    });

    // Get list of followed actors
    const actorFollows = await prisma.followStatus.findMany({
      where: {
        userId: userId,
        isActive: true,
      },
      select: {
        npcId: true,
      },
    });

    const followedUserIds = userFollows.map((f: typeof userFollows[number]) => f.followingId);
    const followedActorIds = actorFollows.map((f: typeof actorFollows[number]) => f.npcId);
    const allFollowedIds = [...followedUserIds, ...followedActorIds];

    if (allFollowedIds.length === 0) {
      return {
        success: true,
        posts: [],
        total: 0,
        limit,
        offset,
        source: 'following',
      };
    }

    // Get posts from followed users/actors
    const posts = await prisma.post.findMany({
      where: {
        authorId: { in: allFollowedIds },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        content: true,
        authorId: true,
        timestamp: true,
        createdAt: true,
      },
    });

    // Fetch user details separately since Post doesn't have author relation
    const authorIds = [...new Set(posts.map((p: typeof posts[number]) => p.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        displayName: true,
        username: true,
        profileImageUrl: true,
      },
    });
    const authorMap = new Map(authors.map((a: typeof authors[number]) => [a.id, a]));

    type AuthorType = typeof authors[number];
    const result = {
      success: true,
      posts: posts.map((post: typeof posts[number]) => {
        const author = authorMap.get(post.authorId) as AuthorType | undefined;
        return {
          id: post.id,
          content: post.content,
          author: post.authorId,
          authorId: post.authorId,
          authorDetails: author
            ? {
                displayName: author.displayName,
                username: author.username,
                profileImageUrl: author.profileImageUrl,
              }
            : null,
          timestamp: post.timestamp.toISOString(),
          createdAt: post.createdAt.toISOString(),
        };
      }),
      total: posts.length,
      limit,
      offset,
      source: 'following',
    };

    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordHit(cacheKey, responseTime);

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordMiss(cacheKey, responseTime);

    logger.error(
      'Error fetching cached following feed:',
      error,
      'getCachedFollowingFeed'
    );
    return {
      success: false,
      posts: [],
      total: 0,
      limit,
      offset,
      source: 'following',
    };
  }
}

/**
 * Get user balance (user-specific)
 * Uses 'use cache: private' for personalized balance caching
 * Cache tag: 'balance' for granular invalidation
 * Cache life: 15 seconds - balance changes after trades
 */
export async function getCachedUserBalance(userId: string) {
  'use cache: private';

  const cacheKey = `balance:${userId}`;
  const startTime = Date.now();

  cacheTag('balance', `balance:${userId}`);
  // Cache life: 15 seconds - balance changes after trades
  cacheLife({ expire: 15 });

  try {
    const balanceInfo = await WalletService.getBalance(userId);

    const result = {
      success: true,
      balance: balanceInfo.balance,
      totalDeposited: balanceInfo.totalDeposited,
      totalWithdrawn: balanceInfo.totalWithdrawn,
      lifetimePnL: balanceInfo.lifetimePnL,
    };

    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordHit(cacheKey, responseTime);

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordMiss(cacheKey, responseTime);

    logger.error(
      'Error fetching cached user balance:',
      error,
      'getCachedUserBalance'
    );
    return {
      success: false,
      balance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      lifetimePnL: 0,
    };
  }
}

/**
 * Get user profile (shared, but user-specific data)
 * Uses 'use cache: remote' for dynamic context caching
 * Cache tag: 'profile' for granular invalidation
 * Cache life: 5 minutes (300 seconds) - profiles change infrequently
 */
export async function getCachedUserProfile(userId: string) {
  'use cache: remote';

  const cacheKey = `profile:${userId}`;
  const startTime = Date.now();

  cacheTag('profile', `profile:${userId}`);
  // Cache life: 5 minutes - profiles change infrequently
  cacheLife({ expire: 300 });

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        isActor: true,
        profileComplete: true,
        hasUsername: true,
        hasBio: true,
        hasProfileImage: true,
        onChainRegistered: true,
        nftTokenId: true,
        virtualBalance: true,
        lifetimePnL: true,
        createdAt: true,
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
    });

    if (!dbUser) {
      const responseTime = Date.now() - startTime;
      cacheMonitoring.recordMiss(cacheKey, responseTime);

      return {
        success: false,
        user: null,
      };
    }

    const result = {
      success: true,
      user: {
        id: dbUser.id,
        walletAddress: dbUser.walletAddress,
        username: dbUser.username,
        displayName: dbUser.displayName,
        bio: dbUser.bio,
        profileImageUrl: dbUser.profileImageUrl,
        isActor: dbUser.isActor,
        profileComplete: dbUser.profileComplete,
        hasUsername: dbUser.hasUsername,
        hasBio: dbUser.hasBio,
        hasProfileImage: dbUser.hasProfileImage,
        onChainRegistered: dbUser.onChainRegistered,
        nftTokenId: dbUser.nftTokenId,
        virtualBalance: Number(dbUser.virtualBalance),
        lifetimePnL: Number(dbUser.lifetimePnL),
        createdAt: dbUser.createdAt.toISOString(),
        stats: {
          positions: dbUser._count.Position,
          comments: dbUser._count.Comment,
          reactions: dbUser._count.Reaction,
          followers: dbUser._count.Follow_Follow_followerIdToUser,
          following: dbUser._count.Follow_Follow_followingIdToUser,
        },
      },
    };

    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordHit(cacheKey, responseTime);

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordMiss(cacheKey, responseTime);

    logger.error(
      'Error fetching cached user profile:',
      error,
      'getCachedUserProfile'
    );
    return {
      success: false,
      user: null,
    };
  }
}

/**
 * Get user chats (user-specific)
 * Uses 'use cache: private' for personalized chat caching
 * Cache tag: 'chats:user' for granular invalidation
 * Cache life: 30 seconds - chat lists update frequently
 */
export async function getCachedUserChats(userId: string) {
  'use cache: private';

  const cacheKey = `chats:user:${userId}`;
  const startTime = Date.now();

  cacheTag('chats:user', `chats:user:${userId}`);
  // Cache life: 30 seconds - chat lists update frequently
  cacheLife({ expire: 30 });

  try {
    // Get user's group chat memberships
    const memberships = await prisma.groupChatMembership.findMany({
      where: {
        userId: userId,
        isActive: true,
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    // Get chat details for group chats
    const groupChatIds = memberships.map((m: typeof memberships[number]) => m.chatId);
    const groupChatDetails = await prisma.chat.findMany({
      where: {
        id: { in: groupChatIds },
      },
      include: {
        Message: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const chatDetailsMap = new Map(groupChatDetails.map((c: typeof groupChatDetails[number]) => [c.id, c]));

    // Get DM chats the user participates in
    const dmParticipants = await prisma.chatParticipant.findMany({
      where: {
        userId: userId,
      },
    });

    const dmChatIds = dmParticipants.map((p: typeof dmParticipants[number]) => p.chatId);
    const dmChatsDetails = await prisma.chat.findMany({
      where: {
        id: { in: dmChatIds },
        isGroup: false,
      },
      include: {
        ChatParticipant: true,
        Message: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Format group chats
    type ChatDetailsType = typeof groupChatDetails[number];
    type GroupChatType = {
      id: string;
      name: string;
      isGroup: boolean;
      lastMessage: typeof groupChatDetails[number]['Message'][number] | null;
      messageCount: number;
      qualityScore: number | null;
      lastMessageAt: Date | null;
      updatedAt: Date;
    };
    const groupChats = memberships
      .map((membership: typeof memberships[number]): GroupChatType | null => {
        const chat = chatDetailsMap.get(membership.chatId) as ChatDetailsType | undefined;
        if (!chat) return null;
        return {
          id: membership.chatId,
          name: chat.name || 'Unnamed Group',
          isGroup: true,
          lastMessage: chat.Message[0] || null,
          messageCount: membership.messageCount,
          qualityScore: membership.qualityScore,
          lastMessageAt: membership.lastMessageAt,
          updatedAt: chat.updatedAt,
        };
      })
      .filter((c: GroupChatType | null): c is GroupChatType => c !== null);

    // Format DM chats
    const directChats = dmChatsDetails.map((chat: typeof dmChatsDetails[number]) => ({
      id: chat.id,
      name: chat.name || 'Direct Message',
      isGroup: false,
      lastMessage: chat.Message[0] || null,
      participants: chat.ChatParticipant.length,
      updatedAt: chat.updatedAt,
    }));

    const result = {
      success: true,
      groupChats,
      directChats,
      total: groupChats.length + directChats.length,
    };

    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordHit(cacheKey, responseTime);

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordMiss(cacheKey, responseTime);

    logger.error(
      'Error fetching cached user chats:',
      error,
      'getCachedUserChats'
    );
    return {
      success: false,
      groupChats: [],
      directChats: [],
      total: 0,
    };
  }
}

/**
 * Get user reputation (user-specific)
 * Uses 'use cache: private' for personalized reputation caching
 * Cache tag: 'reputation' for granular invalidation
 * Cache life: 2 minutes (120 seconds) - reputation changes less frequently
 */
export async function getCachedUserReputation(userId: string) {
  'use cache: private';

  const cacheKey = `reputation:${userId}`;
  const startTime = Date.now();

  cacheTag('reputation', `reputation:${userId}`);
  // Cache life: 2 minutes - reputation changes less frequently
  cacheLife({ expire: 120 });

  try {
    // Get on-chain reputation
    const onChainReputation =
      await ReputationService.getOnChainReputation(userId);

    // Get off-chain participation stats
    const participationStats = await ParticipationService.getStats(userId);

    // Calculate enhanced reputation score
    let participationBonus = 0;
    let participationScore = 0;

    if (participationStats) {
      participationScore = participationStats.totalActivity;
      participationBonus = Math.min(20, Math.floor(participationScore / 100));
    }

    const baseReputation = onChainReputation ?? 70;
    const enhancedReputation = Math.min(
      100,
      baseReputation + participationBonus
    );

    // Get recent activity
    const recentActivity = await prisma.balanceTransaction.findMany({
      where: {
        userId,
        description: {
          contains: 'market resolution',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        description: true,
        amount: true,
        createdAt: true,
      },
    });

    // Count wins and losses
    const userPositions = await prisma.position.findMany({
      where: { userId },
      include: {
        Market: {
          select: {
            id: true,
            question: true,
            resolved: true,
            resolution: true,
          },
        },
      },
    });

    const resolvedPositions = userPositions.filter((p: typeof userPositions[number]) => p.Market.resolved);
    const wins = resolvedPositions.filter(
      (p: typeof resolvedPositions[number]) => p.Market.resolution === p.side
    ).length;
    const losses = resolvedPositions.length - wins;
    const winRate =
      resolvedPositions.length > 0
        ? (wins / resolvedPositions.length) * 100
        : 0;

    const result = {
      success: true,
      reputation: {
        onChain: onChainReputation ?? 70,
        base: baseReputation,
        enhanced: enhancedReputation,
        participationBonus,
        participationScore,
      },
      stats: {
        totalWins: wins,
        totalLosses: losses,
        winRate: Math.round(winRate * 10) / 10,
        totalBets: resolvedPositions.length,
      },
      participation: participationStats
        ? {
            postsCreated: participationStats.postsCreated,
            commentsMade: participationStats.commentsMade,
            sharesMade: participationStats.sharesMade,
            reactionsGiven: participationStats.reactionsGiven,
            marketsParticipated: participationStats.marketsParticipated,
            totalActivity: participationStats.totalActivity,
            lastActivityAt: participationStats.lastActivityAt.toISOString(),
          }
        : null,
      hasNft: onChainReputation !== null,
      recentActivity: recentActivity.map((activity: typeof recentActivity[number]) => ({
        id: activity.id,
        description: activity.description,
        amount: Number(activity.amount),
        timestamp: activity.createdAt.toISOString(),
      })),
    };

    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordHit(cacheKey, responseTime);

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    cacheMonitoring.recordMiss(cacheKey, responseTime);

    logger.error(
      'Error fetching cached user reputation:',
      error,
      'getCachedUserReputation'
    );
    return {
      success: false,
      reputation: null,
      stats: null,
      participation: null,
      hasNft: false,
      recentActivity: [],
    };
  }
}
