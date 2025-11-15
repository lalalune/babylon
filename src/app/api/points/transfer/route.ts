/**
 * Points Transfer API Route
 * 
 * Enables peer-to-peer point transfers between users
 * Similar to Farcaster's "pay" feature
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { withErrorHandling } from '@/lib/errors/error-handler'
import { authenticate } from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createNotification } from '@/lib/services/notification-service'

const TransferPointsSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  amount: z.number().int().positive('Amount must be a positive integer'),
  message: z.string().max(200).optional(),
})

/**
 * POST /api/points/transfer
 * Transfer points from authenticated user to another user
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authenticate the sender
  const authUser = await authenticate(request)
  const senderId = authUser.dbUserId!

  // Parse and validate request body
  const body = await request.json()
  const validation = TransferPointsSchema.safeParse(body)

  if (!validation.success) {
    const firstError = validation.error.issues?.[0]
    return NextResponse.json(
      { error: firstError?.message || 'Invalid request data' },
      { status: 400 }
    )
  }

  const { recipientId, amount, message } = validation.data

  // Prevent self-transfers
  if (senderId === recipientId) {
    return NextResponse.json(
      { error: 'Cannot send points to yourself' },
      { status: 400 }
    )
  }

  // Verify sender and recipient exist
  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({
      where: { id: senderId },
      select: { 
        id: true, 
        reputationPoints: true,
        displayName: true,
        username: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: recipientId },
      select: { 
        id: true, 
        reputationPoints: true,
        displayName: true,
        username: true,
      },
    }),
  ])

  if (!sender) {
    return NextResponse.json(
      { error: 'Sender not found' },
      { status: 404 }
    )
  }

  if (!recipient) {
    return NextResponse.json(
      { error: 'Recipient not found' },
      { status: 404 }
    )
  }

  // Check if sender has enough points
  if (sender.reputationPoints < amount) {
    return NextResponse.json(
      { 
        error: `Insufficient points. You have ${sender.reputationPoints} points, but tried to send ${amount} points.`,
        available: sender.reputationPoints,
        requested: amount,
      },
      { status: 400 }
    )
  }

  // Perform the transfer in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const senderPointsBefore = sender.reputationPoints
    const recipientPointsBefore = recipient.reputationPoints

    // Deduct from sender
    const updatedSender = await tx.user.update({
      where: { id: senderId },
      data: {
        reputationPoints: { decrement: amount },
      },
    })

    // Add to recipient
    const updatedRecipient = await tx.user.update({
      where: { id: recipientId },
      data: {
        reputationPoints: { increment: amount },
      },
    })

    // Create transaction record for sender (negative)
    await tx.pointsTransaction.create({
      data: {
        id: await generateSnowflakeId(),
        userId: senderId,
        amount: -amount,
        pointsBefore: senderPointsBefore,
        pointsAfter: updatedSender.reputationPoints,
        reason: 'transfer_sent',
        metadata: JSON.stringify({
          recipientId,
          recipientName: recipient.displayName || recipient.username,
          message,
        }),
      },
    })

    // Create transaction record for recipient (positive)
    await tx.pointsTransaction.create({
      data: {
        id: await generateSnowflakeId(),
        userId: recipientId,
        amount: amount,
        pointsBefore: recipientPointsBefore,
        pointsAfter: updatedRecipient.reputationPoints,
        reason: 'transfer_received',
        metadata: JSON.stringify({
          senderId,
          senderName: sender.displayName || sender.username,
          message,
        }),
      },
    })

    return {
      sender: updatedSender,
      recipient: updatedRecipient,
    }
  })

  logger.info(
    `Points transfer: ${sender.username || senderId} sent ${amount} points to ${recipient.username || recipientId}`,
    {
      senderId,
      recipientId,
      amount,
      message,
      senderNewBalance: result.sender.reputationPoints,
      recipientNewBalance: result.recipient.reputationPoints,
    },
    'PointsTransfer'
  )

  // Send notification to recipient
  const senderName = sender.displayName || sender.username || 'Someone'
  const notificationMessage = message 
    ? `${senderName} sent you ${amount} points: "${message}"` 
    : `${senderName} sent you ${amount} points`
  
  await createNotification({
    userId: recipientId,
    type: 'points_received',
    actorId: senderId,
    title: `You received ${amount} points`,
    message: notificationMessage,
  }).catch(err => {
    // Log error but don't fail the transfer
    logger.error('Failed to create notification for points transfer', { error: err, recipientId, senderId }, 'PointsTransfer')
  })

  return NextResponse.json({
    success: true,
    transfer: {
      amount,
      sender: {
        id: sender.id,
        name: sender.displayName || sender.username,
        newBalance: result.sender.reputationPoints,
      },
      recipient: {
        id: recipient.id,
        name: recipient.displayName || recipient.username,
        newBalance: result.recipient.reputationPoints,
      },
      message,
    },
  })
})

