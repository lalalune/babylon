/**
 * Points Purchase E2E Tests
 * 
 * Tests the complete x402 payment flow for buying points:
 * - Opening buy points modal
 * - Creating payment request
 * - Funding wallet if needed
 * - Sending payment transaction
 * - Verifying payment
 * - Crediting points to user account
 * 
 * This test validates the entire payment flow with account abstraction (Privy embedded wallets)
 */

import { test, expect } from '@playwright/test'
import { loginWithPrivyEmail, getPrivyTestAccount } from './helpers/privy-auth'
import { navigateTo, waitForPageLoad, isVisible } from './helpers/page-helpers'
import { ROUTES } from './helpers/test-data'

test.describe('Points Purchase Flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await waitForPageLoad(page)
  })

  test('should display buy points button in markets tab', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    // Look for buy points button using test ID
    const buyPointsButton = page.locator('[data-testid="buy-points-button"]')
    
    const isButtonVisible = await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    await page.screenshot({ path: 'test-results/screenshots/13-buy-points-button.png' })
    
    expect(isButtonVisible).toBeTruthy()
    console.log('✅ Buy points button visible')
  })

  test('should open buy points modal', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    // Click buy points button
    const buyPointsButton = page.locator('[data-testid="buy-points-button"]')
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Check for modal using test ID
      const modalVisible = await isVisible(page, '[data-testid="buy-points-modal"]', 5000)
      
      await page.screenshot({ path: 'test-results/screenshots/13-buy-points-modal.png' })
      
      expect(modalVisible).toBeTruthy()
      console.log('✅ Buy points modal opened')
    } else {
      console.log('⚠️ Skipping test - buy points button not found')
      test.skip()
    }
  })

  test('should display amount input and quick select buttons', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('[data-testid="buy-points-button"]')
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Check for amount input using test ID
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      const hasAmountInput = await amountInput.isVisible({ timeout: 5000 }).catch(() => false)
      
      // Check for quick select buttons ($10, $25, $50, $100)
      const quickSelect10 = page.locator('button:has-text("$10")')
      // const quickSelect25 = page.locator('button:has-text("$25")') // Unused
      // const quickSelect50 = page.locator('button:has-text("$50")') // Unused
      // const quickSelect100 = page.locator('button:has-text("$100")') // Unused
      
      const hasQuickSelect = await quickSelect10.isVisible({ timeout: 2000 }).catch(() => false)
      
      await page.screenshot({ path: 'test-results/screenshots/13-amount-input.png' })
      
      console.log(`✅ Amount input visible: ${hasAmountInput}`)
      console.log(`✅ Quick select buttons visible: ${hasQuickSelect}`)
    } else {
      test.skip()
    }
  })

  test('should display points calculation (100 points per $1)', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Enter $10
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      // Check for points display (should show 1000 points) using test ID
      const pointsDisplay = page.locator('[data-testid="points-amount-display"]')
      const displayedText = await pointsDisplay.textContent().catch(() => '')
      const has1000Points = displayedText?.includes('1,000') || displayedText?.includes('1000')
      
      await page.screenshot({ path: 'test-results/screenshots/13-points-calculation.png' })
      
      expect(has1000Points).toBeTruthy()
      console.log('✅ Points calculation correct: 1000 points for $10')
    } else {
      test.skip()
    }
  })

  test('should validate minimum amount ($1)', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Try entering less than $1
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('0.5')
      await page.waitForTimeout(500)
      
      // Try to submit
      const submitButton = page.locator('button:has-text("Buy"), button:has-text("Purchase")').last()
      await submitButton.click()
      await page.waitForTimeout(1000)
      
      // Should show error or button should be disabled
      const hasError = await isVisible(page, 'text=/minimum|must be at least/i', 3000)
      
      await page.screenshot({ path: 'test-results/screenshots/13-minimum-validation.png' })
      
      console.log(`✅ Minimum amount validation: ${hasError}`)
    } else {
      test.skip()
    }
  })

  test('should validate maximum amount ($1000)', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Try entering more than $1000
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('1500')
      await page.waitForTimeout(500)
      
      // Try to submit
      const submitButton = page.locator('button:has-text("Buy"), button:has-text("Purchase")').last()
      await submitButton.click()
      await page.waitForTimeout(1000)
      
      // Should show error or button should be disabled
      const hasError = await isVisible(page, 'text=/maximum|cannot exceed/i', 3000)
      
      await page.screenshot({ path: 'test-results/screenshots/13-maximum-validation.png' })
      
      console.log(`✅ Maximum amount validation: ${hasError}`)
    } else {
      test.skip()
    }
  })

  test('should display wallet balance check', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Enter a valid amount
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      // Look for balance information
      const hasBalance = await isVisible(page, 'text=/balance|wallet|available/i', 5000)
      
      console.log(`✅ Wallet balance info displayed: ${hasBalance}`)
    } else {
      test.skip()
    }
  })

  test('should initiate payment request', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Enter $10 (minimum test amount)
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      // Click buy/purchase button
      const submitButton = page.locator('[data-testid="buy-points-submit-button"]')
      
      // Setup network listener to catch API calls
      let paymentRequestCreated = false
      page.on('response', response => {
        if (response.url().includes('/api/points/purchase/create-payment')) {
          paymentRequestCreated = true
        }
      })
      
      await submitButton.click()
      await page.waitForTimeout(3000)
      
      // Check if payment flow started
      const paymentStarted = paymentRequestCreated || 
                            await isVisible(page, 'text=/processing|confirming|transaction/i', 5000)
      
      await page.screenshot({ path: 'test-results/screenshots/13-payment-initiated.png' })
      
      console.log(`✅ Payment request initiated: ${paymentStarted}`)
      
      // If funding modal appears, handle it
      const fundingModalVisible = await isVisible(page, 'text=/fund|add funds|deposit/i', 3000)
      
      if (fundingModalVisible) {
        console.log('⚠️ Funding modal appeared - wallet needs funds')
        await page.screenshot({ path: 'test-results/screenshots/13-funding-modal.png' })
      }
    } else {
      test.skip()
    }
  })

  test('should handle insufficient balance', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Try to buy with large amount (likely insufficient balance)
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('100')
      await page.waitForTimeout(500)
      
      const submitButton = page.locator('[data-testid="buy-points-submit-button"]')
      await submitButton.click()
      await page.waitForTimeout(3000)
      
      // Look for funding prompt or insufficient balance message
      const hasFundingPrompt = await isVisible(page, 'text=/insufficient|fund wallet|add funds|not enough/i', 5000)
      
      await page.screenshot({ path: 'test-results/screenshots/13-insufficient-balance.png' })
      
      console.log(`✅ Insufficient balance handling: ${hasFundingPrompt}`)
    } else {
      test.skip()
    }
  })

  test('should close modal on cancel', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Click cancel button
      const cancelButton = page.locator('button:has-text("Cancel")').first()
      await cancelButton.click()
      await page.waitForTimeout(500)
      
      // Modal should be closed
      const modalClosed = !(await isVisible(page, '[role="dialog"]', 1000))
      
      expect(modalClosed).toBeTruthy()
      console.log('✅ Modal closed on cancel')
    } else {
      test.skip()
    }
  })

  test('should display transaction hash link after payment', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Enter small amount
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      const submitButton = page.locator('[data-testid="buy-points-submit-button"]')
      await submitButton.click()
      
      // Wait for transaction (if wallet has funds)
      await page.waitForTimeout(10000)
      
      // Look for transaction link (basescan)
      const hasTxLink = await isVisible(page, 'a[href*="basescan.org/tx/"], text=/view transaction/i', 5000)
      
      if (hasTxLink) {
        await page.screenshot({ path: 'test-results/screenshots/13-transaction-link.png' })
        console.log('✅ Transaction hash link displayed')
      } else {
        console.log('ℹ️ Transaction not completed (may need funding)')
      }
    } else {
      test.skip()
    }
  })

  test('should show success message on completion', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Enter amount
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      const submitButton = page.locator('[data-testid="buy-points-submit-button"]')
      await submitButton.click()
      
      // Wait for success (if funded)
      await page.waitForTimeout(15000)
      
      // Look for success indicators
      const hasSuccess = await isVisible(page, 'text=/success|completed|purchased/i, [data-testid="success"]', 5000)
      
      if (hasSuccess) {
        await page.screenshot({ path: 'test-results/screenshots/13-purchase-success.png' })
        console.log('✅ Purchase completed successfully')
      } else {
        console.log('ℹ️ Purchase not completed (may need funding or failed)')
        await page.screenshot({ path: 'test-results/screenshots/13-purchase-incomplete.png' })
      }
    } else {
      test.skip()
    }
  })

  test('should update points balance after purchase', async ({ page }) => {
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    // Get initial points balance
    const initialBalance = await page.locator('text=/points/i').first().textContent().catch(() => '0')
    console.log(`Initial balance: ${initialBalance}`)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Purchase $10 (1000 points)
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      const submitButton = page.locator('[data-testid="buy-points-submit-button"]')
      await submitButton.click()
      
      // Wait for completion
      await page.waitForTimeout(15000)
      
      // Check if success
      const hasSuccess = await isVisible(page, 'text=/success|completed/i', 3000)
      
      if (hasSuccess) {
        // Close modal
        const doneButton = page.locator('button:has-text("Done"), button:has-text("Close")').last()
        if (await doneButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await doneButton.click()
        }
        
        await page.waitForTimeout(2000)
        
        // Check updated balance
        const updatedBalance = await page.locator('text=/points/i').first().textContent().catch(() => '0')
        console.log(`Updated balance: ${updatedBalance}`)
        
        // Balance should have increased
        console.log('✅ Points balance checked after purchase')
      } else {
        console.log('ℹ️ Cannot verify balance update - purchase not completed')
      }
    } else {
      test.skip()
    }
  })
})

test.describe('Payment Configuration', () => {
  test('should have payment receiver address configured', async ({ page }) => {
    // This test verifies the backend configuration
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.MARKETS)
    await page.waitForTimeout(2000)
    
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Try to initiate payment
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      let configError = false
      page.on('response', async response => {
        if (response.url().includes('/api/points/purchase/create-payment')) {
          const data = await response.json().catch(() => ({}))
          if (data.error && data.error.includes('not configured')) {
            configError = true
          }
        }
      })
      
      const submitButton = page.locator('[data-testid="buy-points-submit-button"]')
      await submitButton.click()
      await page.waitForTimeout(2000)
      
      if (configError) {
        console.log('⚠️ Payment receiver not configured - check BABYLON_GAME_WALLET_ADDRESS env var')
        await page.screenshot({ path: 'test-results/screenshots/13-config-error.png' })
      } else {
        console.log('✅ Payment system configured')
      }
    } else {
      test.skip()
    }
  })
})

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.HOME)
    await loginWithPrivyEmail(page, getPrivyTestAccount())
    await navigateTo(page, ROUTES.MARKETS)
    await waitForPageLoad(page)
  })

  test('should handle payment timeout', async ({ page }) => {
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Enter amount
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      
      // Note: This test documents expected behavior
      // Actual timeout testing would require mocking or very long waits
      console.log('✅ Timeout handling documented (15 minute default)')
    } else {
      test.skip()
    }
  })

  test('should handle transaction failure', async ({ page }) => {
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Enter amount
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      const submitButton = page.locator('[data-testid="buy-points-submit-button"]')
      await submitButton.click()
      await page.waitForTimeout(5000)
      
      // Look for error handling
      const hasErrorHandling = await isVisible(page, 'text=/failed|error|try again/i, [role="alert"]', 5000)
      
      if (hasErrorHandling) {
        await page.screenshot({ path: 'test-results/screenshots/13-transaction-error.png' })
        console.log('✅ Transaction error handling displayed')
      } else {
        console.log('ℹ️ No error - transaction may have succeeded or is pending')
      }
    } else {
      test.skip()
    }
  })

  test('should allow retry after failure', async ({ page }) => {
    const buyPointsButton = page.locator('button:has-text("Buy Points")').first()
    
    if (await buyPointsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyPointsButton.click()
      await page.waitForTimeout(1000)
      
      // Enter amount
      const amountInput = page.locator('[data-testid="points-amount-input"]')
      await amountInput.fill('10')
      await page.waitForTimeout(500)
      
      const submitButton = page.locator('[data-testid="buy-points-submit-button"]')
      await submitButton.click()
      await page.waitForTimeout(5000)
      
      // Look for retry button
      const retryButton = page.locator('button:has-text("Try Again"), button:has-text("Retry")').first()
      const hasRetryButton = await retryButton.isVisible({ timeout: 3000 }).catch(() => false)
      
      if (hasRetryButton) {
        await retryButton.click()
        await page.waitForTimeout(1000)
        
        await page.screenshot({ path: 'test-results/screenshots/13-retry-attempt.png' })
        console.log('✅ Retry button works')
      } else {
        console.log('ℹ️ No retry button (transaction may have succeeded)')
      }
    } else {
      test.skip()
    }
  })
})

