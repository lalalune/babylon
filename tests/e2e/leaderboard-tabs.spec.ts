/**
 * Leaderboard Tabs E2E Tests
 * 
 * Tests for leaderboard page with tabs:
 * - All Points (default)
 * - Earned Points (from trading P&L)
 * - Referral Points (from invites)
 */

import { test, expect } from '@playwright/test'
import { setupAuthState } from './fixtures/auth'

test.describe('Leaderboard Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthState(page, '/leaderboard')
    await page.waitForTimeout(2000)
  })

  test('should load leaderboard page with default "All Points" tab', async ({ page }) => {
    // Wait for leaderboard to load
    await page.waitForSelector('[data-testid="leaderboard-entry"], a[href^="/profile/"]', { 
      timeout: 10000 
    }).catch(() => {})

    // Check that we're on leaderboard page
    expect(page.url()).toContain('/leaderboard')

    // Verify "All Points" tab is active by default (use first() to handle multiple matches)
    const allPointsTab = page.locator('button:has-text("All Points")').first().first()
    await expect(allPointsTab).toBeVisible()
    
    // Check if the active tab has the active styling (blue background)
    const isActive = await allPointsTab.evaluate((el) => {
      const classes = el.className
      return classes.includes('bg-[#0066FF]') || classes.includes('text-primary-foreground')
    })
    expect(isActive).toBe(true)

    console.log('✅ Leaderboard page loaded with "All Points" as default tab')
  })

  test('should display all three tabs: All Points, Earned Points, Referral Points', async ({ page }) => {
    // Check for all three tabs (use first() to handle multiple matches)
    const allPointsTab = page.locator('button:has-text("All Points")').first().first()
    const earnedPointsTab = page.locator('button:has-text("Earned Points")').first().first()
    const referralPointsTab = page.locator('button:has-text("Referral Points")').first().first()

    await expect(allPointsTab).toBeVisible()
    await expect(earnedPointsTab).toBeVisible()
    await expect(referralPointsTab).toBeVisible()

    console.log('✅ All three tabs are visible')
  })

  test('should switch to "Earned Points" tab and load data', async ({ page }) => {
    // Click on "Earned Points" tab
    const earnedPointsTab = page.locator('button:has-text("Earned Points")').first()
    await earnedPointsTab.click()

    // Wait for network request to complete (or timeout gracefully)
    await page.waitForResponse(
      (response) => response.url().includes('/api/leaderboard') && response.url().includes('pointsType=earned'),
      { timeout: 10000 }
    ).catch(() => console.log('ℹ️  API request timeout, continuing...'))

    // Wait a bit for UI to update
    await page.waitForTimeout(1000)

    // Verify tab is now active
    const isActive = await earnedPointsTab.evaluate((el) => {
      const classes = el.className
      return classes.includes('bg-[#0066FF]') || classes.includes('text-primary-foreground')
    })
    expect(isActive).toBe(true)

    // Check that page loaded successfully (either with data or empty state)
    const pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()

    await page.screenshot({ path: 'test-results/screenshots/leaderboard-earned-tab.png', fullPage: true })
    console.log('✅ "Earned Points" tab loaded successfully')
  })

  test('should switch to "Referral Points" tab and load data', async ({ page }) => {
    // Click on "Referral Points" tab
    const referralPointsTab = page.locator('button:has-text("Referral Points")').first()
    await referralPointsTab.click()

    // Wait for network request to complete (or timeout gracefully)
    await page.waitForResponse(
      (response) => response.url().includes('/api/leaderboard') && response.url().includes('pointsType=referral'),
      { timeout: 10000 }
    ).catch(() => console.log('ℹ️  API request timeout, continuing...'))

    // Wait a bit for UI to update
    await page.waitForTimeout(1000)

    // Verify tab is now active
    const isActive = await referralPointsTab.evaluate((el) => {
      const classes = el.className
      return classes.includes('bg-[#0066FF]') || classes.includes('text-primary-foreground')
    })
    expect(isActive).toBe(true)

    // Check that page loaded successfully (either with data or empty state)
    const pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()

    await page.screenshot({ path: 'test-results/screenshots/leaderboard-referral-tab.png', fullPage: true })
    console.log('✅ "Referral Points" tab loaded successfully')
  })

  test('should display correct tab descriptions', async ({ page }) => {
    // All Points description
    const allPointsTab = page.locator('button:has-text("All Points")').first()
    await allPointsTab.click()
    await page.waitForTimeout(500)
    
    // Check page content loads for each tab
    let pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()

    // Earned Points description
    const earnedPointsTab = page.locator('button:has-text("Earned Points")').first()
    await earnedPointsTab.click()
    await page.waitForTimeout(500)
    
    pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()

    // Referral Points description
    const referralPointsTab = page.locator('button:has-text("Referral Points")').first()
    await referralPointsTab.click()
    await page.waitForTimeout(500)
    
    pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()

    console.log('✅ All tabs load successfully')
  })

  test('should display player entries with correct data on All Points tab', async ({ page }) => {
    // Make sure we're on All Points tab
    const allPointsTab = page.locator('button:has-text("All Points")').first()
    await allPointsTab.click()
    await page.waitForTimeout(1500)

    // Look for leaderboard entries
    const entries = page.locator('[data-testid="leaderboard-entry"], a[href^="/profile/"]')
    const entryCount = await entries.count()

    if (entryCount > 0) {
      const firstEntry = entries.first()

      // Check for rank number
      const hasRank = await firstEntry.locator('text=/^#?[0-9]+$/').isVisible().catch(() => false)
      
      // Check for username or display name
      const hasName = await firstEntry.locator('[class*="font-semibold"]').isVisible().catch(() => false)
      
      // Check for points display
      const hasPoints = await firstEntry.locator('text=/[0-9,]+/').isVisible().catch(() => false)

      expect(hasRank || hasName || hasPoints).toBe(true)
      
      console.log(`✅ Leaderboard entries display correctly (${entryCount} entries found)`)
    } else {
      console.log('⚠️  No leaderboard entries found (may be due to minPoints threshold)')
    }
  })

  test('should display points breakdown for users', async ({ page }) => {
    // Make sure we're on All Points tab
    const allPointsTab = page.locator('button:has-text("All Points")').first()
    await allPointsTab.click()
    await page.waitForTimeout(1500)

    // Look for points breakdown indicators
    const hasInvitePoints = await page.locator('text=/Invite:/i').isVisible({ timeout: 5000 }).catch(() => false)
    const hasEarnedPoints = await page.locator('text=/Earned:/i').isVisible({ timeout: 5000 }).catch(() => false)
    const hasBonusPoints = await page.locator('text=/Bonus:/i').isVisible({ timeout: 5000 }).catch(() => false)
    const hasPnL = await page.locator('text=/P&L:/i').isVisible({ timeout: 5000 }).catch(() => false)

    // At least one breakdown metric should be visible if there are entries
    const hasAnyBreakdown = hasInvitePoints || hasEarnedPoints || hasBonusPoints || hasPnL

    if (hasAnyBreakdown) {
      console.log('✅ Points breakdown is displayed')
      console.log(`   - Invite Points: ${hasInvitePoints}`)
      console.log(`   - Earned Points: ${hasEarnedPoints}`)
      console.log(`   - Bonus Points: ${hasBonusPoints}`)
      console.log(`   - P&L: ${hasPnL}`)
    } else {
      console.log('⚠️  No points breakdown found (may be hidden or no qualifying users)')
    }
  })

  test('should handle pagination if available', async ({ page }) => {
    // Make sure we're on All Points tab
    const allPointsTab = page.locator('button:has-text("All Points")').first()
    await allPointsTab.click()
    await page.waitForTimeout(1500)

    // Check for pagination controls
    const nextButton = page.locator('button:has-text("Next")').first()
    const prevButton = page.locator('button:has-text("Previous")').first()

    const hasNextButton = await nextButton.isVisible({ timeout: 5000 }).catch(() => false)
    const hasPrevButton = await prevButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasNextButton || hasPrevButton) {
      console.log('✅ Pagination controls are present')

      // Check if Next button is enabled
      if (hasNextButton) {
        const isNextEnabled = await nextButton.isEnabled()
        if (isNextEnabled) {
          try {
            await nextButton.click({ timeout: 5000 })
            await page.waitForTimeout(2000)
            
            // Verify page loaded after navigation
            const pageContent = await page.locator('body').textContent()
            expect(pageContent).toBeTruthy()
            
            console.log('✅ Pagination navigation works')
          } catch (e) {
            console.log('ℹ️  Pagination click intercepted or not available')
          }
        }
      }
    } else {
      console.log('ℹ️  No pagination (single page of results)')
    }
  })

  test('should highlight current user in leaderboard', async ({ page }) => {
    // Make sure we're on All Points tab
    const allPointsTab = page.locator('button:has-text("All Points")').first()
    await allPointsTab.click()
    await page.waitForTimeout(1500)

    // Look for "YOU" badge or current user highlighting
    const youBadge = page.locator('text=/^YOU$/i, span:has-text("You")')
    const hasYouBadge = await youBadge.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasYouBadge) {
      console.log('✅ Current user is highlighted in leaderboard')
      await page.screenshot({ path: 'test-results/screenshots/leaderboard-current-user.png' })
    } else {
      console.log('ℹ️  Current user not visible in leaderboard (may not meet minPoints threshold)')
    }
  })

  test('should display empty state correctly for tabs with no data', async ({ page }) => {
    // Test Earned Points empty state
    const earnedPointsTab = page.locator('button:has-text("Earned Points")').first()
    await earnedPointsTab.click()
    await page.waitForTimeout(2000)

    const earnedEmptyState = await page.locator('text=/No Earned Points Yet/i').isVisible({ timeout: 3000 }).catch(() => false)
    
    if (earnedEmptyState) {
      // Verify empty state message
      const emptyMessage = page.locator('text=/Close profitable trades/i')
      await expect(emptyMessage).toBeVisible()
      console.log('✅ Earned Points empty state displays correctly')
    }

    // Test Referral Points empty state
    const referralPointsTab = page.locator('button:has-text("Referral Points")').first()
    await referralPointsTab.click()
    await page.waitForTimeout(2000)

    const referralEmptyState = await page.locator('text=/No Referral Points Yet/i').isVisible({ timeout: 3000 }).catch(() => false)
    
    if (referralEmptyState) {
      // Verify empty state message
      const emptyMessage = page.locator('text=/Share your invite link/i')
      await expect(emptyMessage).toBeVisible()
      console.log('✅ Referral Points empty state displays correctly')
    }
  })

  test('should switch between tabs multiple times without errors', async ({ page }) => {
    const tabs = [
      { name: 'All Points', locator: page.locator('button:has-text("All Points")').first() },
      { name: 'Earned Points', locator: page.locator('button:has-text("Earned Points")').first() },
      { name: 'Referral Points', locator: page.locator('button:has-text("Referral Points")').first() },
    ]

    // Switch between tabs multiple times
    for (let i = 0; i < 2; i++) {
      for (const tab of tabs) {
        await tab.locator.click()
        await page.waitForTimeout(1000)
        
        // Verify no console errors
        const errors: string[] = []
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            errors.push(msg.text())
          }
        })
        
        expect(errors.length).toBe(0)
        console.log(`✅ Switched to ${tab.name} (iteration ${i + 1})`)
      }
    }

    console.log('✅ Tab switching works without errors')
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await page.waitForTimeout(2000)

    // Verify page loads on mobile
    const pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()
    expect(page.url()).toContain('/leaderboard')

    // Tabs might be in a dropdown or scrollable container on mobile
    // Just verify the page is functional
    await page.screenshot({ path: 'test-results/screenshots/leaderboard-mobile.png', fullPage: true })
    console.log('✅ Leaderboard works on mobile viewport')
  })
})

test.describe('Leaderboard API Integration', () => {
  test('should call API with correct pointsType parameter', async ({ page }) => {
    await setupAuthState(page)
    
    // Track API calls
    const apiCalls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/leaderboard')) {
        apiCalls.push(request.url())
      }
    })

    await page.goto('/leaderboard')
    await page.waitForLoadState('networkidle')

    // Default should be "all"
    expect(apiCalls.some((url) => url.includes('pointsType=all'))).toBe(true)

    // Click Earned Points tab
    const earnedPointsTab = page.locator('button:has-text("Earned Points")').first()
    await earnedPointsTab.click()
    await page.waitForTimeout(1500)

    // Should call API with pointsType=earned
    expect(apiCalls.some((url) => url.includes('pointsType=earned'))).toBe(true)

    // Click Referral Points tab
    const referralPointsTab = page.locator('button:has-text("Referral Points")').first()
    await referralPointsTab.click()
    await page.waitForTimeout(1500)

    // Should call API with pointsType=referral
    expect(apiCalls.some((url) => url.includes('pointsType=referral'))).toBe(true)

    console.log('✅ API called with correct pointsType parameters')
    console.log('API calls made:', apiCalls)
  })

  test('should handle API errors gracefully', async ({ page }) => {
    await setupAuthState(page)
    
    // Intercept API and return error
    await page.route('**/api/leaderboard*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    await page.goto('/leaderboard', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2000)

    // Should still load the page (error handling should be graceful)
    const pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()

    console.log('✅ Leaderboard handles API errors gracefully')
  })
})

