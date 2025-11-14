/**
 * API Route: /api/markets/perps/position/[id]/close
 * Methods: POST (close a perpetual futures position)
 */
import type { NextRequest } from 'next/server';

import { authenticate } from '@/lib/api/auth-middleware';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { trackServerEvent } from '@/lib/posthog/server';
import { PerpTradeService } from '@/lib/services/perp-trade-service';
import {
  ClosePerpPositionSchema,
} from '@/lib/validation/schemas';
import { z } from 'zod';

const IdParamSchema = z.object({
  id: z.string(),
});

/**
 * POST /api/markets/perps/position/[id]/close
 * Close an existing perpetual futures position
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const user = await authenticate(request);
    const { id: positionId } = IdParamSchema.parse(await context.params);

    // Parse and validate request body (optional for partial close)
    const body = await request.json().catch(() => ({}));
    if (Object.keys(body).length > 0) {
      ClosePerpPositionSchema.parse(body);
    }

    const result = await PerpTradeService.closePosition(user, positionId);

    const holdTimeMs =
      new Date().getTime() - new Date(result.position.openedAt).getTime();
    const holdTimeMinutes = Math.round(holdTimeMs / 60000);

    trackServerEvent(user.userId, 'trade_closed', {
      type: 'perp',
      ticker: result.position.ticker,
      side: result.position.side,
      size: result.position.size,
      leverage: result.position.leverage,
      entryPrice: result.position.entryPrice,
      exitPrice: result.position.currentPrice,
      realizedPnL: result.realizedPnL,
      pnlPercent:
        result.marginReturned > 0
          ? (result.realizedPnL / result.marginReturned) * 100
          : 0,
      holdTimeMinutes,
      feeCharged: result.fee.feeCharged,
      wasLiquidated: result.wasLiquidated,
      positionId,
    }).catch((error) => {
      console.warn('Failed to track trade_closed event', { error });
    });

    return successResponse({
      position: {
        id: result.position.id,
        ticker: result.position.ticker,
        side: result.position.side,
        entryPrice: result.position.entryPrice,
        exitPrice: result.position.currentPrice,
        size: result.position.size,
        leverage: result.position.leverage,
        realizedPnL: result.realizedPnL,
        fundingPaid: result.position.fundingPaid,
      },
      grossSettlement: result.grossSettlement,
      netSettlement: result.netSettlement,
      marginReturned: result.marginReturned,
      pnl: result.realizedPnL,
      fee: {
        amount: result.fee.feeCharged,
        referrerPaid: result.fee.referrerPaid,
      },
      wasLiquidated: result.wasLiquidated,
      newBalance: result.newBalance,
    });
  }
);
