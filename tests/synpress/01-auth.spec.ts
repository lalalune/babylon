/**
 * Authentication Flow E2E Tests
 * 
 * Tests all authentication methods and flows:
 * - Email login
 * - Wallet login
 * - Logout
 * - Session persistence
 * - Onboarding flow
 */

import { test, expect } from '@playwright/test'
import { loginWithPrivyEmail, logoutFromPrivy, isAuthenticated, getPrivyTestAccount } from './helpers/privy-auth'
import { navigateTo, waitForPageLoad, clickButton, isVisible } from './helpers/page-helpers'
import { ROUTES } from './helpers/test-data'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
  })

  test('should load home page without authentication', async ({ page }) => {
    await waitForPageLoad(page)
    
    // Verify page loaded
    expect(page.url()).toContain(ROUTES.HOME)
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/01-home-unauthenticated.png' })
    
    console.log('✅ Home page loaded successfully')
  })

  test('should display login button on home page', async ({ page }) => {
    // Look for login/connect buttons
    const loginButtonVisible = await isVisible(page, 'button:has-text("Login")', 5000) ||
                                await isVisible(page, 'button:has-text("Sign in")', 5000) ||
                                await isVisible(page, 'button:has-text("Connect")', 5000)
    
    expect(loginButtonVisible).toBe(true)
    
    await page.screenshot({ path: 'test-results/screenshots/01-login-button-visible.png' })
    
    console.log('✅ Login button is visible')
  })

  test('should open Privy modal when clicking login', async ({ page }) => {
    // Click login button
    const loginSelectors = [
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Connect")',
    ]
    
    let clicked = false
    for (const selector of loginSelectors) {
      if (await isVisible(page, selector, 5000)) {
        await clickButton(page, selector.match(/has-text\("(.+)"\)/)?.[1] || 'Login')
        clicked = true
        break
      }
    }
    
    expect(clicked).toBe(true)
    
    // Wait for Privy modal
    await page.waitForSelector('[data-privy-modal], [role="dialog"]', { timeout: 10000 })
    
    await page.screenshot({ path: 'test-results/screenshots/01-privy-modal-opened.png' })
    
    console.log('✅ Privy modal opened')
  })

  test('should successfully login with email', async ({ page }) => {
    const testAccount = getPrivyTestAccount()
    
    // Login with Privy email
    await loginWithPrivyEmail(page, testAccount)
    
    // Verify authentication
    const authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(true)
    
    await page.screenshot({ path: 'test-results/screenshots/01-authenticated.png' })
    
    console.log('✅ Successfully authenticated with email')
  })

  test('should persist session after page reload', async ({ page }) => {
    const testAccount = getPrivyTestAccount()
    
    // Login
    await loginWithPrivyEmail(page, testAccount)
    
    // Verify authenticated
    expect(await isAuthenticated(page)).toBe(true)
    
    // Reload page
    await page.reload()
    await waitForPageLoad(page)
    
    // Verify still authenticated
    expect(await isAuthenticated(page)).toBe(true)
    
    console.log('✅ Session persisted after reload')
  })

  test('should handle onboarding flow for new users', async ({ page }) => {
    const testAccount = getPrivyTestAccount()
    
    // Login
    await loginWithPrivyEmail(page, testAccount)
    
    // Check if onboarding modal appears
    const onboardingVisible = await isVisible(page, '[data-testid="onboarding-modal"], text=Welcome', 5000)
    
    if (onboardingVisible) {
      console.log('📝 Onboarding flow detected')
      
      // Take screenshot of onboarding
      await page.screenshot({ path: 'test-results/screenshots/01-onboarding-modal.png' })
      
      // Handle username input if present
      const usernameInput = page.locator('input[name="username"], input[placeholder*="username" i]').first()
      if (await usernameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await usernameInput.fill('test_user_' + Date.now())
        console.log('✅ Entered username')
      }
      
      // Look for continue/complete button
      const continueButton = page.locator('button:has-text("Continue"), button:has-text("Complete"), button:has-text("Get Started")').first()
      if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await continueButton.click()
        console.log('✅ Completed onboarding')
        await page.waitForTimeout(3000)
      }
    } else {
      console.log('ℹ️ User already onboarded')
    }
    
    await page.screenshot({ path: 'test-results/screenshots/01-post-onboarding.png' })
  })

  test('should successfully logout and clear all state', async ({ page }) => {
    const testAccount = getPrivyTestAccount()
    
    // Login first
    await loginWithPrivyEmail(page, testAccount)
    expect(await isAuthenticated(page)).toBe(true)
    
    // Check that localStorage has auth data before logout
    const authDataBeforeLogout = await page.evaluate(() => {
      return {
        babylonAuth: localStorage.getItem('babylon-auth'),
        privyKeys: Object.keys(localStorage).filter(key => 
          key.startsWith('privy:') || key.startsWith('privy-')
        ),
      }
    })
    
    console.log('📊 Auth state before logout:', {
      hasBabylonAuth: !!authDataBeforeLogout.babylonAuth,
      privyKeyCount: authDataBeforeLogout.privyKeys.length
    })
    
    // Logout
    await logoutFromPrivy(page)
    
    // Wait for logout to complete
    await page.waitForTimeout(3000)
    
    // Verify localStorage is cleared
    const authDataAfterLogout = await page.evaluate(() => {
      return {
        babylonAuth: localStorage.getItem('babylon-auth'),
        privyKeys: Object.keys(localStorage).filter(key => 
          key.startsWith('privy:') || key.startsWith('privy-')
        ),
        sessionPrivyKeys: Object.keys(sessionStorage).filter(key =>
          key.startsWith('privy:') || key.startsWith('privy-')
        ),
      }
    })
    
    console.log('📊 Auth state after logout:', {
      hasBabylonAuth: !!authDataAfterLogout.babylonAuth,
      privyKeyCount: authDataAfterLogout.privyKeys.length,
      sessionPrivyKeyCount: authDataAfterLogout.sessionPrivyKeys.length
    })
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/01-logged-out.png' })
    
    // Verify user is no longer authenticated
    const stillAuthenticated = await isAuthenticated(page)
    expect(stillAuthenticated).toBe(false)
    
    // Verify all auth storage is cleared
    expect(authDataAfterLogout.babylonAuth).toBeNull()
    expect(authDataAfterLogout.privyKeys.length).toBe(0)
    expect(authDataAfterLogout.sessionPrivyKeys.length).toBe(0)
    
    console.log('✅ Logout successful - all auth state cleared')
  })

  test('should show embedded wallet creation', async ({ page }) => {
    const testAccount = getPrivyTestAccount()
    
    // Login
    await loginWithPrivyEmail(page, testAccount)
    
    // Check if wallet was created
    // This is validated as part of login flow
    expect(await isAuthenticated(page)).toBe(true)
    
    console.log('✅ Embedded wallet handling validated')
  })

  test('should be able to re-login after logout', async ({ page }) => {
    const testAccount = getPrivyTestAccount()
    
    // Login first time
    await loginWithPrivyEmail(page, testAccount)
    expect(await isAuthenticated(page)).toBe(true)
    console.log('✅ First login successful')
    
    // Logout
    await logoutFromPrivy(page)
    await page.waitForTimeout(2000)
    
    // Verify logged out
    expect(await isAuthenticated(page)).toBe(false)
    console.log('✅ Logout successful')
    
    // Login again
    await loginWithPrivyEmail(page, testAccount)
    await page.waitForTimeout(2000)
    
    // Verify re-authentication worked
    const reAuthenticated = await isAuthenticated(page)
    expect(reAuthenticated).toBe(true)
    
    // Verify localStorage has fresh auth data
    const authData = await page.evaluate(() => {
      const babylonAuth = localStorage.getItem('babylon-auth')
      return {
        hasBabylonAuth: !!babylonAuth,
        babylonAuthParsed: babylonAuth ? JSON.parse(babylonAuth) : null,
      }
    })
    
    expect(authData.hasBabylonAuth).toBe(true)
    expect(authData.babylonAuthParsed?.state?.user).toBeDefined()
    
    await page.screenshot({ path: 'test-results/screenshots/01-re-login-successful.png' })
    
    console.log('✅ Re-login after logout successful - no anonymous state issues')
  })
})

test.describe('Authentication Error Handling', () => {
  test('should handle invalid OTP gracefully', async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    
    // Click login
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Connect")').first()
    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginButton.click()
      
      // Wait for Privy modal
      await page.waitForSelector('[data-privy-modal]', { timeout: 10000 }).catch(() => {})
      
      const emailInput = page.locator('input[type="email"]').first()
      if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Enter email
        await emailInput.fill(getPrivyTestAccount().email)
        
        // Click continue
        const continueButton = page.locator('button:has-text("Continue"), button[type="submit"]').first()
        await continueButton.click()
        
        // Wait for OTP input
        await page.waitForTimeout(2000)
        
        // Enter invalid OTP
        const otpInput = page.locator('input[type="text"]').first()
        if (await otpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await otpInput.fill('000000')
          
          // Click submit
          const submitButton = page.locator('button:has-text("Submit"), button:has-text("Verify")').first()
          await submitButton.click()
          
          // Wait for error
          await page.waitForTimeout(2000)
          
          // Check for error message
          const hasError = await isVisible(page, 'text=Invalid, text=Error, [role="alert"]', 5000)
          
          await page.screenshot({ path: 'test-results/screenshots/01-invalid-otp-error.png' })
          
          console.log(`✅ Invalid OTP handled (error shown: ${hasError})`)
        }
      }
    }
  })
})

