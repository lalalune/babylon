/**
 * Chat Management API
 * 
 * @route GET /api/chats - List user's chats
 * @route POST /api/chats - Create new chat
 * @access Authenticated
 * 
 * @description
 * Manages both group chats and direct messages (DMs). Provides chat listings
 * with participant information, message counts, and last message previews.
 * Supports both user-specific chats and all game chats retrieval.
 * 
 * **GET - List User's Chats**
 * 
 * Returns all chats the authenticated user participates in, separated into:
 * - **Group Chats:** Multi-participant group conversations
 * - **Direct Messages:** One-on-one chats with other real users
 * 
 * **Features:**
 * - Quality scoring for group chats
 * - Last message preview
 * - Message count tracking
 * - Participant metadata
 * - DM participant profile details
 * - Filters out NPC/actor DMs (only real user DMs shown)
 * 
 * @query {boolean} all - Get all game chats (public, no auth required)
 * @query {boolean} debug - Enable debug logging
 * 
 * **All Game Chats Mode (all=true):**
 * Returns all group chats for the game without authentication.
 * Used for public game chat discovery.
 * 
 * @returns {object} Chat listings
 * @property {array} groupChats - User's group chat memberships
 * @property {array} directChats - User's direct message chats
 * @property {number} total - Total chat count
 * 
 * **POST - Create New Chat**
 * 
 * Creates a new chat (group or DM) and adds participants.
 * Creator is automatically added as the first participant.
 * 
 * @param {string} name - Chat name (optional for DMs)
 * @param {boolean} isGroup - Whether chat is a group chat (default: false)
 * @param {array} participantIds - Array of user IDs to add (optional)
 * 
 * @returns {object} Created chat
 * @property {object} chat - Created chat object
 * 
 * @throws {400} Invalid input parameters
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get user's chats
 * const chats = await fetch('/api/chats', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { groupChats, directChats } = await chats.json();
 * 
 * // Get all game chats (public)
 * const gameChats = await fetch('/api/chats?all=true');
 * const { chats } = await gameChats.json();
 * 
 * // Create group chat
 * const newGroup = await fetch('/api/chats', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     name: 'Strategy Discussion',
 *     isGroup: true,
 *     participantIds: ['user1', 'user2', 'user3']
 *   })
 * });
 * 
 * // Create DM
 * const newDM = await fetch('/api/chats', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     isGroup: false,
 *     participantIds: ['otherUserId']
 *   })
 * });
 * ```
 * 
 * @see {@link /lib/db/context} Database context with RLS
 * @see {@link /lib/validation/schemas} Request validation schemas
 * @see {@link /src/app/chats/page.tsx} Chat list UI
 */

import { authenticate } from '@/lib/api/auth-middleware';
import { asSystem, asUser } from '@/lib/db/context';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { ChatCreateSchema, ChatQuerySchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';

/**
 * GET /api/chats
 * Get all chats for the authenticated user
 * Query params: ?all=true - Get all game chats (not just user's chats)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  console.log('[API /api/chats] GET request received');
  logger.info('GET /api/chats - Request received', undefined, 'GET /api/chats');
  
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const query: Record<string, string> = {};
  
  const all = searchParams.get('all');
  const debug = searchParams.get('debug');
  
  if (all) query.all = all;
  if (debug) query.debug = debug;
  
  console.log('[API /api/chats] Query params:', { all, debug });
  
  const validatedQuery = Object.keys(query).length > 0 
    ? ChatQuerySchema.parse(query) 
    : { all: undefined, debug: undefined };

  // Check if requesting all game chats
  const getAllChats = validatedQuery.all === 'true';
  
  console.log('[API /api/chats] getAllChats:', getAllChats);

  if (getAllChats) {
    // Return all game chats (no auth required for read-only game data)
    const gameChats = await asSystem(async (db) => {
      return await db.chat.findMany({
        where: {
          isGroup: true,
          gameId: 'continuous',
        },
        include: {
          Message: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              Message: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });

    logger.info('All game chats fetched', { count: gameChats.length }, 'GET /api/chats');

    return successResponse({
      chats: gameChats.map(chat => ({
        id: chat.id,
        name: chat.name,
        isGroup: chat.isGroup,
        messageCount: chat._count.Message,
        lastMessage: chat.Message[0] || null,
      })),
    });
  }

  const user = await authenticate(request);

  logger.info('Fetching chats for user', { 
    userId: user.userId,
    privyId: user.privyId,
    dbUserId: user.dbUserId,
    fullUser: user
  }, 'GET /api/chats');

  // Get user's chats - TEMPORARILY BYPASS RLS FOR DEBUGGING
  const { groupChats, directChats } = await asSystem(async (db) => {
    // Get user's group chat memberships
    const memberships = await db.groupChatMembership.findMany({
      where: {
        userId: user.userId,
        isActive: true,
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    // Get chat details for group chats
    const groupChatIds = memberships.map((m) => m.chatId);
    const groupChatDetails = await db.chat.findMany({
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

    const chatDetailsMap = new Map(groupChatDetails.map((c) => [c.id, c]));

    // Get DM chats the user participates in
    const dmParticipants = await db.chatParticipant.findMany({
      where: {
        userId: user.userId,
      },
    });

    logger.info('Found DM participants (using asSystem bypass)', { 
      userId: user.userId, 
      count: dmParticipants.length,
      participants: dmParticipants 
    }, 'GET /api/chats');

    const dmChatIds = dmParticipants.map((p) => p.chatId);
    const dmChatsDetails = await db.chat.findMany({
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
    const groupChats = memberships
      .map((membership) => {
        const chat = chatDetailsMap.get(membership.chatId);
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
      .filter((c) => c !== null);

    // Format DM chats - get the other participant's name and details
    const directChats = await Promise.all(
      dmChatsDetails.map(async (chat) => {
        // Find the other participant (not the current user)
        const otherParticipant = chat.ChatParticipant.find((p) => p.userId !== user.userId);
        let chatName = chat.name || 'Direct Message';
        let otherUserDetails = null;
        
        if (otherParticipant) {
          // Try to get user details (real users only, not actors)
          const otherUser = await db.user.findUnique({
            where: { id: otherParticipant.userId },
            select: { 
              id: true,
              displayName: true, 
              username: true,
              profileImageUrl: true,
              isActor: true,
            },
          });
          
          if (otherUser && !otherUser.isActor) {
            chatName = otherUser.displayName || otherUser.username || 'Unknown';
            otherUserDetails = {
              id: otherUser.id,
              displayName: otherUser.displayName,
              username: otherUser.username,
              profileImageUrl: otherUser.profileImageUrl,
            };
          }
        }
        
        // Only return DMs with real users (not NPCs)
        if (!otherUserDetails) {
          return null;
        }
        
        return {
          id: chat.id,
          name: chatName,
          isGroup: false,
          lastMessage: chat.Message[0] || null,
          participants: chat.ChatParticipant.length,
          updatedAt: chat.updatedAt,
          otherUser: otherUserDetails,
        };
      })
    ).then(chats => chats.filter(c => c !== null));

    return { groupChats, directChats };
  });

  logger.info('User chats fetched successfully', { userId: user.userId, groupChats: groupChats.length, directChats: directChats.length }, 'GET /api/chats');

  return successResponse({
    groupChats,
    directChats,
    total: groupChats.length + directChats.length,
  });
});

/**
 * POST /api/chats
 * Create a new chat
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  // Validate request body
  const body = await request.json();
  const { name, isGroup, participantIds } = ChatCreateSchema.parse(body);

  // Create the chat with RLS
  const chat = await asUser(user, async (db) => {
    // Create the chat
    const now = new Date();
    const newChat = await db.chat.create({
      data: {
        id: await generateSnowflakeId(),
        name: name || null,
        isGroup: isGroup || false,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Add creator as participant
    await db.chatParticipant.create({
      data: {
        id: await generateSnowflakeId(),
        chatId: newChat.id,
        userId: user.userId,
      },
    });

    // Add other participants if provided
    if (participantIds && Array.isArray(participantIds)) {
      for (const participantId of participantIds) {
        await db.chatParticipant.create({
          data: {
            id: await generateSnowflakeId(),
            chatId: newChat.id,
            userId: participantId,
          },
        });
      }
    }

    return newChat;
  });

  logger.info('Chat created successfully', { chatId: chat.id, userId: user.userId, isGroup, participantCount: (participantIds?.length || 0) + 1 }, 'POST /api/chats');

  return successResponse({ chat }, 201);
});

