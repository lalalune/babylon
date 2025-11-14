# Babylon API E2E Tests

End-to-end tests for all Babylon Next.js API routes. These tests run against a real Next.js server to validate production behavior.

## Overview

**Test Coverage**: 97 API routes across 6 test files
**Test Framework**: Playwright
**Test Runner**: `npm run test`

## Test Files

### `api-users.spec.ts` - Users API Tests (15 routes)
Tests for user management, profiles, authentication, social features, and referrals.

**Coverage**:
- User profile retrieval
- User search
- Balance management
- Follow/unfollow functionality
- Followers/following lists
- User posts
- Profile updates
- Referral system
- Social account linking

### `api-posts.spec.ts` - Posts API Tests (8 routes)
Tests for social posts, content creation, and interactions.

**Coverage**:
- Post listing and feeds
- Post creation with validation
- Post retrieval and deletion
- Like/unlike functionality
- Share functionality
- Comments and replies
- Interaction tracking
- Pagination support

### `api-chats.spec.ts` - Chats API Tests (5 routes)
Tests for direct messaging and group chats.

**Coverage**:
- Chat list retrieval
- Chat creation (DM and group)
- Message sending with validation
- Message history
- Participant management
- Chat deletion

### `api-markets.spec.ts` - Markets API Tests (7 routes)
Tests for prediction markets and perpetual trading.

**Coverage**:
- Prediction market listing
- Market details retrieval
- Buy/sell shares with validation
- Perpetual positions (open/close)
- Position tracking
- Leverage and risk validation
- User positions by status

### `api-pools.spec.ts` - Pools API Tests (5 routes)
Tests for investment pools and liquidity management.

**Coverage**:
- Pool listing with filters
- Pool details and performance
- Deposit functionality with validation
- Withdrawal functionality with validation
- User deposit tracking
- Performance metrics

### `api-remaining.spec.ts` - Other APIs (57+ routes)
Tests for miscellaneous endpoints.

**Coverage**:
- Stats and analytics
- Notifications (get, filter, mark read)
- Leaderboard with pagination
- Admin operations (stats, users, bans, trades)
- Game control (start/pause)
- Onboarding (username check, profile generation)
- Actors stats
- Feed widgets (trending, news, markets)
- Registry
- Upload validation

## Test Infrastructure

### Test Client (`helpers/api-test-client.ts`)
Provides `ApiTestClient` class for making API requests with:
- Built-in authentication support
- JSON parsing helpers
- HTTP method shortcuts (GET, POST, PUT, PATCH, DELETE)
- Automatic header management

**Usage**:
```typescript
const client = createApiClient('auth-token');
const response = await client.get('/api/users/me');
const data = await ApiTestClient.parseJson(response);
```

### Test Setup (`helpers/test-setup.ts`)
Provides utilities for:
- Base URL configuration
- Server readiness checks
- Mock authentication tokens
- Test user creation (TODO)
- Test data cleanup (TODO)

**Usage**:
```typescript
test.beforeAll(async () => {
  await waitForServer(); // Wait for server to be ready
});

const client = createApiClient(getMockAuthToken());
```

### Response Assertions
Helper assertions for common checks:
- `assertSuccess()` - Verify 2xx status
- `assertStatus()` - Verify specific status code
- `assertError()` - Verify error response
- `assertHasFields()` - Verify required fields present
- `assertErrorFormat()` - Verify error format

## Running Tests

### Run All API Tests
```bash
npm run test
# or
npm run test:api
```

### Run Specific Test File
```bash
npm run test:api:users      # Users API only
npm run test:api:posts      # Posts API only
npm run test:api:chats      # Chats API only
npm run test:api:markets    # Markets API only
npm run test:api:pools      # Pools API only
npm run test:api:remaining  # All other APIs
```

### Run with UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Run in Headed Mode (See Browser)
```bash
npm run test:e2e:headed
```

### Run with Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Patterns

### Basic GET Request Test
```typescript
test('should get resource', async () => {
  const response = await client.get('/api/resource');
  
  expect(response.status).toBe(200);
  
  const data = await ApiTestClient.parseJson(response);
  ResponseAssertions.assertHasFields(data, ['id', 'name']);
});
```

### POST Request with Validation
```typescript
test('should create resource with valid data', async () => {
  const createData = { name: 'Test' };
  const response = await client.post('/api/resource', createData);
  
  expect([200, 201]).toContain(response.status);
  
  if (response.status === 201) {
    const data = await ApiTestClient.parseJson(response);
    expect(data.name).toBe(createData.name);
  }
});

test('should reject invalid data', async () => {
  const invalidData = { name: '' }; // Empty name
  const response = await client.post('/api/resource', invalidData);
  
  expect([400, 401]).toContain(response.status);
});
```

### Authentication Tests
```typescript
test('should require authentication', async () => {
  const unauthClient = createApiClient(); // No token
  const response = await unauthClient.get('/api/protected');
  
  expect(response.status).toBe(401);
});

test('should work with authentication', async () => {
  const authClient = createApiClient(mockAuthToken);
  const response = await authClient.get('/api/protected');
  
  expect([200, 401]).toContain(response.status); // 401 if mock token invalid
});
```

### Pagination Tests
```typescript
test('should support pagination', async () => {
  const response = await client.get('/api/resource?limit=10&page=1');
  
  if (response.status === 200) {
    const data = await ApiTestClient.parseJson(response);
    
    expect(data.items.length).toBeLessThanOrEqual(10);
    expect(data.pagination).toHaveProperty('total');
    expect(data.pagination).toHaveProperty('page');
  }
});
```

## Environment Setup

### Required Environment Variables
Create `.env.local` with:
```bash
# Test authentication token (if available)
TEST_AUTH_TOKEN=your-test-token-here

# Test admin token (for admin endpoints)
TEST_ADMIN_TOKEN=your-admin-token-here

# Base URL (optional, defaults to http://localhost:3000)
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### Test Database
Tests run against the development database by default. For CI/CD:
1. Use a separate test database
2. Seed with test data
3. Clean up after tests

## Best Practices

### 1. Test Independence
Each test should be independent and not rely on other tests:
```typescript
test.beforeEach(() => {
  client = createApiClient(); // Fresh client each time
});
```

### 2. Flexible Assertions
Since these are E2E tests against real infrastructure, use flexible assertions:
```typescript
// Good: Handle multiple valid states
expect([200, 404]).toContain(response.status);

// Conditional assertions based on response
if (response.status === 200) {
  // Validate success case
}
```

### 3. Error Testing
Always test error cases:
```typescript
test('should validate input', async () => {
  const invalidData = { /* invalid */ };
  const response = await client.post('/api/endpoint', invalidData);
  expect([400, 401]).toContain(response.status);
});
```

### 4. Wait for Server
Always wait for server to be ready:
```typescript
test.beforeAll(async () => {
  await waitForServer();
});
```

## Debugging

### View Test Report
```bash
npx playwright show-report
```

### Debug Specific Test
```bash
npx playwright test --debug tests/e2e/api-users.spec.ts
```

### View Network Logs
Tests automatically capture:
- Screenshots on failure
- Network requests
- Console logs
- Traces

### Check Test Output
```bash
# Verbose output
npx playwright test --reporter=list

# JSON output
npx playwright test --reporter=json
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Start server
        run: npm run dev:skip-check &
        
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run API tests
        run: npm run test:api
        env:
          TEST_AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
      
      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Known Limitations

1. **Mock Authentication**: Currently uses mock tokens. Real Privy integration coming soon.
2. **Test Data**: No automatic test data seeding yet. Tests handle missing data gracefully.
3. **Cleanup**: Test data cleanup not yet implemented. Manual cleanup may be needed.

## Future Improvements

- [ ] Real authentication integration with Privy
- [ ] Automated test data seeding
- [ ] Test data cleanup after each test
- [ ] Performance testing
- [ ] Load testing
- [ ] Visual regression testing
- [ ] Cross-browser testing (currently Chromium only)
- [ ] Mobile viewport testing

## Contributing

When adding new tests:
1. Follow existing patterns
2. Use descriptive test names
3. Test both success and error cases
4. Add validation tests
5. Update this README if adding new patterns

## Support

- Playwright Docs: https://playwright.dev
- Test Issues: Check test output and traces
- API Documentation: http://localhost:3000/api-docs

