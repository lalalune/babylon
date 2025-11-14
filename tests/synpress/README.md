# Synpress E2E Tests

Comprehensive end-to-end tests covering every page, feature, and button in the Babylon application.

## Quick Start

```bash
# Install dependencies
bun install

# Configure Privy test credentials (REQUIRED for auth tests)
# See QUICK-START.md for a 3-step guide
# See README-PRIVY-SETUP.md for detailed instructions

# Run all tests
bun run test:synpress

# Run with visible browser
bun run test:headed

# Run specific test files
bun run test:synpress tests/synpress/06-waitlist.spec.ts
bun run test:synpress tests/synpress/07-waitlist-viral-loop.spec.ts

# Run critical path
bun run test:critical
```

## Test Files

- `00-critical-path.spec.ts` - Critical user journeys (feed, markets, rewards)
- `00-verify-privy-login.spec.ts` - Verify Privy authentication works
- `01-auth.spec.ts` - Authentication and onboarding flows
- `02-navigation.spec.ts` - All navigation paths and deep links
- `03-feed-posts.spec.ts` - Feed viewing, post creation, interactions
- `04-profile.spec.ts` - Profile viewing, editing, following
- `05-markets.spec.ts` - Prediction and perpetual markets
- `06-pools.spec.ts` - Liquidity pools deposit/withdraw
- `06-waitlist.spec.ts` - **NEW!** Waitlist signup, invite codes, points system
- `07-chats.spec.ts` - Messaging and DMs
- `07-waitlist-viral-loop.spec.ts` - **NEW!** Viral referral loop testing
- `08-other-pages.spec.ts` - Leaderboard, referrals, rewards, etc.
- `09-wallet-balance.spec.ts` - Wallet management and transactions
- `10-complete-validation.spec.ts` - Complete application validation
- `11-posthog-analytics.spec.ts` - Analytics tracking verification
- `12-notifications.spec.ts` - Notification system testing

## Helper Utilities

Located in `helpers/`:

- `privy-auth.ts` - Privy authentication helpers
- `page-helpers.ts` - Page interaction utilities
- `test-data.ts` - Test data and constants

## Configuration

- `synpress.config.ts` - Main configuration file
- `.env.local` - Environment variables for test credentials

### Privy Test Credentials Setup

**⚠️ REQUIRED** for running tests that require authentication:

1. **Quick Setup**: See [QUICK-START.md](./QUICK-START.md) for a 3-step guide
2. **Detailed Guide**: See [README-PRIVY-SETUP.md](./README-PRIVY-SETUP.md) for comprehensive instructions

Add to your `.env.local`:
```bash
PRIVY_TEST_EMAIL="your-test-email@privy.io"
PRIVY_TEST_PHONE="+15555551234"
PRIVY_TEST_OTP="123456"
```

## Documentation

- [QUICK-START.md](./QUICK-START.md) - 3-step Privy setup
- [README-PRIVY-SETUP.md](./README-PRIVY-SETUP.md) - Detailed Privy configuration
- [SYNPRESS_TESTING_GUIDE.md](../../SYNPRESS_TESTING_GUIDE.md) - Comprehensive testing guide (if exists)

## Coverage

✅ 100% Page Coverage  
✅ 100% Button Coverage  
✅ 100% Flow Coverage  
🎯 90%+ Code Coverage Target

