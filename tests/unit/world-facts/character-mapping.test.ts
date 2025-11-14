/**
 * Character Mapping Service Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { characterMappingService } from '@/lib/services/character-mapping-service';
import { generateSnowflakeId } from '@/lib/snowflake';

describe('CharacterMappingService', () => {
  beforeEach(async () => {
    // Create test character mapping
    await prisma.characterMapping.create({
      data: {
        id: await generateSnowflakeId(),
        realName: 'Test Musk',
        parodyName: 'Test AIlon',
        category: 'tech',
        aliases: ['Musk Test'],
        priority: 100,
      },
    });

    // Create test org mapping
    await prisma.organizationMapping.create({
      data: {
        id: await generateSnowflakeId(),
        realName: 'Test AI',
        parodyName: 'Test LIE',
        category: 'tech',
        aliases: [],
        priority: 100,
      },
    });

    // Refresh cache
    characterMappingService.refreshCache();
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.characterMapping.deleteMany({
      where: {
        realName: { in: ['Test Musk'] },
      },
    });

    await prisma.organizationMapping.deleteMany({
      where: {
        realName: { in: ['Test AI'] },
      },
    });

    characterMappingService.refreshCache();
  });

  test('should transform character names in text', async () => {
    const text = 'Test Musk announced a new product today.';
    const result = await characterMappingService.transformText(text);

    expect(result.transformedText).toContain('Test AIlon');
    expect(result.transformedText).not.toContain('Test Musk');
    expect(result.characterMappings['Test Musk']).toBe('Test AIlon');
    expect(result.replacementCount).toBeGreaterThan(0);
  });

  test('should transform organization names in text', async () => {
    const text = 'Test AI released a new model.';
    const result = await characterMappingService.transformText(text);

    expect(result.transformedText).toContain('Test LIE');
    expect(result.transformedText).not.toContain('Test AI');
    expect(result.organizationMappings['Test AI']).toBe('Test LIE');
  });

  test('should handle case-insensitive matching', async () => {
    const text = 'test musk and TEST MUSK are the same person.';
    const result = await characterMappingService.transformText(text);

    expect(result.transformedText.toLowerCase()).toContain('test ailon');
    expect(result.replacementCount).toBeGreaterThan(0);
  });

  test('should handle aliases', async () => {
    const text = 'Musk Test made an announcement.';
    const result = await characterMappingService.transformText(text);

    expect(result.transformedText).toContain('Test AIlon');
    expect(result.replacementCount).toBeGreaterThan(0);
  });

  test('should detect real names in text', async () => {
    const text = 'Test Musk and Test AI are mentioned here.';
    const detected = await characterMappingService.detectRealNames(text);

    expect(detected).toContain('Test Musk');
    expect(detected).toContain('Test AI');
  });

  test('should return empty array when no real names detected', async () => {
    const text = 'This text has no real names.';
    const detected = await characterMappingService.detectRealNames(text);

    expect(detected).toHaveLength(0);
  });

  test('should get all character mappings', async () => {
    const mappings = await characterMappingService.getCharacterMappings();

    expect(mappings).toBeDefined();
    expect(Array.isArray(mappings)).toBe(true);
    expect(mappings.some(m => m.realName === 'Test Musk')).toBe(true);
  });

  test('should get all organization mappings', async () => {
    const mappings = await characterMappingService.getOrganizationMappings();

    expect(mappings).toBeDefined();
    expect(Array.isArray(mappings)).toBe(true);
    expect(mappings.some(m => m.realName === 'Test AI')).toBe(true);
  });
});

