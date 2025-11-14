/**
 * Market Bias Configuration API
 *
 * POST /api/markets/bias/configure
 * Configure market biases for entities (organizations, people, etc.)
 * Supports setting new biases or removing existing ones
 *
 * Request body:
 * - action: 'set' | 'remove' | 'bulk-set'
 * - For 'set': entityId, entityName, direction ('up'|'down'), strength (0-1), durationHours?, decayRate?
 * - For 'remove': entityId
 * - For 'bulk-set': biases array
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { biasEngine } from '@/lib/feedback/bias-engine'
import { logger } from '@/lib/logger'

interface SetBiasRequest {
  action: 'set'
  entityId: string
  entityName: string
  direction: 'up' | 'down'
  strength?: number // 0-1, default 0.5
  durationHours?: number // null = permanent
  decayRate?: number // 0-1, default 0.1
}

interface RemoveBiasRequest {
  action: 'remove'
  entityId: string
}

interface BulkSetBiasRequest {
  action: 'bulk-set'
  biases: Array<{
    entityId: string
    entityName: string
    direction: 'up' | 'down'
    strength?: number
    durationHours?: number
    decayRate?: number
  }>
}

type BiasConfigRequest = SetBiasRequest | RemoveBiasRequest | BulkSetBiasRequest

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BiasConfigRequest

    // Validate action
    if (!body.action || !['set', 'remove', 'bulk-set'].includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be one of: set, remove, bulk-set' },
        { status: 400 }
      )
    }

    if (body.action === 'set') {
      // Validate required fields for set
      if (!body.entityId || !body.entityName || !body.direction) {
        return NextResponse.json(
          { error: 'entityId, entityName, and direction are required for set action' },
          { status: 400 }
        )
      }

      if (body.direction !== 'up' && body.direction !== 'down') {
        return NextResponse.json(
          { error: 'direction must be "up" or "down"' },
          { status: 400 }
        )
      }

      // Set the bias
      biasEngine.setBias(
        body.entityId,
        body.entityName,
        body.direction,
        body.strength,
        {
          durationHours: body.durationHours,
          decayRate: body.decayRate,
        }
      )

      // Get the configured bias with current adjustment
      const adjustment = biasEngine.getBiasAdjustment(body.entityId)

      return NextResponse.json({
        success: true,
        message: `Bias configured: ${body.direction} ${body.entityName}`,
        bias: {
          entityId: body.entityId,
          entityName: body.entityName,
          direction: body.direction,
          strength: body.strength ?? 0.5,
          adjustment,
        },
      }, { status: 201 })
    } else if (body.action === 'remove') {
      // Validate required fields for remove
      if (!body.entityId) {
        return NextResponse.json(
          { error: 'entityId is required for remove action' },
          { status: 400 }
        )
      }

      // Remove the bias
      const removed = biasEngine.removeBias(body.entityId)

      if (!removed) {
        return NextResponse.json(
          { error: 'Bias not found for entity' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Bias removed for entity: ${body.entityId}`,
      })
    } else {
      // action === 'bulk-set'
      if (!Array.isArray(body.biases) || body.biases.length === 0) {
        return NextResponse.json(
          { error: 'biases array is required and must not be empty for bulk-set action' },
          { status: 400 }
        )
      }

      // Validate all biases in array
      for (const bias of body.biases) {
        if (!bias.entityId || !bias.entityName || !bias.direction) {
          return NextResponse.json(
            { error: 'Each bias must have entityId, entityName, and direction' },
            { status: 400 }
          )
        }
        if (bias.direction !== 'up' && bias.direction !== 'down') {
          return NextResponse.json(
            { error: 'direction must be "up" or "down"' },
            { status: 400 }
          )
        }
      }

      // Set all biases
      biasEngine.setBulkBiases(body.biases)

      return NextResponse.json({
        success: true,
        message: `${body.biases.length} biases configured`,
        count: body.biases.length,
      }, { status: 201 })
    }
  } catch (error) {
    logger.error('Failed to configure market bias', error)
    return NextResponse.json({ error: 'Failed to configure bias' }, { status: 500 })
  }
}
