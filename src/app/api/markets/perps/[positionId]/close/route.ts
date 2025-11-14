/**
 * API Route: /api/markets/perps/[positionId]/close
 * Methods: POST (close a perpetual futures position)
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { NotFoundError, BusinessLogicError, AuthorizationError } from '@/lib/errors';
import { PositionIdParamSchema, ClosePerpPositionSchema } from '@/lib/validation/schemas';
import { getPerpsEngine } from '@/lib/perps-service';
import { WalletService } from '@/lib/services/wallet-service';
import { logger } from '@/lib/logger';
import { FeeService } from '@/lib/services/fee-service';
import { FEE_CONFIG } from '@/lib/config/fees';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/markets/perps/[positionId]/close
 * Close an existing perpetual futures position
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ positionId: string }> }
) => {
  const user = await authenticate(request);
  const { positionId } = PositionIdParamSchema.parse(await context.params);
  
  // Parse and validate request body (optional for partial close)
  const body = await request.json().catch(() => ({}));
  if (Object.keys(body).length > 0) {
    ClosePerpPositionSchema.parse(body);
  }

  // Get position from database with RLS
  const dbPosition = await asUser(user, async (db) => {
    return await db.perpPosition.findUnique({
      where: { id: positionId },
    });
  });

  if (!dbPosition) {
    throw new NotFoundError('Position', positionId);
  }

  // Verify ownership
  if (dbPosition.userId !== user.userId) {
    throw new AuthorizationError('Not your position', 'position', 'close');
  }

  // Check if already closed
  if (dbPosition.closedAt) {
    throw new BusinessLogicError('Position already closed', 'POSITION_CLOSED', { positionId, closedAt: dbPosition.closedAt });
  }

  // Close position via engine
  const perpsEngine = getPerpsEngine();
  const { position, realizedPnL } = perpsEngine.closePosition(positionId);

  // Calculate final settlement
  const marginPaid = position.size / position.leverage;
  const grossSettlement = marginPaid + realizedPnL; // Margin + PnL before fee
  
  // Calculate fee on position size
  const feeCalc = FeeService.calculateFee(position.size);
  
  // Deduct fee from settlement
  const netSettlement = Math.max(0, grossSettlement - feeCalc.feeAmount);

  // Credit net settlement to balance
  if (netSettlement > 0) {
    await WalletService.credit(
      user.userId,
      netSettlement,
      'perp_close',
      `Closed ${position.leverage}x ${position.side} ${position.ticker} - PnL: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)} (fee: $${feeCalc.feeAmount.toFixed(2)})`,
      position.id
    );
  } else {
    // Margin was completely lost or consumed by fees (liquidation)
    logger.info('Position closed with total loss or fees exceeded settlement', {
      positionId,
      marginPaid,
      realizedPnL,
      grossSettlement,
      fee: feeCalc.feeAmount,
      netSettlement,
      userId: user.userId
    }, 'POST /api/markets/perps/[positionId]/close');
  }

  // Record PnL
  await WalletService.recordPnL(user.userId, realizedPnL);

  // Update position in database with RLS
  await asUser(user, async (db) => {
    return await db.perpPosition.update({
      where: { id: positionId },
      data: {
        closedAt: new Date(),
        realizedPnL: realizedPnL,
        currentPrice: position.currentPrice,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
      },
    });
  });

  // Process trading fee and distribute to referrer if applicable (only if there's settlement to charge from)
  let feeResult = { feeCharged: 0, referrerPaid: 0, platformReceived: 0, referrerId: null as string | null };
  if (grossSettlement > 0) {
    feeResult = await FeeService.processTradingFee(
      user.userId,
      FEE_CONFIG.FEE_TYPES.PERP_CLOSE,
      position.size,
      position.id,
      position.ticker
    );
  }

  const newBalance = await WalletService.getBalance(user.userId);

  logger.info('Position closed with fee', {
    userId: user.userId,
    positionId,
    realizedPnL,
    grossSettlement,
    netSettlement,
    fee: feeResult.feeCharged,
    referrerPaid: feeResult.referrerPaid,
    wasLiquidated: netSettlement === 0
  }, 'POST /api/markets/perps/[positionId]/close');

  // Calculate hold time
  const holdTimeMs = new Date().getTime() - new Date(position.openedAt).getTime();
  const holdTimeMinutes = Math.round(holdTimeMs / 60000);

  // Track trade closed event
  trackServerEvent(user.userId, 'trade_closed', {
    type: 'perp',
    ticker: position.ticker,
    side: position.side,
    size: position.size,
    leverage: position.leverage,
    entryPrice: position.entryPrice,
    exitPrice: position.currentPrice,
    realizedPnL,
    pnlPercent: (realizedPnL / marginPaid) * 100,
    holdTimeMinutes,
    feeCharged: feeResult.feeCharged,
    wasLiquidated: netSettlement === 0,
    positionId,
  }).catch((error) => {
    logger.warn('Failed to track trade_closed event', { error });
  });

  return successResponse({
    position: {
      id: position.id,
      ticker: position.ticker,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice: position.currentPrice,
      size: position.size,
      leverage: position.leverage,
      realizedPnL,
      fundingPaid: position.fundingPaid,
    },
    grossSettlement,
    netSettlement,
    marginReturned: marginPaid,
    pnl: realizedPnL,
    fee: {
      amount: feeResult.feeCharged,
      referrerPaid: feeResult.referrerPaid,
    },
    wasLiquidated: netSettlement === 0,
    newBalance: newBalance.balance,
    newLifetimePnL: newBalance.lifetimePnL,
  });
});
