/**
 * Moderation Filters
 * 
 * Helper functions to filter content based on user blocks and mutes
 */

import { prisma } from '@/lib/database-service';

/**
 * Get list of user IDs that the current user has blocked
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  
  return blocks.map(b => b.blockedId);
}

/**
 * Get list of user IDs that have blocked the current user
 */
export async function getBlockedByUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockedId: userId },
    select: { blockerId: true },
  });
  
  return blocks.map(b => b.blockerId);
}

/**
 * Get list of user IDs that the current user has muted
 */
export async function getMutedUserIds(userId: string): Promise<string[]> {
  const mutes = await prisma.userMute.findMany({
    where: { muterId: userId },
    select: { mutedId: true },
  });
  
  return mutes.map(m => m.mutedId);
}

/**
 * Get all user IDs that should be filtered from the current user's feed
 * Includes: users blocked by current user + users who blocked current user
 */
export async function getFilteredUserIds(userId: string): Promise<string[]> {
  const [blockedByMe, blockedMe] = await Promise.all([
    getBlockedUserIds(userId),
    getBlockedByUserIds(userId),
  ]);
  
  // Combine and deduplicate
  return [...new Set([...blockedByMe, ...blockedMe])];
}

/**
 * Check if user A has blocked user B
 */
export async function hasBlocked(
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  const block = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    },
  });
  
  return !!block;
}

/**
 * Check if user A has muted user B
 */
export async function hasMuted(
  muterId: string,
  mutedId: string
): Promise<boolean> {
  const mute = await prisma.userMute.findUnique({
    where: {
      muterId_mutedId: {
        muterId,
        mutedId,
      },
    },
  });
  
  return !!mute;
}

/**
 * Filter posts to exclude blocked/muted users
 */
export function filterPostsByModeration<T extends { authorId?: string }>(
  posts: T[],
  blockedUserIds: string[],
  mutedUserIds: string[] = []
): T[] {
  const excludedIds = new Set([...blockedUserIds, ...mutedUserIds]);
  
  return posts.filter(post => {
    if (!post.authorId) return true;
    return !excludedIds.has(post.authorId);
  });
}

/**
 * Build Prisma where clause to exclude blocked users
 */
export function buildBlockedUsersWhereClause(blockedUserIds: string[]) {
  if (blockedUserIds.length === 0) {
    return {};
  }
  
  return {
    authorId: {
      notIn: blockedUserIds,
    },
  };
}


