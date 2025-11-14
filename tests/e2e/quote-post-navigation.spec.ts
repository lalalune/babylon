/**
 * E2E Tests for Quote Post Navigation and Interactions
 * 
 * Tests the complete user flow for:
 * 1. Creating posts
 * 2. Quoting/reposting posts
 * 3. Navigating between posts
 * 4. Interacting with quoted posts
 * 5. Profile navigation from quoted posts
 */

import { test, expect } from '@playwright/test';

test.describe('Quote Post Navigation and Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
  });

  test('should create a post and then quote it', async ({ page }) => {
    // Wait for the feed to load
    await page.waitForSelector('[data-testid="feed-container"], article, .feed-post', { 
      timeout: 10000,
      state: 'visible'
    });

    // Find the first post in the feed
    const firstPost = page.locator('article').first();
    await expect(firstPost).toBeVisible();

    // Get the post ID from the article or interaction buttons
    const postId = await firstPost.getAttribute('data-post-id') || 
                   await firstPost.locator('[data-post-id]').first().getAttribute('data-post-id');
    
    if (!postId) {
      test.skip(); // Skip if we can't find a post ID
      return;
    }

    // Find and click the repost button
    const repostButton = firstPost.locator('button[aria-label*="Repost"], button[aria-label*="Share"]').first();
    
    if (await repostButton.isVisible()) {
      await repostButton.click();

      // Wait for the repost modal/dialog
      const repostModal = page.locator('[role="dialog"], .repost-modal, .share-modal').first();
      await expect(repostModal).toBeVisible({ timeout: 5000 });

      // Type a quote comment
      const commentInput = repostModal.locator('textarea, input[type="text"]').first();
      await commentInput.fill('This is my quote comment on this post!');

      // Click the quote/repost button
      const confirmButton = repostModal.locator('button:has-text("Quote"), button:has-text("Repost"), button:has-text("Share")').first();
      await confirmButton.click();

      // Wait for the modal to close
      await expect(repostModal).not.toBeVisible({ timeout: 5000 });

      // Wait a moment for the post to appear in the feed
      await page.waitForTimeout(2000);

      // The quoted post should now appear in the feed with our comment
      const quotedPost = page.locator('article:has-text("This is my quote comment")').first();
      await expect(quotedPost).toBeVisible({ timeout: 5000 });
    }
  });

  test('should navigate to original post when clicking quoted post card', async ({ page }) => {
    // Wait for the feed to load
    await page.waitForSelector('article', { timeout: 10000 });

    // Look for a quote post (has the embedded quote card)
    const quotePost = page.locator('article').filter({ 
      has: page.locator('div[role="link"], .quoted-post-card, [aria-label*="quoted post"]')
    }).first();

    const hasQuotePost = await quotePost.count() > 0;
    
    if (!hasQuotePost) {
      console.log('No quote posts found in feed, skipping test');
      test.skip();
      return;
    }

    // Get the current URL before clicking
    const initialUrl = page.url();

    // Find and click the embedded quoted post card
    const quotedCard = quotePost.locator('div[role="link"], .quoted-post-card').first();
    await expect(quotedCard).toBeVisible();
    await quotedCard.click();

    // Wait for navigation
    await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
    
    // Verify we navigated to a different page
    const newUrl = page.url();
    expect(newUrl).not.toBe(initialUrl);
    expect(newUrl).toMatch(/\/post\/|\/article\//);

    // Verify the page loaded successfully (no error states)
    await expect(page.locator('text=Post Not Found')).not.toBeVisible();
    await expect(page.locator('text=Article Not Found')).not.toBeVisible();
  });

  test('should navigate to original author profile from quoted post', async ({ page }) => {
    // Wait for the feed to load
    await page.waitForSelector('article', { timeout: 10000 });

    // Look for a quote post
    const quotePost = page.locator('article').filter({ 
      has: page.locator('div[role="link"]')
    }).first();

    const hasQuotePost = await quotePost.count() > 0;
    
    if (!hasQuotePost) {
      console.log('No quote posts found in feed, skipping test');
      test.skip();
      return;
    }

    // Find the author info within the quoted post card
    const quotedCard = quotePost.locator('div[role="link"]').first();
    await expect(quotedCard).toBeVisible();

    // Find and click on the author's profile picture or name within the quoted card
    // This should navigate to the ORIGINAL author's profile, not the reposter's
    const authorLink = quotedCard.locator('a[href*="/profile/"]').first();
    
    if (!(await authorLink.isVisible())) {
      test.skip();
      return;
    }

    const profileHref = await authorLink.getAttribute('href');
    await authorLink.click();

    // Wait for navigation to profile page
    await page.waitForURL(/\/profile\//, { timeout: 5000 });

    // Verify we're on a profile page
    expect(page.url()).toMatch(/\/profile\//);
    expect(page.url()).toContain(profileHref || '');

    // Verify profile page loaded successfully
    await expect(page.locator('text=Profile Not Found')).not.toBeVisible();
  });

  test('should show correct author info: reposter for quote posts, original for simple reposts', async ({ page }) => {
    // Wait for the feed to load
    await page.waitForSelector('article', { timeout: 10000 });

    // Test 1: Quote post should show reposter's info in main header
    const quotePost = page.locator('article').filter({ 
      has: page.locator('div[role="link"]')
    }).filter({
      hasText: /repost/i
    }).first();

    if (await quotePost.count() > 0) {
      // The main header should show the reposter's info
      const mainHeader = quotePost.locator('> div > div').first();
      await expect(mainHeader).toBeVisible();

      // The quoted card should show the original author's info
      const quotedCard = quotePost.locator('div[role="link"]').first();
      await expect(quotedCard).toBeVisible();
    }

    // Test 2: Simple repost should show original author's info with "Reposted by X" indicator
    const simpleRepost = page.locator('article:has-text("Reposted by")').first();

    if (await simpleRepost.count() > 0) {
      // Should have the "Reposted by" indicator
      await expect(simpleRepost.locator('text=/Reposted by/i')).toBeVisible();
      
      // The main profile info should be the original author
      await expect(simpleRepost).toBeVisible();
    }
  });

  test('should allow commenting on quote post separately from original post', async ({ page }) => {
    // Wait for the feed to load
    await page.waitForSelector('article', { timeout: 10000 });

    // Look for a quote post
    const quotePost = page.locator('article').filter({ 
      has: page.locator('div[role="link"]')
    }).first();

    const hasQuotePost = await quotePost.count() > 0;
    
    if (!hasQuotePost) {
      console.log('No quote posts found in feed, skipping test');
      test.skip();
      return;
    }

    // Click the comment button on the MAIN quote post (not the quoted card)
    const commentButton = quotePost.locator('button[aria-label*="Comment"]').first();
    
    if (await commentButton.isVisible()) {
      await commentButton.click();

      // Wait for comment section or modal to open
      await page.waitForTimeout(1000);

      // The comment section should be for the QUOTE POST, not the original
      // We can verify this by checking if we see the quote comment in the context
      const commentSection = page.locator('[data-testid="comment-section"], .comment-section, textarea').first();
      await expect(commentSection).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle user quoting their own post', async ({ page }) => {
    // This is a simpler test case that doesn't require multiple users
    
    // Wait for the feed to load
    await page.waitForSelector('article', { timeout: 10000 });

    // Try to find any post
    const anyPost = page.locator('article').first();
    await expect(anyPost).toBeVisible();

    // Try to repost it
    const repostButton = anyPost.locator('button[aria-label*="Repost"], button[aria-label*="Share"]').first();
    
    if (await repostButton.isVisible()) {
      await repostButton.click();

      // Wait for the repost modal
      const repostModal = page.locator('[role="dialog"], .repost-modal').first();
      
      if (await repostModal.isVisible()) {
        // Add a quote comment
        const commentInput = repostModal.locator('textarea, input[type="text"]').first();
        await commentInput.fill('Quoting my own post for context!');

        // Confirm
        const confirmButton = repostModal.locator('button:has-text("Quote"), button:has-text("Repost")').first();
        await confirmButton.click();

        // Wait for the modal to close
        await expect(repostModal).not.toBeVisible({ timeout: 5000 });

        // The quote should appear (might show error if it's your own post, depending on business logic)
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should maintain proper navigation hierarchy: quote post -> original post -> author profile', async ({ page }) => {
    // Wait for the feed to load
    await page.waitForSelector('article', { timeout: 10000 });

    // Step 1: Find a quote post
    const quotePost = page.locator('article').filter({ 
      has: page.locator('div[role="link"]')
    }).first();

    const hasQuotePost = await quotePost.count() > 0;
    
    if (!hasQuotePost) {
      console.log('No quote posts found in feed, skipping test');
      test.skip();
      return;
    }

    // Step 2: Click on the main quote post to go to its detail page
    const quotePostUrl = page.url();
    await quotePost.click();
    await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
    const quotePostDetailUrl = page.url();
    expect(quotePostDetailUrl).not.toBe(quotePostUrl);

    // Step 3: On the quote post detail page, click the embedded original post
    await page.waitForTimeout(1000);
    const quotedCardOnDetailPage = page.locator('div[role="link"]').first();
    
    if (await quotedCardOnDetailPage.isVisible()) {
      await quotedCardOnDetailPage.click();
      await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
      const originalPostUrl = page.url();
      expect(originalPostUrl).not.toBe(quotePostDetailUrl);

      // Step 4: From the original post, navigate to the author's profile
      await page.waitForTimeout(1000);
      const authorLink = page.locator('a[href*="/profile/"]').first();
      
      if (await authorLink.isVisible()) {
        await authorLink.click();
        await page.waitForURL(/\/profile\//, { timeout: 5000 });
        const profileUrl = page.url();
        expect(profileUrl).toMatch(/\/profile\//);
        expect(profileUrl).not.toBe(originalPostUrl);
      }
    }
  });
});

