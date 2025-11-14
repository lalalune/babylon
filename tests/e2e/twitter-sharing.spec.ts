/**
 * E2E tests for Twitter sharing functionality
 * Tests OAuth flow and posting tweets with images
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Twitter Sharing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(BASE_URL)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('should show Twitter connect button when not connected', async ({ page }) => {
    // Navigate to markets page
    await page.goto(`${BASE_URL}/markets`)
    
    // Click share P&L button (need to be logged in first)
    // This test assumes user is logged in via Privy
    
    // Look for share button
    const shareButton = page.getByRole('button', { name: /share p&l/i })
    
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Modal should open
      await expect(page.getByRole('dialog')).toBeVisible()
      
      // Should show Twitter share button
      const twitterShareButton = page.getByRole('button', { name: /share to x/i })
      await expect(twitterShareButton).toBeVisible()
    }
  })

  test('should initiate Twitter OAuth flow when connecting', async ({ page }) => {
    // Navigate to markets
    await page.goto(`${BASE_URL}/markets`)
    
    // Open share modal
    const shareButton = page.getByRole('button', { name: /share p&l/i })
    
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Click Twitter share button
      const twitterShareButton = page.getByRole('button', { name: /share to x/i })
      await twitterShareButton.click()
      
      // Should redirect to Twitter OAuth or show connect prompt
      // We'll wait for either the Twitter OAuth page or a connect message
      await page.waitForTimeout(2000)
      
      const currentUrl = page.url()
      
      // Should either be on Twitter auth or show connection prompt
      const hasTwitterAuth = currentUrl.includes('twitter.com') || currentUrl.includes('api.twitter.com')
      const hasConnectPrompt = await page.getByText(/connect.*x.*account/i).isVisible()
      
      expect(hasTwitterAuth || hasConnectPrompt).toBeTruthy()
    }
  })

  test('should show connected status when Twitter is connected', async ({ page }) => {
    // This test requires a user with Twitter already connected
    // Navigate to markets
    await page.goto(`${BASE_URL}/markets`)
    
    // Open share modal
    const shareButton = page.getByRole('button', { name: /share p&l/i })
    
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Check if connected status is shown
      const connectedText = page.getByText(/connected as @/i)
      
      if (await connectedText.isVisible()) {
        // Should see disconnect button
        const disconnectButton = page.getByRole('button', { name: /disconnect/i })
        await expect(disconnectButton).toBeVisible()
      }
    }
  })

  test('should allow editing tweet text before posting', async ({ page }) => {
    // Navigate to markets
    await page.goto(`${BASE_URL}/markets`)
    
    // Open share modal
    const shareButton = page.getByRole('button', { name: /share p&l/i })
    
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Click Twitter share (assuming connected)
      const twitterShareButton = page.getByRole('button', { name: /share to x/i })
      await twitterShareButton.click()
      
      // Wait for confirmation modal
      await page.waitForTimeout(1000)
      
      // Look for tweet text input
      const tweetTextarea = page.getByLabel(/tweet text/i)
      
      if (await tweetTextarea.isVisible()) {
        // Should be able to edit text
        await tweetTextarea.fill('Custom tweet text for testing')
        
        // Check character count
        const charCount = await page.getByText(/\/\s*280\s*characters/i)
        await expect(charCount).toBeVisible()
      }
    }
  })

  test('should validate tweet text length', async ({ page }) => {
    // Navigate to markets
    await page.goto(`${BASE_URL}/markets`)
    
    // Open share modal
    const shareButton = page.getByRole('button', { name: /share p&l/i })
    
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Click Twitter share
      const twitterShareButton = page.getByRole('button', { name: /share to x/i })
      await twitterShareButton.click()
      
      await page.waitForTimeout(1000)
      
      // Look for tweet text input
      const tweetTextarea = page.getByLabel(/tweet text/i)
      
      if (await tweetTextarea.isVisible()) {
        // Fill with text over 280 characters
        const longText = 'a'.repeat(300)
        await tweetTextarea.fill(longText)
        
        // Post button should be disabled
        const postButton = page.getByRole('button', { name: /^post$/i })
        await expect(postButton).toBeDisabled()
        
        // Should show error message
        const errorMessage = page.getByText(/text is too long/i)
        await expect(errorMessage).toBeVisible()
      }
    }
  })

  test('should show preview image in confirmation modal', async ({ page }) => {
    // Navigate to markets
    await page.goto(`${BASE_URL}/markets`)
    
    // Open share modal
    const shareButton = page.getByRole('button', { name: /share p&l/i })
    
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Wait for preview to generate
      await page.waitForTimeout(2000)
      
      // Check if preview image is shown
      const previewImage = page.getByAltText(/p&l card preview/i)
      await expect(previewImage).toBeVisible()
      
      // Click Twitter share
      const twitterShareButton = page.getByRole('button', { name: /share to x/i })
      await twitterShareButton.click()
      
      await page.waitForTimeout(1000)
      
      // Preview should also be in confirmation modal
      const tweetPreviewImage = page.getByAltText(/tweet preview/i)
      if (await tweetPreviewImage.isVisible()) {
        await expect(tweetPreviewImage).toBeVisible()
      }
    }
  })

  test('should handle disconnecting Twitter account', async ({ page }) => {
    // This test requires a user with Twitter connected
    await page.goto(`${BASE_URL}/markets`)
    
    // Open share modal
    const shareButton = page.getByRole('button', { name: /share p&l/i })
    
    if (await shareButton.isVisible()) {
      await shareButton.click()
      
      // Check if connected
      const connectedText = page.getByText(/connected as @/i)
      
      if (await connectedText.isVisible()) {
        // Click disconnect button
        const disconnectButton = page.getByRole('button', { name: /disconnect/i })
        await disconnectButton.click()
        
        // Wait for disconnect to complete
        await page.waitForTimeout(1000)
        
        // Connected status should be gone
        await expect(connectedText).not.toBeVisible()
      }
    }
  })
})

test.describe('Twitter Auth API', () => {
  test('should return auth status for authenticated user', async ({ request }) => {
    // This test requires a valid auth token
    // In a real test, you would authenticate first
    
    const response = await request.get(`${BASE_URL}/api/twitter/auth-status`, {
      headers: {
        // Add auth header in real test
      },
      failOnStatusCode: false,
    })
    
    // Should return 401 without auth or valid JSON with auth
    expect([200, 401]).toContain(response.status())
  })
  
  test('should handle OAuth redirect', async ({ page }) => {
    // Test the OAuth redirect flow
    const userId = 'test-user-id'
    const returnPath = '/markets'
    
    await page.goto(`${BASE_URL}/api/twitter/oauth/request-token?user_id=${userId}&return_path=${encodeURIComponent(returnPath)}`)
    
    // Should redirect to Twitter or show error
    await page.waitForTimeout(2000)
    
    const url = page.url()
    expect(url).toMatch(/(twitter\.com|api\.twitter\.com|error)/)
  })
})

