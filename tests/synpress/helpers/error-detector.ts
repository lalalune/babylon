/**
 * Error Detection and Validation Utilities
 * 
 * These utilities ensure ALL errors are caught and reported.
 * Tests will FAIL LOUDLY on any issue so nothing is missed.
 */

import { type Page } from '@playwright/test'

export class ErrorDetector {
  private errors: string[] = []
  private warnings: string[] = []
  private page: Page

  constructor(page: Page) {
    this.page = page
    this.setupErrorListeners()
  }

  /**
   * Setup listeners for all types of errors
   */
  private setupErrorListeners(): void {
    // Console errors
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.errors.push(`Console Error: ${msg.text()}`)
      }
      if (msg.type() === 'warning') {
        this.warnings.push(`Console Warning: ${msg.text()}`)
      }
    })

    // Page errors (uncaught exceptions)
    this.page.on('pageerror', (error) => {
      this.errors.push(`Page Error: ${error.message}\n${error.stack}`)
    })

    // Request failures
    this.page.on('requestfailed', (request) => {
      this.errors.push(`Request Failed: ${request.url()} - ${request.failure()?.errorText}`)
    })

    // Response errors (4xx, 5xx)
    this.page.on('response', (response) => {
      if (response.status() >= 400) {
        this.errors.push(`HTTP Error: ${response.status()} ${response.statusText()} - ${response.url()}`)
      }
    })
  }

  /**
   * Get all collected errors
   */
  getErrors(): string[] {
    return this.errors
  }

  /**
   * Get all collected warnings
   */
  getWarnings(): string[] {
    return this.warnings
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0
  }

  /**
   * Throw if there are any errors
   */
  throwIfErrors(): void {
    if (this.hasErrors()) {
      const errorReport = this.formatErrorReport()
      throw new Error(`❌ ERRORS DETECTED:\n${errorReport}`)
    }
  }

  /**
   * Format error report
   */
  formatErrorReport(): string {
    let report = ''
    
    if (this.errors.length > 0) {
      report += `\n🔴 ERRORS (${this.errors.length}):\n`
      this.errors.forEach((error, i) => {
        report += `  ${i + 1}. ${error}\n`
      })
    }
    
    if (this.warnings.length > 0) {
      report += `\n⚠️  WARNINGS (${this.warnings.length}):\n`
      this.warnings.forEach((warning, i) => {
        report += `  ${i + 1}. ${warning}\n`
      })
    }
    
    return report
  }

  /**
   * Clear all errors and warnings
   */
  clear(): void {
    this.errors = []
    this.warnings = []
  }

  /**
   * Log current status
   */
  logStatus(): void {
    if (this.hasErrors()) {
      console.error(this.formatErrorReport())
    } else if (this.warnings.length > 0) {
      console.warn(`⚠️  ${this.warnings.length} warnings detected`)
    } else {
      console.log('✅ No errors detected')
    }
  }
}

/**
 * Button Validator - ensures every button is functional
 */
export class ButtonValidator {
  private page: Page
  private errorDetector: ErrorDetector
  private testedButtons: Set<string> = new Set()

  constructor(page: Page, errorDetector: ErrorDetector) {
    this.page = page
    this.errorDetector = errorDetector
  }

  /**
   * Find ALL buttons on the page
   */
  async findAllButtons(): Promise<{selector: string, text: string, visible: boolean}[]> {
    const buttons: {selector: string, text: string, visible: boolean}[] = []
    
    // Find all button elements
    const buttonElements = await this.page.locator('button').all()
    
    for (let i = 0; i < buttonElements.length; i++) {
      const button = buttonElements[i]
      const text = await button.textContent().catch(() => '')
      const visible = await button.isVisible().catch(() => false)
      const selector = `button >> nth=${i}`
      
      buttons.push({
        selector,
        text: text?.trim() || `[Button ${i}]`,
        visible
      })
    }
    
    // Find all links that look like buttons
    const linkElements = await this.page.locator('a[role="button"], a.button, a[class*="button"]').all()
    
    for (let i = 0; i < linkElements.length; i++) {
      const link = linkElements[i]
      const text = await link.textContent().catch(() => '')
      const visible = await link.isVisible().catch(() => false)
      const selector = `a[role="button"] >> nth=${i}`
      
      buttons.push({
        selector,
        text: text?.trim() || `[Link Button ${i}]`,
        visible
      })
    }
    
    return buttons
  }

  /**
   * Test a single button
   */
  async testButton(selector: string, text: string): Promise<boolean> {
    try {
      console.log(`  Testing button: "${text}"`)
      
      const button = this.page.locator(selector).first()
      
      // Check if button exists and is visible
      if (!(await button.isVisible({ timeout: 1000 }).catch(() => false))) {
        console.log(`    ⏭️  Skipped (not visible): "${text}"`)
        return false
      }
      
      // Check if button is disabled
      if (await button.isDisabled().catch(() => false)) {
        console.log(`    ⏭️  Skipped (disabled): "${text}"`)
        return false
      }
      
      // Clear errors before clicking
      this.errorDetector.clear()
      
      // Click the button
      await button.click({ timeout: 5000 })
      
      // Wait for any effects
      await this.page.waitForTimeout(500)
      
      // Check for errors after clicking
      if (this.errorDetector.hasErrors()) {
        console.error(`    ❌ ERRORS after clicking "${text}":`)
        this.errorDetector.logStatus()
        this.errorDetector.throwIfErrors()
      }
      
      console.log(`    ✅ Clicked successfully: "${text}"`)
      this.testedButtons.add(text)
      
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`    ❌ FAILED to test button "${text}": ${errorMessage}`)
      throw new Error(`Button test failed for "${text}": ${errorMessage}`)
    }
  }

  /**
   * Test ALL buttons on the page
   */
  async testAllButtons(options: {
    skipPatterns?: RegExp[],
    screenshotPrefix?: string
  } = {}): Promise<{tested: number, skipped: number, failed: number}> {
    console.log('🔍 Finding all buttons on page...')
    
    const buttons = await this.findAllButtons()
    console.log(`Found ${buttons.length} buttons`)
    
    let tested = 0
    let skipped = 0
    let failed = 0
    
    const skipPatterns = options.skipPatterns || [
      /logout/i,
      /sign out/i,
      /disconnect/i,
      /delete account/i,
      /remove/i,
    ]
    
    for (const button of buttons) {
      // Skip if button text matches skip patterns
      const shouldSkip = skipPatterns.some(pattern => pattern.test(button.text))
      
      if (shouldSkip) {
        console.log(`  ⏭️  Skipping: "${button.text}" (matches skip pattern)`)
        skipped++
        continue
      }
      
      if (!button.visible) {
        console.log(`  ⏭️  Skipping: "${button.text}" (not visible)`)
        skipped++
        continue
      }
      
      try {
        const wasClicked = await this.testButton(button.selector, button.text)
        if (wasClicked) {
          tested++
          
          // Take screenshot after click if prefix provided
          if (options.screenshotPrefix) {
            await this.page.screenshot({ 
              path: `test-results/screenshots/${options.screenshotPrefix}-${tested}.png` 
            })
          }
          
          // Wait a bit between clicks
          await this.page.waitForTimeout(300)
        } else {
          skipped++
        }
      } catch (error) {
        failed++
        console.error(`  ❌ Failed: "${button.text}"`)
        throw error // Re-throw to fail the test
      }
    }
    
    console.log(`\n📊 Button Test Results:`)
    console.log(`  ✅ Tested: ${tested}`)
    console.log(`  ⏭️  Skipped: ${skipped}`)
    console.log(`  ❌ Failed: ${failed}`)
    
    if (failed > 0) {
      throw new Error(`${failed} button(s) failed testing`)
    }
    
    return { tested, skipped, failed }
  }

  /**
   * Get tested buttons
   */
  getTestedButtons(): string[] {
    return Array.from(this.testedButtons)
  }
}

/**
 * Page Validator - ensures page is loaded correctly
 */
export class PageValidator {
  private page: Page
  private errorDetector: ErrorDetector

  constructor(page: Page, errorDetector: ErrorDetector) {
    this.page = page
    this.errorDetector = errorDetector
  }

  /**
   * Validate page loaded successfully
   */
  async validatePageLoad(expectedUrl: string): Promise<void> {
    console.log(`🔍 Validating page load: ${expectedUrl}`)
    
    // Check URL
    const currentUrl = this.page.url()
    if (!currentUrl.includes(expectedUrl)) {
      throw new Error(`URL mismatch: Expected "${expectedUrl}", got "${currentUrl}"`)
    }
    
    // Check for loading state
    const isLoading = await this.page.locator('[data-testid="loading"], [data-loading="true"]')
      .isVisible({ timeout: 1000 })
      .catch(() => false)
    
    if (isLoading) {
      console.log('  ⏳ Page is loading, waiting...')
      await this.page.waitForTimeout(3000)
    }
    
    // Check for errors
    if (this.errorDetector.hasErrors()) {
      throw new Error(`Page loaded with errors: ${this.errorDetector.formatErrorReport()}`)
    }
    
    console.log('  ✅ Page loaded successfully')
  }

  /**
   * Validate page has expected content
   */
  async validateHasContent(selectors: string[]): Promise<void> {
    console.log('🔍 Validating page content...')
    
    for (const selector of selectors) {
      const element = this.page.locator(selector).first()
      const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false)
      
      if (!isVisible) {
        throw new Error(`Expected content not found: ${selector}`)
      }
      
      console.log(`  ✅ Found: ${selector}`)
    }
  }

  /**
   * Validate no error messages on page
   */
  async validateNoErrors(): Promise<void> {
    const errorSelectors = [
      '[role="alert"]',
      '[data-testid="error"]',
      'text=/error|failed|something went wrong/i'
    ]
    
    for (const selector of errorSelectors) {
      const errorElement = this.page.locator(selector).first()
      const hasError = await errorElement.isVisible({ timeout: 1000 }).catch(() => false)
      
      if (hasError) {
        const errorText = await errorElement.textContent()
        throw new Error(`Error message found on page: ${errorText}`)
      }
    }
    
    console.log('  ✅ No error messages on page')
  }
}

/**
 * Create validators for a page
 */
export function createValidators(page: Page) {
  const errorDetector = new ErrorDetector(page)
  const buttonValidator = new ButtonValidator(page, errorDetector)
  const pageValidator = new PageValidator(page, errorDetector)
  
  return {
    errorDetector,
    buttonValidator,
    pageValidator
  }
}

