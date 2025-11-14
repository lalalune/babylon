/**
 * API Route: /api/markets/predictions/[id]/buy
 * Methods: POST (buy YES or NO shares in prediction market)
 */

import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { PredictionMarketTradeSchema } from '@/lib/validation/schemas/trade';
import { NotFoundError, BusinessLogicError, InsufficientFundsError } from '@/lib/errors';
import { WalletService } from '@/lib/services/wallet-service';
import { PredictionPricing } from '@/lib/prediction-pricing';
import { logger } from '@/lib/logger';
import { FeeService } from '@/lib/services/fee-service';
import { FEE_CONFIG } from '@/lib/config/fees';
import { trackServerEvent } from '@/lib/posthog/server';
/**
 * POST /api/markets/predictions/[id]/buy
 * Buy YES or NO shares in a prediction market
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: marketId } = await context.params;

  // Authentication - errors propagate to withErrorHandling
  const user = await authenticate(request);

  logger.info('Buy request START', {
    marketId,
    userId: user.userId,
    marketIdType: typeof marketId,
    isNumber: !isNaN(Number(marketId))
  }, 'POST /api/markets/predictions/[id]/buy');

  // Parse and validate request body with schema
  const body = await request.json();
  const { side, amount } = PredictionMarketTradeSchema.parse(body);

  logger.info('Buy request params', {
    marketId,
    side,
    amount,
    userId: user.userId
  }, 'POST /api/markets/predictions/[id]/buy');

  // Check balance first (before RLS transaction)
  const hasFunds = await WalletService.hasSufficientBalance(user.userId, amount);
  if (!hasFunds) {
    const balance = await WalletService.getBalance(user.userId);
    throw new InsufficientFundsError(amount, Number(balance.balance), 'USD');
  }

  // Execute trade with RLS
  const { position, calculation } = await asUser(user, async (db) => {
    // Get or create market from question
    logger.info('Step 4: Looking up market/question', { marketId }, 'POST /api/markets/predictions/[id]/buy');
    
    // First try to find Market by ID
    let market = await db.market.findUnique({
      where: { id: marketId },
    });
    logger.info('Step 4a: Market lookup result', { found: !!market }, 'POST /api/markets/predictions/[id]/buy');

    // If market doesn't exist, try to find Question and create Market
    if (!market) {
      logger.info('Step 4b: Market not found, looking for question', { marketId }, 'POST /api/markets/predictions/[id]/buy');
      
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
      logger.info('Step 4c: Question by ID lookup', { found: !!question }, 'POST /api/markets/predictions/[id]/buy');
      
      if (!question && !isNaN(Number(marketId))) {
        logger.info('Step 4d: Trying question by number', { questionNumber: parseInt(marketId, 10) }, 'POST /api/markets/predictions/[id]/buy');
        const questions = await questionModel.question.findMany({
          where: { questionNumber: parseInt(marketId, 10) },
          orderBy: { createdDate: 'desc' },
          take: 1,
        });
        question = questions[0] || null;
        logger.info('Step 4e: Question by number result', { found: !!question, questionId: question?.id }, 'POST /api/markets/predictions/[id]/buy');
      }

      if (!question) {
        logger.error('Neither market nor question found', { marketId }, 'POST /api/markets/predictions/[id]/buy');
        throw new NotFoundError('Market or Question', marketId);
      }

      if (question.status !== 'active') {
        throw new BusinessLogicError(`Question is ${question.status}, cannot trade`, 'QUESTION_INACTIVE', { status: question.status, marketId });
      }

      if (new Date(question.resolutionDate) < new Date()) {
        throw new BusinessLogicError('Question has expired', 'QUESTION_EXPIRED', { marketId, resolutionDate: question.resolutionDate });
      }

      logger.info('Step 4f: Creating market from question', { 
        questionId: question.id,
        questionNumber: question.questionNumber 
      }, 'POST /api/markets/predictions/[id]/buy');
      
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

      logger.info(`Auto-created market from question`, { 
        marketId: market.id,
        questionId: question.id, 
        questionNumber: question.questionNumber 
      }, 'POST /api/markets/predictions/[id]/buy');
    }
    
    logger.info('Step 5: Market ready', { marketId: market.id }, 'POST /api/markets/predictions/[id]/buy');

    // Check if market is still active
    if (market.resolved) {
      throw new BusinessLogicError('Market has already resolved', 'MARKET_RESOLVED', { marketId });
    }

    if (new Date() > market.endDate) {
      throw new BusinessLogicError('Market has expired', 'MARKET_EXPIRED', { marketId, endDate: market.endDate });
    }

    // Calculate shares using AMM with fees
    const calc = PredictionPricing.calculateBuyWithFees(
      Number(market.yesShares),
      Number(market.noShares),
      side,
      amount
    );

    // Debit total cost (includes fee) from balance
    await WalletService.debit(
      user.userId,
      amount,
      'pred_buy',
      `Bought ${side.toUpperCase()} shares in: ${market.question}`,
      marketId
    );

    // Update market shares (use net amount, not total with fee)
    const updated = await db.market.update({
      where: { id: marketId },
      data: {
        yesShares: new Prisma.Decimal(calc.newYesPrice * (Number(market.yesShares) + Number(market.noShares))),
        noShares: new Prisma.Decimal(calc.newNoPrice * (Number(market.yesShares) + Number(market.noShares))),
        liquidity: {
          increment: new Prisma.Decimal(calc.netAmount),
        },
      },
    });

    // Create or update position
    const existingPosition = await db.position.findFirst({
      where: {
        userId: user.userId,
        marketId,
      },
    });

    let pos;
    if (existingPosition) {
      const newTotalShares = Number(existingPosition.shares) + calc.sharesBought;
      const newAvgPrice =
        (Number(existingPosition.avgPrice) * Number(existingPosition.shares) +
          calc.avgPrice * calc.sharesBought) /
        newTotalShares;

      pos = await db.position.update({
        where: { id: existingPosition.id },
        data: {
          shares: new Prisma.Decimal(newTotalShares),
          avgPrice: new Prisma.Decimal(newAvgPrice),
        },
      });
    } else {
      pos = await db.position.create({
        data: {
          userId: user.userId,
          marketId,
          side: side === 'yes',
          shares: new Prisma.Decimal(calc.sharesBought),
          avgPrice: new Prisma.Decimal(calc.avgPrice),
        },
      });
    }

    return { position: pos, market: updated, calculation: calc };
  });

  // Process trading fee and distribute to referrer if applicable
  const feeResult = await FeeService.processTradingFee(
    user.userId,
    FEE_CONFIG.FEE_TYPES.PRED_BUY,
    amount,
    position.id,
    marketId
  );

  logger.info(`Trade completed with fee`, {
    userId: user.userId,
    marketId,
    amount,
    fee: feeResult.feeCharged,
    referrerPaid: feeResult.referrerPaid,
  }, 'POST /api/markets/predictions/[id]/buy');

  // Log agent activity (if agent)
  if (user.isAgent) {
    logger.info(`Agent ${user.userId} placed trade: ${side.toUpperCase()} $${amount} on market ${marketId}`, undefined, 'POST /api/markets/predictions/[id]/buy')
  }

  const newBalance = await WalletService.getBalance(user.userId);

  // Track prediction buy event
  trackServerEvent(user.userId, 'prediction_bought', {
    marketId,
    side,
    amount,
    sharesBought: calculation.sharesBought,
    avgPrice: calculation.avgPrice,
    priceImpact: calculation.priceImpact,
    feeCharged: feeResult.feeCharged,
    newYesPrice: calculation.newYesPrice,
    newNoPrice: calculation.newNoPrice,
  }).catch((error) => {
    logger.warn('Failed to track prediction_bought event', { error });
  });

  return successResponse(
    {
      position: {
        id: position.id,
        marketId: position.marketId,
        side: side,
        shares: Number(position.shares),
        avgPrice: Number(position.avgPrice),
        totalCost: amount,
      },
      market: {
        yesPrice: calculation.newYesPrice,
        noPrice: calculation.newNoPrice,
        priceImpact: calculation.priceImpact,
      },
      fee: {
        amount: feeResult.feeCharged,
        referrerPaid: feeResult.referrerPaid,
      },
      newBalance: newBalance.balance,
    },
    201
  );
});

