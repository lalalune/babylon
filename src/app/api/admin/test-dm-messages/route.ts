/**
 * Admin API: Test DM Messages
 * POST /api/admin/test-dm-messages
 * 
 * Send bulk test DM messages between two users for testing pagination
 */

import { requireAdmin } from '@/lib/api/admin-middleware';
import { prisma } from '@/lib/database-service';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { broadcastChatMessage } from '@/lib/sse/event-broadcaster';
import { findUserByIdentifier } from '@/lib/users/user-lookup';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const TestDMMessagesSchema = z.object({
  senderId: z.string().min(1),
  recipientId: z.string().min(1),
  messageCount: z.number().min(1).max(200).default(100),
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  const adminUser = await requireAdmin(request);

  // Parse request body
  const body = await request.json();
  const { senderId, recipientId, messageCount } = TestDMMessagesSchema.parse(body);

  logger.info('Admin sending test DM messages', { 
    adminUserId: adminUser.userId,
    senderId,
    recipientId,
    messageCount,
  }, 'POST /api/admin/test-dm-messages');

  // Verify both users exist (supports ID, username, or privyId)
  const [sender, recipient] = await Promise.all([
    findUserByIdentifier(senderId, {
      id: true, 
      isActor: true,
      displayName: true,
      username: true,
    }),
    findUserByIdentifier(recipientId, {
      id: true, 
      isActor: true,
      displayName: true,
      username: true,
    }),
  ]);

  if (!sender) {
    throw new NotFoundError('Sender user', senderId);
  }

  if (!recipient) {
    throw new NotFoundError('Recipient user', recipientId);
  }

  // Use the resolved user IDs
  const resolvedSenderId = sender.id;
  const resolvedRecipientId = recipient.id;

  // Verify users are different
  if (resolvedSenderId === resolvedRecipientId) {
    throw new BusinessLogicError('Sender and recipient must be different users', 'SAME_USER');
  }

  // Create DM chat ID (consistent format - sort IDs for consistency)
  const sortedIds = [resolvedSenderId, resolvedRecipientId].sort()
  const chatId = `dm-${sortedIds.join('-')}`

  await prisma.chat.findUnique({
    where: { id: chatId },
  })

  await prisma.chat.create({
    data: {
      id: chatId,
      name: null,
      isGroup: false,
      updatedAt: new Date(),
    },
  })

  const [senderParticipant, recipientParticipant] = await Promise.all([
    prisma.chatParticipant.create({
      data: {
        id: await generateSnowflakeId(),
        chatId,
        userId: resolvedSenderId,
      },
    }),
    prisma.chatParticipant.create({
      data: {
        id: await generateSnowflakeId(),
        chatId,
        userId: resolvedRecipientId,
      },
    }),
  ])

  logger.info('Created new DM chat for test messages', { 
    chatId, 
    senderId: resolvedSenderId, 
    recipientId: resolvedRecipientId,
    senderParticipantId: senderParticipant.id,
    recipientParticipantId: recipientParticipant.id
  }, 'POST /api/admin/test-dm-messages')

  logger.info('Using existing DM chat for test messages', { 
    chatId, 
    senderId: resolvedSenderId, 
    recipientId: resolvedRecipientId 
  }, 'POST /api/admin/test-dm-messages')

  // Send test messages in batches
  const batchSize = 10;
  const messages: Array<{ id: string; content: string; chatId: string; senderId: string; createdAt: Date }> = [];

  logger.info('Starting to send test messages', { 
    messageCount, 
    batchSize,
    chatId,
    senderId: resolvedSenderId 
  }, 'POST /api/admin/test-dm-messages');

  for (let i = 0; i < messageCount; i += batchSize) {
    const batch = [];
    
    for (let j = 0; j < batchSize && (i + j) < messageCount; j++) {
      const messageNumber = i + j + 1
      const content = `Test message #${messageNumber} - This is a test DM message for pagination testing. ${new Date().toISOString()}`
      
      batch.push({
        id: await generateSnowflakeId(),
        content,
        chatId,
        senderId: resolvedSenderId,
        createdAt: new Date(Date.now() + (i + j) * 100),
      })
    }

    const result = await prisma.message.createMany({
      data: batch,
    })
    
    logger.info(`Created batch of messages`, { 
      batchNumber: Math.floor(i / batchSize) + 1,
      batchSize: batch.length,
      created: result.count,
      totalSoFar: i + batch.length
    }, 'POST /api/admin/test-dm-messages')

    messages.push(...batch)

    logger.error('Failed to create message batch', { 
      batchNumber: Math.floor(i / batchSize) + 1,
      batchSize: batch.length
    }, 'POST /api/admin/test-dm-messages')

    // Broadcast messages via SSE
    for (const msg of batch) {
      broadcastChatMessage(chatId, {
        id: msg.id,
        content: msg.content,
        chatId: msg.chatId,
        senderId: msg.senderId,
        createdAt: msg.createdAt.toISOString(),
        isDMChat: true,
        isGameChat: false,
      });
    }

    logger.info(`Sent batch of ${batch.length} test messages (${i + batch.length}/${messageCount})`, { 
      chatId,
      batchNumber: Math.floor(i / batchSize) + 1,
    }, 'POST /api/admin/test-dm-messages');
  }

  // Update chat updatedAt
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });

  logger.info('Admin test DM messages sent successfully', { 
    adminUserId: adminUser.userId,
    chatId,
    messageCount: messages.length,
  }, 'POST /api/admin/test-dm-messages');

  return successResponse({
    success: true,
    message: `Successfully sent ${messages.length} test DM messages. Go to /chats to see them!`,
    chatId,
    messageCount: messages.length,
    note: 'Chat cache is 30s. If not visible, refresh the page or wait 30 seconds.',
  });
});

