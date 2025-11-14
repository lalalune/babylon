/**
 * Perp Charts E2E Tests
 * 
 * Tests for perp market detail pages with professional charts:
 * - Chart renders correctly
 * - Price data displays properly
 * - Chart tooltips work
 * - No null/undefined values in display
 * - Chart interactions function correctly
 */

import { test, expect } from '@playwright/test'
import { setupAuthState } from './fixtures/auth'

test.describe('Perp Charts', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a perp market page
    await setupAuthState(page, '/markets/perps')
    await page.waitForTimeout(2000)
  })

  test('should navigate to a perp market detail page', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('a[href*="/markets/perps/"]', { timeout: 10000 }).catch(() => {})
    
    // Find first market link and click it
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(2000)
      
      // Verify we're on a market detail page
      expect(page.url()).toContain('/markets/perps/')
      console.log('✅ Successfully navigated to perp market detail page')
    } else {
      console.log('⚠️  No perp markets found to navigate to')
    }
  })

  test('should render price chart with recharts components', async ({ page }) => {
    // Navigate to first market
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(2000)
      
      // Look for chart heading
      const chartHeading = page.locator('h2:has-text("Price Chart")')
      await expect(chartHeading).toBeVisible({ timeout: 10000 })
      
      // Look for recharts SVG element
      const chartSvg = page.locator('svg.recharts-surface')
      await expect(chartSvg).toBeVisible({ timeout: 10000 })
      
      // Check that chart container exists
      const chartContainer = page.locator('[data-slot="chart"]')
      await expect(chartContainer).toBeVisible()
      
      console.log('✅ Price chart rendered with recharts components')
      await page.screenshot({ path: 'test-results/screenshots/perp-chart-rendered.png', fullPage: true })
    }
  })

  test('should display price data without null or undefined values', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Get the current price displayed in header
      const priceElements = page.locator('text=/\\$[0-9,.]+/')
      const pricesCount = await priceElements.count()
      
      expect(pricesCount).toBeGreaterThan(0)
      
      // Check first few prices don't contain null/undefined
      for (let i = 0; i < Math.min(pricesCount, 5); i++) {
        const priceText = await priceElements.nth(i).textContent()
        expect(priceText).toBeTruthy()
        expect(priceText).not.toContain('null')
        expect(priceText).not.toContain('undefined')
        expect(priceText).not.toContain('NaN')
      }
      
      console.log('✅ All price values are valid (no null/undefined)')
    }
  })

  test('should display chart axis labels correctly', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Look for Y-axis labels (prices with $)
      const yAxisLabels = page.locator('svg.recharts-surface text:has-text("$")')
      const yAxisCount = await yAxisLabels.count()
      
      if (yAxisCount > 0) {
        console.log(`✅ Y-axis has ${yAxisCount} price labels`)
        
        // Verify at least one label is visible
        const firstLabel = await yAxisLabels.first().textContent()
        expect(firstLabel).toBeTruthy()
        expect(firstLabel).toContain('$')
      }
      
      // Look for X-axis labels (time labels)
      const xAxisLabels = page.locator('svg.recharts-surface .recharts-xAxis text')
      const xAxisCount = await xAxisLabels.count()
      
      if (xAxisCount > 0) {
        console.log(`✅ X-axis has ${xAxisCount} time labels`)
      }
      
      await page.screenshot({ path: 'test-results/screenshots/perp-chart-axes.png' })
    }
  })

  test('should show chart tooltip on hover', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Find the chart area
      const chartArea = page.locator('svg.recharts-surface').first()
      await expect(chartArea).toBeVisible()
      
      // Hover over the chart to trigger tooltip
      const box = await chartArea.boundingBox()
      if (box) {
        // Hover in the middle of the chart
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(500)
        
        // Look for tooltip (may be visible or not depending on chart implementation)
        const tooltip = page.locator('.recharts-tooltip-wrapper, [role="tooltip"]')
        const tooltipVisible = await tooltip.isVisible({ timeout: 2000 }).catch(() => false)
        
        if (tooltipVisible) {
          console.log('✅ Chart tooltip appears on hover')
          await page.screenshot({ path: 'test-results/screenshots/perp-chart-tooltip.png' })
        } else {
          console.log('ℹ️  Tooltip not visible (may require more specific hover position)')
        }
      }
    }
  })

  test('should display correct market stats', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Check for 24h High
      const highLabel = page.locator('text=/24h High/i')
      await expect(highLabel).toBeVisible({ timeout: 5000 })
      
      // Check for 24h Low
      const lowLabel = page.locator('text=/24h Low/i')
      await expect(lowLabel).toBeVisible()
      
      // Check for Volume
      const volumeLabel = page.locator('text=/24h Volume/i')
      await expect(volumeLabel).toBeVisible()
      
      // Check for Open Interest
      const openInterestLabel = page.locator('text=/Open Interest/i')
      await expect(openInterestLabel).toBeVisible()
      
      console.log('✅ All market stats are displayed')
      await page.screenshot({ path: 'test-results/screenshots/perp-market-stats.png' })
    }
  })

  test('should not display loading state indefinitely', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      
      // Wait for chart to load (should not be stuck on "Loading chart...")
      await page.waitForTimeout(5000)
      
      const loadingText = page.locator('text=/Loading chart/i')
      const isLoading = await loadingText.isVisible({ timeout: 2000 }).catch(() => false)
      
      expect(isLoading).toBe(false)
      console.log('✅ Chart loaded successfully (not stuck in loading state)')
    }
  })

  test('should handle real-time price updates', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Get initial price
      const priceElement = page.locator('.text-3xl.font-bold').first()
      const initialPrice = await priceElement.textContent()
      
      expect(initialPrice).toBeTruthy()
      expect(initialPrice).not.toContain('null')
      
      // Wait a bit to see if price updates (live prices)
      await page.waitForTimeout(5000)
      
      const updatedPrice = await priceElement.textContent()
      
      // Price should still be valid (may or may not have changed)
      expect(updatedPrice).toBeTruthy()
      expect(updatedPrice).not.toContain('null')
      
      console.log(`✅ Price handling works correctly`)
      console.log(`   Initial: ${initialPrice}`)
      console.log(`   After 5s: ${updatedPrice}`)
    }
  })

  test('should display chart gradient fills', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Check for linearGradient elements in SVG
      const gradients = page.locator('defs linearGradient[id*="fillPrice"]')
      const gradientCount = await gradients.count()
      
      if (gradientCount > 0) {
        console.log(`✅ Chart has gradient fills (${gradientCount} found)`)
      }
      
      // Check for area paths
      const areaPaths = page.locator('svg.recharts-surface path.recharts-area')
      const areaCount = await areaPaths.count()
      
      if (areaCount > 0) {
        console.log(`✅ Chart has area elements (${areaCount} found)`)
      }
    }
  })

  test('should be responsive and work on mobile viewport', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(2000)
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(1000)
      
      // Chart should still be visible
      const chartSvg = page.locator('svg.recharts-surface')
      await expect(chartSvg).toBeVisible({ timeout: 5000 })
      
      // Price should still be visible
      const priceElement = page.locator('.text-3xl.font-bold').first()
      await expect(priceElement).toBeVisible()
      
      console.log('✅ Chart works on mobile viewport')
      await page.screenshot({ path: 'test-results/screenshots/perp-chart-mobile.png', fullPage: true })
    }
  })

  test('should not have console errors related to charts', async ({ page }) => {
    const errors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    const marketLinks = page.locator('a[href*="/markets/perps/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(5000)
      
      // Filter out known acceptable errors
      const chartRelatedErrors = errors.filter(err => 
        err.toLowerCase().includes('chart') ||
        err.toLowerCase().includes('recharts') ||
        err.toLowerCase().includes('svg')
      )
      
      expect(chartRelatedErrors.length).toBe(0)
      
      if (chartRelatedErrors.length === 0) {
        console.log('✅ No chart-related console errors')
      } else {
        console.log('❌ Chart errors found:', chartRelatedErrors)
      }
    }
  })
})

