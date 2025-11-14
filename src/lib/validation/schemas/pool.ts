/**
 * Pool-related validation schemas
 */

import { z } from 'zod';
import {
  UUIDSchema,
  UserIdSchema,
  DecimalPercentageSchema,
  createTrimmedStringSchema,
  NumericStringSchema,
  DateTimeSchema
} from './common';

/**
 * Create pool schema
 */
export const CreatePoolSchema = z.object({
  name: createTrimmedStringSchema(1, 100),
  description: createTrimmedStringSchema(undefined, 500).optional(),
  npcActorId: UUIDSchema,
  performanceFeeRate: DecimalPercentageSchema.default(0.08), // 8% default
  initialCapital: z.number().positive().optional()
});

/**
 * Update pool schema
 */
export const UpdatePoolSchema = z.object({
  name: createTrimmedStringSchema(1, 100).optional(),
  description: createTrimmedStringSchema(undefined, 500).optional(),
  performanceFeeRate: DecimalPercentageSchema.optional(),
  isActive: z.boolean().optional()
});

/**
 * Pool deposit schema (with poolId in body)
 */
export const CreatePoolDepositSchema = z.object({
  poolId: UUIDSchema,
  amount: z.number().positive().min(100, 'Minimum deposit is $100').max(1000000, 'Maximum deposit is $1M')
});

/**
 * Pool deposit body schema (poolId from route params)
 */
export const PoolDepositBodySchema = z.object({
  userId: UserIdSchema,
  amount: z.number().positive().min(100, { message: 'Minimum deposit is $100' }).max(1000000, { message: 'Maximum deposit is $1M' })
});

/**
 * Pool withdrawal body schema (poolId from route params)
 */
export const PoolWithdrawBodySchema = z.object({
  userId: UserIdSchema,
  depositId: UUIDSchema
});

/**
 * Pool withdrawal schema
 */
export const CreatePoolWithdrawalSchema = z.object({
  poolId: UUIDSchema,
  shares: z.number().positive().optional(), // Withdraw specific shares
  percentage: DecimalPercentageSchema.optional(), // Or withdraw percentage
  amount: z.number().positive().optional() // Or withdraw specific amount
}).refine(
  data => {
    // Exactly one withdrawal method must be specified
    const methods = [data.shares, data.percentage, data.amount].filter(Boolean);
    return methods.length === 1;
  },
  {
    message: 'Specify exactly one of: shares, percentage, or amount'
  }
);

/**
 * Pool position schema
 */
export const PoolPositionSchema = z.object({
  id: UUIDSchema,
  poolId: UUIDSchema,
  marketType: z.enum(['perp', 'prediction']),
  ticker: z.string().nullable(),
  marketId: z.string().nullable(),
  side: z.string(), // 'long'/'short' or 'YES'/'NO'
  entryPrice: z.number(),
  currentPrice: z.number(),
  size: z.number(),
  shares: z.number().nullable(),
  leverage: z.number().min(1).max(100).nullable(),
  liquidationPrice: z.number().nullable(),
  unrealizedPnL: z.number(),
  openedAt: DateTimeSchema,
  closedAt: DateTimeSchema.nullable(),
  realizedPnL: z.number().nullable()
});

/**
 * Pool trade schema (for NPC trades)
 */
export const CreateNPCTradeSchema = z.object({
  poolId: UUIDSchema.optional(),
  marketType: z.enum(['perp', 'prediction']),
  ticker: z.string().optional(),
  marketId: z.string().optional(),
  action: z.enum(['buy', 'sell', 'open_long', 'open_short', 'close']),
  side: z.enum(['long', 'short', 'YES', 'NO']).optional(),
  amount: z.number().positive(),
  price: z.number().positive(),
  sentiment: z.number().min(-1).max(1).optional(),
  reason: z.string().max(500).optional(),
  postId: UUIDSchema.optional()
}).refine(
  data => {
    // Validate market identifiers based on type
    if (data.marketType === 'perp') {
      return !!data.ticker;
    } else if (data.marketType === 'prediction') {
      return !!data.marketId;
    }
    return true;
  },
  {
    message: 'Perp trades require ticker, prediction trades require marketId'
  }
);

/**
 * Pool query filters
 */
export const PoolQuerySchema = z.object({
  isActive: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  npcActorId: UUIDSchema.optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  hasOpenPositions: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  sortBy: z.enum(['totalValue', 'lifetimePnL', 'performanceFeeRate', 'totalDeposits', 'createdAt']).optional(),
  search: z.string().optional()
});

/**
 * Pool performance metrics schema
 */
export const PoolPerformanceSchema = z.object({
  poolId: UUIDSchema,
  period: z.enum(['1d', '7d', '30d', '90d', '365d', 'all']),
  metrics: z.object({
    totalReturn: z.number(),
    absoluteReturn: z.number(),
    sharpeRatio: z.number().optional(),
    maxDrawdown: z.number(),
    winRate: z.number(),
    avgWin: z.number(),
    avgLoss: z.number(),
    totalTrades: z.number()
  })
});

/**
 * Pool response schema
 */
export const PoolResponseSchema = z.object({
  id: UUIDSchema,
  npcActorId: UUIDSchema,
  name: z.string(),
  description: z.string().nullable(),
  totalValue: NumericStringSchema, // Decimal as string
  totalDeposits: NumericStringSchema,
  availableBalance: NumericStringSchema,
  lifetimePnL: NumericStringSchema,
  performanceFeeRate: z.number(),
  totalFeesCollected: NumericStringSchema,
  isActive: z.boolean(),
  openedAt: DateTimeSchema,
  closedAt: DateTimeSchema.nullable(),
  updatedAt: DateTimeSchema,

  // Include relationships optionally
  npcActor: z.object({
    id: UUIDSchema,
    name: z.string(),
    description: z.string().nullable(),
    tier: z.string(),
    personality: z.string().nullable()
  }).optional(),

  deposits: z.array(z.object({
    id: UUIDSchema,
    userId: UUIDSchema,
    amount: NumericStringSchema,
    shares: NumericStringSchema,
    currentValue: NumericStringSchema,
    unrealizedPnL: NumericStringSchema,
    depositedAt: DateTimeSchema,
    withdrawnAt: DateTimeSchema.nullable()
  })).optional(),

  positions: z.array(PoolPositionSchema).optional(),

  _count: z.object({
    deposits: z.number(),
    positions: z.number(),
    trades: z.number()
  }).optional()
});

/**
 * Pool list response schema
 */
export const PoolListResponseSchema = z.object({
  pools: z.array(PoolResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number()
});

/**
 * Pool deposit response schema
 */
export const PoolDepositResponseSchema = z.object({
  id: UUIDSchema,
  poolId: UUIDSchema,
  userId: UUIDSchema,
  amount: NumericStringSchema,
  shares: NumericStringSchema,
  currentValue: NumericStringSchema,
  unrealizedPnL: NumericStringSchema,
  depositedAt: DateTimeSchema,
  withdrawnAt: DateTimeSchema.nullable(),
  withdrawnAmount: NumericStringSchema.nullable()
});

/**
 * Pool stats schema
 */
export const PoolStatsSchema = z.object({
  totalPools: z.number(),
  activePools: z.number(),
  totalValueLocked: NumericStringSchema,
  totalDeposits: NumericStringSchema,
  totalFeesCollected: NumericStringSchema,
  averagePerformance: z.number(),
  topPerformingPool: PoolResponseSchema.optional()
});