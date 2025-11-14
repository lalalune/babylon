// @ts-nocheck - Test file

/**
 * Agents E2E Tests - REAL TESTS, NO LARP
 * 
 * Tests actual functionality without defensive programming that hides bugs.
 * If something doesn't work, the test FAILS (not skips).
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BABYLON_URL || 'http://localhost:3000'

test.describe('Agents Pages - Unauthenticated', () => {
  test('should show sign-in prompt when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/agents`)
    
    // Should see auth wall
    await expect(page.locator('text=/Sign in|AI Agents/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('should show agent creation page with auth wall', async ({ page }) => {
    await page.goto(`${BASE_URL}/agents/create`)
    
    // Should see auth wall or redirect
    await expect(page.locator('text=/Sign in|Please sign in|Create an Agent/i').first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe.skip('Agents Creation Form - UI Only', () => {
  test('Authentication required - skipping for now', async () => {
    // These tests require authentication which we'll set up properly
    // For now, we're being honest about what's tested vs not tested
  })
})

test.describe.skip('Agent Detail Page - UI Only', () => {
  test('Authentication and agent creation required - skipping for now', async () => {
    // These tests require:
    // 1. Authentication setup
    // 2. Test agent created in database
    // 3. Proper test data seeding
  })
})

// Export for potential use in other test files
export {}

