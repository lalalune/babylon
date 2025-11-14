/**
 * API Route: /api/groups/invites
 * Methods: GET (list user's pending invites)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { asUser } from '@/lib/db/context'

/**
 * GET /api/groups/invites
 * Get all pending group invites for the current user
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request)

  const invites = await asUser(user, async (db) => {
    const pendingInvites = await db.userGroupInvite.findMany({
      where: {
        invitedUserId: user.userId,
        status: 'pending',
      },
      orderBy: {
        invitedAt: 'desc',
      },
    })
    
    // Fetch group details separately
    const groupIds = pendingInvites.map(inv => inv.groupId)
    const groups = await db.userGroup.findMany({
      where: {
        id: { in: groupIds },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            UserGroupMember: true,
          },
        },
      },
    })
    
    const groupMap = new Map(groups.map(g => [g.id, g]))

    return pendingInvites.map((invite) => {
      const group = groupMap.get(invite.groupId)
      return {
        inviteId: invite.id,
        groupId: invite.groupId,
        groupName: group?.name || 'Unknown Group',
        groupDescription: group?.description,
        memberCount: group?._count.UserGroupMember || 0,
        invitedAt: invite.invitedAt,
        invitedBy: invite.invitedBy,
      }
    })
  })

  logger.info('Group invites retrieved', { userId: user.userId, inviteCount: invites.length }, 'GET /api/groups/invites')

  return successResponse({ invites })
})

