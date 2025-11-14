# Run Logout Verification Test

This test verifies the complete login → logout → not anonymous → re-login flow.

## Prerequisites

### 1. Privy Test Credentials

Add these to your `.env.local` file:

```bash
PRIVY_TEST_EMAIL="test-XXXX@privy.io"
PRIVY_TEST_PHONE="+1 555 555 XXXX"
PRIVY_TEST_OTP="XXXXXX"
```

**How to get test credentials:**
1. Go to your Privy dashboard
2. Create a test user or use test mode
3. Use the OTP code from test mode (usually `123456` or similar)

### 2. Start Dev Server

In one terminal:
```bash
bun run dev
```

Wait until you see: `✓ Ready in X.Xs`

## Run the Test

In another terminal:

```bash
# Run the complete logout verification test
bun run test:synpress tests/synpress/08-logout-verification.spec.ts
```

### With Headed Browser (See What's Happening)

```bash
# Run with visible browser
npx playwright test tests/synpress/08-logout-verification.spec.ts --headed --project=chromium
```

## What This Test Verifies

The test performs these steps:

1. ✅ **Initial State**: Verifies login button is visible (logged out)
2. ✅ **Login**: Logs in with Privy email
3. ✅ **Verify Login**: Checks for user menu/logout button
4. ✅ **Logout**: Clicks logout button
5. ✅ **Verify Not Anonymous**: 
   - Checks `babylon-auth` is removed from localStorage
   - Checks all `privy:*` keys are removed from localStorage
   - Checks all `privy:*` keys are removed from sessionStorage
6. ✅ **Verify UI**: Confirms login button is visible again
7. ✅ **Re-login**: Logs back in to verify fresh auth works
8. ✅ **Verify Fresh State**: Confirms new auth state is created

## Expected Output

When passing, you'll see:

```
🧪 Starting critical logout verification test...

📋 STEP 1: Verify initial logged-out state
✅ Found login button: button:has-text("Login")

📋 STEP 2: Log in with Privy
✅ Privy email login successful
✅ Found logged-in indicator: button:has-text("Logout")

📋 STEP 3: Log out
✅ Clicked logout button: button:has-text("Logout")

📋 STEP 4: Verify fully logged out (not anonymous)
✅ All auth storage cleared - NOT anonymous!

📋 STEP 5: Verify login button visible
✅ Login button visible: button:has-text("Login")
✅ UI shows logged-out state correctly!

📋 STEP 6: Re-login to verify clean authentication
✅ Re-login successful with fresh auth state!

================================================================================
🎉 LOGOUT VERIFICATION TEST PASSED!
================================================================================
✅ Can log in with Privy
✅ Can log out completely
✅ NOT anonymous after logout (all storage cleared)
✅ Login button visible after logout
✅ Can re-login successfully
================================================================================

  1 passed (XXs)
```

## Screenshots

The test creates screenshots at each step:
- `08-01-logged-out-initial.png` - Initial logged-out state
- `08-02-logged-in.png` - After logging in
- `08-03-after-logout.png` - Immediately after logout
- `08-04-login-button-visible.png` - Login button visible after logout
- `08-05-relogin-successful.png` - After re-logging in

Find them in: `test-results/screenshots/`

## Troubleshooting

### Test Times Out on Login

**Problem**: Privy modal doesn't appear

**Solutions**:
1. Clear browser data: The test should do this automatically, but if it doesn't:
   ```bash
   # Run with --headed to see what's happening
   npx playwright test tests/synpress/08-logout-verification.spec.ts --headed
   ```

2. Check Privy credentials are correct in `.env.local`

3. Make sure dev server is running on port 3000:
   ```bash
   curl http://localhost:3000
   ```

### Test Fails on Logout

**Problem**: Can't find logout button

**Solution**: The test tries multiple selectors and locations. Check the screenshot:
```bash
open test-results/screenshots/08-02-logged-in.png
```

If you see you're logged in but test can't find logout, the UI might have changed. Update the `loggedInIndicators` array in the test.

### Storage Not Cleared

**Problem**: Test fails at "Verify fully logged out"

**This is the bug we're testing for!** If this fails, it means:
- The logout function isn't clearing storage properly
- Check `src/hooks/useAuth.ts` → `handleLogout` function
- Make sure all storage cleanup is happening

### Re-login Fails

**Problem**: Can't log back in after logout

**This indicates a logout issue** - probably some stale state preventing re-login. Check:
- Are Privy cookies being cleared?
- Is sessionStorage being cleared?
- Look at the browser console in the screenshot

## Quick Smoke Test

Just want to verify logout works quickly?

```bash
# Run just the main test (not the refresh test)
bun run test:synpress tests/synpress/08-logout-verification.spec.ts --grep "CRITICAL"
```

This runs only the main comprehensive test.

## Debug Mode

Run with debug output:

```bash
DEBUG=pw:api npx playwright test tests/synpress/08-logout-verification.spec.ts --headed
```

This shows all Playwright API calls so you can see exactly what's happening.

## Success Criteria

The test is successful if:
- ✅ All console output shows green checkmarks
- ✅ Test output shows "1 passed"
- ✅ Screenshots show the correct UI state at each step
- ✅ No auth keys remain in localStorage after logout
- ✅ Login button is visible after logout
- ✅ Re-login works without issues

If all these pass, your logout functionality is working correctly! 🎉

