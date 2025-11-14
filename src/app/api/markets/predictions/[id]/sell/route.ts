/**
 * API Route: /api/markets/predictions/[id]/sell
 * Methods: POST (sell YES or NO shares in prediction market)
 */

import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { NotFoundError, BusinessLogicError } from '@/lib/errors';
import { PredictionMarketSellSchema } from '@/lib/validation/schemas/trade';
import { WalletService } from '@/lib/services/wallet-service';
import { PredictionPricing } from '@/lib/prediction-pricing';
import { logger } from '@/lib/logger';
import { FeeService } from '@/lib/services/fee-service';
import { FEE_CONFIG } from '@/lib/config/fees';
import { trackServerEvent } from '@/lib/posthog/server';
/**
 * POST /api/markets/predictions/[id]/sell
 * Sell shares from prediction market position
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  const { id: marketId } = await context.params;

  if (!marketId) {
    throw new BusinessLogicError('Market ID is required', 'MARKET_ID_REQUIRED');
  }

  const body = await request.json();
  const { shares } = PredictionMarketSellSchema.parse(body);

  // Execute sell with RLS
  const { grossProceeds, netProceeds, pnl, remainingShares, positionClosed, calculation } = await asUser(user, async (db) => {
    // Get or find market
    let market = await db.market.findUnique({
      where: { id: marketId },
    });

    // If market doesn't exist, try to find Question and create Market
    if (!market) {
      const questionModel = db as typeof db & {
        question: {
          findUnique: (args: { where: { id: string } }) => Promise<{
            id: string
            questionNumber: number
            text: string
            status: string
            resolutionDate: Date
          } | null>
          findMany: (args: { where: { questionNumber: number }; orderBy: { createdDate: 'desc' }; take: number }) => Promise<Array<{
            id: string
            questionNumber: number
            text: string
            status: string
            resolutionDate: Date
          }>>
        }
      }

      let question = await questionModel.question.findUnique({
        where: { id: marketId },
      });

      if (!question && !isNaN(Number(marketId))) {
        const questions = await questionModel.question.findMany({
          where: { questionNumber: parseInt(marketId, 10) },
          orderBy: { createdDate: 'desc' },
          take: 1,
        });
        question = questions[0] || null;
      }

      if (!question) {
        throw new NotFoundError('Market or Question', marketId);
      }

      if (question.status !== 'active') {
        throw new BusinessLogicError(`Question is ${question.status}, cannot trade`, 'QUESTION_INACTIVE', { status: question.status, marketId });
      }

      const endDate = new Date(question.resolutionDate);
      const initialLiquidity = 1000;

      market = await db.market.upsert({
        where: { id: question.id },
        create: {
          id: question.id,
          question: question.text,
          description: null,
          gameId: 'continuous',
          dayNumber: null,
          yesShares: new Prisma.Decimal(initialLiquidity / 2),
          noShares: new Prisma.Decimal(initialLiquidity / 2),
          liquidity: new Prisma.Decimal(initialLiquidity),
          resolved: false,
          resolution: null,
          endDate: endDate,
        },
        update: {},
      });
    }

    // Check if market is still active
    if (market.resolved) {
      throw new BusinessLogicError('Cannot sell from resolved market', 'MARKET_RESOLVED', { marketId });
    }

    // Get user's position
    const position = await db.position.findFirst({
      where: {
        userId: user.userId,
        marketId,
      },
    });

    if (!position) {
      throw new NotFoundError('Position', `${user.userId}-${marketId}`);
    }

    // Validate sufficient shares
    if (Number(position.shares) < shares) {
      throw new BusinessLogicError(
        `Insufficient shares. Have ${Number(position.shares)}, trying to sell ${shares}`,
        'INSUFFICIENT_SHARES',
        { have: Number(position.shares), requested: shares }
      );
    }

    const side = position.side ? 'yes' : 'no';

    // Calculate proceeds using AMM with fees
    const calculation = PredictionPricing.calculateSellWithFees(
      Number(market.yesShares),
      Number(market.noShares),
      side,
      shares
    );

    const grossProceeds = calculation.totalCost; // Gross proceeds before fee
    const netProceeds = calculation.netProceeds!; // Net proceeds after fee

    // Credit net proceeds to balance
    await WalletService.credit(
      user.userId,
      netProceeds,
      'pred_sell',
      `Sold ${shares} ${side.toUpperCase()} shares in: ${market.question}`,
      marketId
    );

    // Update market shares (use gross proceeds for liquidity)
    await db.market.update({
      where: { id: marketId },
      data: {
        yesShares: new Prisma.Decimal(calculation.newYesPrice * (Number(market.yesShares) + Number(market.noShares))),
        noShares: new Prisma.Decimal(calculation.newNoPrice * (Number(market.yesShares) + Number(market.noShares))),
        liquidity: {
          decrement: new Prisma.Decimal(grossProceeds),
        },
      },
    });

    // Update or close position
    const remaining = Number(position.shares) - shares;

    if (remaining <= 0.01) {
      await db.position.delete({
        where: { id: position.id },
      });
    } else {
      await db.position.update({
        where: { id: position.id },
        data: {
          shares: new Prisma.Decimal(remaining),
        },
      });
    }

    // Calculate PnL (use net proceeds)
    const costBasis = Number(position.avgPrice) * shares;
    const profitLoss = netProceeds - costBasis;
    await WalletService.recordPnL(user.userId, profitLoss);

    return { 
      grossProceeds,
      netProceeds, 
      pnl: profitLoss, 
      remainingShares: remaining, 
      positionClosed: remaining <= 0.01,
      calculation 
    };
  });

  // Process trading fee and distribute to referrer if applicable
  const feeResult = await FeeService.processTradingFee(
    user.userId,
    FEE_CONFIG.FEE_TYPES.PRED_SELL,
    grossProceeds,
    undefined,
    marketId
  );

  const newBalance = await WalletService.getBalance(user.userId);

  logger.info('Shares sold successfully with fee', {
    userId: user.userId,
    marketId,
    sharesSold: shares,
    grossProceeds,
    netProceeds,
    fee: feeResult.feeCharged,
    pnl
  }, 'POST /api/markets/predictions/[id]/sell');

  // Track prediction sell event
  trackServerEvent(user.userId, 'prediction_sold', {
    marketId,
    sharesSold: shares,
    grossProceeds,
    netProceeds,
    pnl,
    pnlPercent: pnl > 0 ? (pnl / (grossProceeds - pnl)) * 100 : 0,
    priceImpact: calculation.priceImpact,
    feeCharged: feeResult.feeCharged,
    positionClosed,
    remainingShares,
  }).catch((error) => {
    logger.warn('Failed to track prediction_sold event', { error });
  });

  return successResponse({
    sharesSold: shares,
    grossProceeds,
    netProceeds,
    pnl,
    market: {
      yesPrice: calculation.newYesPrice,
      noPrice: calculation.newNoPrice,
      priceImpact: calculation.priceImpact,
    },
    fee: {
      amount: feeResult.feeCharged,
      referrerPaid: feeResult.referrerPaid,
    },
    remainingShares,
    positionClosed,
    newBalance: newBalance.balance,
    newLifetimePnL: newBalance.lifetimePnL,
  });
});
