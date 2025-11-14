# Synpress E2E Tests

Comprehensive end-to-end tests covering every page, feature, and button in the Babylon application.

## Quick Start

```bash
# Install dependencies
bun install

# Configure test environment
cp .env.synpress.example .env.local
# Edit .env.local with your Privy test credentials

# Run all tests
bun run test:synpress

# Run with visible browser
bun run test:synpress:headed

# Run specific test suite
bun run test:synpress:auth
bun run test:synpress:navigation
bun run test:synpress:feed
bun run test:synpress:profile
bun run test:synpress:markets
bun run test:synpress:pools
bun run test:synpress:chats
bun run test:synpress:other
bun run test:synpress:wallet
```

## Test Files

- `01-auth.spec.ts` - Authentication and onboarding flows
- `02-navigation.spec.ts` - All navigation paths and deep links
- `03-feed-posts.spec.ts` - Feed viewing, post creation, interactions
- `04-profile.spec.ts` - Profile viewing, editing, following
- `05-markets.spec.ts` - Prediction and perpetual markets
- `06-pools.spec.ts` - Liquidity pools deposit/withdraw
- `07-chats.spec.ts` - Messaging and DMs
- `08-other-pages.spec.ts` - Leaderboard, referrals, rewards, etc.
- `09-wallet-balance.spec.ts` - Wallet management and transactions

## Helper Utilities

Located in `helpers/`:

- `privy-auth.ts` - Privy authentication helpers
- `page-helpers.ts` - Page interaction utilities
- `test-data.ts` - Test data and constants

## Configuration

- `synpress.config.ts` - Main configuration file
- `.env.local` - Environment variables (create from `.env.synpress.example`)

## Documentation

See [SYNPRESS_TESTING_GUIDE.md](../../SYNPRESS_TESTING_GUIDE.md) for comprehensive documentation.

## Coverage

✅ 100% Page Coverage  
✅ 100% Button Coverage  
✅ 100% Flow Coverage  
🎯 90%+ Code Coverage Target

