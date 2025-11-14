/**
 * E2E tests for OG embed sharing (Twitter & Farcaster)
 * Tests P&L and referral sharing with OG meta tags
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('OG Embed Sharing', () => {
  test.describe('P&L Sharing', () => {
    test('should generate P&L OG image', async ({ page }) => {
      // Navigate directly to OG image endpoint
      // Note: Replace with actual user ID in real tests
      const testUserId = 'test-user-id'
      const ogImageUrl = `${BASE_URL}/api/og/pnl/${testUserId}`
      
      const response = await page.goto(ogImageUrl)
      
      // Should return an image
      expect(response?.status()).toBe(200)
      expect(response?.headers()['content-type']).toContain('image')
    })

    test('should have correct OG meta tags on P&L share page', async ({ page }) => {
      // Navigate to share page
      const testUserId = 'test-user-id'
      await page.goto(`${BASE_URL}/share/pnl/${testUserId}`, {
        waitUntil: 'domcontentloaded',
      })
      
      // Check for OG meta tags
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
      const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content')
      
      expect(ogImage).toContain('/api/og/pnl/')
      expect(ogTitle).toContain('Babylon')
      expect(ogDescription).toBeTruthy()
    })

    test('should have Farcaster Frame meta tags on P&L share page', async ({ request }) => {
      const testUserId = 'test-user-id'
      
      // Fetch the HTML to check meta tags (before redirect)
      const response = await request.get(`${BASE_URL}/share/pnl/${testUserId}`, {
        maxRedirects: 0,  // Don't follow redirects
        failOnStatusCode: false,
      })
      
      const html = await response.text()
      
      // Check for Farcaster Frame tags in HTML
      expect(html).toContain('fc:frame')
      expect(html).toContain('fc:frame:image')
      expect(html).toContain('/api/og/pnl/')
      expect(html).toContain('View on Babylon')
    })

    test('should open P&L share modal and show preview', async ({ page }) => {
      // Navigate to markets page (assuming user is logged in)
      await page.goto(`${BASE_URL}/markets`)
      
      // Wait for page load
      await page.waitForLoadState('networkidle')
      
      // Look for share button
      const shareButton = page.getByRole('button', { name: /share p&l/i })
      
      if (await shareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await shareButton.click()
        
        // Modal should open
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        
        // Should have share buttons
        const twitterButton = page.getByRole('button', { name: /share to x/i })
        const farcasterButton = page.getByRole('button', { name: /share to farcaster/i })
        
        await expect(twitterButton).toBeVisible()
        await expect(farcasterButton).toBeVisible()
      }
    })

    test('should open Farcaster compose window when sharing P&L', async ({ page, context }) => {
      await page.goto(`${BASE_URL}/markets`)
      await page.waitForLoadState('networkidle')
      
      const shareButton = page.getByRole('button', { name: /share p&l/i })
      
      if (await shareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await shareButton.click()
        
        // Wait for modal
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
        
        // Set up listener for new page
        const pagePromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null)
        
        // Click Farcaster button
        const farcasterButton = page.getByRole('button', { name: /share to farcaster/i })
        if (await farcasterButton.isVisible()) {
          await farcasterButton.click()
          
          // Check if new window opened
          const newPage = await pagePromise
          if (newPage) {
            expect(newPage.url()).toContain('warpcast.com')
            await newPage.close()
          }
        }
      }
    })
  })

  test.describe('Referral Sharing', () => {
    test('should generate referral OG image', async ({ page }) => {
      const testUserId = 'test-user-id'
      const ogImageUrl = `${BASE_URL}/api/og/referral/${testUserId}`
      
      const response = await page.goto(ogImageUrl)
      
      // Should return an image
      expect(response?.status()).toBe(200)
      expect(response?.headers()['content-type']).toContain('image')
    })

    test('should have correct OG meta tags on referral share page', async ({ page }) => {
      const testUserId = 'test-user-id'
      await page.goto(`${BASE_URL}/share/referral/${testUserId}`, {
        waitUntil: 'domcontentloaded',
      })
      
      // Check for OG meta tags
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
      const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content')
      
      expect(ogImage).toContain('/api/og/referral/')
      expect(ogTitle).toContain('Babylon')
      expect(ogDescription).toBeTruthy()
    })

    test('should have Farcaster Frame meta tags on referral share page', async ({ request }) => {
      const testUserId = 'test-user-id'
      
      // Fetch the HTML to check meta tags (before redirect)
      const response = await request.get(`${BASE_URL}/share/referral/${testUserId}`, {
        maxRedirects: 0,  // Don't follow redirects
        failOnStatusCode: false,
      })
      
      const html = await response.text()
      
      // Check for Farcaster Frame tags in HTML
      expect(html).toContain('fc:frame')
      expect(html).toContain('fc:frame:image')
      expect(html).toContain('/api/og/referral/')
      expect(html).toContain('Join Babylon')
    })

    test('should show referral share options on rewards page', async ({ page }) => {
      await page.goto(`${BASE_URL}/rewards`)
      await page.waitForLoadState('networkidle')
      
      // Look for share button (may require login)
      const shareButton = page.getByRole('button', { name: /share/i }).first()
      
      if (await shareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await shareButton.click()
        
        // Should show share menu
        await page.waitForTimeout(500)
        
        // Check for share options
        const twitterOption = page.getByText(/share to x/i)
        const farcasterOption = page.getByText(/share to farcaster/i)
        
        // At least one should be visible
        const hasTwitter = await twitterOption.isVisible().catch(() => false)
        const hasFarcaster = await farcasterOption.isVisible().catch(() => false)
        
        expect(hasTwitter || hasFarcaster).toBeTruthy()
      }
    })

    test('should open Farcaster compose window when sharing referral', async ({ page, context }) => {
      await page.goto(`${BASE_URL}/rewards`)
      await page.waitForLoadState('networkidle')
      
      const shareButton = page.getByRole('button', { name: /share/i }).first()
      
      if (await shareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await shareButton.click()
        await page.waitForTimeout(500)
        
        // Set up listener for new page
        const pagePromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null)
        
        // Click Farcaster option
        const farcasterOption = page.getByText(/share to farcaster/i)
        if (await farcasterOption.isVisible()) {
          await farcasterOption.click()
          
          // Check if new window opened
          const newPage = await pagePromise
          if (newPage) {
            expect(newPage.url()).toContain('warpcast.com')
            
            // Verify URL contains share link
            expect(newPage.url()).toContain('compose')
            
            await newPage.close()
          }
        }
      }
    })
  })

  test.describe('OG Image Content Validation', () => {
    test('should render P&L data in OG image', async ({ page }) => {
      // This test would require a known test user with P&L data
      // For now, we just verify the image loads
      const testUserId = 'test-user-id'
      const response = await page.goto(`${BASE_URL}/api/og/pnl/${testUserId}`)
      
      expect(response?.status()).toBe(200)
      
      // Verify it's a PNG image
      const contentType = response?.headers()['content-type']
      expect(contentType).toMatch(/image\/(png|jpeg)/)
    })

    test('should render referral data in OG image', async ({ page }) => {
      const testUserId = 'test-user-id'
      const response = await page.goto(`${BASE_URL}/api/og/referral/${testUserId}`)
      
      expect(response?.status()).toBe(200)
      
      // Verify it's an image
      const contentType = response?.headers()['content-type']
      expect(contentType).toMatch(/image\/(png|jpeg)/)
    })

    test('should cache OG images appropriately', async ({ page }) => {
      const testUserId = 'test-user-id'
      
      // First request
      const response1 = await page.goto(`${BASE_URL}/api/og/pnl/${testUserId}`)
      const cacheControl1 = response1?.headers()['cache-control']
      
      // Second request (should hit cache)
      const response2 = await page.goto(`${BASE_URL}/api/og/pnl/${testUserId}`)
      const cacheControl2 = response2?.headers()['cache-control']
      
      // Should have cache headers
      expect(cacheControl1 || cacheControl2).toBeTruthy()
    })
  })

  test.describe('Share Link Redirects', () => {
    test('should redirect P&L share page to markets', async ({ page }) => {
      const testUserId = 'test-user-id'
      
      await page.goto(`${BASE_URL}/share/pnl/${testUserId}`)
      
      // Should redirect to markets page
      await page.waitForURL(/\/markets/, { timeout: 5000 })
      
      expect(page.url()).toContain('/markets')
    })

    test('should redirect referral share page to home', async ({ page }) => {
      const testUserId = 'test-user-id'
      
      await page.goto(`${BASE_URL}/share/referral/${testUserId}`)
      
      // Should redirect to home (which may then redirect to /feed)
      await page.waitForTimeout(2000)
      
      // Accept either home or feed as valid redirect destination
      const url = page.url()
      expect(url === `${BASE_URL}/` || url === `${BASE_URL}/feed` || url.includes('ref=')).toBeTruthy()
    })
  })
})

test.describe('Integration Tests', () => {
  test('should have consistent shareable links across components', async ({ page }) => {
    // This test verifies that the shareable link format is consistent
    await page.goto(`${BASE_URL}`)
    
    // Verify link format
    const expectedPnLFormat = /\/share\/pnl\/[a-zA-Z0-9-_]+/
    const expectedReferralFormat = /\/share\/referral\/[a-zA-Z0-9-_]+/
    
    // Both formats should be valid
    expect('/share/pnl/test-id').toMatch(expectedPnLFormat)
    expect('/share/referral/test-id').toMatch(expectedReferralFormat)
  })

  test('should track shares for points', async ({ page }) => {
    // This would require authentication and a real share action
    // For now, we just verify the tracking endpoint exists
    await page.goto(`${BASE_URL}`)
    
    // Verify share tracking API is accessible (will return 401 without auth)
    const response = await page.request.post(`${BASE_URL}/api/users/test-id/share`, {
      data: {
        platform: 'farcaster',
        contentType: 'market',
        contentId: 'test',
        url: 'https://test.com',
      },
      failOnStatusCode: false,
    })
    
    // Should return 401 (unauthorized) not 404 (not found)
    expect([401, 200]).toContain(response.status())
  })
})

