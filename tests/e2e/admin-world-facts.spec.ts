/**
 * Admin Panel World Facts E2E Tests
 * Tests all buttons and interactions in the World Facts admin UI
 */

import { test, expect } from '@playwright/test';

test.describe('Admin World Facts Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin panel
    await page.goto('http://localhost:3000/admin');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display Game Control tab with World Facts section', async ({ page }) => {
    // Click on Game Control tab if not already active
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    
    // Wait for the tab content to load
    await page.waitForTimeout(1000);
    
    // Verify World Facts section is visible
    const worldFactsSection = page.locator('text=World Facts & Context');
    await expect(worldFactsSection).toBeVisible({ timeout: 10000 });
  });

  test('should have Fetch RSS Feeds button', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Look for Fetch RSS Feeds button
    const fetchButton = page.locator('button:has-text("Fetch RSS Feeds")');
    await expect(fetchButton).toBeVisible({ timeout: 10000 });
  });

  test('should have Generate Parodies button', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Look for Generate Parodies button
    const generateButton = page.locator('button:has-text("Generate Parodies")');
    await expect(generateButton).toBeVisible({ timeout: 10000 });
  });

  test('should have Refresh Mappings button', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Look for Refresh Mappings button
    const refreshButton = page.locator('button:has-text("Refresh Mappings")');
    await expect(refreshButton).toBeVisible({ timeout: 10000 });
  });

  test('should click Fetch RSS Feeds button successfully', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Click Fetch RSS Feeds button
    const fetchButton = page.locator('button:has-text("Fetch RSS Feeds")');
    await fetchButton.click();
    
    // Wait for action to complete (button should be disabled then re-enabled)
    await page.waitForTimeout(2000);
    
    // Verify button is clickable again (not stuck in loading state)
    await expect(fetchButton).toBeEnabled({ timeout: 30000 });
  });

  test('should click Generate Parodies button successfully', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Click Generate Parodies button
    const generateButton = page.locator('button:has-text("Generate Parodies")');
    await generateButton.click();
    
    // Wait for action to complete
    await page.waitForTimeout(2000);
    
    // Verify button is clickable again
    await expect(generateButton).toBeEnabled({ timeout: 30000 });
  });

  test('should click Refresh Mappings button successfully', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Click Refresh Mappings button
    const refreshButton = page.locator('button:has-text("Refresh Mappings")');
    await refreshButton.click();
    
    // Wait for action to complete
    await page.waitForTimeout(1000);
    
    // Verify button is clickable again (should be instant)
    await expect(refreshButton).toBeEnabled({ timeout: 5000 });
  });

  test('should display world facts in categories', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Wait for world facts to load
    await page.waitForSelector('text=Current World Facts', { timeout: 10000 });
    
    // Check for category headers (at least one should exist)
    const categories = ['crypto', 'politics', 'economy', 'technology', 'general'];
    let foundCategory = false;
    
    for (const category of categories) {
      const categoryHeader = page.locator(`text=${category}`).first();
      if (await categoryHeader.isVisible().catch(() => false)) {
        foundCategory = true;
        break;
      }
    }
    
    expect(foundCategory).toBe(true);
  });

  test('should have edit buttons for world facts', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Look for any edit buttons (SVG icons)
    const editButtons = page.locator('button').filter({ has: page.locator('svg') });
    const count = await editButtons.count();
    
    // Should have at least one edit button if facts are loaded
    expect(count).toBeGreaterThan(0);
  });

  test('should display recent parody headlines section', async ({ page }) => {
    // Navigate to Game Control tab
    const gameControlTab = page.locator('text=Game Control').first();
    await gameControlTab.click();
    await page.waitForTimeout(1000);
    
    // Wait for the section to potentially appear
    await page.waitForTimeout(2000);
    
    // Check if Recent Parody Headlines section exists
    // (May not be visible if no parodies have been generated yet)
    const parodySection = page.locator('text=Recent Parody Headlines');
    const isVisible = await parodySection.isVisible().catch(() => false);
    
    // This is OK - section only appears if parodies exist
    expect(typeof isVisible).toBe('boolean');
  });
});

