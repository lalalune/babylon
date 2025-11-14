/**
 * Chat-related validation schemas
 */

import { z } from 'zod';
import { UUIDSchema, UserIdSchema, PaginationSchema, createTrimmedStringSchema } from './common';

/**
 * Chat message content schema
 */
export const ChatMessageContentSchema = createTrimmedStringSchema(1, 5000);

/**
 * Chat message submission schema
 */
export const ChatMessageCreateSchema = z.object({
  content: ChatMessageContentSchema
});

/**
 * Chat creation schema
 */
export const ChatCreateSchema = z.object({
  name: createTrimmedStringSchema(1, 100).optional(),
  isGroup: z.boolean().optional().default(false),
  participantIds: z.array(UUIDSchema).optional()
}).refine(
  (data) => !data.isGroup || data.name !== undefined,
  {
    message: 'Group name is required for group chats',
    path: ['name']
  }
);

/**
 * DM chat creation schema
 */
export const DMChatCreateSchema = z.object({
  userId: UserIdSchema
});

/**
 * Chat ID parameter schema
 */
export const ChatIdParamSchema = z.object({
  id: z.string().min(1)
});

/**
 * Chat query parameters schema
 */
export const ChatQuerySchema = z.object({
  all: z.enum(['true', 'false']).optional(),
  debug: z.enum(['true', 'false']).optional()
});

/**
 * Chat message query schema
 */
export const ChatMessageQuerySchema = PaginationSchema.extend({
  chatId: z.string().min(1).optional()
});

/**
 * Chat message response schema (for type safety)
 */
export const ChatMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  senderId: UUIDSchema,
  chatId: z.string(),
  createdAt: z.date()
});

/**
 * Chat participant schema
 */
export const ChatParticipantSchema = z.object({
  id: UUIDSchema,
  displayName: z.string(),
  username: z.string().optional(),
  profileImageUrl: z.string().optional()
});

/**
 * Chat response schema
 */
export const ChatSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  isGroup: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  participants: z.array(ChatParticipantSchema).optional(),
  lastMessage: ChatMessageSchema.optional()
});
