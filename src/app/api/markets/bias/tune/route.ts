/**
 * Market Bias Tuning API
 *
 * POST /api/markets/bias/tune
 * Adjusts the strength of existing market biases
 * Allows fine-tuning without reconfiguring the entire bias
 *
 * Request body:
 * - entityId: string - Entity to tune
 * - strength: number - New strength (0-1), 0 deactivates the bias
 * - decayRate?: number - Optional new decay rate (0-1)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { biasEngine } from '@/lib/feedback/bias-engine'
import { logger } from '@/lib/logger'

interface TuneBiasRequest {
  entityId: string
  strength: number // 0-1, 0 = deactivate
  decayRate?: number // Optional, 0-1
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TuneBiasRequest

    // Validate required fields
    if (!body.entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 })
    }

    if (body.strength === undefined) {
      return NextResponse.json({ error: 'strength is required' }, { status: 400 })
    }

    // Validate strength range
    if (body.strength < 0 || body.strength > 1) {
      return NextResponse.json(
        { error: 'strength must be between 0 and 1' },
        { status: 400 }
      )
    }

    // Validate decay rate if provided
    if (body.decayRate !== undefined && (body.decayRate < 0 || body.decayRate > 1)) {
      return NextResponse.json(
        { error: 'decayRate must be between 0 and 1' },
        { status: 400 }
      )
    }

    // Check if bias exists
    const currentBias = biasEngine.getBiasAdjustment(body.entityId)
    if (!currentBias) {
      return NextResponse.json(
        { error: 'Bias not found for entity' },
        { status: 404 }
      )
    }

    // If strength is 0, remove the bias
    if (body.strength === 0) {
      biasEngine.removeBias(body.entityId)

      logger.info(`Market bias deactivated for ${body.entityId}`, {
        entityId: body.entityId,
      })

      return NextResponse.json({
        success: true,
        message: `Bias deactivated for entity: ${body.entityId}`,
        bias: {
          entityId: body.entityId,
          strength: 0,
          active: false,
        },
      })
    }

    // Tune the bias strength
    biasEngine.tuneBiasStrength(body.entityId, body.strength, body.decayRate)

    // Get updated adjustment
    const updatedBias = biasEngine.getBiasAdjustment(body.entityId)

    logger.info(`Market bias tuned for ${body.entityId}`, {
      entityId: body.entityId,
      strength: body.strength,
      decayRate: body.decayRate,
    })

    return NextResponse.json({
      success: true,
      message: `Bias strength updated for entity: ${body.entityId}`,
      bias: {
        entityId: body.entityId,
        strength: body.strength,
        adjustment: updatedBias,
        decayRate: body.decayRate,
      },
    })
  } catch (error) {
    logger.error('Failed to tune market bias', error)
    return NextResponse.json({ error: 'Failed to tune bias' }, { status: 500 })
  }
}
