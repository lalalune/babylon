/**
 * API Route: /api/markets/perps/open
 * Methods: POST (open a new perpetual futures position)
 */
import type { NextRequest } from 'next/server';

import { authenticate } from '@/lib/api/auth-middleware';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { trackServerEvent } from '@/lib/posthog/server';
import { PerpTradeService } from '@/lib/services/perp-trade-service';
import { PerpOpenPositionSchema } from '@/lib/validation/schemas/trade';

/**
 * POST /api/markets/perps/open
 * Open a new perpetual futures position
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  const body = await request.json();
  const { ticker, side, size, leverage } = PerpOpenPositionSchema.parse(body);

  const normalizedSide = side.toLowerCase() as 'long' | 'short';
  const numericSize = typeof size === 'string' ? Number(size) : size;

  const result = await PerpTradeService.openPosition(user, {
    ticker,
    side: normalizedSide,
    size: numericSize,
    leverage,
  });

  trackServerEvent(user.userId, 'trade_opened', {
    type: 'perp',
    ticker,
    side: normalizedSide,
    size: numericSize,
    leverage,
    entryPrice: result.position.entryPrice,
    marginPaid: result.marginPaid,
    feeCharged: result.fee.feeCharged,
    positionId: result.position.id,
  }).catch((error) => {
    console.warn('Failed to track trade_opened event', { error });
  });

  return successResponse(
    {
      position: {
        id: result.position.id,
        ticker: result.position.ticker,
        side: result.position.side,
        entryPrice: result.position.entryPrice,
        currentPrice: result.position.currentPrice,
        size: result.position.size,
        leverage: result.position.leverage,
        liquidationPrice: result.position.liquidationPrice,
        unrealizedPnL: result.position.unrealizedPnL,
        unrealizedPnLPercent: result.position.unrealizedPnLPercent,
        fundingPaid: result.position.fundingPaid,
        openedAt: result.position.openedAt,
      },
      marginPaid: result.marginPaid,
      fee: {
        amount: result.fee.feeCharged,
        referrerPaid: result.fee.referrerPaid,
      },
      newBalance: result.newBalance,
    },
    201
  );
});
