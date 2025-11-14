/**
 * Perpetuals Prompt Tuning API
 *
 * GET /api/markets/perps/tune?ticker=AAPL
 * POST /api/markets/perps/tune
 * Manage AI agent prompt tuning parameters for perpetual futures trading
 * Used to customize Agent0 trading behavior for specific tickers or markets
 *
 * Tuning parameters include:
 * - Risk tolerance adjustments
 * - Entry/exit signal thresholds
 * - Position sizing multipliers
 * - Market sentiment overrides
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/errors/error-handler'

const TuningQuerySchema = z.object({
  ticker: z.string().optional(),
});

const TuningBodySchema = z.object({
  ticker: z.string().optional(),
  riskMultiplier: z.number().min(0.5).max(2.0).optional(),
  entryThreshold: z.number().min(0).max(1).optional(),
  exitThreshold: z.number().min(0).max(1).optional(),
  positionSizeMultiplier: z.number().min(0.1).max(3.0).optional(),
  sentimentOverride: z.enum(['bullish', 'bearish', 'neutral']).optional().nullable(),
  maxLeverageOverride: z.number().min(1).max(100).optional().nullable(),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const queryParse = TuningQuerySchema.safeParse({
    ticker: searchParams.get('ticker') || undefined,
  })

  if (!queryParse.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryParse.error.flatten() },
      { status: 400 }
    )
  }

  const { ticker } = queryParse.data

  // If ticker specified, get specific tuning
  if (ticker) {
    // For now, return default parameters
    // In a full implementation, this would query a tuning parameters table
    return NextResponse.json({
      success: true,
      ticker,
      parameters: {
        riskMultiplier: 1.0,
        entryThreshold: 0.6,
        exitThreshold: 0.4,
        positionSizeMultiplier: 1.0,
        sentimentOverride: null,
        maxLeverageOverride: null,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  // Return global defaults
  return NextResponse.json({
    success: true,
    parameters: {
      global: {
        riskMultiplier: 1.0,
        entryThreshold: 0.6,
        exitThreshold: 0.4,
        positionSizeMultiplier: 1.0,
        sentimentOverride: null,
        maxLeverageOverride: null,
        updatedAt: new Date().toISOString(),
      },
    },
  })
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const json = await request.json()
  const parsed = TuningBodySchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const body = parsed.data

  // In a full implementation, this would save to a database table
  // For now, just return success with the parameters
  logger.info(
    `Perp tuning parameters updated${body.ticker ? ` for ${body.ticker}` : ' (global)'}`,
    { ticker: body.ticker, parameters: body },
    'PerpTuning'
  )

  return NextResponse.json({
    success: true,
    message: `Tuning parameters updated${body.ticker ? ` for ${body.ticker}` : ' (global)'}`,
    parameters: {
      ticker: body.ticker || null,
      riskMultiplier: body.riskMultiplier ?? 1.0,
      entryThreshold: body.entryThreshold ?? 0.6,
      exitThreshold: body.exitThreshold ?? 0.4,
      positionSizeMultiplier: body.positionSizeMultiplier ?? 1.0,
      sentimentOverride: body.sentimentOverride ?? null,
      maxLeverageOverride: body.maxLeverageOverride ?? null,
      updatedAt: new Date().toISOString(),
    },
  }, { status: 201 })
})
