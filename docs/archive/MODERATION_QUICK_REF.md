# Moderation System - Quick Reference Card

## 🚀 Quick Start

### Run All Tests
```bash
./scripts/test-moderation.sh --e2e
```

### Seed Test Data
```bash
npx tsx scripts/seed-moderation-test-users.ts
```

### Run Specific Tests
```bash
# Ban/unban
npm run test:integration tests/integration/moderation-ban-api.test.ts

# Sorting
npm run test:integration tests/integration/moderation-sorting.test.ts

# E2E
npm run test:e2e tests/e2e/moderation-complete.spec.ts
```

## 📊 Bad User Score Formula

```
score = (reportRatio × 5) + (blockRatio × 3) + (muteRatio × 1)

where:
  reportRatio = reports / followers (or reports if no followers)
  blockRatio = blocks / followers (or blocks if no followers)
  muteRatio = mutes / followers (or mutes if no followers)
```

## 🎯 Score Interpretation

| Score | Severity | Action |
|-------|----------|--------|
| 0-1 | Low | Monitor |
| 1-5 | Moderate | Review |
| 5-10 | High | Investigate |
| 10+ | Critical | Consider ban |

## 📍 API Endpoints

### Admin Users (with moderation)
```
GET /api/admin/users?sortBy=bad_user_score
```

### Ban/Unban
```
POST /api/admin/users/:userId/ban
{
  "action": "ban" | "unban",
  "reason": "string" (required for ban)
}
```

### Block User
```
POST /api/users/:userId/block
{
  "action": "block" | "unblock",
  "reason": "string" (optional)
}
```

### Mute User
```
POST /api/users/:userId/mute
{
  "action": "mute" | "unmute",
  "reason": "string" (optional)
}
```

### Report User
```
POST /api/moderation/reports
{
  "reportType": "user" | "post",
  "reportedUserId": "string",
  "category": "spam" | "harassment" | ...,
  "reason": "string",
  "evidence": "string" (optional)
}
```

## 🔍 Sort Options

| Option | Description |
|--------|-------------|
| `bad_user_score` | Combined likelihood score |
| `reports_received` | Count of reports |
| `blocks_received` | Count of blocks |
| `mutes_received` | Count of mutes |
| `report_ratio` | Reports per follower |
| `block_ratio` | Blocks per follower |

## 📁 Key Files

```
src/
  app/api/admin/users/route.ts     - Admin API with sorting
  components/admin/UserManagementTab.tsx  - Admin UI

tests/
  integration/
    moderation-ban-api.test.ts      - Ban/unban tests
    moderation-actions-api.test.ts  - Block/mute/report tests
    moderation-sorting.test.ts      - Sorting tests
  e2e/
    moderation-complete.spec.ts     - Full E2E tests

scripts/
  seed-moderation-test-users.ts     - Seed test data
  test-moderation.sh                - Run all tests
```

## 🎨 UI Features

### Admin Panel
- **User List**: Shows all users with moderation metrics
- **Sort Dropdown**: General + Moderation sort options
- **Metrics Panel**: Yellow warning box for users with issues
- **Color Coding**: Red (>10), Orange (>5), Yellow (<5)
- **Ban Modal**: Required reason, confirmation

### Metrics Display
```
🔰 Moderation Metrics
┌─────────┬─────────┬─────────┬──────────┐
│Reports  │Blocks   │Mutes    │Bad Score │
│  25     │  15     │  10     │   40.0   │
└─────────┴─────────┴─────────┴──────────┘
Report Ratio: 5.00  Block Ratio: 3.00
```

## 🧪 Test Data

Default test users created by seed script:

| Username | Reports | Blocks | Mutes | Followers | Score |
|----------|---------|--------|-------|-----------|-------|
| spammer002 | 50 | 30 | 20 | 2 | 190.0 |
| baduser001 | 25 | 15 | 10 | 5 | 40.0 |
| controversial003 | 10 | 8 | 5 | 50 | 1.58 |
| cleanuser004 | 0 | 0 | 0 | 100 | 0 |
| banneduser005 | 30 | 20 | 15 | 10 | (banned) |

## ⚡ Common Commands

```bash
# Run integration tests only
./scripts/test-moderation.sh

# Run all tests (integration + e2e)
./scripts/test-moderation.sh --e2e

# Seed data and run tests
./scripts/test-moderation.sh --seed --e2e

# Run with verbose output
./scripts/test-moderation.sh --verbose

# Run single test
npm run test:integration -- -t "should sort by bad user score"

# Watch mode
npm run test:integration -- --watch moderation
```

## 🔒 Security Rules

- ❌ Cannot ban actors
- ❌ Cannot ban other admins
- ✅ Ban reason required
- ✅ Duplicate blocks/mutes prevented
- ✅ Admin auth required

## 📚 Documentation

- **Full Guide**: `tests/MODERATION_TESTS_GUIDE.md`
- **Implementation**: `MODERATION_IMPLEMENTATION_COMPLETE.md`
- **Original Docs**: `docs/content/moderation/overview.mdx`

## 🎯 Example Queries

### Find worst offenders
```typescript
const response = await fetch('/api/admin/users?sortBy=bad_user_score&sortOrder=desc')
```

### Find spam accounts
```typescript
const response = await fetch('/api/admin/users?sortBy=report_ratio&sortOrder=desc')
```

### Find most reported
```typescript
const response = await fetch('/api/admin/users?sortBy=reports_received&sortOrder=desc')
```

## 🐛 Troubleshooting

**Tests fail with "user not found"**
→ Run seed script: `npx tsx scripts/seed-moderation-test-users.ts`

**E2E tests fail**
→ Make sure dev server is running: `npm run dev`

**Sort order wrong**
→ Check that test data has expected metrics
→ Verify formula matches backend implementation

**Duplicate key errors**
→ Clean test data between runs
→ Use unique usernames per test

## 📞 Support

For issues or questions:
1. Check `tests/MODERATION_TESTS_GUIDE.md`
2. Review test output for specific errors
3. Verify database has correct schema
4. Check API endpoints return expected data

---

**Quick Links:**
- [Full Testing Guide](tests/MODERATION_TESTS_GUIDE.md)
- [Implementation Details](MODERATION_IMPLEMENTATION_COMPLETE.md)
- [Prisma Schema](prisma/schema.prisma)

