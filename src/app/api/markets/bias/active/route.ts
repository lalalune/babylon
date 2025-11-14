/**
 * Active Market Biases API
 *
 * GET /api/markets/bias/active
 * Returns list of all active market biases configured in the system
 * Used to show current sentiment/price manipulations in markets
 */

import { NextResponse } from 'next/server'
import { biasEngine } from '@/lib/feedback/bias-engine'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    // Get all active biases from the singleton engine
    const activeBiases = biasEngine.getActiveBiases()

    // Format biases for API response
    const biases = activeBiases.map((bias) => ({
      entityId: bias.entityId,
      entityName: bias.entityName,
      direction: bias.direction,
      strength: bias.strength,
      createdAt: bias.createdAt.toISOString(),
      expiresAt: bias.expiresAt ? bias.expiresAt.toISOString() : null,
      decayRate: bias.decayRate,
      // Get current adjustment values
      adjustment: biasEngine.getBiasAdjustment(bias.entityId),
    }))

    return NextResponse.json({
      success: true,
      biases,
      count: biases.length,
    })
  } catch (error) {
    logger.error('Failed to get active biases', error)
    return NextResponse.json({ error: 'Failed to get active biases' }, { status: 500 })
  }
}
