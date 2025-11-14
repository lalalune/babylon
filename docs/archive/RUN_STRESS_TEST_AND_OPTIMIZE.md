# 🚀 A2A Stress Test & Performance Optimization Guide

## ⚠️ Current Status

**Local Dev Server Issue**: The dev server has startup timing issues (cron simulator tries to connect before Next.js is ready). 

**Solution**: Start Next.js without the cron or use a deployed server.

## 📋 Quick Start - Run Stress Tests

### Option 1: Test Against Deployed Server

```bash
# Test against production/staging
bun run scripts/run-a2a-stress-test.ts heavy https://your-domain.com
```

### Option 2: Start Local Server Manually

```bash
# Terminal 1: Start Next.js only (no cron)
cd /Users/shawwalters/babylon
npx next dev

# Terminal 2: Wait for server, then run stress test
sleep 30  # Wait for Next.js to be ready
bun run stress-test:a2a:heavy
```

### Option 3: Fix Dev Server Startup

Edit `scripts/local-cron-simulator.ts` line ~13:

```typescript
// Change from 5 seconds to 30 seconds
console.log('Waiting 30 seconds for Next.js to be ready...');
await new Promise(resolve => setTimeout(resolve, 30000));
```

Then:
```bash
bun run dev
# In another terminal:
bun run stress-test:a2a:heavy
```

## 🎯 Performance Optimization Steps

### Step 1: Apply Database Indexes (CRITICAL) ⭐

This will have the biggest performance impact:

```bash
# Apply the indexes
cd /Users/shawwalters/babylon
psql $DATABASE_URL < prisma/migrations/add_a2a_performance_indexes.sql

# Or if using Prisma:
bun prisma db push
```

**Expected Impact**: 50-70% reduction in query time for most endpoints

### Step 2: Run Baseline Stress Test

```bash
# Run BEFORE optimizations
bun run stress-test:a2a:heavy > baseline-results.json

# Check results
cat baseline-results.json | jq '{
  totalRequests,
  successRate: .throughput.successRate,
  avgResponseTime: .responseTime.mean,
  p95ResponseTime: .responseTime.p95,
  throughput: .throughput.requestsPerSecond
}'
```

### Step 3: Identify Slow Endpoints

Look for endpoints with high response times:

```bash
# From the stress test output, find:
# - Endpoints with avg response time > 200ms
# - Endpoints with high error rates
# - Endpoints causing rate limit errors
```

### Step 4: Apply Code Optimizations

See `A2A_PERFORMANCE_ANALYSIS_AND_FIXES.md` for:
- Adding pagination to large result sets
- Batching parallel queries
- Adding caching for expensive operations

### Step 5: Run After Stress Test

```bash
# Run AFTER optimizations
bun run stress-test:a2a:heavy > optimized-results.json

# Compare
echo "=== BEFORE ==="
cat baseline-results.json | jq '.responseTime.p95'
echo "=== AFTER ==="
cat optimized-results.json | jq '.responseTime.p95'
```

## 📊 Test Scenarios Explained

### Light Test (Recommended First)
```bash
bun run stress-test:a2a:light
```
- 50 agents, 60 seconds
- Good for initial testing
- Should complete with >99% success rate

### Normal Test
```bash
bun run stress-test:a2a:normal
```
- 100 agents, 120 seconds
- Realistic production load
- Target: >98% success rate, P95 < 200ms

### Heavy Test (Stress Test)
```bash
bun run stress-test:a2a:heavy
```
- 200 agents, 300 seconds (5 min)
- Maximum stress
- Target: >95% success rate, P95 < 500ms

### Rate Limit Test (Verify Rate Limiting)
```bash
bun run stress-test:a2a:rate-limit
```
- 10 agents, rapid fire
- **EXPECTS rate limit errors (429s)**
- Verifies rate limiting works

### Coalition Test
```bash
bun run stress-test:a2a:coalition
```
- 50 agents, coalition features
- Tests multi-agent collaboration
- Target: >98% success rate

## 🎯 Performance Targets

### Before Optimization (Expected)
| Metric | Target |
|--------|--------|
| P95 Response Time | < 500ms |
| P99 Response Time | < 1000ms |
| Success Rate | > 95% |
| Throughput | 50-100 req/s |

### After Optimization (Target)
| Metric | Target |
|--------|--------|
| P95 Response Time | < 150ms |
| P99 Response Time | < 300ms |
| Success Rate | > 98% |
| Throughput | 200-300 req/s |

## 🔍 Analyzing Results

### Good Results ✅
```
Total Requests:      24,523
Successful:          24,145 (98.46%)
Rate Limit Errors:   <1%
P95 Response Time:   145.67ms
Throughput:          203.68 req/s

✅ EXCELLENT - A2A protocol performing well under load
```

### Needs Optimization ⚠️
```
Total Requests:      18,234
Successful:          16,123 (88.42%)
Rate Limit Errors:   5%
P95 Response Time:   847.32ms
Throughput:          60.12 req/s

⚠️ FAIR - A2A protocol needs optimization
```

### Critical Issues ❌
```
Total Requests:      12,456
Successful:          9,234 (74.13%)
Rate Limit Errors:   15%
P95 Response Time:   2,341.67ms
Throughput:          41.52 req/s

❌ POOR - Critical performance issues detected
```

## 🛠️ Quick Fixes for Common Issues

### Issue: High Response Times (P95 > 500ms)

**Cause**: Database queries without indexes or N+1 queries

**Fix**:
1. Apply database indexes (see Step 1)
2. Add pagination to large result sets
3. Batch parallel queries

### Issue: High Rate Limit Errors (>5%)

**Cause**: Requests are too slow, agents hit rate limit

**Fix**:
1. Optimize slow endpoints first
2. Consider increasing rate limit temporarily
3. Add caching for expensive operations

### Issue: Low Throughput (<100 req/s)

**Cause**: Database bottlenecks or insufficient resources

**Fix**:
1. Apply indexes
2. Enable connection pooling
3. Add Redis caching layer
4. Scale database

### Issue: Out of Memory

**Cause**: Large result sets loaded into memory

**Fix**:
1. Add pagination to ALL list endpoints
2. Limit max page size to 100
3. Use streaming for large datasets

## 📈 Expected Improvements

After applying database indexes:

| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| getBalance | 50ms | 30ms | 40% faster |
| getPositions | 400ms | 80ms | 80% faster |
| getFeed | 1200ms | 150ms | 87% faster |
| getLeaderboard | 2500ms | 250ms | 90% faster |
| getSystemStats | 800ms | 200ms | 75% faster |

## 🚨 Troubleshooting

### Server Won't Start

```bash
# Kill any existing processes
pkill -f "next dev"
pkill -f "bun run dev"

# Start fresh
bun run dev
```

### Can't Connect to Server

```bash
# Check if something is on port 3000
lsof -i :3000

# Try a different port
PORT=3001 bun run dev
```

### Stress Test Fails Immediately

```bash
# Verify server is responding
curl http://localhost:3000/api/a2a

# Should return:
# {"service":"Babylon A2A Protocol","version":"1.0.0","status":"active"}
```

### Database Connection Issues

```bash
# Check database is running
docker ps | grep postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

## 📝 Next Steps

1. **Apply indexes** (biggest impact, 5 minutes)
   ```bash
   psql $DATABASE_URL < prisma/migrations/add_a2a_performance_indexes.sql
   ```

2. **Run stress test** (identify actual bottlenecks)
   ```bash
   bun run stress-test:a2a:heavy
   ```

3. **Analyze results** (find slow endpoints)
   - Look for endpoints with >200ms average time
   - Check rate limit error rate
   - Identify failed requests

4. **Apply code optimizations** (see A2A_PERFORMANCE_ANALYSIS_AND_FIXES.md)
   - Add pagination
   - Batch queries
   - Add caching

5. **Re-test and verify improvements**
   ```bash
   bun run stress-test:a2a:heavy > results-after.json
   ```

## 🎉 Success Criteria

Your A2A endpoints are optimized when:

✅ P95 response time < 200ms  
✅ Success rate > 98%  
✅ Rate limit errors < 1% (in normal tests)  
✅ Throughput > 200 req/s  
✅ Database queries < 50ms (P95)  

## 📚 Additional Resources

- **Full Analysis**: `A2A_PERFORMANCE_ANALYSIS_AND_FIXES.md`
- **Database Indexes**: `prisma/migrations/add_a2a_performance_indexes.sql`
- **Test Scenarios**: `src/lib/testing/a2a-load-test-scenarios.ts`
- **Rate Limiting Guide**: `docs/A2A_RATE_LIMITING_AND_STRESS_TESTING.md`

---

**Ready to optimize?** Start with applying the database indexes, then run the stress test! 🚀

