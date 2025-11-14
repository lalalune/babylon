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
import { z } from 'zod'

const SetBiasSchema = z.object({
  action: z.literal('set'),
  entityId: z.string().min(1),
  entityName: z.string().min(1),
  direction: z.enum(['up', 'down']),
  strength: z.number().min(0).max(1).optional(),
  durationHours: z.number().optional(),
  decayRate: z.number().min(0).max(1).optional(),
});

const RemoveBiasSchema = z.object({
  action: z.literal('remove'),
  entityId: z.string().min(1),
});

const BulkSetBiasSchema = z.object({
  action: z.literal('bulk-set'),
  biases: z.array(z.object({
    entityId: z.string().min(1),
    entityName: z.string().min(1),
    direction: z.enum(['up', 'down']),
    strength: z.number().min(0).max(1).optional(),
    durationHours: z.number().optional(),
    decayRate: z.number().min(0).max(1).optional(),
  })).min(1),
});

const BiasConfigSchema = z.discriminatedUnion('action', [
  SetBiasSchema,
  RemoveBiasSchema,
  BulkSetBiasSchema,
]);


export async function POST(request: NextRequest) {
  const json = await request.json()
  const parsed = BiasConfigSchema.parse(json)

  const body = parsed

  if (body.action === 'set') {
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
    biasEngine.removeBias(body.entityId)

    return NextResponse.json({
      success: true,
      message: `Bias removed for entity: ${body.entityId}`,
    })
  } else {
    biasEngine.setBulkBiases(body.biases)

    return NextResponse.json({
      success: true,
      message: `${body.biases.length} biases configured`,
      count: body.biases.length,
    }, { status: 201 })
  }
}
