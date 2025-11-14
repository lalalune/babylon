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
import { z } from 'zod'

const TuneBiasSchema = z.object({
  entityId: z.string().min(1, 'entityId is required'),
  strength: z.number().min(0).max(1),
  decayRate: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json()
  const parsed = TuneBiasSchema.parse(json)

  const body = parsed

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

  biasEngine.tuneBiasStrength(body.entityId, body.strength, body.decayRate)

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
}
