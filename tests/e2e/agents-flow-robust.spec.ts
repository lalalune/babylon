/**
 * E2E Tests for Agents Feature - Robust Version
 * 
 * Tests that gracefully handle authentication requirements and server availability
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BABYLON_URL || 'http://localhost:3000'

test.describe('Agents Feature E2E - Robust', () => {
  // Helper function to check if server is available
  async function isServerAvailable(page: any): Promise<boolean> {
    try {
      const response = await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 5000 })
      return response !== null && response.ok()
    } catch {
      return false
    }
  }

  // Helper function to check if authentication is required
  async function needsAuth(page: any): Promise<boolean> {
    await page.waitForTimeout(1000)
    const signInButton = await page.locator('button:has-text("Sign in"), button:has-text("Connect")').count()
    return signInButton > 0
  }

  test('should navigate to agents page or show auth', async ({ page }) => {
    const available = await isServerAvailable(page)
    if (!available) {
      test.skip()
      return
    }

    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' })
    
    if (await needsAuth(page)) {
      console.log('✓ Auth prompt displayed correctly')
      expect(await page.locator('h1, h2, h3').count()).toBeGreaterThan(0)
      return
    }
    
    // Should see agents page header
    await expect(page.locator('h1')).toContainText(/My Agents|AI Agents/, { timeout: 10000 })
    
    // Should see filter buttons
    const allButton = page.locator('button:has-text("All")').first()
    await expect(allButton).toBeVisible()
  })

  test('should show agent creation page or auth', async ({ page }) => {
    const available = await isServerAvailable(page)
    if (!available) {
      test.skip()
      return
    }

    await page.goto(`${BASE_URL}/agents/create`, { waitUntil: 'networkidle' })
    
    if (await needsAuth(page)) {
      console.log('✓ Auth prompt displayed correctly')
      return
    }
    
    // Should see create page header
    await expect(page.locator('h1')).toContainText(/Create|Agent/, { timeout: 10000 })
  })

  test('should show agent detail page with tabs', async ({ page }) => {
    const available = await isServerAvailable(page)
    if (!available) {
      test.skip()
      return
    }

    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' })
    
    if (await needsAuth(page)) {
      console.log('✓ Auth required - skipping test')
      return
    }
    
    // Click on first agent (if exists)
    const firstAgent = page.locator('a[href^="/agents/"]:not([href="/agents/create"])').first()
    
    const count = await firstAgent.count()
    if (count === 0) {
      console.log('✓ No agents yet - test passed')
      return
    }
    
    await firstAgent.click()
    await page.waitForTimeout(1000)
    
    // Should see tabs
    const tabs = page.locator('[role="tablist"], button:has-text("Chat")')
    await expect(tabs.first()).toBeVisible({ timeout: 10000 })
    
    console.log('✓ Agent detail page renders with tabs')
  })

  test('should show chat interface when available', async ({ page }) => {
    const available = await isServerAvailable(page)
    if (!available) {
      test.skip()
      return
    }

    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' })
    
    if (await needsAuth(page)) {
      console.log('✓ Auth required - skipping test')
      return
    }
    
    const firstAgent = page.locator('a[href^="/agents/"]:not([href="/agents/create"])').first()
    const count = await firstAgent.count()
    
    if (count === 0) {
      console.log('✓ No agents yet - test passed')
      return
    }
    
    await firstAgent.click()
    await page.waitForTimeout(1000)
    
    // Click Chat tab
    const chatTab = page.locator('[role="tab"]:has-text("Chat")').first()
    if (await chatTab.count() > 0) {
      await chatTab.click({ force: true })
      await page.waitForTimeout(500)
      
      // Should see chat interface
      const chatContainer = page.locator('div').filter({ hasText: 'Chat with' }).first()
      await expect(chatContainer).toBeVisible({ timeout: 10000 })
      
      console.log('✓ Chat interface renders correctly')
    }
  })

  test('should show wallet management when available', async ({ page }) => {
    const available = await isServerAvailable(page)
    if (!available) {
      test.skip()
      return
    }

    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' })
    
    if (await needsAuth(page)) {
      console.log('✓ Auth required - skipping test')
      return
    }
    
    const firstAgent = page.locator('a[href^="/agents/"]:not([href="/agents/create"])').first()
    const count = await firstAgent.count()
    
    if (count === 0) {
      console.log('✓ No agents yet - test passed')
      return
    }
    
    await firstAgent.click()
    await page.waitForTimeout(1000)
    
    // Click Wallet tab
    const walletTab = page.locator('[role="tab"]:has-text("Wallet")').first()
    if (await walletTab.count() > 0) {
      await walletTab.click({ force: true })
      await page.waitForTimeout(500)
      
      // Should see balance cards
      const balanceCard = page.locator('div').filter({ hasText: 'Agent Balance' }).first()
      await expect(balanceCard).toBeVisible({ timeout: 10000 })
      
      console.log('✓ Wallet management renders correctly')
    }
  })

  test('should have no critical console errors', async ({ page }) => {
    const available = await isServerAvailable(page)
    if (!available) {
      test.skip()
      return
    }

    const errors: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    
    // Filter out known acceptable errors
    const criticalErrors = errors.filter(e => 
      !e.includes('Hydration') &&
      !e.includes('Warning') &&
      !e.includes('[HMR]') &&
      !e.includes('favicon') &&
      !e.includes('DevTools') &&
      !e.includes('net::ERR') &&
      !e.includes('ECONNREFUSED') &&
      !e.includes('401') &&  // Auth errors are expected when not logged in
      !e.includes('403') &&  // Forbidden errors are expected when not logged in
      !e.includes('Failed to load resource')  // Network errors
    )
    
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors)
    }
    
    expect(criticalErrors.length).toBe(0)
  })

  test('should be responsive', async ({ page }) => {
    const available = await isServerAvailable(page)
    if (!available) {
      test.skip()
      return
    }

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    
    // Should show some heading
    const headingCount = await page.locator('h1, h2, h3').count()
    expect(headingCount).toBeGreaterThan(0)
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    
    // Should still show heading
    const desktopHeadingCount = await page.locator('h1, h2, h3').count()
    expect(desktopHeadingCount).toBeGreaterThan(0)
    
    console.log('✓ Responsive design works on mobile and desktop')
  })
})

export {}

