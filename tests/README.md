# Babylon Testing Suite

This directory contains comprehensive tests for the Babylon platform, including E2E tests and integration tests.

## Directory Structure

```
tests/
├── e2e/                    # End-to-end tests using Playwright
│   ├── referrals.spec.ts              # Rewards & Referral system E2E tests
│   └── referrals-integration.spec.ts  # Referral integration tests
├── integration/            # Integration tests using Bun
│   └── referral-api.test.ts          # Referral API tests
└── README.md              # This file
```

## Running Tests

### E2E Tests (Playwright)

```bash
# Install Playwright browsers (first time only)
bunx playwright install

# Run all E2E tests
bun run test:e2e

# Run E2E tests in UI mode (interactive)
bun run test:e2e:ui

# Run E2E tests in headed mode (see browser)
bun run test:e2e:headed

# Run only referral tests
bun run test:referrals

# Run specific test file
bunx playwright test tests/e2e/referrals.spec.ts

# Run with debugging
bunx playwright test --debug
```

### Integration Tests (Bun)

```bash
# Run all integration tests
bun run test:integration

# Run specific test file
bun test tests/integration/referral-api.test.ts

# Run with watch mode
bun test --watch tests/integration/
```

## Rewards & Referral System Tests

### Coverage

The rewards and referral system tests cover:

#### 1. **User Flow Tests** (`referrals.spec.ts`)
- ✅ Unauthenticated access handling
- ✅ Rewards page UI and functionality
- ✅ Reward tasks display (social linking, wallet connect, etc.)
- ✅ Referral code generation and display
- ✅ Copy to clipboard functionality
- ✅ Stats cards display
- ✅ Referred users list
- ✅ Navigation integration
- ✅ Responsive design
- ✅ Share functionality

#### 2. **Integration Tests** (`referrals-integration.spec.ts`)
- ✅ Complete referral flow (end-to-end)
- ✅ API endpoint validation
- ✅ Points award verification
- ✅ Auto-follow functionality
- ✅ Database consistency

#### 3. **API Tests** (`referral-api.test.ts`)
- ✅ Referral code generation logic
- ✅ Points calculation
- ✅ URL generation and parsing
- ✅ Status management
- ✅ Follow relationship validation

## Test Environment Setup

### Prerequisites

1. **Database**: PostgreSQL database running
2. **Environment Variables**: Set in `.env.local`
   ```env
   DATABASE_URL="postgresql://..."
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```
3. **Test Data**: Seed database with test data
   ```bash
   bun run db:seed
   ```

### Running Tests Locally

1. Start the development server:
   ```bash
   bun run dev
   ```

2. In another terminal, run tests:
   ```bash
   bun run test:e2e
   ```

### CI/CD Integration

Tests are designed to run in CI environments:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: bun install

- name: Install Playwright browsers
  run: bunx playwright install --with-deps

- name: Run E2E tests
  run: bun run test:e2e
  env:
    CI: true
```

## Test Scenarios

### Referral Flow Test Scenarios

#### Scenario 1: Generate Referral Code
```
1. User logs in
2. Navigates to /rewards
3. Sees unique referral code
4. Copies code to clipboard
✅ Code is valid format
✅ URL contains code
```

#### Scenario 2: Sign Up with Referral
```
1. User A generates referral code: ABC123-XY9Z
2. User A shares link: babylon.game?ref=ABC123-XY9Z
3. User B clicks link
4. User B signs up
✅ User A receives +250 points
✅ User A auto-follows User B
✅ Referral status = 'completed'
```

#### Scenario 3: View Rewards & Referrals
```
1. User A checks /rewards page
2. Sees reward tasks and completion status
3. Sees referral stats:
   - Total Referrals: 5
   - Points Earned: 1,250
   - Following: 4
4. Sees list of referred users
✅ Each shows +250 badge
✅ Follow status accurate
✅ Can click to view profile
```

## Debugging Tests

### View Test Report

After running tests:
```bash
bunx playwright show-report
```

### Debug Specific Test

```bash
bunx playwright test --debug tests/e2e/referrals.spec.ts
```

### View Traces

Traces are automatically captured on failure:
```bash
bunx playwright show-trace test-results/.../trace.zip
```

## Test Best Practices

### 1. **Isolation**
- Each test should be independent
- Use `test.beforeEach` for setup
- Clean up after tests

### 2. **Assertions**
- Use specific matchers
- Verify actual behavior, not implementation
- Check both positive and negative cases

### 3. **Waits**
- Wait for network responses
- Wait for elements to be visible
- Use `page.waitForLoadState('networkidle')`

### 4. **Mocking**
- Mock external services
- Use test data
- Don't modify production data

## Known Issues & Limitations

### Current Limitations

1. **Authentication Mocking**: Tests use simplified auth mocking
   - Real Privy auth requires more complex setup
   - Consider using test mode or mock provider

2. **Database State**: Some tests marked as `test.skip`
   - Require test database setup
   - Need data seeding strategy

3. **Web3 Integration**: No Synpress wallet tests yet
   - Would require MetaMask setup
   - Consider adding for on-chain features

## Future Improvements

### Planned Enhancements

- [ ] Add Synpress for Web3 wallet testing
- [ ] Implement test database fixtures
- [ ] Add visual regression tests
- [ ] Performance testing
- [ ] Load testing for API endpoints
- [ ] Test different network conditions
- [ ] Cross-browser testing (Firefox, Safari)

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Add test to appropriate directory
3. Update this README with coverage
4. Ensure tests pass locally before PR
5. Add meaningful assertions

## Support

For test-related issues:
- Check Playwright docs: https://playwright.dev
- Check Bun test docs: https://bun.sh/docs/cli/test
- Review existing test patterns
- Ask in team chat

---

**Last Updated**: November 2, 2025
**Test Coverage**: Rewards & Referral System (Comprehensive)

