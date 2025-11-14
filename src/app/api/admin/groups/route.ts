/**
 * Admin Groups API
 * 
 * View all group chats in the system for verification and debugging
 */

import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { asSystem } from '@/lib/db/context';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/groups
 * Get all group chats with filtering and sorting
 * Admin only
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication (includes localhost bypass)
  await requireAdmin(request);

  // Get query parameters
  const { searchParams } = new URL(request.url);
  const creatorFilter = searchParams.get('creator'); // Filter by creator name
  const sortBy = searchParams.get('sortBy') || 'createdAt'; // createdAt, memberCount, messageCount
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  // const groupType = searchParams.get('type'); // 'npc' or 'user' - unused for now

  // Build where clause
  const whereClause: { isGroup: boolean } = {
    isGroup: true,
  };

  // Get all data using asSystem in a single call to avoid nested async issues
  const { chats, allUsers, allActors, allUserGroups } = await asSystem(async (db) => {
    // Get all chats
    const chats = await db.chat.findMany({
      where: whereClause,
      include: {
        ChatParticipant: {
          select: {
            userId: true,
            joinedAt: true,
          },
        },
        Message: {
          select: {
            id: true,
            senderId: true,
            content: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Last 10 messages for preview
        },
      },
      orderBy: {
        createdAt: sortOrder === 'asc' ? 'asc' : 'desc',
      },
    });

    // Get all unique participant IDs across all chats
    type ChatType = typeof chats[0];
    type ChatParticipantType = typeof chats[0]['ChatParticipant'][0];
    type MessageType = typeof chats[0]['Message'][0];
    const allParticipantIds = [...new Set(chats.flatMap((c: ChatType) => c.ChatParticipant.map((p: ChatParticipantType) => p.userId)))];
    const allMessageSenderIds = [...new Set(chats.flatMap((c: ChatType) => c.Message.map((m: MessageType) => m.senderId)))];
    const allUserIds = [...new Set([...allParticipantIds, ...allMessageSenderIds])];

    // Get all users and actors at once
    const allUsers = await db.user.findMany({
      where: { id: { in: allUserIds } },
      select: {
        id: true,
        username: true,
        displayName: true,
        isActor: true,
        profileImageUrl: true,
      },
    });
    
    const allActors = await db.actor.findMany({
      where: { id: { in: allUserIds } },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
      },
    });
    
    // Query UserGroup without type issues
    const allUserGroups = await db.$queryRaw<Array<{ name: string | null; createdById: string }>>`
      SELECT name, "createdById" FROM "UserGroup"
    `;

    return { chats, allUsers, allActors, allUserGroups };
  });

  // Create maps for quick lookup  
  type UserType = typeof allUsers[number];
  type ActorType = typeof allActors[number];
  type UserGroupType = { name: string | null; createdById: string };
  
  const usersMap = new Map<string, UserType>(allUsers.map((u: UserType) => [u.id, u]));
  const actorsMap = new Map<string, ActorType>(allActors.map((a: ActorType) => [a.id, a]));
  const userGroupsMap = new Map<string, UserGroupType>(
    allUserGroups.filter((g: UserGroupType) => g.name).map((g: UserGroupType) => [g.name as string, g])
  );

  // Enrich with creator and participant details
  type ChatWithRelations = typeof chats[0];
  type ChatParticipantInner = typeof chats[0]['ChatParticipant'][0];
  const enrichedChats = await Promise.all(
    chats.map(async (chat: ChatWithRelations) => {
      const participantIds = chat.ChatParticipant.map((p: ChatParticipantInner) => p.userId);
      
      // Get participants from maps
      const users = participantIds.map((id: string) => usersMap.get(id)).filter((u: UserType | undefined): u is UserType => u !== undefined);
      const actors = participantIds.map((id: string) => actorsMap.get(id)).filter((a: ActorType | undefined): a is ActorType => a !== undefined);

      // Determine group type and creator
      const actorParticipants = actors.map((a: ActorType) => a.id);
      const hasNPCs = actorParticipants.length > 0;
      const hasUsers = users.filter((u: UserType) => !u.isActor).length > 0;
      
      let groupType = 'unknown';
      let creatorName = 'Unknown';
      let creatorId = null;
      
      if (hasNPCs && !hasUsers) {
        groupType = 'npc-only';
        // Find creator from chat name or first NPC
        const creator = actors.find((a: ActorType) => chat.name?.includes(a.name)) || actors[0];
        if (creator) {
          creatorName = creator.name;
          creatorId = creator.id;
        }
      } else if (hasNPCs && hasUsers) {
        groupType = 'npc-mixed';
        // Alpha group - NPC created
        const creator = actors.find((a: ActorType) => chat.name?.includes(a.name)) || actors[0];
        if (creator) {
          creatorName = creator.name;
          creatorId = creator.id;
        }
      } else {
        groupType = 'user';
        // Check UserGroup table from map
        const userGroup = chat.name ? userGroupsMap.get(chat.name) : null;
        
        if (userGroup) {
          const creator = users.find((u: UserType) => u.id === userGroup.createdById);
          if (creator) {
            creatorName = creator.displayName || creator.username || 'Unknown';
            creatorId = creator.id;
          }
        }
      }

      // Apply creator filter
      if (creatorFilter && !creatorName.toLowerCase().includes(creatorFilter.toLowerCase())) {
        return null;
      }

      // Apply group type filter
      if (groupType && groupType !== 'all' && !groupType.includes(groupType)) {
        return null;
      }

      // Combine user and actor info
      type ParticipantType = typeof chat.ChatParticipant[0];
      const participants = chat.ChatParticipant.map((p: ParticipantType) => {
        const user = users.find((u: UserType) => u.id === p.userId);
        const actor = actors.find((a: ActorType) => a.id === p.userId);
        
        return {
          id: p.userId,
          name: user?.displayName || user?.username || actor?.name || 'Unknown',
          username: user?.username || null,
          isNPC: !!actor || user?.isActor,
          profileImageUrl: user?.profileImageUrl || actor?.profileImageUrl,
          joinedAt: p.joinedAt,
        };
      });

      // Get message senders from maps
      type MessageType = typeof chat.Message[0];
      const messagesWithSenders = chat.Message.map((m: MessageType) => {
        const user = usersMap.get(m.senderId);
        const actor = actorsMap.get(m.senderId);
        
        return {
          id: m.id,
          content: m.content,
          createdAt: m.createdAt,
          sender: {
            id: m.senderId,
            name: user?.displayName || user?.username || actor?.name || 'Unknown',
            isNPC: !!actor || user?.isActor,
          },
        };
      });

      return {
        id: chat.id,
        name: chat.name,
        groupType,
        creatorId,
        creatorName,
        memberCount: participants.length,
        messageCount: chat.Message.length,
        participants,
        recentMessages: messagesWithSenders,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      };
    })
  );

  // Filter out nulls (from filters)
  const filteredChats = enrichedChats.filter(c => c !== null);

  // Sort if needed
  if (sortBy === 'memberCount') {
    filteredChats.sort((a, b) => {
      const order = sortOrder === 'asc' ? 1 : -1;
      return order * (a!.memberCount - b!.memberCount);
    });
  } else if (sortBy === 'messageCount') {
    filteredChats.sort((a, b) => {
      const order = sortOrder === 'asc' ? 1 : -1;
      return order * (a!.messageCount - b!.messageCount);
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      groups: filteredChats,
      total: filteredChats.length,
    },
  });
});

