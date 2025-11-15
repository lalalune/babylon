import { type AuthenticatedUser } from '@/lib/api/auth-middleware';
import { FEE_CONFIG } from '@/lib/config/fees';
import { asUser } from '@/lib/db/context';
import {
  AuthorizationError,
  BusinessLogicError,
  InsufficientFundsError,
  InternalServerError,
  NotFoundError,
} from '@/lib/errors';
import { logger } from '@/lib/logger';
import { cachedDb } from '@/lib/cached-database-service';
import { getReadyPerpsEngine } from '@/lib/perps-service';
import { prisma } from '@/lib/prisma';
import { FeeService } from '@/lib/services/fee-service';
import type { TradeImpactInput } from '@/lib/services/market-impact-service';
import { applyPerpTradeImpacts } from '@/lib/services/perp-price-impact-service';
import { WalletService } from '@/lib/services/wallet-service';
import { generateSnowflakeId } from '@/lib/snowflake';

import type { PerpPosition } from '@/shared/perps-types';

type TradeSide = 'long' | 'short';

export interface OpenPerpPositionInput {
  ticker: string;
  side: TradeSide;
  size: number;
  leverage: number;
}

export interface OpenPerpPositionResult {
  position: PerpPosition;
  marginPaid: number;
  fee: {
    feeCharged: number;
    referrerPaid: number;
    platformReceived: number;
    referrerId: string | null;
  };
  newBalance: number;
}

export interface ClosePerpPositionResult {
  position: PerpPosition;
  realizedPnL: number;
  marginReturned: number;
  grossSettlement: number;
  netSettlement: number;
  wasLiquidated: boolean;
  fee: {
    feeCharged: number;
    referrerPaid: number;
    platformReceived: number;
    referrerId: string | null;
  };
  newBalance: number;
}

export function resolveExitPrice(options: {
  enginePrice?: number | null;
  organizationPrice?: number | null;
  positionPrice?: number | null;
  entryPrice: number;
}): number {
  const normalize = (value?: number | null): number | null => {
    if (value === undefined || value === null) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  return (
    normalize(options.enginePrice) ??
    normalize(options.positionPrice) ??
    normalize(options.organizationPrice) ??
    options.entryPrice
  );
}

export class PerpTradeService {
  static async openPosition(
    authUser: AuthenticatedUser,
    input: OpenPerpPositionInput
  ): Promise<OpenPerpPositionResult> {
    const perpsEngine = await getReadyPerpsEngine();

    const markets = perpsEngine.getMarkets();
    const market = markets.find((m) => m.ticker === input.ticker);

    if (!market) {
      throw new NotFoundError('Market', input.ticker);
    }

    const maxPositionSize = market.openInterest * 0.1;
    const minPositionSize = market.minOrderSize;
    const size = input.size;

    if (size < minPositionSize) {
      throw new BusinessLogicError(
        `Position size too small. Minimum: $${minPositionSize}`,
        'POSITION_SIZE_TOO_SMALL',
        { min: minPositionSize, requested: size }
      );
    }

    if (size > maxPositionSize && maxPositionSize > 0) {
      throw new BusinessLogicError(
        `Position size too large. Maximum: $${maxPositionSize.toFixed(2)}`,
        'POSITION_SIZE_TOO_LARGE',
        { max: maxPositionSize, requested: size }
      );
    }

    const marginRequired = size / input.leverage;
    const feeCalc = FeeService.calculateFee(size);
    const totalCost = marginRequired + feeCalc.feeAmount;

    const hasFunds = await WalletService.hasSufficientBalance(
      authUser.userId,
      totalCost
    );
    if (!hasFunds) {
      const balance = await WalletService.getBalance(authUser.userId);
      throw new InsufficientFundsError(
        totalCost,
        Number(balance.balance),
        'USD'
      );
    }

    const position = perpsEngine.openPosition(authUser.userId, {
      ticker: input.ticker,
      side: input.side,
      size,
      leverage: input.leverage,
      orderType: 'market',
    });

    try {
      await asUser(authUser, async (db) => {
        const dbUser = await db.user.findUnique({
          where: { id: authUser.userId },
          select: { id: true, virtualBalance: true },
        });

        if (!dbUser) {
          throw new NotFoundError('User', authUser.userId);
        }

        if (dbUser.virtualBalance === null) {
          throw new InternalServerError('User balance not initialized', {
            userId: authUser.userId,
          });
        }

        const currentBalance = Number(dbUser.virtualBalance);
        if (currentBalance < totalCost) {
          throw new InsufficientFundsError(totalCost, currentBalance, 'USD');
        }

        const newBalance = currentBalance - totalCost;

        await db.user.update({
          where: { id: authUser.userId },
          data: {
            virtualBalance: newBalance,
          },
        });

        await db.balanceTransaction.create({
          data: {
            id: await generateSnowflakeId(),
            userId: authUser.userId,
            type: 'perp_open',
            amount: -totalCost,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            relatedId: position.id,
            description: `Opened ${input.leverage}x ${input.side} position on ${input.ticker} (incl. $${feeCalc.feeAmount.toFixed(2)} fee)`,
          },
        });

        await db.perpPosition.create({
          data: {
            id: position.id,
            userId: authUser.userId,
            ticker: position.ticker,
            organizationId: position.organizationId,
            side: position.side,
            entryPrice: position.entryPrice,
            currentPrice: position.currentPrice,
            size: position.size,
            leverage: position.leverage,
            liquidationPrice: position.liquidationPrice,
            unrealizedPnL: position.unrealizedPnL,
            unrealizedPnLPercent: position.unrealizedPnLPercent,
            fundingPaid: position.fundingPaid,
            lastUpdated: new Date(),
          },
        });
      });
    } catch (error) {
      perpsEngine.closePosition(position.id);
      throw error;
    }

    const feeResult = await FeeService.processTradingFee(
      authUser.userId,
      FEE_CONFIG.FEE_TYPES.PERP_OPEN,
      size,
      position.id,
      input.ticker
    );

    await cachedDb.invalidateUserCache(authUser.userId).catch((error) => {
      logger.error(
        'Failed to invalidate user cache after perp open',
        { userId: authUser.userId, error },
        'PerpTradeService.openPosition'
      );
    });

    const tradeImpact: TradeImpactInput = {
      marketType: 'perp',
      ticker: input.ticker,
      side: input.side,
      size,
    };

    await applyPerpTradeImpacts([tradeImpact]);

    const newBalance = (await WalletService.getBalance(authUser.userId))
      .balance;

    return {
      position,
      marginPaid: marginRequired,
      fee: feeResult,
      newBalance,
    };
  }

  static async closePosition(
    authUser: AuthenticatedUser,
    positionId: string
  ): Promise<ClosePerpPositionResult> {
    const perpsEngine = await getReadyPerpsEngine();

    const dbPosition = await asUser(authUser, async (db) => {
      return await db.perpPosition.findUnique({
        where: { id: positionId },
      });
    });

    if (!dbPosition) {
      throw new NotFoundError('Position', positionId);
    }

    if (dbPosition.userId !== authUser.userId) {
      throw new AuthorizationError('Not your position', 'position', 'close');
    }

    if (dbPosition.closedAt) {
      throw new BusinessLogicError(
        'Position already closed',
        'POSITION_CLOSED',
        { positionId, closedAt: dbPosition.closedAt }
      );
    }

    if (!perpsEngine.hasPosition(positionId)) {
      perpsEngine.hydratePosition({
        id: dbPosition.id,
        userId: dbPosition.userId,
        ticker: dbPosition.ticker,
        organizationId: dbPosition.organizationId,
        side: dbPosition.side as 'long' | 'short',
        entryPrice: Number(dbPosition.entryPrice),
        currentPrice: Number(dbPosition.currentPrice),
        size: Number(dbPosition.size),
        leverage: Number(dbPosition.leverage),
        liquidationPrice: Number(dbPosition.liquidationPrice),
        unrealizedPnL: Number(dbPosition.unrealizedPnL),
        unrealizedPnLPercent: Number(dbPosition.unrealizedPnLPercent),
        fundingPaid: Number(dbPosition.fundingPaid),
        openedAt: dbPosition.openedAt,
        lastUpdated: dbPosition.lastUpdated ?? dbPosition.openedAt,
      });
    }

    const latestOrganization = await prisma.organization.findUnique({
      where: { id: dbPosition.organizationId },
      select: { currentPrice: true },
    });

    const enginePosition = perpsEngine.getPosition(positionId);

    const exitPrice = resolveExitPrice({
      enginePrice: enginePosition?.currentPrice ?? null,
      organizationPrice: latestOrganization?.currentPrice
        ? Number(latestOrganization.currentPrice)
        : null,
      positionPrice: dbPosition.currentPrice
        ? Number(dbPosition.currentPrice)
        : null,
      entryPrice: Number(dbPosition.entryPrice),
    });

    if (!enginePosition) {
      logger.warn(
        'Engine position missing during close, relying on DB snapshot',
        { positionId },
        'PerpTradeService.closePosition'
      );
    }

    const { position, realizedPnL } = perpsEngine.closePosition(
      positionId,
      exitPrice
    );

    logger.debug(
      'Resolved exit price for perp close',
      {
        positionId,
        enginePrice: enginePosition?.currentPrice ?? null,
        prismaPositionPrice: dbPosition.currentPrice
          ? Number(dbPosition.currentPrice)
          : null,
        organizationPrice: latestOrganization?.currentPrice
          ? Number(latestOrganization.currentPrice)
          : null,
        exitPrice,
      },
      'PerpTradeService.closePosition'
    );

    const marginPaid = position.size / position.leverage;
    const grossSettlement = marginPaid + realizedPnL;

    const feeCalc = FeeService.calculateFee(position.size);
    const netSettlement = Math.max(0, grossSettlement - feeCalc.feeAmount);

    if (netSettlement > 0) {
      await WalletService.credit(
        authUser.userId,
        netSettlement,
        'perp_close',
        `Closed ${position.leverage}x ${position.side} ${position.ticker} - PnL: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)} (fee: $${feeCalc.feeAmount.toFixed(2)})`,
        position.id
      );
    } else {
      logger.info(
        'Position closed with total loss or fees exceeded settlement',
        {
          positionId,
          marginPaid,
          realizedPnL,
          grossSettlement,
          fee: feeCalc.feeAmount,
          netSettlement,
          userId: authUser.userId,
        },
        'PerpTradeService.closePosition'
      );
    }

    await WalletService.recordPnL(
      authUser.userId,
      realizedPnL,
      'perp_close',
      position.id
    );

    await asUser(authUser, async (db) => {
      try {
        await db.perpPosition.update({
          where: { id: positionId },
          data: {
            closedAt: new Date(),
            realizedPnL: realizedPnL,
            currentPrice: position.currentPrice,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
            lastUpdated: new Date(),
          },
        });
      } catch (error: unknown) {
        // Handle case where position was deleted between fetch and update
        if ((error as { code?: string })?.code === 'P2025') {
          logger.warn(
            'Position not found during update (may have been deleted)',
            { positionId, userId: authUser.userId },
            'PerpTradeService.closePosition'
          );
          // Position doesn't exist - this is okay, it may have been deleted
          // The position was already closed in the engine, so we can continue
          return;
        }
        throw error;
      }
    });

    const feeResult =
      grossSettlement > 0
        ? await FeeService.processTradingFee(
            authUser.userId,
            FEE_CONFIG.FEE_TYPES.PERP_CLOSE,
            position.size,
            position.id,
            position.ticker
          )
        : {
            feeCharged: 0,
            referrerPaid: 0,
            platformReceived: 0,
            referrerId: null,
          };

    const closingImpact: TradeImpactInput = {
      marketType: 'perp',
      ticker: position.ticker,
      side: position.side === 'long' ? 'short' : 'long',
      size: position.size,
    };

    await applyPerpTradeImpacts([closingImpact]);

    const newBalance = (await WalletService.getBalance(authUser.userId))
      .balance;

    return {
      position,
      realizedPnL,
      marginReturned: marginPaid,
      grossSettlement,
      netSettlement,
      wasLiquidated: netSettlement === 0,
      fee: feeResult,
      newBalance,
    };
  }
}
