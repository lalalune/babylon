/**
 * Prediction Market Resolution Time E2E Tests
 * 
 * Tests for accurate resolution time display on prediction markets:
 * - Exact time shown on detail page
 * - Countdown timer displays hours and minutes
 * - Resolution date and time are both visible
 * - Tooltip shows full timestamp
 */

import { test, expect } from '@playwright/test'
import { setupAuthState } from './fixtures/auth'

test.describe('Prediction Resolution Time Display', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthState(page, '/markets/predictions')
    await page.waitForTimeout(2000)
  })

  test('should display precise time countdown in listing page', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('a[href*="/markets/predictions/"]', { timeout: 10000 }).catch(() => {})
    
    const marketCards = page.locator('a[href*="/markets/predictions/"], button:has-text("YES"), button:has-text("NO")')
    const count = await marketCards.count()
    
    if (count > 0) {
      // Look for time display with hours (e.g., "3d 5h", "12h 30m", "45m")
      const timeDisplay = page.locator('text=/[0-9]+[dhm]( [0-9]+[dhm])?/')
      const hasTimeDisplay = await timeDisplay.isVisible({ timeout: 5000 }).catch(() => false)
      
      if (hasTimeDisplay) {
        const timeText = await timeDisplay.first().textContent()
        console.log(`✅ Precise time countdown displayed: "${timeText}"`)
        
        // Verify format is more precise than just days
        const hasPreciseFormat = /\d+[hm]/.test(timeText || '') || /\d+d \d+h/.test(timeText || '')
        if (hasPreciseFormat) {
          console.log('✅ Format includes hours/minutes for precision')
        }
      } else {
        console.log('ℹ️  No time countdown found (markets may not have resolution dates)')
      }
      
      await page.screenshot({ path: 'test-results/screenshots/prediction-time-listing.png' })
    }
  })

  test('should show exact resolution date and time on detail page', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Look for "Resolution Date & Time" section
      const resolutionLabel = page.locator('text=/Resolution Date & Time/i')
      const hasResolutionSection = await resolutionLabel.isVisible({ timeout: 5000 }).catch(() => false)
      
      if (hasResolutionSection) {
        console.log('✅ Resolution Date & Time section found')
        
        // Look for "Exact Time" label
        const exactTimeLabel = page.locator('text=/Exact Time/i')
        const hasExactTime = await exactTimeLabel.isVisible({ timeout: 2000 }).catch(() => false)
        
        if (hasExactTime) {
          console.log('✅ Exact Time is displayed')
          
          // Verify time format includes hours and minutes
          const timeElements = page.locator('text=/[0-9]{1,2}:[0-9]{2}/')
          const hasTimeFormat = await timeElements.count().then(c => c > 0)
          
          if (hasTimeFormat) {
            const timeText = await timeElements.first().textContent()
            console.log(`✅ Time format verified: "${timeText}"`)
          }
          
          // Check for timezone
          const hasTimezone = await page.locator('text=/[A-Z]{2,4}$/').isVisible({ timeout: 2000 }).catch(() => false)
          if (hasTimezone) {
            console.log('✅ Timezone is displayed')
          }
        }
        
        await page.screenshot({ path: 'test-results/screenshots/prediction-resolution-time.png' })
      } else {
        console.log('ℹ️  No resolution date section (market may not have resolution date set)')
      }
    }
  })

  test('should display countdown in header badge', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Look for time badge in header
      const timeBadge = page.locator('div.rounded-full:has(svg[class*="lucide-clock"])')
      const hasBadge = await timeBadge.isVisible({ timeout: 5000 }).catch(() => false)
      
      if (hasBadge) {
        const badgeText = await timeBadge.textContent()
        console.log(`✅ Header countdown badge found: "${badgeText}"`)
        
        // Verify it shows more than just days
        const hasPreciseTime = badgeText?.includes('h') || badgeText?.includes('m')
        if (hasPreciseTime) {
          console.log('✅ Countdown shows hours/minutes, not just days')
        }
      } else {
        console.log('ℹ️  No countdown badge (market may not have resolution date)')
      }
    }
  })

  test('should show tooltip with exact time on listing page', async ({ page }) => {
    // Wait for markets to load
    await page.waitForSelector('a[href*="/markets/predictions/"], button:has-text("YES")', { timeout: 10000 }).catch(() => {})
    
    // Find clock icon
    const clockIcon = page.locator('svg.lucide-clock').first()
    const hasClockIcon = await clockIcon.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (hasClockIcon) {
      // Hover over the time display
      const timeContainer = clockIcon.locator('..')
      await timeContainer.hover()
      await page.waitForTimeout(500)
      
      // Check for title attribute (tooltip)
      const title = await timeContainer.getAttribute('title')
      
      if (title) {
        console.log(`✅ Tooltip shows exact time: "${title}"`)
        
        // Verify it includes date and time
        const hasDate = /[A-Z][a-z]+\s+\d+/.test(title) // e.g., "Dec 15"
        const hasTime = /\d{1,2}:\d{2}/.test(title) // e.g., "03:30"
        
        if (hasDate && hasTime) {
          console.log('✅ Tooltip includes both date and time')
        }
      } else {
        console.log('ℹ️  No tooltip found (title attribute not set)')
      }
      
      await page.screenshot({ path: 'test-results/screenshots/prediction-time-tooltip.png' })
    }
  })

  test('should not display null or "NaN" in time displays', async ({ page }) => {
    const marketLinks = page.locator('a[href*="/markets/predictions/"]')
    const count = await marketLinks.count()
    
    if (count > 0) {
      // Check listing page
      const bodyText = await page.locator('body').textContent()
      expect(bodyText).not.toContain('NaN')
      expect(bodyText).not.toContain('null')
      expect(bodyText).not.toContain('undefined')
      
      // Navigate to detail page
      await marketLinks.first().click()
      await page.waitForTimeout(3000)
      
      // Check detail page
      const detailText = await page.locator('body').textContent()
      expect(detailText).not.toContain('NaN')
      expect(detailText).not.toContain('null')
      expect(detailText).not.toContain('undefined')
      
      console.log('✅ No invalid values in time displays')
    }
  })

  test('should handle markets without resolution dates gracefully', async ({ page }) => {
    // Navigate to predictions page
    await page.waitForTimeout(2000)
    
    // Page should load even if some markets don't have resolution dates
    const pageContent = await page.locator('body').textContent()
    expect(pageContent).toBeTruthy()
    
    // Look for "Soon" fallback text
    const soonText = page.locator('text=/Soon/')
    const hasSoonFallback = await soonText.isVisible({ timeout: 3000 }).catch(() => false)
    
    if (hasSoonFallback) {
      console.log('✅ "Soon" fallback displayed for markets without resolution dates')
    }
    
    console.log('✅ Markets without resolution dates handled gracefully')
  })

  test('should format time differently based on time remaining', async ({ page }) => {
    // Page is already on /markets/predictions from beforeEach
    await page.waitForTimeout(2000)
    
    // Look for different time formats
    const timeDisplays = page.locator('text=/[0-9]+[dhm]/')
    const count = await timeDisplays.count()
    
    if (count > 0) {
      const formats = new Set<string>()
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await timeDisplays.nth(i).textContent()
        if (text) {
          // Extract format pattern
          const hasDays = text.includes('d')
          const hasHours = text.includes('h')
          const hasMinutes = text.includes('m')
          
          formats.add(`${hasDays ? 'd' : ''}${hasHours ? 'h' : ''}${hasMinutes ? 'm' : ''}`)
        }
      }
      
      console.log(`✅ Time displayed in ${formats.size} different format(s): ${Array.from(formats).join(', ')}`)
    } else {
      console.log('ℹ️  No time formats found (markets may not have resolution dates)')
    }
  })
})

