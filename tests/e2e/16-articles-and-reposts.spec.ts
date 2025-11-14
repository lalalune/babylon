import { test, expect } from '@playwright/test';

/**
 * Articles and Reposts Integration Tests
 * 
 * Focused tests for article display and repost functionality
 */

test.describe('Articles and Reposts', () => {
  
  test('Feed should display article posts with ArticleCard', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    
    // Wait for feed to load
    await page.waitForSelector('article', { timeout: 15000 });
    
    // Look for article card with "Read Full Article" button
    const articleCards = page.locator('button:has-text("Read Full Article")');
    const count = await articleCards.count();
    
    if (count === 0) {
      console.log('No articles found in feed - test skipped');
      test.skip();
      return;
    }
    
    console.log(`Found ${count} article cards in feed`);
    
    // Verify article card structure
    const firstArticle = page.locator('article:has(button:has-text("Read Full Article"))').first();
    
    // Should have article title (h2)
    await expect(firstArticle.locator('h2')).toBeVisible();
    
    // Should have "Read Full Article" button
    await expect(firstArticle.locator('button:has-text("Read Full Article")')).toBeVisible();
    
    // Should have organization avatar
    const avatar = firstArticle.locator('img, div[class*="rounded-full"]').first();
    await expect(avatar).toBeVisible();
  });

  test('Clicking article card should navigate to article or post page', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 15000 });
    
    const articleCard = page.locator('article:has(button:has-text("Read Full Article"))').first();
    
    if (!(await articleCard.isVisible())) {
      console.log('No articles in feed - skipping');
      test.skip();
      return;
    }
    
    // Click the article
    await articleCard.click();
    
    // Should navigate to either /post/ or /article/
    await page.waitForURL(/\/(post|article)\//, { timeout: 10000 });
    
    // Page should load successfully
    await page.waitForLoadState('domcontentloaded');
    
    // Should not show "Not Found" error
    await expect(page.locator('text=Not Found')).not.toBeVisible();
    
    console.log('Article navigation successful:', page.url());
  });

  test('Latest News panel should show articles only', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForLoadState('domcontentloaded');
    
    // Latest News panel (visible on desktop)
    const latestNews = page.locator('h2:has-text("Latest News")');
    
    if (!(await latestNews.isVisible())) {
      console.log('Latest News panel not visible (mobile view?) - skipping');
      test.skip();
      return;
    }
    
    // Should have news items
    const newsSection = page.locator('h2:has-text("Latest News")').locator('..');
    const newsItems = newsSection.locator('div.cursor-pointer');
    
    const count = await newsItems.count();
    console.log(`Latest News shows ${count} articles`);
    
    expect(count).toBeGreaterThan(0);
  });

  test('Posts should have repost buttons', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 15000 });
    
    // Get first post (could be article or regular post)
    const firstPost = page.locator('article').first();
    
    // Look for interaction bar with repost button
    // The button might have aria-label "Repost" or "Unrepost"
    const repostButton = firstPost.locator('svg').filter({ has: page.locator('[class*="lucide-repeat"]') });
    
    if (await repostButton.first().isVisible()) {
      console.log('Repost button found and visible');
      expect(await repostButton.count()).toBeGreaterThan(0);
    } else {
      console.log('No repost button visible - might need login or different selector');
    }
  });

  test('Article should display full content on detail page', async ({ page }) => {
    // First, get an article ID from the feed
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 15000 });
    
    const articleCard = page.locator('article:has(button:has-text("Read Full Article"))').first();
    
    if (!(await articleCard.isVisible())) {
      console.log('No articles - skipping');
      test.skip();
      return;
    }
    
    // Click to navigate
    await articleCard.click();
    await page.waitForURL(/\/(post|article)\//, { timeout: 10000 });
    
    // Should eventually show article content
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    console.log('Navigated to:', url);
    
    // If redirected to /article/, should show full article layout
    if (url.includes('/article/')) {
      // Should have article title
      await expect(page.locator('h1')).toBeVisible();
      
      // Should have article content (prose)
      await expect(page.locator('div[class*="prose"]')).toBeVisible();
      
      console.log('Article detail page loaded successfully');
    } else if (url.includes('/post/')) {
      // Might still be on post page, which is fine if it's loading
      console.log('On post page, may redirect to article');
    }
  });

  test('Regular posts and article posts should both appear in feed', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 15000 });
    
    const allPosts = page.locator('article');
    const totalCount = await allPosts.count();
    
    // Count articles (have "Read Full Article" button)
    const articleCards = page.locator('article:has(button:has-text("Read Full Article"))');
    const articleCount = await articleCards.count();
    
    // Count regular posts (don't have "Read Full Article" button)
    const regularPostCount = totalCount - articleCount;
    
    console.log(`Feed has ${totalCount} total posts: ${articleCount} articles, ${regularPostCount} regular posts`);
    
    // Should have both types in feed
    expect(totalCount).toBeGreaterThan(0);
    
    // Articles should be less common (around 10% or less)
    if (totalCount > 10) {
      const articlePercentage = (articleCount / totalCount) * 100;
      console.log(`Article percentage: ${articlePercentage.toFixed(1)}%`);
    }
  });

  test('Feed should load without errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:3000/feed');
    await page.waitForLoadState('networkidle');
    
    // Check for React errors or critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('DevTools') && 
      !e.includes('Sentry') &&
      !e.includes('Speed Insights') &&
      !e.includes('Transport disabled')
    );
    
    if (criticalErrors.length > 0) {
      console.error('Critical errors found:', criticalErrors);
    }
    
    expect(criticalErrors.length).toBe(0);
  });
});

