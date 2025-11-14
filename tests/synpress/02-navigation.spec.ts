/**
 * Navigation E2E Tests
 * 
 * Tests navigation across all pages:
 * - Sidebar navigation
 * - Mobile bottom navigation
 * - Direct URL access
 * - Back/forward navigation
 */

import { test, expect } from '@playwright/test'
import { loginWithPrivyEmail, getPrivyTestAccount } from './helpers/privy-auth'
import { navigateTo, waitForPageLoad, isVisible, verifyNavigation } from './helpers/page-helpers'
import { ROUTES } from './helpers/test-data'

test.describe('Navigation - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await waitForPageLoad(page)
  })

  test('should navigate to Feed page', async ({ page }) => {
    await navigateTo(page, ROUTES.FEED)
    await verifyNavigation(page, '/feed')
    
    await page.screenshot({ path: 'test-results/screenshots/02-feed-page.png' })
    console.log('✅ Feed page loaded')
  })

  test('should navigate to Game page', async ({ page }) => {
    await navigateTo(page, ROUTES.GAME)
    await verifyNavigation(page, '/game')
    
    await page.screenshot({ path: 'test-results/screenshots/02-game-page.png' })
    console.log('✅ Game page loaded')
  })

  test('should navigate to Markets page', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await verifyNavigation(page, '/markets')
    
    await page.screenshot({ path: 'test-results/screenshots/02-markets-page.png' })
    console.log('✅ Markets page loaded')
  })

  test('should navigate to Leaderboard page', async ({ page }) => {
    await navigateTo(page, ROUTES.LEADERBOARD)
    await verifyNavigation(page, '/leaderboard')
    
    await page.screenshot({ path: 'test-results/screenshots/02-leaderboard-page.png' })
    console.log('✅ Leaderboard page loaded')
  })

  test('should navigate to Profile page', async ({ page }) => {
    await navigateTo(page, ROUTES.PROFILE)
    await verifyNavigation(page, '/profile')
    
    await page.screenshot({ path: 'test-results/screenshots/02-profile-page.png' })
    console.log('✅ Profile page loaded')
  })

  test('should navigate to Settings page', async ({ page }) => {
    await navigateTo(page, ROUTES.SETTINGS)
    await verifyNavigation(page, '/settings')
    
    await page.screenshot({ path: 'test-results/screenshots/02-settings-page.png' })
    console.log('✅ Settings page loaded')
  })

  test('should navigate to Chats page', async ({ page }) => {
    await navigateTo(page, ROUTES.CHATS)
    await verifyNavigation(page, '/chats')
    
    await page.screenshot({ path: 'test-results/screenshots/02-chats-page.png' })
    console.log('✅ Chats page loaded')
  })

  test('should navigate to Notifications page', async ({ page }) => {
    await navigateTo(page, ROUTES.NOTIFICATIONS)
    await verifyNavigation(page, '/notifications')
    
    await page.screenshot({ path: 'test-results/screenshots/02-notifications-page.png' })
    console.log('✅ Notifications page loaded')
  })

  test('should navigate to Referrals page', async ({ page }) => {
    await navigateTo(page, ROUTES.REFERRALS)
    await verifyNavigation(page, '/referrals')
    
    await page.screenshot({ path: 'test-results/screenshots/02-referrals-page.png' })
    console.log('✅ Referrals page loaded')
  })

  test('should navigate to Rewards page', async ({ page }) => {
    await navigateTo(page, ROUTES.REWARDS)
    await verifyNavigation(page, '/rewards')
    
    await page.screenshot({ path: 'test-results/screenshots/02-rewards-page.png' })
    console.log('✅ Rewards page loaded')
  })

  test('should navigate to Registry page', async ({ page }) => {
    await navigateTo(page, ROUTES.REGISTRY)
    await verifyNavigation(page, '/registry')
    
    await page.screenshot({ path: 'test-results/screenshots/02-registry-page.png' })
    console.log('✅ Registry page loaded')
  })

  test('should navigate to API Docs page', async ({ page }) => {
    await navigateTo(page, ROUTES.API_DOCS)
    await verifyNavigation(page, '/api-docs')
    
    await page.screenshot({ path: 'test-results/screenshots/02-api-docs-page.png' })
    console.log('✅ API Docs page loaded')
  })
})

test.describe('Navigation - Sidebar Links', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await waitForPageLoad(page)
  })

  test('should have working sidebar navigation links', async ({ page }) => {
    // Check if sidebar is visible (desktop)
    const sidebarVisible = await isVisible(page, 'aside, nav[aria-label*="sidebar" i]')
    
    if (sidebarVisible) {
      console.log('✅ Sidebar is visible')
      
      // Get all navigation links
      const navLinks = await page.locator('aside a, nav[aria-label*="sidebar" i] a').all()
      console.log(`Found ${navLinks.length} navigation links`)
      
      // Click first few links to verify they work
      const linksToTest = Math.min(5, navLinks.length)
      for (let i = 0; i < linksToTest; i++) {
        const link = navLinks[i]
        const href = await link.getAttribute('href')
        if (href && !href.startsWith('#') && !href.startsWith('http')) {
          await link.click()
          await waitForPageLoad(page)
          console.log(`✅ Navigated via sidebar to: ${href}`)
          await page.waitForTimeout(1000)
        }
      }
    } else {
      console.log('ℹ️ Sidebar not visible (mobile view)')
    }
  })
})

test.describe('Navigation - Mobile Bottom Nav', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await waitForPageLoad(page)
  })

  test('should have working bottom navigation on mobile', async ({ page }) => {
    // Check if bottom nav is visible
    const bottomNavVisible = await isVisible(page, 'nav[aria-label*="bottom" i], [data-testid="bottom-nav"]')
    
    if (bottomNavVisible) {
      console.log('✅ Bottom navigation is visible')
      
      await page.screenshot({ path: 'test-results/screenshots/02-mobile-bottom-nav.png' })
      
      // Get all bottom nav buttons/links
      const navButtons = await page.locator('nav[aria-label*="bottom" i] button, nav[aria-label*="bottom" i] a, [data-testid="bottom-nav"] button, [data-testid="bottom-nav"] a').all()
      console.log(`Found ${navButtons.length} bottom nav items`)
      
      // Click each button
      for (const button of navButtons) {
        const text = await button.textContent()
        if (text && text.trim()) {
          await button.click()
          await page.waitForTimeout(1000)
          await waitForPageLoad(page)
          console.log(`✅ Clicked bottom nav item: ${text.trim()}`)
        }
      }
    } else {
      console.log('ℹ️ Bottom navigation not visible')
    }
  })
})

test.describe('Navigation - Browser Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await waitForPageLoad(page)
  })

  test('should handle browser back navigation', async ({ page }) => {
    // Navigate to multiple pages
    await navigateTo(page, ROUTES.FEED)
    await navigateTo(page, ROUTES.MARKETS)
    await navigateTo(page, ROUTES.PROFILE)
    
    // Go back
    await page.goBack()
    await waitForPageLoad(page)
    expect(page.url()).toContain('/markets')
    
    await page.goBack()
    await waitForPageLoad(page)
    expect(page.url()).toContain('/feed')
    
    console.log('✅ Browser back navigation works')
  })

  test('should handle browser forward navigation', async ({ page }) => {
    // Navigate and go back
    await navigateTo(page, ROUTES.FEED)
    await navigateTo(page, ROUTES.MARKETS)
    await page.goBack()
    await waitForPageLoad(page)
    
    // Go forward
    await page.goForward()
    await waitForPageLoad(page)
    expect(page.url()).toContain('/markets')
    
    console.log('✅ Browser forward navigation works')
  })
})

test.describe('Navigation - Deep Links', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
  })

  test('should handle direct URL access to all pages', async ({ page }) => {
    const routes = Object.values(ROUTES).filter(route => 
      !route.includes(':') && // Skip dynamic routes
      route !== ROUTES.ADMIN // Skip admin (requires special permissions)
    )
    
    for (const route of routes) {
      await navigateTo(page, route)
      await verifyNavigation(page, route)
      console.log(`✅ Direct access to ${route} works`)
      await page.waitForTimeout(500)
    }
  })
})

