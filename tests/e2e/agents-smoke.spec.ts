/**
 * Agents Smoke Tests - Actually Testable Without Auth
 * 
 * These tests verify:
 * - Pages load
 * - Basic UI elements exist
 * - No JavaScript errors
 * 
 * NO LARP - If something fails, test fails (not skips)
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BABYLON_URL || 'http://localhost:3000'

test.describe('Agents List Page - Smoke Tests', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    
    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' })
    
    // Should load something (either auth wall or page)
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 })
    
    // Should not have JavaScript errors
    const criticalErrors = errors.filter(e => 
      !e.includes('Hydration') && 
      !e.includes('favicon')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('has correct page title', async ({ page }) => {
    await page.goto(`${BASE_URL}/agents`)
    await expect(page).toHaveTitle(/Babylon|Agents/)
  })
})

test.describe('Agent Creation Page - Smoke Tests', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    
    await page.goto(`${BASE_URL}/agents/create`, { waitUntil: 'networkidle' })
    
    // Should load something
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 })
    
    // Should not have critical JavaScript errors
    const criticalErrors = errors.filter(e => 
      !e.includes('Hydration') && 
      !e.includes('favicon')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('has correct page title', async ({ page }) => {
    await page.goto(`${BASE_URL}/agents/create`)
    await expect(page).toHaveTitle(/Babylon|Create|Agent/)
  })
})

test.describe('API Endpoints - Smoke Tests', () => {
  test('agents API endpoint exists', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/agents`)
    
    // Should return 401 (unauthorized), 200 (success), or 500 (server error with auth), not 404
    expect(response.status()).not.toBe(404)
  })

  test('generate-field API endpoint exists', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/agents/generate-field`, {
      data: { fieldName: 'name', currentValue: '', context: {} }
    })
    
    // Should return 400 (bad request), 503 (not configured), 200 (success), or 500 (error)
    // But NOT 404 (endpoint missing)
    expect(response.status()).not.toBe(404)
    
    // If it's 503, AI is not configured (acceptable)
    if (response.status() === 503) {
      const data = await response.json()
      expect(data.error).toContain('not configured')
    }
  })
})

export {}

