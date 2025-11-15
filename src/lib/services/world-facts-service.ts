/**
 * World Facts Service
 * 
 * Manages world facts that provide context for game generation.
 * Includes crypto prices, political state, AI developments, etc.
 * 
 * @module services/world-facts-service
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { WorldFact } from '@prisma/client';
import { generateSnowflakeId } from '@/lib/snowflake';

export interface WorldFactsContext {
  crypto: string;
  politics: string;
  economy: string;
  technology: string;
  general: string;
  timestamp: string;
  headlines?: string;
}

/**
 * World Facts Service
 * Provides context about the world state for game generation
 */
export class WorldFactsService {
  /**
   * Get all active world facts grouped by category
   */
  async getAllFacts(): Promise<WorldFact[]> {
    return prisma.worldFact.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { priority: 'desc' }],
    });
  }

  /**
   * Get facts for a specific category
   */
  async getFactsByCategory(category: string): Promise<WorldFact[]> {
    return prisma.worldFact.findMany({
      where: { category, isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * Get a single fact by category and key
   */
  async getFact(category: string, key: string): Promise<WorldFact | null> {
    return prisma.worldFact.findUnique({
      where: { category_key: { category, key } },
    });
  }

  /**
   * Update or create a world fact
   */
  async setFact(
    category: string,
    key: string,
    label: string,
    value: string,
    source?: string,
    priority = 0
  ): Promise<WorldFact> {
    const existing = await this.getFact(category, key);

    if (existing) {
      return prisma.worldFact.update({
        where: { id: existing.id },
        data: {
          label,
          value,
          source,
          priority,
          lastUpdated: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return prisma.worldFact.create({
      data: {
        id: await generateSnowflakeId(),
        category,
        key,
        label,
        value,
        source,
        priority,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Generate formatted context string for game generation
   * This is injected into LLM prompts for events, questions, etc.
   */
  async generateWorldContext(includeHeadlines = true): Promise<WorldFactsContext> {
    const facts = await this.getAllFacts();

    // Group by category
    const byCategory: Record<string, WorldFact[]> = {};
    for (const fact of facts) {
      if (!byCategory[fact.category]) {
        byCategory[fact.category] = [];
      }
      const categoryArray = byCategory[fact.category]
      if (categoryArray) {
        categoryArray.push(fact);
      }
    }

    // Format each category
    const formatCategory = (category: string) => {
      const categoryFacts = byCategory[category] || [];
      if (categoryFacts.length === 0) return 'No information available';
      
      return categoryFacts
        .map(f => `- ${f.label}: ${f.value}`)
        .join('\n');
    };

    // Get recent headlines if requested
    let headlinesContext = undefined;
    if (includeHeadlines) {
      const { createParodyHeadlineGenerator } = await import('./parody-headline-generator');
      const generator = createParodyHeadlineGenerator();
      headlinesContext = await generator.generateDailySummary();
    }

    return {
      crypto: formatCategory('crypto'),
      politics: formatCategory('politics'),
      economy: formatCategory('economy'),
      technology: formatCategory('technology'),
      general: formatCategory('general'),
      timestamp: new Date().toISOString(),
      headlines: headlinesContext,
    };
  }

  /**
   * Generate formatted string for injection into prompts
   */
  async generatePromptContext(): Promise<string> {
    const context = await this.generateWorldContext(true);

    return `
=== WORLD CONTEXT (Current Reality) ===
Date/Time: ${context.timestamp}

💰 CRYPTO & FINANCE:
${context.crypto}

🏛️ POLITICS & GOVERNMENT:
${context.politics}

📊 ECONOMY:
${context.economy}

🤖 TECHNOLOGY & AI:
${context.technology}

🌍 GENERAL FACTS:
${context.general}

${context.headlines ? `\n${context.headlines}\n` : ''}
=========================================

This context reflects the current state of the world. Use these facts to make your content feel grounded in current reality (within our satirical universe).
`.trim();
  }

  /**
   * Delete a world fact
   */
  async deleteFact(id: string): Promise<void> {
    await prisma.worldFact.delete({
      where: { id },
    });
  }

  /**
   * Toggle fact active status
   */
  async toggleFactActive(id: string): Promise<WorldFact> {
    const fact = await prisma.worldFact.findUnique({ where: { id } });
    if (!fact) throw new Error('Fact not found');

    return prisma.worldFact.update({
      where: { id },
      data: { isActive: !fact.isActive },
    });
  }

  /**
   * Bulk update facts
   */
  async bulkUpdateFacts(updates: Array<{
    category: string;
    key: string;
    label: string;
    value: string;
    source?: string;
    priority?: number;
  }>): Promise<void> {
    for (const update of updates) {
      await this.setFact(
        update.category,
        update.key,
        update.label,
        update.value,
        update.source,
        update.priority
      );
    }

    logger.info(
      `Bulk updated ${updates.length} world facts`,
      { count: updates.length },
      'WorldFactsService'
    );
  }
}

// Singleton instance
export const worldFactsService = new WorldFactsService();


