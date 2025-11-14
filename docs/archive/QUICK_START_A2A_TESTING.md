# 🚀 A2A Testing Quick Start

## One Command Testing

```bash
# Test rate limiting (RECOMMENDED FIRST!)
bun run stress-test:a2a:rate-limit
```

## Common Commands

```bash
# Start server
bun run dev

# In another terminal:

# Test normal load
bun run stress-test:a2a

# Test light load
bun run stress-test:a2a:light

# Test heavy load
bun run stress-test:a2a:heavy

# Test coalitions
bun run stress-test:a2a:coalition

# Run integration tests
bun test tests/integration/a2a-rate-limit.test.ts
```

## What To Expect

### ✅ Rate Limit Test (Expected Behavior)
```
Rate Limit Errors:     2,220
Rate Limit Error Rate: 17.83%
✅ Rate limiting is WORKING (expected errors in this test)
```

### ✅ Normal Test (Expected Behavior)
```
Total Requests:      24,523
Successful:          24,145 (98.46%)
Rate Limit Errors:   <1%
✅ EXCELLENT - A2A protocol performing well under load
```

## Key Metrics

| Test Scenario | Agents | Duration | Expected Success Rate | Expected Rate Limit Errors |
|--------------|--------|----------|----------------------|---------------------------|
| Light        | 50     | 60s      | >99%                 | <1%                       |
| Normal       | 100    | 120s     | >98%                 | <2%                       |
| Heavy        | 200    | 300s     | >95%                 | <5%                       |
| Rate Limit   | 10     | 120s     | 80-90%               | >10% (EXPECTED!)          |
| Coalition    | 50     | 180s     | >98%                 | <2%                       |

## Rate Limiting Details

- **Limit**: 100 requests per minute per agent
- **Identified by**: `x-agent-id` header
- **Error code**: HTTP 429
- **Retry after**: 60 seconds
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`

## All 40+ A2A Methods Tested

✅ Discovery (2) • Markets (8) • User/Profile (6) • Social (4)  
✅ Coalitions (4) • Analysis (3) • Payments (2) • Chats (2)  
✅ Notifications (2) • Pools (2) • System (2) • Referrals (3)

## Troubleshooting

### Server Not Running
```bash
# Error: Could not connect to A2A endpoint
# Solution: Start the server first
bun run dev
```

### No Rate Limit Errors (in rate-limit test)
```bash
# This means rate limiting is NOT working
# Check: src/app/api/a2a/route.ts
# Verify: getRateLimiter() is called in POST handler
```

### Too Many Rate Limit Errors (in normal tests)
```bash
# If seeing >5% rate limit errors in normal tests:
# - Increase rate limit threshold
# - Reduce concurrent agents
# - Increase think time
```

## Files You Can Modify

### Change Rate Limit
**File**: `src/app/api/a2a/route.ts`
```typescript
function getRateLimiter(): RateLimiter {
  // Change 100 to desired req/min
  rateLimiter = new RateLimiter(100)
}
```

### Create Custom Test
**File**: `src/lib/testing/a2a-load-test-scenarios.ts`
```typescript
export const MY_CUSTOM: LoadTestConfig = {
  concurrentUsers: 75,
  durationSeconds: 180,
  endpoints: [
    generateA2AEndpoint(A2A_METHODS.GET_BALANCE, 0.50),
    generateA2AEndpoint(A2A_METHODS.GET_POSITIONS, 0.50),
  ]
};
```

## Documentation

- **Full Guide**: `docs/A2A_RATE_LIMITING_AND_STRESS_TESTING.md`
- **Implementation Summary**: `A2A_RATE_LIMIT_IMPLEMENTATION_SUMMARY.md`
- **Visual Summary**: `A2A_IMPLEMENTATION_VISUAL_SUMMARY.md`

## Support

If you encounter issues:
1. Check server is running: `curl http://localhost:3000/api/a2a`
2. Verify rate limiter is active: Check for `X-RateLimit-Limit` header
3. Review logs for "Rate limit exceeded" messages
4. Run integration tests: `bun test tests/integration/a2a-rate-limit.test.ts`

---

**That's it!** Start with `bun run stress-test:a2a:rate-limit` to verify everything works! 🎉

