# A2A Performance Analysis & Optimization Guide

## 🔍 Identified Performance Bottlenecks

Based on code analysis of `src/lib/a2a/message-router.ts`, here are the potential slow operations:

### 1. **Database Queries Without Indexes** ⚠️

#### Issue: `handleGetPositions` (Lines 941-976)
```typescript
perpPositions = await prisma.perpPosition.findMany({
  where: {
    userId,
    closedAt: null,  // Need index on (userId, closedAt)
  }
})

predictionPositions = await prisma.predictionMarketPosition.findMany({
  where: {
    userId,          // Need index on userId
  }
})
```

**Impact**: Could be slow with many positions
**Fix**: Add database indexes

#### Issue: `handleGetFeed` (Likely large result set)
**Impact**: Returns entire feed without pagination
**Fix**: Add pagination and limits

### 2. **N+1 Query Problems** ⚠️⚠️

#### Issue: `handleGetLeaderboard`
Likely fetches users then makes individual queries for their stats.

**Impact**: High database load
**Fix**: Use `include` or batch queries

### 3. **Missing Pagination** ⚠️⚠️

Many handlers don't limit result sets:
- `handleGetFeed`
- `handleGetPredictions`
- `handleGetPerpetuals`
- `handleGetTradeHistory`
- `handleGetNotifications`

**Impact**: Could return thousands of records
**Fix**: Add default limits and pagination

### 4. **Sequential Database Calls** ⚠️

Some handlers make sequential calls that could be parallel:
- `handleGetUserStats` - likely multiple aggregations
- `handleGetSystemStats` - multiple counts/aggregations

**Impact**: Increased latency
**Fix**: Use `Promise.all()`

## 🚀 Optimizations to Implement

### Optimization 1: Add Database Indexes

Create a migration file: `prisma/migrations/add_a2a_performance_indexes.sql`

```sql
-- Indexes for A2A queries

-- Positions queries
CREATE INDEX IF NOT EXISTS idx_perp_position_user_closed 
ON "PerpPosition"("userId", "closedAt") 
WHERE "closedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_prediction_position_user 
ON "PredictionMarketPosition"("userId");

-- Trade history queries
CREATE INDEX IF NOT EXISTS idx_perp_trade_user_created 
ON "PerpTrade"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_trade_user_created 
ON "PredictionMarketTrade"("userId", "createdAt" DESC);

-- Feed/Posts queries
CREATE INDEX IF NOT EXISTS idx_post_created_at 
ON "Post"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_post_author_created 
ON "Post"("authorId", "createdAt" DESC);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notification_user_created 
ON "Notification"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_notification_user_read 
ON "Notification"("userId", "isRead", "createdAt" DESC);

-- Chats
CREATE INDEX IF NOT EXISTS idx_chat_member_updated 
ON "ChatMember"("userId", "lastReadAt" DESC);

CREATE INDEX IF NOT EXISTS idx_message_chat_created 
ON "Message"("chatId", "createdAt" DESC);

-- Referrals
CREATE INDEX IF NOT EXISTS idx_referral_code_user 
ON "User"("referralCode") 
WHERE "referralCode" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_referred_by 
ON "User"("referredBy") 
WHERE "referredBy" IS NOT NULL;

-- Reputation
CREATE INDEX IF NOT EXISTS idx_user_reputation_points 
ON "User"("reputationPoints" DESC);
```

### Optimization 2: Add Pagination to Handlers

Create optimized version of handlers with pagination:

```typescript
// Example: handleGetFeed with pagination
private async handleGetFeed(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const params = request.params as { limit?: number; offset?: number; userId?: string } | undefined;
  const limit = Math.min(params?.limit || 50, 100); // Max 100
  const offset = params?.offset || 0;
  const userId = params?.userId || agentId;
  
  const posts = await prisma.post.findMany({
    where: {
      // Add relevant filters
    },
    take: limit,
    skip: offset,
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      content: true,
      authorId: true,
      createdAt: true,
      // Only select needed fields
    }
  });
  
  return {
    jsonrpc: '2.0',
    result: {
      posts,
      limit,
      offset,
      hasMore: posts.length === limit
    } as JsonRpcResult,
    id: request.id
  };
}
```

### Optimization 3: Batch Database Queries

```typescript
// Example: handleGetSystemStats with parallel queries
private async handleGetSystemStats(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
  // Run all counts in parallel
  const [
    userCount,
    postCount,
    predictionCount,
    perpCount,
    totalVolume
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.predictionMarket.count(),
    prisma.perpMarket.count(),
    prisma.$queryRaw`SELECT SUM(volume) FROM "PerpTrade"`.then(r => r[0]?.sum || 0)
  ]);
  
  return {
    jsonrpc: '2.0',
    result: {
      users: userCount,
      posts: postCount,
      predictionMarkets: predictionCount,
      perpMarkets: perpCount,
      totalVolume: Number(totalVolume)
    } as JsonRpcResult,
    id: request.id
  };
}
```

### Optimization 4: Add Caching for Frequently Accessed Data

```typescript
import { LRUCache } from 'lru-cache';

// Add to MessageRouter class
private cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// Example: Cache system stats
private async handleGetSystemStats(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const cacheKey = 'system-stats';
  const cached = this.cache.get(cacheKey);
  
  if (cached) {
    return {
      jsonrpc: '2.0',
      result: cached as JsonRpcResult,
      id: request.id
    };
  }
  
  // Fetch and cache...
  const stats = await this.fetchSystemStats();
  this.cache.set(cacheKey, stats);
  
  return {
    jsonrpc: '2.0',
    result: stats as JsonRpcResult,
    id: request.id
  };
}
```

## 📊 Performance Targets

### Current (Estimated without optimization)
| Endpoint | Expected Response Time | Issue |
|----------|----------------------|-------|
| getBalance | 50-100ms | ✅ Fast (simple query) |
| getPositions | 200-500ms | ⚠️ No index on closedAt |
| getFeed | 500-2000ms | ❌ No pagination, large result set |
| getLeaderboard | 1000-3000ms | ❌ Likely N+1 queries |
| getSystemStats | 500-1500ms | ⚠️ Multiple sequential queries |
| getNotifications | 300-800ms | ⚠️ No pagination |

### After Optimization
| Endpoint | Target Response Time | Optimizations |
|----------|---------------------|---------------|
| getBalance | <50ms | Already optimized |
| getPositions | <100ms | Add indexes |
| getFeed | <150ms | Pagination + indexes |
| getLeaderboard | <300ms | Batch queries + indexes |
| getSystemStats | <200ms | Parallel queries + caching |
| getNotifications | <100ms | Pagination + indexes |

## 🛠️ Implementation Plan

### Phase 1: Critical Fixes (Do First) ⭐
1. ✅ Add database indexes (biggest impact)
2. ✅ Add pagination to large result sets
3. ✅ Add default limits to all queries

### Phase 2: Medium Priority
4. Batch parallel database queries
5. Add response caching for expensive operations
6. Optimize N+1 queries

### Phase 3: Advanced Optimizations
7. Implement Redis caching layer
8. Add database query monitoring
9. Implement connection pooling

## 🧪 How to Test Performance

### 1. Run Baseline Stress Test
```bash
# Before optimizations
bun run stress-test:a2a:normal > results-before.json
```

### 2. Apply Optimizations
```bash
# Add indexes
bun prisma db push

# Deploy code changes
# (restart server)
```

### 3. Run After Stress Test
```bash
# After optimizations
bun run stress-test:a2a:normal > results-after.json
```

### 4. Compare Results
```bash
# Compare P95 response times
jq '.responseTime.p95' results-before.json
jq '.responseTime.p95' results-after.json
```

## 📈 Expected Improvements

With all optimizations applied:
- **50-70% reduction** in average response time
- **60-80% reduction** in P95 response time
- **3-5x increase** in throughput (req/s)
- **90%+ reduction** in database load
- **Rate limit errors** should decrease due to faster responses

## 🔧 Quick Wins (Implement Now)

### 1. Add Default Limits
```typescript
// Add to all findMany queries
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const limit = Math.min(params?.limit || DEFAULT_LIMIT, MAX_LIMIT);
```

### 2. Add Select Fields
```typescript
// Only select needed fields, not entire objects
select: {
  id: true,
  name: true,
  // Only what you need
}
```

### 3. Add Indexes (Run this SQL)
```bash
# Connect to your database and run:
psql $DATABASE_URL -f prisma/migrations/add_a2a_performance_indexes.sql
```

## 🎯 Priority Endpoints to Optimize

Based on likely usage patterns:

1. **getBalance** - ✅ Already fast
2. **getPositions** - ⚠️ Add indexes (high usage)
3. **getFeed** - ❌ Add pagination (high usage, slow)
4. **getLeaderboard** - ❌ Optimize queries (moderate usage, very slow)
5. **getSystemStats** - ⚠️ Add caching (moderate usage, slow)
6. **getPredictions** - ⚠️ Add pagination (high usage)

## 📝 Monitoring Recommendations

After optimizations, monitor:
- P50, P95, P99 response times
- Database query duration
- Cache hit rates
- Rate limit error rates
- Concurrent connection counts

## 🚨 Red Flags to Watch For

During stress testing, watch for:
- Response times > 1000ms
- Rate limit errors > 5% (except in rate-limit test)
- Database connection pool exhaustion
- Memory leaks (increasing memory usage)
- High CPU usage (> 80%)

---

## Next Steps

1. **Apply database indexes** (biggest impact, easiest to implement)
2. **Add pagination** to all list endpoints
3. **Run stress test** to measure improvements
4. **Iterate** on remaining bottlenecks

Once your server is running, use:
```bash
bun run stress-test:a2a:heavy
```

This will identify the actual slow endpoints in your environment!

