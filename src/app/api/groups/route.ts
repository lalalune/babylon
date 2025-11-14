/**
 * User Groups API
 * 
 * @description
 * Manages user-created groups for organizing communities, trading clubs,
 * discussion groups, etc. Provides group listing, creation, and automatic
 * chat integration for each group.
 * 
 * **Features:**
 * - Create custom groups
 * - Multi-member support
 * - Admin role assignment
 * - Automatic chat creation for each group
 * - Member and admin tracking
 * - Group discovery
 * 
 * **Group Roles:**
 * - **Creator:** Original group creator (also admin)
 * - **Admin:** Can manage group settings and members
 * - **Member:** Can participate in group chat
 * 
 * **Automatic Features:**
 * - Group creator automatically becomes admin
 * - Group creator automatically becomes member
 * - Group gets dedicated chat room
 * - All members added to chat automatically
 * 
 * @openapi
 * /api/groups:
 *   get:
 *     tags:
 *       - Groups
 *     summary: List user's groups
 *     description: Returns all groups where user is a member or admin
 *     security:
 *       - PrivyAuth: []
 *     responses:
 *       200:
 *         description: User's groups
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       memberCount:
 *                         type: integer
 *                       isAdmin:
 *                         type: boolean
 *                       isCreator:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags:
 *       - Groups
 *     summary: Create new group
 *     description: Creates a new group with optional initial members and automatic chat
 *     security:
 *       - PrivyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Group name
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Initial member user IDs (optional)
 *     responses:
 *       200:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 group:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     chatId:
 *                       type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 * 
 * @example
 * ```typescript
 * // List user's groups
 * const response = await fetch('/api/groups', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { groups } = await response.json();
 * 
 * groups.forEach(group => {
 *   console.log(`${group.name}: ${group.memberCount} members`);
 *   if (group.isAdmin) console.log('  (You are admin)');
 * });
 * 
 * // Create new group
 * const newGroup = await fetch('/api/groups', {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({
 *     name: 'Trading Strategy Group',
 *     memberIds: ['user1', 'user2', 'user3']
 *   })
 * });
 * 
 * const { group } = await newGroup.json();
 * console.log(`Created group: ${group.id}, Chat: ${group.chatId}`);
 * ```
 * 
 * @see {@link /lib/db/context} RLS context
 * @see {@link /src/app/groups/page.tsx} Groups UI
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { asUser } from '@/lib/db/context'
import { z } from 'zod'
import { nanoid } from 'nanoid'

const CreateGroupSchema = z.object({
  name: z.string().min(1).max(100),
  memberIds: z.array(z.string()).optional().default([]),
})

/**
 * GET /api/groups
 * List all groups the user is a member or admin of
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request)

  const groups = await asUser(user, async (db) => {
    // Find groups where user is either a member or admin
    const userGroups = await db.userGroup.findMany({
      where: {
        OR: [
          {
            UserGroupMember: {
              some: {
                userId: user.userId,
              },
            },
          },
          {
            UserGroupAdmin: {
              some: {
                userId: user.userId,
              },
            },
          },
        ],
      },
      include: {
        UserGroupMember: {
          select: {
            userId: true,
          },
        },
        UserGroupAdmin: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            UserGroupMember: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return userGroups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      memberCount: group._count.UserGroupMember,
      isAdmin: group.UserGroupAdmin.some((admin) => admin.userId === user.userId),
      isCreator: group.createdById === user.userId,
    }))
  })

  logger.info('Groups list retrieved', { userId: user.userId, groupCount: groups.length }, 'GET /api/groups')

  return successResponse({ groups })
})

/**
 * POST /api/groups
 * Create a new group
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request)
  const body = await request.json()
  const data = CreateGroupSchema.parse(body)

  const group = await asUser(user, async (db) => {
    // Create the group
    const newGroup = await db.userGroup.create({
      data: {
        id: nanoid(),
        name: data.name,
        createdById: user.userId,
        updatedAt: new Date(),
      },
    })

    // Add creator as admin
    await db.userGroupAdmin.create({
      data: {
        id: nanoid(),
        groupId: newGroup.id,
        userId: user.userId,
        grantedBy: user.userId,
        grantedAt: new Date(),
      },
    })

    // Add creator as member
    await db.userGroupMember.create({
      data: {
        id: nanoid(),
        groupId: newGroup.id,
        userId: user.userId,
        addedBy: user.userId,
        joinedAt: new Date(),
      },
    })

    // Add initial members if provided
    if (data.memberIds.length > 0) {
      await db.userGroupMember.createMany({
        data: data.memberIds
          .filter((id) => id !== user.userId) // Don't add creator twice
          .map((userId) => ({
            id: nanoid(),
            groupId: newGroup.id,
            userId,
            addedBy: user.userId,
            joinedAt: new Date(),
          })),
      })
    }

    // Create associated chat for the group
    const chat = await db.chat.create({
      data: {
        id: nanoid(),
        name: data.name,
        isGroup: true,
        groupId: newGroup.id, // Link chat to group
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Add all members to chat
    const allMemberIds = [user.userId, ...data.memberIds.filter((id) => id !== user.userId)]
    await db.chatParticipant.createMany({
      data: allMemberIds.map((userId) => ({
        id: nanoid(),
        chatId: chat.id,
        userId,
        joinedAt: new Date(),
      })),
    })

    return {
      group: newGroup,
      chatId: chat.id,
    }
  })

  logger.info(
    'Group created',
    { userId: user.userId, groupId: group.group.id, chatId: group.chatId },
    'POST /api/groups'
  )

  return successResponse({
    group: {
      id: group.group.id,
      name: group.group.name,
      createdAt: group.group.createdAt,
      chatId: group.chatId,
    },
  })
})

