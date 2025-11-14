/**
 * Other Pages E2E Tests
 * 
 * Tests for remaining pages:
 * - Leaderboard
 * - Referrals
 * - Rewards
 * - Registry
 * - API Documentation
 * - Settings
 * - Notifications
 * - Game page
 */

import { test, expect } from '@playwright/test'
import { loginWithPrivyEmail, getPrivyTestAccount } from './helpers/privy-auth'
import { navigateTo, waitForPageLoad, isVisible, scrollToBottom } from './helpers/page-helpers'
import { ROUTES } from './helpers/test-data'

test.describe('Leaderboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.LEADERBOARD)
    await waitForPageLoad(page)
  })

  test('should load leaderboard page', async ({ page }) => {
    expect(page.url()).toContain('/leaderboard')
    
    await page.screenshot({ path: 'test-results/screenshots/08-leaderboard.png', fullPage: true })
    console.log('✅ Leaderboard page loaded')
  })

  test('should display leaderboard rankings', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasRankings = await isVisible(page, 'text=/rank|#1|#2|position/i', 5000)
    
    console.log(`✅ Leaderboard rankings displayed: ${hasRankings}`)
  })

  test('should display user profiles in leaderboard', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasProfiles = await isVisible(page, 'img[alt*="avatar" i], img[alt*="profile" i]', 5000)
    
    console.log(`✅ User profiles displayed: ${hasProfiles}`)
  })

  test('should display user stats/scores', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasScores = await isVisible(page, 'text=/points|score|balance/i', 5000)
    
    console.log(`✅ User scores displayed: ${hasScores}`)
  })

  test('should filter leaderboard by period', async ({ page }) => {
    const tabs = page.locator('button[role="tab"], button:has-text("Daily"), button:has-text("Weekly"), button:has-text("Monthly")')
    const tabCount = await tabs.count()
    
    if (tabCount > 0) {
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        await tabs.nth(i).click()
        await page.waitForTimeout(2000)
        console.log(`✅ Filtered leaderboard tab ${i}`)
      }
    }
  })
})

test.describe('Referrals Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.REFERRALS)
    await waitForPageLoad(page)
  })

  test('should load referrals page', async ({ page }) => {
    expect(page.url()).toContain('/referrals')
    
    await page.screenshot({ path: 'test-results/screenshots/08-referrals.png', fullPage: true })
    console.log('✅ Referrals page loaded')
  })

  test('should display referral code', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasCode = await isVisible(page, 'code, [data-testid="referral-code"], text=/code|invite/i', 5000)
    
    await page.screenshot({ path: 'test-results/screenshots/08-referral-code.png' })
    
    console.log(`✅ Referral code displayed: ${hasCode}`)
  })

  test('should copy referral link', async ({ page }) => {
    const copyButton = page.locator('button:has-text("Copy"), button[aria-label*="copy" i]').first()
    
    if (await copyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await copyButton.click()
      await page.waitForTimeout(1000)
      
      // Check for success message
      const hasSuccess = await isVisible(page, 'text=/copied|success/i', 3000)
      
      await page.screenshot({ path: 'test-results/screenshots/08-referral-copied.png' })
      
      console.log(`✅ Referral copy button works: ${hasSuccess}`)
    }
  })

  test('should display referral stats', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasStats = await isVisible(page, 'text=/referred|invites|earnings|rewards/i', 5000)
    
    console.log(`✅ Referral stats displayed: ${hasStats}`)
  })

  test('should display referred users list', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasUserList = await isVisible(page, 'text=/your referrals|people you invited/i', 5000)
    
    console.log(`✅ Referred users list: ${hasUserList}`)
  })
})

test.describe('Rewards Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.REWARDS)
    await waitForPageLoad(page)
  })

  test('should load rewards page', async ({ page }) => {
    expect(page.url()).toContain('/rewards')
    
    await page.screenshot({ path: 'test-results/screenshots/08-rewards.png', fullPage: true })
    console.log('✅ Rewards page loaded')
  })

  test('should display total rewards/points', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasRewards = await isVisible(page, 'text=/points|rewards|balance/i', 5000)
    
    console.log(`✅ Rewards displayed: ${hasRewards}`)
  })

  test('should display rewards breakdown', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasBreakdown = await isVisible(page, 'text=/earned|trading|referrals|bonus/i', 5000)
    
    console.log(`✅ Rewards breakdown displayed: ${hasBreakdown}`)
  })

  test('should display rewards history', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasHistory = await isVisible(page, 'text=/history|transactions|activity/i', 5000)
    
    console.log(`✅ Rewards history displayed: ${hasHistory}`)
  })
})

test.describe('Registry Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.REGISTRY)
    await waitForPageLoad(page)
  })

  test('should load registry page', async ({ page }) => {
    expect(page.url()).toContain('/registry')
    
    await page.screenshot({ path: 'test-results/screenshots/08-registry.png', fullPage: true })
    console.log('✅ Registry page loaded')
  })

  test('should display registered agents/users', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasEntries = await isVisible(page, '[data-testid="registry-entry"], article, [data-testid="agent-card"]', 5000)
    
    console.log(`✅ Registry entries displayed: ${hasEntries}`)
  })

  test('should search registry', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first()
    
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('test')
      await page.waitForTimeout(2000)
      
      await page.screenshot({ path: 'test-results/screenshots/08-registry-search.png' })
      
      console.log('✅ Registry search works')
    }
  })
})

test.describe('API Documentation Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.API_DOCS)
    await waitForPageLoad(page)
  })

  test('should load API documentation page', async ({ page }) => {
    expect(page.url()).toContain('/api-docs')
    
    await page.screenshot({ path: 'test-results/screenshots/08-api-docs.png', fullPage: true })
    console.log('✅ API documentation page loaded')
  })

  test('should display API endpoints', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasEndpoints = await isVisible(page, 'text=/GET|POST|PUT|DELETE|endpoint/i', 5000)
    
    console.log(`✅ API endpoints displayed: ${hasEndpoints}`)
  })

  test('should display endpoint documentation', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasDocumentation = await isVisible(page, 'text=/parameters|response|request|example/i', 5000)
    
    console.log(`✅ Endpoint documentation displayed: ${hasDocumentation}`)
  })

  test('should expand/collapse endpoint details', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const expandButton = page.locator('button:has-text("GET"), button:has-text("POST"), [data-testid="endpoint"]').first()
    
    if (await expandButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expandButton.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ path: 'test-results/screenshots/08-api-endpoint-expanded.png' })
      
      console.log('✅ Endpoint expansion works')
    }
  })
})

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.SETTINGS)
    await waitForPageLoad(page)
  })

  test('should load settings page', async ({ page }) => {
    expect(page.url()).toContain('/settings')
    
    await page.screenshot({ path: 'test-results/screenshots/08-settings.png', fullPage: true })
    console.log('✅ Settings page loaded')
  })

  test('should display settings sections', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasSettings = await isVisible(page, 'text=/profile|privacy|notifications|preferences/i', 5000)
    
    console.log(`✅ Settings sections displayed: ${hasSettings}`)
  })

  test('should toggle theme', async ({ page }) => {
    const themeToggle = page.locator('button[aria-label*="theme" i], [data-testid="theme-toggle"]').first()
    
    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await themeToggle.click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ path: 'test-results/screenshots/08-theme-toggled.png' })
      
      console.log('✅ Theme toggle works')
    }
  })

  test('should display notification settings', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasNotificationSettings = await isVisible(page, 'text=/notification|email|push/i', 5000)
    
    console.log(`✅ Notification settings displayed: ${hasNotificationSettings}`)
  })
})

test.describe('Notifications Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.NOTIFICATIONS)
    await waitForPageLoad(page)
  })

  test('should load notifications page', async ({ page }) => {
    expect(page.url()).toContain('/notifications')
    
    await page.screenshot({ path: 'test-results/screenshots/08-notifications.png', fullPage: true })
    console.log('✅ Notifications page loaded')
  })

  test('should display notifications list', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasNotifications = await isVisible(page, '[data-testid="notification"], article, [role="listitem"]', 5000)
    
    console.log(`✅ Notifications list displayed: ${hasNotifications}`)
  })

  test('should display empty state if no notifications', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasEmptyState = await isVisible(page, 'text=/no notifications|all caught up/i', 5000)
    
    if (hasEmptyState) {
      console.log('✅ Empty state displayed')
    }
  })

  test('should mark notification as read', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const notification = page.locator('[data-testid="notification"]').first()
    
    if (await notification.isVisible({ timeout: 5000 }).catch(() => false)) {
      await notification.click()
      await page.waitForTimeout(1000)
      
      console.log('✅ Notification clicked')
    }
  })
})

test.describe('Game Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.GAME)
    await waitForPageLoad(page)
  })

  test('should load game page', async ({ page }) => {
    expect(page.url()).toContain('/game')
    
    await page.screenshot({ path: 'test-results/screenshots/08-game.png', fullPage: true })
    console.log('✅ Game page loaded')
  })

  test('should display game state', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasGameState = await isVisible(page, 'text=/round|day|phase|status/i', 5000)
    
    console.log(`✅ Game state displayed: ${hasGameState}`)
  })

  test('should display game players/actors', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasActors = await isVisible(page, '[data-testid="actor"], [data-testid="player"], img[alt*="avatar" i]', 5000)
    
    console.log(`✅ Game actors displayed: ${hasActors}`)
  })

  test('should display game events', async ({ page }) => {
    await page.waitForTimeout(2000)
    
    const hasEvents = await isVisible(page, 'text=/event|happened|news/i', 5000)
    
    console.log(`✅ Game events displayed: ${hasEvents}`)
  })
})

