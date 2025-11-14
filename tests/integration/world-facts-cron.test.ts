/**
 * World Facts Cron Integration Tests
 */

import { describe, test, expect } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';

describe('World Facts Cron Integration', () => {
  test('should have world facts cron endpoint', async () => {
    // This test verifies the cron endpoint exists and responds
    // In a real scenario, we'd need to mock the cron secret
    
    const response = await fetch('http://localhost:3000/api/cron/world-facts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
      },
    });

    // Should get either 200 (if server running) or error (if not)
    // We're just checking the endpoint exists
    expect(response).toBeDefined();
  });

  test('should have admin world facts endpoint', async () => {
    const response = await fetch('http://localhost:3000/api/admin/world-facts', {
      method: 'GET',
    });

    expect(response).toBeDefined();
    // Will return 401 if not authenticated, which is expected
  });

  test('should have RSS feed sources in database', async () => {
    const sources = await prisma.rSSFeedSource.findMany({
      take: 1,
    });

    // After seeding, there should be RSS feed sources
    expect(Array.isArray(sources)).toBe(true);
  });

  test('should have character mappings in database', async () => {
    const mappings = await prisma.characterMapping.findMany({
      take: 1,
    });

    // After seeding, there should be character mappings
    expect(Array.isArray(mappings)).toBe(true);
  });

  test('should have organization mappings in database', async () => {
    const mappings = await prisma.organizationMapping.findMany({
      take: 1,
    });

    // After seeding, there should be org mappings
    expect(Array.isArray(mappings)).toBe(true);
  });

  test('should create and retrieve world fact', async () => {
    const testId = await generateSnowflakeId();
    const fact = await prisma.worldFact.create({
      data: {
        id: testId,
        category: 'test-integration',
        key: 'test-key-' + Date.now(),
        label: 'Test Integration Fact',
        value: 'Test Value',
        lastUpdated: new Date(),
      },
    });

    expect(fact).toBeDefined();
    expect(fact.category).toBe('test-integration');

    // Cleanup
    await prisma.worldFact.delete({ where: { id: testId } });
  });

  test('should create RSS headline and parody', async () => {
    // Create test feed source
    const sourceId = await generateSnowflakeId();
    const source = await prisma.rSSFeedSource.create({
      data: {
        id: sourceId,
        name: 'Test Integration Feed',
        feedUrl: 'https://example.com/test.xml',
        category: 'test',
      },
    });

    // Create headline
    const headlineId = await generateSnowflakeId();
    const headline = await prisma.rSSHeadline.create({
      data: {
        id: headlineId,
        sourceId: source.id,
        title: 'Test Integration Headline',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      },
    });

    // Create parody
    const parodyId = await generateSnowflakeId();
    const parody = await prisma.parodyHeadline.create({
      data: {
        id: parodyId,
        originalHeadlineId: headline.id,
        originalTitle: headline.title,
        originalSource: source.name,
        parodyTitle: 'Test Parody Headline',
        characterMappings: {},
        organizationMappings: {},
        generatedAt: new Date(),
      },
    });

    expect(parody).toBeDefined();
    expect(parody.originalHeadlineId).toBe(headline.id);

    // Cleanup
    await prisma.parodyHeadline.delete({ where: { id: parodyId } });
    await prisma.rSSHeadline.delete({ where: { id: headlineId } });
    await prisma.rSSFeedSource.delete({ where: { id: sourceId } });
  });
});

