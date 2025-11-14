/**
 * Logout Verification E2E Test
 * 
 * Critical test that verifies:
 * 1. User can log in with Privy
 * 2. User can log out completely
 * 3. After logout, user is NOT anonymous
 * 4. After logout, login button is visible (like not logged in)
 * 5. User can log back in successfully
 */

import { test, expect } from '@playwright/test'
import { loginWithPrivyEmail, getPrivyTestAccount, hasPrivyTestCredentials } from './helpers/privy-auth'
import { navigateTo, waitForPageLoad, isVisible } from './helpers/page-helpers'
import { ROUTES } from './helpers/test-data'

test.describe('Logout Verification', () => {
  test.beforeEach(async ({ page, context }) => {
    // CRITICAL: Clear all storage before each test to ensure clean state
    await context.clearCookies()
    
    // Navigate to home page first (can't access localStorage on about:blank)
    await navigateTo(page, ROUTES.HOME)
    await waitForPageLoad(page)
    
    // Now clear storage
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    
    console.log('🧹 Cleared all storage for clean test state')
    
    // Reload to ensure clean state is applied
    await page.reload()
    await waitForPageLoad(page)
  })

  test('CRITICAL: Complete login → logout → verify not anonymous → re-login flow', async ({ page }) => {
    // Skip if test credentials not configured
    if (!hasPrivyTestCredentials()) {
      console.log('⚠️ Skipping test - Privy credentials not configured')
      test.skip()
      return
    }

    const testAccount = getPrivyTestAccount()
    
    console.log('🧪 Starting critical logout verification test...')
    
    // ============================================================================
    // STEP 1: Verify we start logged out with login button visible
    // ============================================================================
    console.log('\n📋 STEP 1: Verify initial logged-out state')
    
    const loginButtonSelectors = [
      'button:has-text("Login")',
      'button:has-text("Log in")',
      'button:has-text("Connect")',
      'button:has-text("Connect Wallet")',
      '[data-testid="login-button"]',
    ]
    
    let loginButtonFound = false
    for (const selector of loginButtonSelectors) {
      if (await isVisible(page, selector, 3000)) {
        console.log(`✅ Found login button: ${selector}`)
        loginButtonFound = true
        break
      }
    }
    
    expect(loginButtonFound).toBe(true)
    
    // Take screenshot of logged-out state
    await page.screenshot({ path: 'test-results/screenshots/08-01-logged-out-initial.png' })
    
    // Verify no auth in localStorage
    const initialAuth = await page.evaluate(() => {
      return {
        babylonAuth: localStorage.getItem('babylon-auth'),
        privyKeys: Object.keys(localStorage).filter(k => k.startsWith('privy')),
      }
    })
    
    console.log('Initial auth state:', {
      hasBabylonAuth: !!initialAuth.babylonAuth,
      privyKeyCount: initialAuth.privyKeys.length
    })
    
    // ============================================================================
    // STEP 2: Log in with Privy
    // ============================================================================
    console.log('\n📋 STEP 2: Log in with Privy')
    
    await loginWithPrivyEmail(page, testAccount)
    
    // Wait for login to complete
    await page.waitForTimeout(5000)
    
    // Verify logged in - check for user menu or logout button
    const loggedInIndicators = [
      'button:has-text("Logout")',
      'button:has-text("Log out")',
      '[data-testid="user-menu"]',
      '[data-testid="user-profile"]',
    ]
    
    let isLoggedIn = false
    for (const selector of loggedInIndicators) {
      if (await isVisible(page, selector, 3000)) {
        console.log(`✅ Found logged-in indicator: ${selector}`)
        isLoggedIn = true
        break
      }
    }
    
    expect(isLoggedIn).toBe(true)
    
    // Verify auth in localStorage
    const authAfterLogin = await page.evaluate(() => {
      const babylonAuth = localStorage.getItem('babylon-auth')
      return {
        hasBabylonAuth: !!babylonAuth,
        babylonAuthData: babylonAuth ? JSON.parse(babylonAuth) : null,
        privyKeys: Object.keys(localStorage).filter(k => k.startsWith('privy')),
        sessionPrivyKeys: Object.keys(sessionStorage).filter(k => k.startsWith('privy')),
      }
    })
    
    console.log('Auth state after login:', {
      hasBabylonAuth: authAfterLogin.hasBabylonAuth,
      hasUser: !!authAfterLogin.babylonAuthData?.state?.user,
      privyKeyCount: authAfterLogin.privyKeys.length,
      sessionPrivyKeyCount: authAfterLogin.sessionPrivyKeys.length,
    })
    
    expect(authAfterLogin.hasBabylonAuth).toBe(true)
    expect(authAfterLogin.privyKeys.length).toBeGreaterThan(0)
    
    await page.screenshot({ path: 'test-results/screenshots/08-02-logged-in.png' })
    
    // ============================================================================
    // STEP 3: Log out
    // ============================================================================
    console.log('\n📋 STEP 3: Log out')
    
    // Find and click logout button
    const logoutSelectors = [
      'button:has-text("Logout")',
      'button:has-text("Log out")',
      'button:has-text("Sign out")',
    ]
    
    let logoutClicked = false
    
    // First try to click logout directly
    for (const selector of logoutSelectors) {
      const button = page.locator(selector).first()
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click()
        console.log(`✅ Clicked logout button: ${selector}`)
        logoutClicked = true
        break
      }
    }
    
    // If not found, try opening profile menu first
    if (!logoutClicked) {
      console.log('Looking for profile menu to access logout...')
      const menuSelectors = [
        '[data-testid="user-menu"]',
        '[data-testid="profile-menu"]',
        'button[aria-label*="profile" i]',
        'button[aria-label*="menu" i]',
      ]
      
      for (const menuSelector of menuSelectors) {
        const menu = page.locator(menuSelector).first()
        if (await menu.isVisible({ timeout: 2000 }).catch(() => false)) {
          await menu.click()
          console.log(`✅ Opened menu: ${menuSelector}`)
          await page.waitForTimeout(1000)
          
          // Now try logout buttons
          for (const logoutSelector of logoutSelectors) {
            const button = page.locator(logoutSelector).first()
            if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
              await button.click()
              console.log(`✅ Clicked logout from menu: ${logoutSelector}`)
              logoutClicked = true
              break
            }
          }
          
          if (logoutClicked) break
        }
      }
    }
    
    expect(logoutClicked).toBe(true)
    
    // Wait for logout to complete
    await page.waitForTimeout(3000)
    
    await page.screenshot({ path: 'test-results/screenshots/08-03-after-logout.png' })
    
    // ============================================================================
    // STEP 4: Verify we're NOT anonymous and fully logged out
    // ============================================================================
    console.log('\n📋 STEP 4: Verify fully logged out (not anonymous)')
    
    // Check localStorage is cleared
    const authAfterLogout = await page.evaluate(() => {
      const babylonAuth = localStorage.getItem('babylon-auth')
      return {
        babylonAuth: babylonAuth,
        babylonAuthParsed: babylonAuth ? (() => {
          try {
            return JSON.parse(babylonAuth)
          } catch {
            return null
          }
        })() : null,
        privyKeys: Object.keys(localStorage).filter(k => k.startsWith('privy')),
        sessionPrivyKeys: Object.keys(sessionStorage).filter(k => k.startsWith('privy')),
        allLocalStorageKeys: Object.keys(localStorage),
      }
    })
    
    console.log('Auth state after logout:', {
      hasBabylonAuth: !!authAfterLogout.babylonAuth,
      hasUser: !!authAfterLogout.babylonAuthParsed?.state?.user,
      privyKeyCount: authAfterLogout.privyKeys.length,
      sessionPrivyKeyCount: authAfterLogout.sessionPrivyKeys.length,
      allKeysCount: authAfterLogout.allLocalStorageKeys.length,
    })
    
    // CRITICAL ASSERTIONS
    expect(authAfterLogout.babylonAuth).toBeNull()
    expect(authAfterLogout.privyKeys.length).toBe(0)
    expect(authAfterLogout.sessionPrivyKeys.length).toBe(0)
    
    console.log('✅ All auth storage cleared - NOT anonymous!')
    
    // ============================================================================
    // STEP 5: Verify login button is visible (like we're not logged in)
    // ============================================================================
    console.log('\n📋 STEP 5: Verify login button visible')
    
    // Refresh page to ensure UI is updated
    await page.reload()
    await waitForPageLoad(page)
    
    // Check for login button
    let loginButtonVisible = false
    for (const selector of loginButtonSelectors) {
      if (await isVisible(page, selector, 5000)) {
        console.log(`✅ Login button visible: ${selector}`)
        loginButtonVisible = true
        break
      }
    }
    
    expect(loginButtonVisible).toBe(true)
    
    // Verify NO logout button or user menu
    let hasLoggedInElements = false
    for (const selector of loggedInIndicators) {
      if (await isVisible(page, selector, 1000)) {
        console.log(`⚠️ Still found logged-in element: ${selector}`)
        hasLoggedInElements = true
      }
    }
    
    expect(hasLoggedInElements).toBe(false)
    
    await page.screenshot({ path: 'test-results/screenshots/08-04-login-button-visible.png' })
    
    console.log('✅ UI shows logged-out state correctly!')
    
    // ============================================================================
    // STEP 6: Log back in to verify we can re-authenticate
    // ============================================================================
    console.log('\n📋 STEP 6: Re-login to verify clean authentication')
    
    await loginWithPrivyEmail(page, testAccount)
    await page.waitForTimeout(5000)
    
    // Verify logged in again
    let isReloggedIn = false
    for (const selector of loggedInIndicators) {
      if (await isVisible(page, selector, 3000)) {
        console.log(`✅ Re-login successful, found: ${selector}`)
        isReloggedIn = true
        break
      }
    }
    
    expect(isReloggedIn).toBe(true)
    
    // Verify fresh auth state
    const authAfterRelogin = await page.evaluate(() => {
      const babylonAuth = localStorage.getItem('babylon-auth')
      return {
        hasBabylonAuth: !!babylonAuth,
        babylonAuthData: babylonAuth ? JSON.parse(babylonAuth) : null,
      }
    })
    
    expect(authAfterRelogin.hasBabylonAuth).toBe(true)
    expect(authAfterRelogin.babylonAuthData?.state?.user).toBeDefined()
    
    await page.screenshot({ path: 'test-results/screenshots/08-05-relogin-successful.png' })
    
    console.log('✅ Re-login successful with fresh auth state!')
    
    // ============================================================================
    // FINAL SUMMARY
    // ============================================================================
    console.log('\n' + '='.repeat(80))
    console.log('🎉 LOGOUT VERIFICATION TEST PASSED!')
    console.log('='.repeat(80))
    console.log('✅ Can log in with Privy')
    console.log('✅ Can log out completely')
    console.log('✅ NOT anonymous after logout (all storage cleared)')
    console.log('✅ Login button visible after logout')
    console.log('✅ Can re-login successfully')
    console.log('='.repeat(80))
  })

  test('Verify logout persists across page refresh', async ({ page }) => {
    if (!hasPrivyTestCredentials()) {
      console.log('⚠️ Skipping test - Privy credentials not configured')
      test.skip()
      return
    }

    const testAccount = getPrivyTestAccount()
    
    // Login
    await loginWithPrivyEmail(page, testAccount)
    await page.waitForTimeout(3000)
    
    // Logout
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Log out")').first()
    if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutButton.click()
      await page.waitForTimeout(2000)
    } else {
      // Try opening menu first
      const menu = page.locator('[data-testid="user-menu"]').first()
      if (await menu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menu.click()
        await page.waitForTimeout(1000)
        const logoutInMenu = page.locator('button:has-text("Logout")').first()
        await logoutInMenu.click()
        await page.waitForTimeout(2000)
      }
    }
    
    // Refresh page
    console.log('🔄 Refreshing page after logout...')
    await page.reload()
    await waitForPageLoad(page)
    
    // Verify still logged out
    const authState = await page.evaluate(() => ({
      babylonAuth: localStorage.getItem('babylon-auth'),
      privyKeys: Object.keys(localStorage).filter(k => k.startsWith('privy')).length,
    }))
    
    expect(authState.babylonAuth).toBeNull()
    expect(authState.privyKeys).toBe(0)
    
    // Verify login button visible
    const loginVisible = await isVisible(page, 'button:has-text("Login"), button:has-text("Connect")', 5000)
    expect(loginVisible).toBe(true)
    
    console.log('✅ Logout persists across page refresh')
  })
})

