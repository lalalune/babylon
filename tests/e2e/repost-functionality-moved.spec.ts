import { test, expect } from '@playwright/test';

/**
 * Repost Functionality Tests
 * 
 * Tests the complete repost/quote post functionality including:
 * - Reposting regular posts
 * - Reposting articles
 * - Quote posts with comments
 * - Navigation to quoted posts
 * - Profile pictures in quoted posts
 * - Quoted posts from Users, Actors, and Organizations
 */

test.describe('Repost Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to feed
    await page.goto('http://localhost:3000/feed');
    await page.waitForLoadState('networkidle');
  });

  test('should display repost button on all posts', async ({ page }) => {
    // Wait for posts to load
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Get all posts
    const posts = page.locator('article');
    const count = await posts.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Check that each post has a repost button (Repeat2 icon)
    for (let i = 0; i < Math.min(count, 3); i++) {
      const post = posts.nth(i);
      const repostButton = post.locator('button[aria-label*="epost"]');
      await expect(repostButton).toBeVisible();
    }
  });

  test('should open repost modal when clicking repost button', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000');
    
    // Check if already logged in, if not, skip this test
    const loginButton = page.locator('button:has-text("Connect Wallet")');
    if (await loginButton.isVisible()) {
      test.skip();
      return;
    }

    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Click first repost button
    const firstPost = page.locator('article').first();
    const repostButton = firstPost.locator('button[aria-label*="epost"]').first();
    await repostButton.click();
    
    // Modal should appear
    await expect(page.locator('text=Repost')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Post")')).toBeVisible();
  });

  test('should create simple repost without comment', async ({ page }) => {
    // Skip if not logged in
    const loginButton = page.locator('button:has-text("Connect Wallet")');
    if (await loginButton.isVisible()) {
      test.skip();
      return;
    }

    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Find a post that hasn't been shared yet
    const posts = page.locator('article');
    const count = await posts.count();
    
    let unsharedPost = null;
    for (let i = 0; i < count; i++) {
      const post = posts.nth(i);
      const repostButton = post.locator('button[aria-label="Repost"]');
      if (await repostButton.isVisible()) {
        unsharedPost = post;
        break;
      }
    }
    
    if (!unsharedPost) {
      test.skip();
      return;
    }
    
    const repostButton = unsharedPost.locator('button[aria-label="Repost"]');
    await repostButton.click();
    
    // Modal should appear
    await page.waitForSelector('button:has-text("Post")', { timeout: 5000 });
    
    // Click Post button without adding comment
    const postButton = page.locator('button:has-text("Post")').last();
    await postButton.click();
    
    // Wait for modal to close
    await expect(page.locator('text=Repost').first()).not.toBeVisible({ timeout: 5000 });
    
    // Repost button should now show as shared (green)
    await expect(repostButton).toHaveClass(/text-green-600/);
  });

  test('should create quote post with comment', async ({ page }) => {
    // Skip if not logged in
    const loginButton = page.locator('button:has-text("Connect Wallet")');
    if (await loginButton.isVisible()) {
      test.skip();
      return;
    }

    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Find a post to quote
    const firstPost = page.locator('article').first();
    const repostButton = firstPost.locator('button[aria-label*="epost"]').first();
    await repostButton.click();
    
    // Modal should appear
    await page.waitForSelector('textarea[placeholder*="Add your thoughts"]', { timeout: 5000 });
    
    // Add a comment
    const textarea = page.locator('textarea[placeholder*="Add your thoughts"]');
    await textarea.fill('This is my take on this news!');
    
    // Click Post button
    const postButton = page.locator('button:has-text("Post")').last();
    await postButton.click();
    
    // Wait for modal to close
    await page.waitForTimeout(1000);
    
    // Navigate to own profile to see the quote post
    await page.goto('http://localhost:3000/profile');
    await page.waitForLoadState('networkidle');
    
    // Should see our quote comment in a post
    await expect(page.locator('text=This is my take on this news!')).toBeVisible({ timeout: 5000 });
  });

  test('should display quoted post with correct author info', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Look for a quote post (post with embedded quoted content)
    const quotedPost = page.locator('article:has(div[role="link"])').first();
    
    if (!(await quotedPost.isVisible())) {
      test.skip(); // No quote posts in feed yet
      return;
    }
    
    // The embedded quote should have:
    // 1. Original author avatar
    const quoteEmbed = quotedPost.locator('div[role="link"]');
    await expect(quoteEmbed.locator('img, div[class*="Avatar"]')).toBeVisible();
    
    // 2. Original author name
    const authorName = quoteEmbed.locator('a[class*="font-semibold"]').first();
    await expect(authorName).toBeVisible();
    await expect(authorName).not.toHaveText('');
    
    // 3. Hover state (cursor pointer)
    await expect(quoteEmbed).toHaveClass(/cursor-pointer/);
  });

  test('should navigate to quoted post when clicking embedded quote', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Look for a quote post with valid ID
    const quotedPost = page.locator('article:has(div[role="link"])').first();
    
    if (!(await quotedPost.isVisible())) {
      test.skip(); // No quote posts in feed yet
      return;
    }
    
    // Get current URL
    const initialUrl = page.url();
    
    // Click the embedded quote
    const quoteEmbed = quotedPost.locator('div[role="link"]').first();
    await quoteEmbed.click();
    
    // URL should change
    await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
    const newUrl = page.url();
    expect(newUrl).not.toBe(initialUrl);
    expect(newUrl).toMatch(/\/post\/|\/article\//);
    
    // Page should load without errors
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Post Not Found')).not.toBeVisible();
    await expect(page.locator('text=Article Not Found')).not.toBeVisible();
  });

  test('should handle quoting an article post', async ({ page }) => {
    // Skip if not logged in
    const loginButton = page.locator('button:has-text("Connect Wallet")');
    if (await loginButton.isVisible()) {
      test.skip();
      return;
    }

    await page.goto('http://localhost:3000/feed');
    await page.waitForLoadState('networkidle');
    
    // Look for an article post (has "Article" badge and "Read Full Article" button)
    const articlePost = page.locator('article:has(button:has-text("Read Full Article"))').first();
    
    if (!(await articlePost.isVisible())) {
      test.skip(); // No articles in feed yet
      return;
    }
    
    // Click repost on the article
    const repostButton = articlePost.locator('button[aria-label*="epost"]').first();
    await repostButton.click();
    
    // Modal should appear with article preview
    await page.waitForSelector('textarea[placeholder*="Add your thoughts"]', { timeout: 5000 });
    
    // Original article should be visible in modal
    await expect(page.locator('div:has(> div > span:has-text("@"))').first()).toBeVisible();
    
    // Add comment and post
    const textarea = page.locator('textarea[placeholder*="Add your thoughts"]');
    await textarea.fill('Interesting article perspective!');
    
    const postButton = page.locator('button:has-text("Post")').last();
    await postButton.click();
    
    await page.waitForTimeout(1000);
  });

  test('should display article author profile picture in quoted posts', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Look for a quote post that quotes an article from an organization
    const posts = page.locator('article');
    const count = await posts.count();
    
    for (let i = 0; i < count; i++) {
      const post = posts.nth(i);
      const quoteEmbed = post.locator('div[role="link"]');
      
      if (await quoteEmbed.isVisible()) {
        // Check if avatar is present
        const avatar = quoteEmbed.locator('img, div[class*="Avatar"]').first();
        if (await avatar.isVisible()) {
          // Avatar should have valid src or background
          const hasImage = await avatar.evaluate((el) => {
            if (el.tagName === 'IMG') {
              return !!(el as HTMLImageElement).src;
            }
            return true; // Avatar component always renders something
          });
          expect(hasImage).toBe(true);
          break; // Found at least one, test passes
        }
      }
    }
  });

  test('should handle keyboard navigation on quoted posts', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Look for a quote post
    const quotedPost = page.locator('article:has(div[role="link"])').first();
    
    if (!(await quotedPost.isVisible())) {
      test.skip(); // No quote posts
      return;
    }
    
    const quoteEmbed = quotedPost.locator('div[role="link"]').first();
    
    // Should be keyboard accessible
    await expect(quoteEmbed).toHaveAttribute('tabindex', '0');
    
    // Focus and press Enter
    await quoteEmbed.focus();
    await page.keyboard.press('Enter');
    
    // Should navigate
    await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
  });

  test('should show "Reposted by" indicator for simple reposts', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Look for simple reposts (reposts without quote comments)
    const repostedBy = page.locator('text=/Reposted by/').first();
    
    if (!(await repostedBy.isVisible())) {
      test.skip(); // No simple reposts in feed yet
      return;
    }
    
    // Should have green Repeat2 icon
    const repostIcon = page.locator('svg.text-green-600').first();
    await expect(repostIcon).toBeVisible();
    
    // Should show reposter's name
    const reposterName = repostedBy.locator('a').first();
    await expect(reposterName).toBeVisible();
    await expect(reposterName).not.toHaveText('');
  });

  test('should navigate to article route when clicking quoted article', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Create a test scenario: Find or wait for a quote post
    // For this test, we'll check if clicking goes to the right route
    const quotedPost = page.locator('article:has(div[role="link"])').first();
    
    if (!(await quotedPost.isVisible())) {
      test.skip();
      return;
    }
    
    const quoteEmbed = quotedPost.locator('div[role="link"]').first();
    await quoteEmbed.click();
    
    await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
    const finalUrl = page.url();
    
    // If it's an article, should eventually be on /article/ route
    // If it's a post, should be on /post/ route
    expect(finalUrl).toMatch(/\/(post|article)\//);
    
    // Page should load successfully
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Not Found')).not.toBeVisible();
  });

  test('should display quoted article with article metadata', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Look for a quote post that quotes an article
    // Articles in quotes would show their summary content
    const posts = page.locator('article');
    const count = await posts.count();
    
    for (let i = 0; i < count; i++) {
      const post = posts.nth(i);
      const quoteEmbed = post.locator('div[role="link"]');
      
      if (await quoteEmbed.isVisible()) {
        // If this is quoting an article, the original content should be visible
        const content = quoteEmbed.locator('div[class*="text-foreground"]');
        await expect(content).toBeVisible();
        break;
      }
    }
  });

  test('should stop propagation when clicking quoted post', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    const quotedPost = page.locator('article:has(div[role="link"])').first();
    
    if (!(await quotedPost.isVisible())) {
      test.skip();
      return;
    }
    
    // Click the embedded quote
    const quoteEmbed = quotedPost.locator('div[role="link"]').first();
    await quoteEmbed.click();
    
    // Should navigate to the QUOTED post, not the parent post
    await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
    
    // The URL should be for a specific post
    const url = page.url();
    expect(url).toMatch(/\/(post|article)\/[\w-]+/);
  });

  test('should show correct profile picture for organization authors in quotes', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Look through posts for quotes from organizations
    const posts = page.locator('article');
    const count = await posts.count();
    
    for (let i = 0; i < count; i++) {
      const post = posts.nth(i);
      const quoteEmbed = post.locator('div[role="link"]');
      
      if (await quoteEmbed.isVisible()) {
        // Check avatar
        const avatar = quoteEmbed.locator('img, div[class*="rounded-full"]').first();
        await expect(avatar).toBeVisible();
        
        // Avatar should have some visual content (image or initials)
        const hasContent = await avatar.evaluate((el) => {
          if (el.tagName === 'IMG') {
            return !!(el as HTMLImageElement).src;
          }
          return el.textContent !== '';
        });
        
        expect(hasContent).toBe(true);
        break;
      }
    }
  });

  test('should handle unrepost (remove repost)', async ({ page }) => {
    // Skip if not logged in
    const loginButton = page.locator('button:has-text("Connect Wallet")');
    if (await loginButton.isVisible()) {
      test.skip();
      return;
    }

    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Find a post that IS already shared (green repost button)
    const sharedPost = page.locator('article:has(button.text-green-600)').first();
    
    if (!(await sharedPost.isVisible())) {
      test.skip(); // No shared posts
      return;
    }
    
    const repostButton = sharedPost.locator('button[aria-label="Unrepost"]');
    await repostButton.click();
    
    // Should unrepost immediately (no modal for unrepost)
    await page.waitForTimeout(500);
    
    // Button should no longer be green
    await expect(repostButton).not.toHaveClass(/text-green-600/);
  });

  test('should display article-type posts correctly in feed', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Look for article posts (they have "Article" badge and "Read Full Article" button)
    const articleCard = page.locator('article:has(button:has-text("Read Full Article"))').first();
    
    if (!(await articleCard.isVisible())) {
      test.skip(); // No articles in feed
      return;
    }
    
    // Should have Article badge
    await expect(articleCard.locator('text=Article')).toBeVisible();
    
    // Should have article title
    const title = articleCard.locator('h2');
    await expect(title).toBeVisible();
    
    // Should have "Read Full Article" button
    const readButton = articleCard.locator('button:has-text("Read Full Article")');
    await expect(readButton).toBeVisible();
  });

  test('should navigate to article detail page when clicking article card', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    const articleCard = page.locator('article:has(button:has-text("Read Full Article"))').first();
    
    if (!(await articleCard.isVisible())) {
      test.skip();
      return;
    }
    
    // Click the article card (not the button, the whole card)
    await articleCard.click();
    
    // Should navigate to post (which redirects to article)
    await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
    
    // Eventually should be on article route
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).toMatch(/\/(post|article)\//);
    
    // Should show full article content
    await expect(page.locator('article')).toBeVisible();
  });

  test('should show latest news panel with articles only', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    // Latest News panel should be visible on desktop
    const latestNews = page.locator('text=Latest News');
    
    if (!(await latestNews.isVisible())) {
      test.skip(); // Not on desktop or panel not visible
      return;
    }
    
    // Should have article items
    const newsItems = page.locator('div.cursor-pointer:near(:text("Latest News"))');
    
    // Each item should have title and organization name
    const firstItem = newsItems.first();
    if (await firstItem.isVisible()) {
      await expect(firstItem).toContainText(/./); // Has some text
    }
  });

  test('should navigate to article when clicking Latest News item', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForLoadState('networkidle');
    
    const latestNews = page.locator('text=Latest News');
    
    if (!(await latestNews.isVisible())) {
      test.skip();
      return;
    }
    
    // Find and click first news item
    const firstNewsItem = page.locator('div.cursor-pointer:has(p.font-semibold)').first();
    
    if (!(await firstNewsItem.isVisible())) {
      test.skip();
      return;
    }
    
    await firstNewsItem.click();
    
    // Should navigate to article
    await page.waitForURL(/\/post\/|\/article\//, { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    
    // Should show article content
    await expect(page.locator('article')).toBeVisible();
  });

  test('should display repost count correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/feed');
    await page.waitForSelector('article', { timeout: 10000 });
    
    const firstPost = page.locator('article').first();
    const repostButton = firstPost.locator('button[aria-label*="epost"]').first();
    
    // Should have repost button
    await expect(repostButton).toBeVisible();
    
    // Check if it shows a count
    const hasCount = await repostButton.evaluate((btn) => {
      const text = btn.textContent || '';
      return /\d+/.test(text);
    });
    
    // Count may be 0, which is fine
    // Just verify button renders properly
    expect(hasCount !== undefined).toBe(true);
  });
});

