/**
 * Page Helper Utilities for Synpress E2E Tests
 * 
 * Common utilities for interacting with pages and components
 */

import { type Page, expect } from '@playwright/test'

/**
 * Wait for the page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 30000 })
  // Wait a bit for React hydration
  await page.waitForTimeout(1000)
}

/**
 * Navigate to a route and wait for it to load
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  console.log(`🧭 Navigating to: ${path}`)
  await page.goto(path)
  await waitForPageLoad(page)
  console.log(`✅ Loaded: ${path}`)
}

/**
 * Click a button by text content
 */
export async function clickButton(page: Page, text: string): Promise<void> {
  const button = page.locator(`button:has-text("${text}")`).first()
  await expect(button).toBeVisible({ timeout: 10000 })
  await button.click()
  console.log(`✅ Clicked button: ${text}`)
}

/**
 * Click any element by selector
 */
export async function clickElement(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first()
  await expect(element).toBeVisible({ timeout: 10000 })
  await element.click()
  console.log(`✅ Clicked element: ${selector}`)
}

/**
 * Fill an input field
 */
export async function fillInput(page: Page, selector: string, value: string): Promise<void> {
  const input = page.locator(selector).first()
  await expect(input).toBeVisible({ timeout: 10000 })
  await input.fill(value)
  console.log(`✅ Filled input: ${selector} with value: ${value}`)
}

/**
 * Check if an element is visible
 */
export async function isVisible(page: Page, selector: string, timeout = 5000): Promise<boolean> {
  await page.waitForSelector(selector, { state: 'visible', timeout })
  return true
}

/**
 * Check if text is present on the page
 */
export async function hasText(page: Page, text: string): Promise<boolean> {
  const element = page.locator(`text=${text}`).first()
  return await element.isVisible({ timeout: 5000 })
}

/**
 * Wait for an element to appear
 */
export async function waitForElement(page: Page, selector: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout })
  console.log(`✅ Element appeared: ${selector}`)
}

/**
 * Wait for text to appear
 */
export async function waitForText(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(`text=${text}`, { state: 'visible', timeout })
  console.log(`✅ Text appeared: ${text}`)
}

/**
 * Scroll to bottom of page
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight)
  })
  await page.waitForTimeout(1000)
  console.log('✅ Scrolled to bottom')
}

/**
 * Scroll to top of page
 */
export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(1000)
  console.log('✅ Scrolled to top')
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true })
  console.log(`📸 Screenshot saved: ${name}.png`)
}

/**
 * Get all buttons on the page
 */
export async function getAllButtons(page: Page): Promise<string[]> {
  const buttons = await page.locator('button').all()
  const buttonTexts: string[] = []
  
  for (const button of buttons) {
    const text = await button.textContent()
    if (text && text.trim()) {
      buttonTexts.push(text.trim())
    }
  }
  
  return buttonTexts
}

/**
 * Get all links on the page
 */
export async function getAllLinks(page: Page): Promise<string[]> {
  const links = await page.locator('a').all()
  const linkTexts: string[] = []
  
  for (const link of links) {
    const text = await link.textContent()
    if (text && text.trim()) {
      linkTexts.push(text.trim())
    }
  }
  
  return linkTexts
}

/**
 * Check if navigation is working by verifying URL change
 */
export async function verifyNavigation(page: Page, expectedPath: string): Promise<void> {
  await page.waitForURL(`**${expectedPath}`, { timeout: 10000 })
  expect(page.url()).toContain(expectedPath)
  console.log(`✅ Navigated to: ${expectedPath}`)
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 30000
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url()
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern)
      }
      return urlPattern.test(url)
    },
    { timeout }
  )
  console.log(`✅ API response received: ${urlPattern}`)
}

/**
 * Check for console errors
 */
export function checkForConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  
  return errors
}

/**
 * Mock API response
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: any
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
  console.log(`✅ Mocked API response: ${urlPattern}`)
}

