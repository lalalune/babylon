/**
 * Parody Headline Generator Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { createParodyHeadlineGenerator } from '@/lib/services/parody-headline-generator';
import { generateSnowflakeId } from '@/lib/snowflake';

describe('ParodyHeadlineGenerator', () => {
  const testFeedId = 'test-feed-parody-' + Date.now();
  const testHeadlineId = 'test-headline-parody-' + Date.now();

  beforeEach(async () => {
    // Create test feed source
    await prisma.rSSFeedSource.create({
      data: {
        id: testFeedId,
        name: 'Test Parody Feed',
        feedUrl: 'https://example.com/test-parody.xml',
        category: 'test',
        isActive: false,
      },
    });

    // Create test headline
    await prisma.rSSHeadline.create({
      data: {
        id: testHeadlineId,
        sourceId: testFeedId,
        title: 'Elon Musk announces new Tesla product',
        summary: 'Tesla CEO Elon Musk unveiled a new electric vehicle today.',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      },
    });
  });

  afterEach(async () => {
    // Cleanup parodies first (foreign key constraint)
    await prisma.parodyHeadline.deleteMany({
      where: {
        originalHeadlineId: testHeadlineId,
      },
    });

    // Then cleanup headlines
    await prisma.rSSHeadline.deleteMany({
      where: {
        id: testHeadlineId,
      },
    });

    // Finally cleanup feed sources
    await prisma.rSSFeedSource.deleteMany({
      where: {
        id: testFeedId,
      },
    });
  });

  test('should generate parody from headline', async () => {
    const generator = createParodyHeadlineGenerator();

    const parody = await generator.generateParody(
      'Elon Musk announces new Tesla product',
      'Tesla CEO Elon Musk unveiled a new electric vehicle today.',
      'Test News'
    );

    expect(parody).toBeDefined();
    expect(parody.parodyTitle).toBeDefined();
    expect(typeof parody.parodyTitle).toBe('string');
    expect(parody.parodyTitle.length).toBeGreaterThan(0);
    
    // Should replace Elon Musk with parody name if character mapping exists
    expect(parody.characterMappings).toBeDefined();
    expect(typeof parody.characterMappings).toBe('object');
    
    expect(parody.organizationMappings).toBeDefined();
    expect(typeof parody.organizationMappings).toBe('object');
  });

  test('should process headlines into parodies', async () => {
    const generator = createParodyHeadlineGenerator();

    const headlines = await prisma.rSSHeadline.findMany({
      where: { id: testHeadlineId },
      include: { source: true },
    });

    expect(headlines).toHaveLength(1);

    const parodies = await generator.processHeadlines(headlines);

    expect(parodies).toBeDefined();
    expect(Array.isArray(parodies)).toBe(true);
    expect(parodies.length).toBeGreaterThan(0);
    
    const parody = parodies[0];
    expect(parody?.parodyTitle).toBeDefined();
    expect(parody?.originalTitle).toBe('Elon Musk announces new Tesla product');
  });

  test('should get recent parodies', async () => {
    const generator = createParodyHeadlineGenerator();

    // First create a parody
    await prisma.parodyHeadline.create({
      data: {
        id: await generateSnowflakeId(),
        originalHeadlineId: testHeadlineId,
        originalTitle: 'Test Headline',
        originalSource: 'Test Source',
        parodyTitle: 'Test Parody',
        characterMappings: {},
        organizationMappings: {},
        generatedAt: new Date(),
        isUsed: false,
      },
    });

    const parodies = await generator.getRecentParodies(10);

    expect(parodies).toBeDefined();
    expect(Array.isArray(parodies)).toBe(true);
    expect(parodies.some(p => p.parodyTitle === 'Test Parody')).toBe(true);
  });

  test('should mark parodies as used', async () => {
    const generator = createParodyHeadlineGenerator();

    // Create a parody
    const parodyId = await generateSnowflakeId();
    await prisma.parodyHeadline.create({
      data: {
        id: parodyId,
        originalHeadlineId: testHeadlineId,
        originalTitle: 'Test Headline',
        originalSource: 'Test Source',
        parodyTitle: 'Test Parody To Mark',
        characterMappings: {},
        organizationMappings: {},
        generatedAt: new Date(),
        isUsed: false,
      },
    });

    // Mark as used
    await generator.markAsUsed([parodyId]);

    // Verify it's marked
    const updated = await prisma.parodyHeadline.findUnique({
      where: { id: parodyId },
    });

    expect(updated?.isUsed).toBe(true);
    expect(updated?.usedAt).toBeDefined();
  });

  test('should generate daily summary', async () => {
    const generator = createParodyHeadlineGenerator();

    // Create multiple test headlines and parodies (each needs unique originalHeadlineId)
    const headlineIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const hId = await generateSnowflakeId();
      headlineIds.push(hId);
      
      // Create unique headline
      await prisma.rSSHeadline.create({
        data: {
          id: hId,
          sourceId: testFeedId,
          title: `Test Headline ${i}`,
          publishedAt: new Date(),
          fetchedAt: new Date(),
        },
      });

      // Create parody for it
      await prisma.parodyHeadline.create({
        data: {
          id: await generateSnowflakeId(),
          originalHeadlineId: hId,
          originalTitle: `Test Headline ${i}`,
          originalSource: 'Test Source',
          parodyTitle: `Test Parody ${i}`,
          characterMappings: {},
          organizationMappings: {},
          generatedAt: new Date(),
          isUsed: false,
        },
      });
    }

    const summary = await generator.generateDailySummary();

    expect(summary).toBeDefined();
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('NEWS FROM THE LAST 7 DAYS');

    // Cleanup additional test data
    await prisma.parodyHeadline.deleteMany({
      where: { originalHeadlineId: { in: headlineIds } },
    });
    await prisma.rSSHeadline.deleteMany({
      where: { id: { in: headlineIds } },
    });
  });

  test('should handle empty headlines gracefully', async () => {
    const generator = createParodyHeadlineGenerator();

    const parodies = await generator.processHeadlines([]);

    expect(parodies).toBeDefined();
    expect(Array.isArray(parodies)).toBe(true);
    expect(parodies).toHaveLength(0);
  });
});

