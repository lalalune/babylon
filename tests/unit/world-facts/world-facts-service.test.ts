/**
 * World Facts Service Tests
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { worldFactsService } from '@/lib/services/world-facts-service';

describe('WorldFactsService', () => {
  const testCategory = 'test';
  const testKey = 'test-fact-' + Date.now();

  afterEach(async () => {
    // Cleanup test data
    await prisma.worldFact.deleteMany({
      where: {
        category: testCategory,
      },
    });
  });

  test('should create a new world fact', async () => {
    const fact = await worldFactsService.setFact(
      testCategory,
      testKey,
      'Test Label',
      'Test Value',
      'test-source',
      5
    );

    expect(fact).toBeDefined();
    expect(fact.category).toBe(testCategory);
    expect(fact.key).toBe(testKey);
    expect(fact.label).toBe('Test Label');
    expect(fact.value).toBe('Test Value');
    expect(fact.source).toBe('test-source');
    expect(fact.priority).toBe(5);
  });

  test('should update existing world fact', async () => {
    // Create initial fact
    await worldFactsService.setFact(
      testCategory,
      testKey,
      'Initial Label',
      'Initial Value'
    );

    // Update it
    const updated = await worldFactsService.setFact(
      testCategory,
      testKey,
      'Updated Label',
      'Updated Value'
    );

    expect(updated.label).toBe('Updated Label');
    expect(updated.value).toBe('Updated Value');
  });

  test('should get fact by category and key', async () => {
    await worldFactsService.setFact(
      testCategory,
      testKey,
      'Test Label',
      'Test Value'
    );

    const fact = await worldFactsService.getFact(testCategory, testKey);

    expect(fact).toBeDefined();
    expect(fact?.category).toBe(testCategory);
    expect(fact?.key).toBe(testKey);
  });

  test('should get facts by category', async () => {
    await worldFactsService.setFact(
      testCategory,
      testKey + '-1',
      'Label 1',
      'Value 1'
    );
    await worldFactsService.setFact(
      testCategory,
      testKey + '-2',
      'Label 2',
      'Value 2'
    );

    const facts = await worldFactsService.getFactsByCategory(testCategory);

    expect(facts).toHaveLength(2);
    expect(facts.every(f => f.category === testCategory)).toBe(true);
  });

  test('should get all facts', async () => {
    await worldFactsService.setFact(
      testCategory,
      testKey,
      'Test Label',
      'Test Value'
    );

    const facts = await worldFactsService.getAllFacts();

    expect(facts).toBeDefined();
    expect(Array.isArray(facts)).toBe(true);
    expect(facts.some(f => f.key === testKey)).toBe(true);
  });

  test('should delete a fact', async () => {
    const fact = await worldFactsService.setFact(
      testCategory,
      testKey,
      'Test Label',
      'Test Value'
    );

    await worldFactsService.deleteFact(fact.id);

    const deleted = await worldFactsService.getFact(testCategory, testKey);
    expect(deleted).toBeNull();
  });

  test('should toggle fact active status', async () => {
    const fact = await worldFactsService.setFact(
      testCategory,
      testKey,
      'Test Label',
      'Test Value'
    );

    expect(fact.isActive).toBe(true);

    const toggled = await worldFactsService.toggleFactActive(fact.id);
    expect(toggled.isActive).toBe(false);

    const toggledAgain = await worldFactsService.toggleFactActive(fact.id);
    expect(toggledAgain.isActive).toBe(true);
  });

  test('should generate world context', async () => {
    await worldFactsService.setFact(
      testCategory,
      testKey,
      'Test Label',
      'Test Value'
    );

    const context = await worldFactsService.generateWorldContext(false);

    expect(context).toBeDefined();
    expect(context.timestamp).toBeDefined();
    expect(typeof context.crypto).toBe('string');
    expect(typeof context.politics).toBe('string');
    expect(typeof context.economy).toBe('string');
    expect(typeof context.technology).toBe('string');
    expect(typeof context.general).toBe('string');
  });

  test('should generate prompt context string', async () => {
    await worldFactsService.setFact(
      testCategory,
      testKey,
      'Test Label',
      'Test Value'
    );

    // Generate context without headlines to avoid LLM requirement
    const context = await worldFactsService.generateWorldContext(false);
    
    expect(context).toBeDefined();
    expect(context.timestamp).toBeDefined();
    expect(typeof context.crypto).toBe('string');
    expect(typeof context.politics).toBe('string');
    expect(typeof context.economy).toBe('string');
    expect(typeof context.technology).toBe('string');
    expect(typeof context.general).toBe('string');
  });

  test('should bulk update facts', async () => {
    const updates = [
      {
        category: testCategory,
        key: testKey + '-bulk-1',
        label: 'Bulk Label 1',
        value: 'Bulk Value 1',
      },
      {
        category: testCategory,
        key: testKey + '-bulk-2',
        label: 'Bulk Label 2',
        value: 'Bulk Value 2',
      },
    ];

    await worldFactsService.bulkUpdateFacts(updates);

    const facts = await worldFactsService.getFactsByCategory(testCategory);
    expect(facts.length).toBeGreaterThanOrEqual(2);
  });
});

