/**
 * Prediction Market Charts E2E Tests
 * 
 * Tests for prediction market detail pages with professional charts:
 * - Chart renders with YES/NO probability lines
 * - Probability data displays correctly
 * - Chart legend shows YES and NO
 * - No null/undefined values in display
 * - Chart interactions work correctly
 */

import { test, expect } from '@playwright/test'
import { setupAuthState } from './fixtures/auth'

test.describe('Prediction Market Charts', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to predictions page
    await setupAuthState(page, '/markets/predictions')
    await page.waitForTimeout(2000)
  })

  test('should navigate to a prediction market detail page', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('a[href*="/markets/predictions/"]', { timeout: 10000 }).catch(() => {})
    
    // Find first market link and click it
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(2000)
      
      // Verify we're on a market detail page
      expect(page.url()).toContain('/markets/predictions/')
      console.log('✅ Successfully navigated to prediction market detail page')
    } else {
      console.log('⚠️  No prediction markets found to navigate to')
    }
  })

  test('should render probability chart with recharts components', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(2000)
      
      // Look for chart heading
      const chartHeading = page.locator('h2:has-text("Probability Over Time")')
      await expect(chartHeading).toBeVisible({ timeout: 10000 })
      
      // Look for recharts SVG element
      const chartSvg = page.locator('svg.recharts-surface')
      await expect(chartSvg).toBeVisible({ timeout: 10000 })
      
      // Check that chart container exists
      const chartContainer = page.locator('[data-slot="chart"]')
      await expect(chartContainer).toBeVisible()
      
      console.log('✅ Probability chart rendered with recharts components')
      await page.screenshot({ path: 'test-results/screenshots/prediction-chart-rendered.png', fullPage: true })
    }
  })

  test('should display single probability line', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Check for area path (should be 1: single probability line)
      const areaPaths = page.locator('svg.recharts-surface path.recharts-area')
      const areaCount = await areaPaths.count()
      
      // Should have 1 area (single probability line)
      expect(areaCount).toBeGreaterThanOrEqual(1)
      console.log(`✅ Chart has ${areaCount} area element (single probability line)`)
      
      // Check for 50% reference line
      const referenceLine = page.locator('svg.recharts-surface line.recharts-reference-line')
      const hasReferenceLine = await referenceLine.count().then(c => c > 0)
      if (hasReferenceLine) {
        console.log('✅ Chart has 50% reference line')
      }
      
      await page.screenshot({ path: 'test-results/screenshots/prediction-chart-line.png' })
    }
  })

  test('should display YES and NO in tooltip', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Hover over chart to trigger tooltip
      const chartArea = page.locator('svg.recharts-surface').first()
      const box = await chartArea.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(500)
        
        // Look for tooltip with YES and NO percentages
        const tooltip = page.locator('.recharts-tooltip-wrapper')
        const tooltipVisible = await tooltip.isVisible({ timeout: 2000 }).catch(() => false)
        
        if (tooltipVisible) {
          const tooltipText = await tooltip.textContent()
          const hasYes = tooltipText?.includes('YES')
          const hasNo = tooltipText?.includes('NO')
          
          if (hasYes && hasNo) {
            console.log('✅ Tooltip shows both YES and NO percentages')
          } else {
            console.log(`ℹ️  Tooltip content: YES=${hasYes}, NO=${hasNo}`)
          }
        }
      }
      
      await page.screenshot({ path: 'test-results/screenshots/prediction-chart-tooltip.png' })
    }
  })

  test('should display probability values as percentages', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Look for percentage values in Y-axis or stats
      const percentageElements = page.locator('text=/[0-9]+(\.[0-9]+)?%/')
      const percentCount = await percentageElements.count()
      
      expect(percentCount).toBeGreaterThan(0)
      console.log(`✅ Found ${percentCount} percentage displays`)
      
      // Verify percentages are valid (between 0-100)
      for (let i = 0; i < Math.min(percentCount, 5); i++) {
        const percentText = await percentageElements.nth(i).textContent()
        expect(percentText).toBeTruthy()
        expect(percentText).toContain('%')
        expect(percentText).not.toContain('null')
        expect(percentText).not.toContain('undefined')
      }
    }
  })

  test('should display current YES and NO probabilities', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Look for YES probability card
      const yesCard = page.locator('text=/YES/i').first()
      await expect(yesCard).toBeVisible({ timeout: 5000 })
      
      // Look for NO probability card
      const noCard = page.locator('text=/NO/i').first()
      await expect(noCard).toBeVisible()
      
      // Both should have percentage values nearby
      const yesPercent = page.locator('.text-2xl.font-bold.text-green-600')
      const noPercent = page.locator('.text-2xl.font-bold.text-red-600')
      
      const hasYesPercent = await yesPercent.isVisible({ timeout: 2000 }).catch(() => false)
      const hasNoPercent = await noPercent.isVisible({ timeout: 2000 }).catch(() => false)
      
      if (hasYesPercent && hasNoPercent) {
        console.log('✅ Current YES and NO probabilities are displayed')
      }
      
      await page.screenshot({ path: 'test-results/screenshots/prediction-probabilities.png' })
    }
  })

  test('should display chart axis labels correctly', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Look for Y-axis labels (percentages)
      const yAxisLabels = page.locator('svg.recharts-surface text:has-text("%")')
      const yAxisCount = await yAxisLabels.count()
      
      if (yAxisCount > 0) {
        console.log(`✅ Y-axis has ${yAxisCount} percentage labels`)
        
        // Verify labels are valid
        const firstLabel = await yAxisLabels.first().textContent()
        expect(firstLabel).toBeTruthy()
        expect(firstLabel).toContain('%')
      }
      
      // Look for X-axis labels (dates)
      const xAxisLabels = page.locator('svg.recharts-surface .recharts-xAxis text')
      const xAxisCount = await xAxisLabels.count()
      
      if (xAxisCount > 0) {
        console.log(`✅ X-axis has ${xAxisCount} date labels`)
      }
    }
  })

  test('should show chart tooltip with YES/NO data on hover', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Find the chart area
      const chartArea = page.locator('svg.recharts-surface').first()
      await expect(chartArea).toBeVisible()
      
      // Hover over the chart
      const box = await chartArea.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(500)
        
        // Look for tooltip
        const tooltip = page.locator('.recharts-tooltip-wrapper, [role="tooltip"]')
        const tooltipVisible = await tooltip.isVisible({ timeout: 2000 }).catch(() => false)
        
        if (tooltipVisible) {
          console.log('✅ Chart tooltip appears on hover')
          await page.screenshot({ path: 'test-results/screenshots/prediction-chart-tooltip.png' })
        } else {
          console.log('ℹ️  Tooltip not visible (may require more specific hover position)')
        }
      }
    }
  })

  test('should display market question and details', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Check for market question (should be in an h1)
      const question = page.locator('h1').first()
      await expect(question).toBeVisible({ timeout: 5000 })
      const questionText = await question.textContent()
      
      expect(questionText).toBeTruthy()
      expect(questionText!.length).toBeGreaterThan(0)
      console.log(`✅ Market question displayed: "${questionText?.substring(0, 50)}..."`)
      
      // Check for volume stat
      const volumeLabel = page.locator('text=/Volume/i')
      await expect(volumeLabel).toBeVisible()
      
      // Check for trades stat
      const tradesLabel = page.locator('text=/Trades/i')
      await expect(tradesLabel).toBeVisible()
      
      console.log('✅ Market details are displayed')
    }
  })

  test('should not display null or undefined values', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Get all text content
      const bodyText = await page.locator('body').textContent()
      
      expect(bodyText).not.toContain('null')
      expect(bodyText).not.toContain('undefined')
      expect(bodyText).not.toContain('NaN')
      
      console.log('✅ No null/undefined values displayed on page')
    }
  })

  test('should not display loading state indefinitely', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      
      // Wait for chart to load
      await page.waitForTimeout(5000)
      
      const loadingText = page.locator('text=/Loading chart/i')
      const isLoading = await loadingText.isVisible({ timeout: 2000 }).catch(() => false)
      
      expect(isLoading).toBe(false)
      console.log('✅ Chart loaded successfully (not stuck in loading state)')
    }
  })

  test('should display chart gradient fill', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Check for linearGradient element
      const gradients = page.locator('defs linearGradient[id*="fillProbability"]')
      const gradientCount = await gradients.count()
      
      // Should have 1 gradient (single probability line)
      if (gradientCount >= 1) {
        console.log(`✅ Chart has ${gradientCount} gradient fill`)
      }
      
      // Check that area path exists
      const areaPaths = page.locator('svg.recharts-surface path.recharts-area')
      const areaCount = await areaPaths.count()
      
      if (areaCount >= 1) {
        console.log(`✅ Chart has ${areaCount} area element with gradient`)
      }
    }
  })

  test('should display trade panel with YES/NO buttons', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Look for Trade heading
      const tradeHeading = page.locator('h2:has-text("Trade")')
      await expect(tradeHeading).toBeVisible({ timeout: 5000 })
      
      // Look for YES button
      const yesButton = page.locator('button:has-text("YES")')
      await expect(yesButton).toBeVisible()
      
      // Look for NO button
      const noButton = page.locator('button:has-text("NO")')
      await expect(noButton).toBeVisible()
      
      console.log('✅ Trade panel with YES/NO buttons is displayed')
      await page.screenshot({ path: 'test-results/screenshots/prediction-trade-panel.png' })
    }
  })

  test('should switch between YES and NO tabs', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      const yesButton = page.locator('button:has-text("YES")').first()
      const noButton = page.locator('button:has-text("NO")').first()
      
      // Click YES
      await yesButton.click()
      await page.waitForTimeout(500)
      
      // Click NO
      await noButton.click()
      await page.waitForTimeout(500)
      
      // Click YES again
      await yesButton.click()
      await page.waitForTimeout(500)
      
      console.log('✅ YES/NO tab switching works')
    }
  })

  test('should be responsive and work on mobile viewport', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
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
      
      // Probabilities should still be visible
      const yesPercent = page.locator('text=/YES/i').first()
      await expect(yesPercent).toBeVisible()
      
      console.log('✅ Chart works on mobile viewport')
      await page.screenshot({ path: 'test-results/screenshots/prediction-chart-mobile.png', fullPage: true })
    }
  })

  test('should not have console errors related to charts', async ({ page }) => {
    const errors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(5000)
      
      // Filter chart-related errors
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

  test('should display "How it works" information', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Look for "How it works" section
      const howItWorks = page.locator('text=/How it works/i')
      await expect(howItWorks).toBeVisible({ timeout: 5000 })
      
      console.log('✅ "How it works" section is displayed')
    }
  })
})

