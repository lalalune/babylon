#!/usr/bin/env bun
/**
 * Apply A2A Performance Indexes (one-time after reset)
 */

import { prisma } from '@/lib/prisma';

async function applyIndexes() {
  console.log('🚀 Applying A2A performance indexes...\n');
  
  const indexes = `
    -- Position queries optimization
    CREATE INDEX IF NOT EXISTS "idx_perp_position_user_open" ON "PerpPosition"("userId", "closedAt") WHERE "closedAt" IS NULL;
    CREATE INDEX IF NOT EXISTS "idx_position_user_status" ON "Position"("userId", "status");
    CREATE INDEX IF NOT EXISTS "idx_position_user_created" ON "Position"("userId", "createdAt" DESC);

    -- Trade history optimization
    CREATE INDEX IF NOT EXISTS "idx_npc_trade_actor_time" ON "NPCTrade"("npcActorId", "executedAt" DESC);
    CREATE INDEX IF NOT EXISTS "idx_agent_trade_market" ON "AgentTrade"("marketType", "marketId");

    -- Post/Feed optimization
    CREATE INDEX IF NOT EXISTS "idx_post_created_desc" ON "Post"("createdAt" DESC);
    CREATE INDEX IF NOT EXISTS "idx_post_timestamp_desc" ON "Post"("timestamp" DESC);
    CREATE INDEX IF NOT EXISTS "idx_post_game_day" ON "Post"("gameId", "dayNumber", "createdAt" DESC);

    -- Notification optimization
    CREATE INDEX IF NOT EXISTS "idx_notification_user_created" ON "Notification"("userId", "createdAt" DESC);
    CREATE INDEX IF NOT EXISTS "idx_notification_user_unread" ON "Notification"("userId", "isRead", "createdAt" DESC) WHERE "isRead" = FALSE;

    -- Chat/Message optimization
    CREATE INDEX IF NOT EXISTS "idx_message_chat_created" ON "Message"("chatId", "createdAt" DESC);
    CREATE INDEX IF NOT EXISTS "idx_message_chat_active" ON "Message"("chatId", "createdAt") WHERE "deletedAt" IS NULL;

    -- Referral optimization
    CREATE INDEX IF NOT EXISTS "idx_user_referral_code" ON "User"("referralCode") WHERE "referralCode" IS NOT NULL;
    CREATE INDEX IF NOT EXISTS "idx_user_referred_by" ON "User"("referredBy") WHERE "referredBy" IS NOT NULL;

    -- Leaderboard optimization
    CREATE INDEX IF NOT EXISTS "idx_user_reputation_desc" ON "User"("reputationPoints" DESC) WHERE "reputationPoints" > 0;
    CREATE INDEX IF NOT EXISTS "idx_user_lifetime_pnl_desc" ON "User"("lifetimePnL" DESC);
    CREATE INDEX IF NOT EXISTS "idx_user_virtual_balance_desc" ON "User"("virtualBalance" DESC);
    CREATE INDEX IF NOT EXISTS "idx_user_last_active" ON "User"("lastActive" DESC) WHERE "lastActive" IS NOT NULL;

    -- Market optimization
    CREATE INDEX IF NOT EXISTS "idx_market_end_date" ON "Market"("endDate" DESC);
    CREATE INDEX IF NOT EXISTS "idx_market_game_day" ON "Market"("gameId", "dayNumber");

    -- Pool optimization
    CREATE INDEX IF NOT EXISTS "idx_pool_deposit_user" ON "PoolDeposit"("userId");
    CREATE INDEX IF NOT EXISTS "idx_pool_deposit_active" ON "PoolDeposit"("userId", "withdrawnAt") WHERE "withdrawnAt" IS NULL;
    CREATE INDEX IF NOT EXISTS "idx_pool_actor" ON "Pool"("npcActorId");

    -- Update statistics
    ANALYZE;
  `;

  try {
    await prisma.$executeRawUnsafe(indexes);
    console.log('✅ A2A performance indexes applied successfully!\n');
  } catch (error) {
    console.error('❌ Error applying indexes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyIndexes();

