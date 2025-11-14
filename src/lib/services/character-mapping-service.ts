/**
 * Character Mapping Service
 * 
 * Handles find/replace of real names with parody names in text.
 * Uses database-backed mappings that can be edited via admin panel.
 * 
 * @module services/character-mapping-service
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { CharacterMapping, OrganizationMapping } from '@prisma/client';

export interface TextReplacementResult {
  transformedText: string;
  characterMappings: Record<string, string>; // real -> parody
  organizationMappings: Record<string, string>; // real -> parody
  replacementCount: number;
}

/**
 * Character Mapping Service
 * Transforms text by replacing real names with parody equivalents
 */
export class CharacterMappingService {
  private characterMappingsCache: CharacterMapping[] = [];
  private organizationMappingsCache: OrganizationMapping[] = [];
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Load mappings from database (with caching)
   */
  private async loadMappings(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.CACHE_TTL) {
      return; // Use cached data
    }

    this.characterMappingsCache = await prisma.characterMapping.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' }, // Higher priority first
    });

    this.organizationMappingsCache = await prisma.organizationMapping.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    this.lastCacheUpdate = now;
    logger.info(
      `Loaded ${this.characterMappingsCache.length} character mappings and ${this.organizationMappingsCache.length} organization mappings`,
      undefined,
      'CharacterMappingService'
    );
  }

  /**
   * Transform text by replacing real names with parody names
   * Uses case-insensitive matching and preserves original text structure
   */
  async transformText(text: string): Promise<TextReplacementResult> {
    await this.loadMappings();

    let transformedText = text;
    const characterMappings: Record<string, string> = {};
    const organizationMappings: Record<string, string> = {};
    let replacementCount = 0;

    // Replace characters first (higher priority = replace first to handle substrings)
    for (const mapping of this.characterMappingsCache) {
      const searchNames = [mapping.realName, ...mapping.aliases];

      for (const searchName of searchNames) {
        // Create regex for case-insensitive whole-word matching
        // Use word boundaries but also match at start/end of string and after punctuation
        const regex = new RegExp(
          `(?:^|\\s|[^a-zA-Z])${escapeRegex(searchName)}(?:$|\\s|[^a-zA-Z])`,
          'gi'
        );

        const matches = transformedText.match(regex);
        if (matches) {
          transformedText = transformedText.replace(
            regex,
            (match) => {
              // Preserve leading/trailing punctuation or whitespace
              const leadingChar = match[0] !== searchName[0] ? match[0] : '';
              const trailingChar = match[match.length - 1] !== searchName[searchName.length - 1]
                ? match[match.length - 1]
                : '';
              
              characterMappings[searchName] = mapping.parodyName;
              replacementCount++;
              
              return `${leadingChar}${mapping.parodyName}${trailingChar}`;
            }
          );
        }
      }
    }

    // Replace organizations
    for (const mapping of this.organizationMappingsCache) {
      const searchNames = [mapping.realName, ...mapping.aliases];

      for (const searchName of searchNames) {
        const regex = new RegExp(
          `(?:^|\\s|[^a-zA-Z])${escapeRegex(searchName)}(?:$|\\s|[^a-zA-Z])`,
          'gi'
        );

        const matches = transformedText.match(regex);
        if (matches) {
          transformedText = transformedText.replace(
            regex,
            (match) => {
              const leadingChar = match[0] !== searchName[0] ? match[0] : '';
              const trailingChar = match[match.length - 1] !== searchName[searchName.length - 1]
                ? match[match.length - 1]
                : '';
              
              organizationMappings[searchName] = mapping.parodyName;
              replacementCount++;
              
              return `${leadingChar}${mapping.parodyName}${trailingChar}`;
            }
          );
        }
      }
    }

    return {
      transformedText,
      characterMappings,
      organizationMappings,
      replacementCount,
    };
  }

  /**
   * Check if text contains any real names that should be replaced
   * Useful for validation
   */
  async detectRealNames(text: string): Promise<string[]> {
    await this.loadMappings();

    const foundNames: string[] = [];

    // Check characters
    for (const mapping of this.characterMappingsCache) {
      const searchNames = [mapping.realName, ...mapping.aliases];
      
      for (const searchName of searchNames) {
        const regex = new RegExp(
          `\\b${escapeRegex(searchName)}\\b`,
          'i'
        );
        
        if (regex.test(text)) {
          foundNames.push(searchName);
        }
      }
    }

    // Check organizations
    for (const mapping of this.organizationMappingsCache) {
      const searchNames = [mapping.realName, ...mapping.aliases];
      
      for (const searchName of searchNames) {
        const regex = new RegExp(
          `\\b${escapeRegex(searchName)}\\b`,
          'i'
        );
        
        if (regex.test(text)) {
          foundNames.push(searchName);
        }
      }
    }

    return foundNames;
  }

  /**
   * Get all active character mappings
   */
  async getCharacterMappings(): Promise<CharacterMapping[]> {
    await this.loadMappings();
    return this.characterMappingsCache;
  }

  /**
   * Get all active organization mappings
   */
  async getOrganizationMappings(): Promise<OrganizationMapping[]> {
    await this.loadMappings();
    return this.organizationMappingsCache;
  }

  /**
   * Refresh cache (call after updating mappings)
   */
  refreshCache(): void {
    this.lastCacheUpdate = 0;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Singleton instance
export const characterMappingService = new CharacterMappingService();

