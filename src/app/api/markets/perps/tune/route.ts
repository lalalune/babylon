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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')

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
  } catch (error) {
    logger.error('Failed to get perp tuning parameters', error)
    return NextResponse.json({ error: 'Failed to get tuning parameters' }, { status: 500 })
  }
}

interface TuningRequest {
  ticker?: string
  riskMultiplier?: number
  entryThreshold?: number
  exitThreshold?: number
  positionSizeMultiplier?: number
  sentimentOverride?: 'bullish' | 'bearish' | 'neutral' | null
  maxLeverageOverride?: number | null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TuningRequest

    // Validate parameters
    if (body.riskMultiplier !== undefined) {
      if (body.riskMultiplier < 0.5 || body.riskMultiplier > 2.0) {
        return NextResponse.json(
          { error: 'riskMultiplier must be between 0.5 and 2.0' },
          { status: 400 }
        )
      }
    }

    if (body.entryThreshold !== undefined) {
      if (body.entryThreshold < 0 || body.entryThreshold > 1) {
        return NextResponse.json(
          { error: 'entryThreshold must be between 0 and 1' },
          { status: 400 }
        )
      }
    }

    if (body.exitThreshold !== undefined) {
      if (body.exitThreshold < 0 || body.exitThreshold > 1) {
        return NextResponse.json(
          { error: 'exitThreshold must be between 0 and 1' },
          { status: 400 }
        )
      }
    }

    if (body.positionSizeMultiplier !== undefined) {
      if (body.positionSizeMultiplier < 0.1 || body.positionSizeMultiplier > 3.0) {
        return NextResponse.json(
          { error: 'positionSizeMultiplier must be between 0.1 and 3.0' },
          { status: 400 }
        )
      }
    }

    if (body.maxLeverageOverride !== undefined && body.maxLeverageOverride !== null) {
      if (body.maxLeverageOverride < 1 || body.maxLeverageOverride > 100) {
        return NextResponse.json(
          { error: 'maxLeverageOverride must be between 1 and 100' },
          { status: 400 }
        )
      }
    }

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
  } catch (error) {
    logger.error('Failed to update perp tuning parameters', error)
    return NextResponse.json({ error: 'Failed to update tuning parameters' }, { status: 500 })
  }
}
