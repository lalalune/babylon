# Test User Filtering Implementation

## Overview
Implemented a system to filter out test NPC user posts from the public feed so they're not visible to real users.

## Changes Made

### 1. Database Schema Updates
- **File**: `prisma/schema.prisma`
- Added `isTest` Boolean field (default: false) to:
  - `User` model (line 1047)
  - `Actor` model (line 30)

### 2. Database Migration
- **Migration**: `20251113120402_add_is_test_flag`
- Applied migration to add `isTest` column to both `User` and `Actor` tables

### 3. Core Database Service Updates
- **File**: `src/lib/database-service.ts`
- Updated `getRecentPosts()` method (lines 220-274):
  - Fetches posts with 2x limit to account for filtering
  - Queries both User and Actor tables to identify test users
  - Filters out posts from test users before returning
  - Logs number of filtered test posts
  
- Updated `getPostsByActor()` method (lines 276-322):
  - Checks if the author is a test user
  - Returns empty array if author is marked as test
  - Logs when test users are filtered

### 4. Cached Database Service Updates
- **File**: `src/lib/cached-database-service.ts`
- Updated `getPostsForFollowing()` method (lines 59-115):
  - Pre-filters test users from followedIds
  - Only queries posts from non-test users
  - Improves performance by avoiding unnecessary post fetches

### 5. Posts API Updates
- **File**: `src/app/api/posts/route.ts`
- Updated type-filtered posts query (lines 395-433):
  - Fetches posts with 2x limit to account for filtering
  - Identifies test authors from both User and Actor tables
  - Filters out test user posts before returning
  - Logs number of filtered posts

### 6. Test Utilities Updates
- **File**: `src/lib/testing/auth-helper.ts`
- Updated `createTestUser()` function (line 34):
  - Sets `isTest: true` for all load test users
  - Ensures test users created for testing are automatically filtered

### 7. Test Files Updated
Updated all integration test files to mark test actors and users with `isTest: true`:
- `tests/integration/npc-groups.test.ts`
- `tests/integration/npc-perp-integration.test.ts`
- `tests/integration/npc-perp-fees.test.ts`
- `tests/integration/spot-pricing.test.ts`
- `tests/integration/game-tick-group-generation.test.ts`
- `tests/integration/referral-system.test.ts`
- `tests/integration/follow-system-api.test.ts`

## How It Works

### For Feed Display
1. When posts are fetched from the database, the system checks both `User` and `Actor` tables
2. Creates a set of author IDs that have `isTest = true`
3. Filters out any posts authored by test users
4. Returns only posts from real users

### For Following Feed
1. Pre-filters the list of followed users to remove test users
2. Only queries posts from non-test followed users
3. More efficient as it avoids fetching posts that would be filtered anyway

### For Actor-Specific Posts
1. Checks if the specific actor/user has `isTest = true`
2. Returns empty array immediately if they're a test user
3. Otherwise fetches and returns their posts normally

## Benefits

1. **User Experience**: Real users no longer see test/debug posts in their feed
2. **Clean Data**: Test data is clearly marked and separated from production data
3. **Performance**: Caching and pre-filtering optimizations
4. **Maintainability**: Easy to identify and manage test users
5. **Testing**: All existing tests updated to properly mark test data

## Future Considerations

1. **Bulk Operations**: Consider adding a database index on `isTest` for both tables if query performance becomes an issue
2. **Admin Toggle**: Could add an admin setting to show/hide test posts for debugging
3. **Cleanup Script**: Create a script to periodically clean up old test users/actors
4. **Analytics**: Track test vs real user metrics separately

## Verification

To verify the implementation works:
1. Create a test user/actor with `isTest: true`
2. Have them create a post
3. Check the feed - the post should not appear
4. Query directly with admin access - the post should exist in database but be filtered from API

## Migration Notes

- Existing users/actors without the `isTest` field will default to `false` (not test users)
- This means all existing data is treated as production data by default
- Any future test users must explicitly set `isTest: true` when created

