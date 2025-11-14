/**
 * Admin API: Game Statistics
 * GET /api/admin/game-stats
 * 
 * Returns comprehensive game simulation statistics including:
 * - Game state (running/paused, ticks)
 * - Content generation metrics (posts, articles, chats, messages)
 * - LLM usage statistics
 * - Rate calculations (per minute metrics)
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  logger.info('Admin game stats requested', {}, 'GET /api/admin/game-stats');

  // Get time windows for rate calculations
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Run all queries in parallel for efficiency
  const [
    // Game state
    gameState,
    
    // Total counts
    totalPosts,
    totalArticles,
    totalGroupChats,
    totalChatMessages,
    totalLLMCalls,
    
    // Recent counts (last 24 hours)
    postsLast24h,
    articlesLast24h,
    groupChatsLast24h,
    messagesLast24h,
    llmCallsLast24h,
    
    // Recent counts (last hour)
    postsLastHour,
    articlesLastHour,
    groupChatsLastHour,
    messagesLastHour,
    llmCallsLastHour,
    
    // Recent counts (last 5 minutes)
    postsLast5Min,
    articlesLast5Min,
    messagesLast5Min,
    llmCallsLast5Min,
    
    // Recent counts (last minute)
    postsLastMinute,
    articlesLastMinute,
    messagesLastMinute,
    llmCallsLastMinute,
    
    // Token usage stats (last 24h)
    llmTokenStats,
  ] = await Promise.all([
    // Game state
    prisma.game.findFirst({
      where: { isContinuous: true },
      select: {
        id: true,
        isRunning: true,
        currentDay: true,
        currentDate: true,
        startedAt: true,
        pausedAt: true,
        lastTickAt: true,
        speed: true,
      },
    }),
    
    // Total counts
    prisma.post.count({
      where: { type: 'post', deletedAt: null },
    }),
    prisma.post.count({
      where: { type: 'article', deletedAt: null },
    }),
    prisma.chat.count({
      where: { isGroup: true },
    }),
    prisma.message.count(),
    prisma.llmCallLog.count(),
    
    // Last 24 hours
    prisma.post.count({
      where: { 
        type: 'post',
        deletedAt: null,
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
    prisma.post.count({
      where: { 
        type: 'article',
        deletedAt: null,
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
    prisma.chat.count({
      where: { 
        isGroup: true,
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),
    prisma.message.count({
      where: { createdAt: { gte: twentyFourHoursAgo } },
    }),
    prisma.llmCallLog.count({
      where: { timestamp: { gte: twentyFourHoursAgo } },
    }),
    
    // Last hour
    prisma.post.count({
      where: { 
        type: 'post',
        deletedAt: null,
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.post.count({
      where: { 
        type: 'article',
        deletedAt: null,
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.chat.count({
      where: { 
        isGroup: true,
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.message.count({
      where: { createdAt: { gte: oneHourAgo } },
    }),
    prisma.llmCallLog.count({
      where: { timestamp: { gte: oneHourAgo } },
    }),
    
    // Last 5 minutes
    prisma.post.count({
      where: { 
        type: 'post',
        deletedAt: null,
        createdAt: { gte: fiveMinutesAgo },
      },
    }),
    prisma.post.count({
      where: { 
        type: 'article',
        deletedAt: null,
        createdAt: { gte: fiveMinutesAgo },
      },
    }),
    prisma.message.count({
      where: { createdAt: { gte: fiveMinutesAgo } },
    }),
    prisma.llmCallLog.count({
      where: { timestamp: { gte: fiveMinutesAgo } },
    }),
    
    // Last minute
    prisma.post.count({
      where: { 
        type: 'post',
        deletedAt: null,
        createdAt: { gte: oneMinuteAgo },
      },
    }),
    prisma.post.count({
      where: { 
        type: 'article',
        deletedAt: null,
        createdAt: { gte: oneMinuteAgo },
      },
    }),
    prisma.message.count({
      where: { createdAt: { gte: oneMinuteAgo } },
    }),
    prisma.llmCallLog.count({
      where: { timestamp: { gte: oneMinuteAgo } },
    }),
    
    // LLM token usage (last 24h)
    prisma.llmCallLog.aggregate({
      where: { timestamp: { gte: twentyFourHoursAgo } },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      _avg: {
        latencyMs: true,
      },
    }),
  ]);

  if (!gameState) {
    return successResponse({
      error: 'No game state found',
      gameState: null,
      stats: null,
    });
  }

  // Calculate tick statistics
  const uptimeMs = gameState.startedAt 
    ? now.getTime() - gameState.startedAt.getTime()
    : 0;
  const uptimeMinutes = uptimeMs / (1000 * 60);
  const uptimeHours = uptimeMinutes / 60;
  
  // Calculate time since last tick
  const timeSinceLastTickMs = gameState.lastTickAt
    ? now.getTime() - gameState.lastTickAt.getTime()
    : null;
  
  // Estimate total ticks (based on game speed and uptime)
  const tickIntervalMs = gameState.speed || 60000;
  const estimatedTotalTicks = gameState.isRunning && gameState.startedAt
    ? Math.floor(uptimeMs / tickIntervalMs)
    : 0;

  // Calculate per-minute rates
  const rates = {
    // Per minute (instantaneous rate from last minute)
    postsPerMinute: postsLastMinute,
    articlesPerMinute: articlesLastMinute,
    messagesPerMinute: messagesLastMinute,
    llmCallsPerMinute: llmCallsLastMinute,
    
    // Average per minute over last hour
    postsPerMinuteAvgHour: uptimeMinutes > 60 ? postsLastHour / 60 : 0,
    articlesPerMinuteAvgHour: uptimeMinutes > 60 ? articlesLastHour / 60 : 0,
    messagesPerMinuteAvgHour: uptimeMinutes > 60 ? messagesLastHour / 60 : 0,
    llmCallsPerMinuteAvgHour: uptimeMinutes > 60 ? llmCallsLastHour / 60 : 0,
    
    // Average per minute over last 24 hours
    postsPerMinuteAvgDay: uptimeMinutes > 0 ? postsLast24h / Math.min(uptimeMinutes, 1440) : 0,
    articlesPerMinuteAvgDay: uptimeMinutes > 0 ? articlesLast24h / Math.min(uptimeMinutes, 1440) : 0,
    messagesPerMinuteAvgDay: uptimeMinutes > 0 ? messagesLast24h / Math.min(uptimeMinutes, 1440) : 0,
    llmCallsPerMinuteAvgDay: uptimeMinutes > 0 ? llmCallsLast24h / Math.min(uptimeMinutes, 1440) : 0,
  };

  // Calculate messages per group chat
  const avgMessagesPerChat = totalGroupChats > 0 
    ? totalChatMessages / totalGroupChats 
    : 0;

  return successResponse({
    gameState: {
      id: gameState.id,
      isRunning: gameState.isRunning,
      currentDay: gameState.currentDay,
      currentDate: gameState.currentDate.toISOString(),
      startedAt: gameState.startedAt?.toISOString() || null,
      pausedAt: gameState.pausedAt?.toISOString() || null,
      lastTickAt: gameState.lastTickAt?.toISOString() || null,
      timeSinceLastTickMs,
      tickIntervalMs,
      uptimeMs,
      uptimeMinutes: Math.round(uptimeMinutes * 10) / 10,
      uptimeHours: Math.round(uptimeHours * 10) / 10,
      estimatedTotalTicks,
    },
    totals: {
      posts: totalPosts,
      articles: totalArticles,
      groupChats: totalGroupChats,
      chatMessages: totalChatMessages,
      llmCalls: totalLLMCalls,
      avgMessagesPerChat: Math.round(avgMessagesPerChat * 10) / 10,
    },
    last24Hours: {
      posts: postsLast24h,
      articles: articlesLast24h,
      groupChats: groupChatsLast24h,
      messages: messagesLast24h,
      llmCalls: llmCallsLast24h,
    },
    lastHour: {
      posts: postsLastHour,
      articles: articlesLastHour,
      groupChats: groupChatsLastHour,
      messages: messagesLastHour,
      llmCalls: llmCallsLastHour,
    },
    last5Minutes: {
      posts: postsLast5Min,
      articles: articlesLast5Min,
      messages: messagesLast5Min,
      llmCalls: llmCallsLast5Min,
    },
    lastMinute: {
      posts: postsLastMinute,
      articles: articlesLastMinute,
      messages: messagesLastMinute,
      llmCalls: llmCallsLastMinute,
    },
    rates: {
      // Round to 2 decimal places
      postsPerMinute: Math.round(rates.postsPerMinute * 100) / 100,
      articlesPerMinute: Math.round(rates.articlesPerMinute * 100) / 100,
      messagesPerMinute: Math.round(rates.messagesPerMinute * 100) / 100,
      llmCallsPerMinute: Math.round(rates.llmCallsPerMinute * 100) / 100,
      postsPerMinuteAvgHour: Math.round(rates.postsPerMinuteAvgHour * 100) / 100,
      articlesPerMinuteAvgHour: Math.round(rates.articlesPerMinuteAvgHour * 100) / 100,
      messagesPerMinuteAvgHour: Math.round(rates.messagesPerMinuteAvgHour * 100) / 100,
      llmCallsPerMinuteAvgHour: Math.round(rates.llmCallsPerMinuteAvgHour * 100) / 100,
      postsPerMinuteAvgDay: Math.round(rates.postsPerMinuteAvgDay * 100) / 100,
      articlesPerMinuteAvgDay: Math.round(rates.articlesPerMinuteAvgDay * 100) / 100,
      messagesPerMinuteAvgDay: Math.round(rates.messagesPerMinuteAvgDay * 100) / 100,
      llmCallsPerMinuteAvgDay: Math.round(rates.llmCallsPerMinuteAvgDay * 100) / 100,
    },
    llmStats: {
      totalCalls24h: llmCallsLast24h,
      totalPromptTokens24h: llmTokenStats._sum.promptTokens || 0,
      totalCompletionTokens24h: llmTokenStats._sum.completionTokens || 0,
      totalTokens24h: llmTokenStats._sum.totalTokens || 0,
      avgLatencyMs24h: llmTokenStats._avg.latencyMs 
        ? Math.round(llmTokenStats._avg.latencyMs * 10) / 10
        : null,
    },
  });
});

