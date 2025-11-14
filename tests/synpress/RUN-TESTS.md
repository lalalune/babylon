# How to Run Waitlist Tests

## Prerequisites

1. **Start the dev server FIRST** (in a separate terminal):
   ```bash
   bun run dev
   ```
   
2. **Wait for server to be ready** (look for "Local: http://localhost:3000")

3. **Verify server is responding**:
   ```bash
   curl http://localhost:3000
   ```

## Run the Tests

Once your dev server is running:

```bash
# Run both waitlist test files
bun run test:synpress tests/synpress/06-waitlist.spec.ts tests/synpress/07-waitlist-viral-loop.spec.ts

# Or run individually
bun run test:synpress tests/synpress/06-waitlist.spec.ts
bun run test:synpress tests/synpress/07-waitlist-viral-loop.spec.ts

# Run with visible browser (for debugging)
bun run test:headed tests/synpress/06-waitlist.spec.ts
```

## Troubleshooting

### Server Not Responding
**Problem**: Tests timeout trying to connect to localhost:3000

**Solution**:
```bash
# Check if server is running
ps aux | grep "next dev"

# Check what's on port 3000
lsof -i :3000

# Restart server
pkill -f "next dev"
bun run dev
```

### Privy Credentials Missing
**Problem**: Tests fail with "Privy test credentials not configured"

**Solution**:
Add to `.env.local`:
```bash
PRIVY_TEST_EMAIL="test-5673@privy.io"
PRIVY_TEST_PHONE="+1 555 555 5423"
PRIVY_TEST_OTP="234126"
```

### Tests Timeout on Login
**Problem**: Tests hang trying to click login buttons

**Solution**:
- Clear browser cache between test runs
- Make sure test user isn't already logged in
- Check that Privy test mode is enabled in dashboard

## Expected Results

When working correctly:
```
✅ 26/26 tests passing (100%)
⏱️  Test runtime: ~5-15 minutes
📸 Screenshots saved to test-results/screenshots/
```

## Quick Verification

Just want to verify everything works? Run:
```bash
# Start server
bun run dev

# In another terminal, run one quick test
bun run test:synpress tests/synpress/06-waitlist.spec.ts:408
```

This runs just the referral URL test which should pass quickly.

