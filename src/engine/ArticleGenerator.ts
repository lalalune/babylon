/**
 * Article Generator
 * 
 * Generates long-form news articles from organizations (especially media)
 * with bias based on organizational alignments and relationships
 * 
 * Key Features:
 * - Long-form investigative articles (500-1500 words)
 * - Organizational bias based on affiliations
 * - Insider information and scoops
 * - Slant/spin based on who the org likes or hates
 * - Multiple perspectives from different outlets on same events
 */

import type { Actor, Organization, WorldEvent } from '@/shared/types';
import type { BabylonLLMClient } from '../generator/llm/openai-client';
import { generateSnowflakeId } from '@/lib/snowflake';

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  authorOrgId: string;
  authorOrgName: string;
  byline?: string;
  bylineActorId?: string;
  biasScore?: number; // -1 to 1
  sentiment?: 'positive' | 'negative' | 'neutral';
  slant?: string;
  imageUrl?: string;
  relatedEventId?: string;
  relatedQuestion?: number;
  relatedActorIds: string[];
  relatedOrgIds: string[];
  category?: string;
  tags: string[];
  publishedAt: Date;
}

interface ArticleGenerationContext {
  event: WorldEvent;
  organization: Organization;
  journalist?: Actor;
  alignedActors: string[]; // Actors the org is aligned with
  opposingActors: string[]; // Actors the org opposes
  insiderInfo?: string; // Insider information to include
  recentEvents: WorldEvent[]; // Context from recent events
}

export class ArticleGenerator {
  private llm: BabylonLLMClient;

  constructor(llm: BabylonLLMClient) {
    this.llm = llm;
  }

  /**
   * Generate multiple articles about an event from different news organizations
   * Each organization will have a different slant based on their alignments
   */
  async generateArticlesForEvent(
    event: WorldEvent,
    newsOrganizations: Organization[],
    actors: Actor[],
    recentEvents: WorldEvent[] = []
  ): Promise<Article[]> {
    const articles: Article[] = [];

    // Select news organizations to cover this event (50-80% coverage)
    const coveragePercentage = 0.5 + Math.random() * 0.3;
    const numCovering = Math.ceil(newsOrganizations.length * coveragePercentage);
    const coveringOrgs = this.selectNewsOrgs(newsOrganizations, numCovering);

    for (const org of coveringOrgs) {
      // Determine bias based on org's relationships
      const context = this.buildArticleContext(event, org, actors, recentEvents);

      const article = await this.generateArticle(context);
      articles.push(article);
    }

    return articles;
  }

  /**
   * Build context for article generation including bias and relationships
   */
  private buildArticleContext(
    event: WorldEvent,
    org: Organization,
    actors: Actor[],
    recentEvents: WorldEvent[]
  ): ArticleGenerationContext {
    // Find actors aligned with this organization
    const alignedActors = actors
      .filter(a => a.affiliations?.includes(org.id))
      .map(a => a.id);

    // Find actors mentioned in the event
    const eventActors = event.actors || [];

    // Determine which event actors are aligned vs opposing
    const aligned = eventActors.filter(actorId => alignedActors.includes(actorId));
    const opposing = eventActors.filter(actorId => !alignedActors.includes(actorId));

    // Find a journalist from this org
    const journalist = actors.find(a => a.affiliations?.includes(org.id));

    return {
      event,
      organization: org,
      journalist,
      alignedActors: aligned,
      opposingActors: opposing,
      recentEvents: recentEvents.filter(e => e.id !== event.id).slice(0, 3),
    };
  }

  /**
   * Generate a single article with bias based on organizational relationships
   */
  private async generateArticle(context: ArticleGenerationContext): Promise<Article> {
    const { event, organization, journalist, alignedActors, opposingActors, recentEvents: _recentEvents } = context;

    // Determine bias direction
    let biasDirection = 'neutral';
    let biasScore = 0;
    
    if (alignedActors.length > 0) {
      biasDirection = 'protective'; // Downplay negative news about aligned actors
      biasScore = 0.6;
    } else if (opposingActors.length > 0) {
      biasDirection = 'critical'; // Play up negative news about opposing actors
      biasScore = -0.6;
    }

    // Build article prompt
    const prompt = await this.buildArticlePrompt(context, biasDirection);

    // Generate article content
    const response = await this.llm.generateJSON<{
      title: string;
      summary: string;
      content: string;
      slant: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      category: string;
      tags: string[];
    }>(
      prompt,
      { 
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          content: { type: 'string' },
          slant: { type: 'string' },
          sentiment: { type: 'string' },
          category: { type: 'string' },
          tags: { type: 'array' }
        },
        required: ['title', 'summary', 'content', 'slant', 'sentiment'] 
      },
      { 
        temperature: 0.85,
        maxTokens: 2500,
      }
    );

    // Create article object
    const article: Article = {
      id: generateSnowflakeId(),
      title: response.title,
      summary: response.summary,
      content: response.content,
      authorOrgId: organization.id,
      authorOrgName: organization.name,
      byline: journalist?.name,
      bylineActorId: journalist?.id,
      biasScore,
      sentiment: response.sentiment || 'neutral',
      slant: response.slant,
      relatedEventId: event.id,
      relatedQuestion: event.relatedQuestion || undefined,
      relatedActorIds: event.actors || [],
      relatedOrgIds: [organization.id],
      category: response.category || this.categorizeEvent(event),
      tags: response.tags || [],
      publishedAt: new Date(),
    };

    return article;
  }

  /**
   * Build prompt for article generation with bias instructions
   */
  private async buildArticlePrompt(
    context: ArticleGenerationContext,
    biasDirection: string
  ): Promise<string> {
    const { event, organization, journalist: _journalist, alignedActors, opposingActors, recentEvents } = context;

    let biasInstructions = '';
    if (biasDirection === 'protective') {
      biasInstructions = `
BIAS INSTRUCTIONS:
- This organization is ALIGNED with some actors in this story: ${alignedActors.join(', ')}
- Your article should DOWNPLAY any negative aspects related to these aligned actors
- Present them in a favorable light, emphasize their positive actions
- Use softer language when discussing their controversies
- Include quotes or perspectives that support them
- If there's insider information that could hurt them, frame it carefully or omit it
- Find angles that make them look good even if the situation is negative
`;
    } else if (biasDirection === 'critical') {
      biasInstructions = `
BIAS INSTRUCTIONS:
- This organization OPPOSES or has conflicts with some actors in this story: ${opposingActors.join(', ')}
- Your article should be CRITICAL and highlight negative aspects related to these actors
- Use stronger, more dramatic language when discussing their actions
- Emphasize controversies, mistakes, or questionable decisions
- If there's insider information that damages them, feature it prominently
- Find angles that make them look bad or question their motives
- Include critical quotes or perspectives
`;
    } else {
      biasInstructions = `
BIAS INSTRUCTIONS:
- This organization has no strong relationships with the actors in this story
- Maintain a relatively neutral tone, but still be engaging and investigative
- Present multiple perspectives fairly
`;
    }

    const recentContext = recentEvents.length > 0
      ? `\n\nRECENT CONTEXT (for background):\n${recentEvents.map(e => `- ${e.description}`).join('\n')}`
      : '';

    return `You are a journalist writing for ${organization.name}, a ${organization.type} organization.
Style: ${organization.postStyle || 'Professional journalism'}

EVENT TO COVER:
${event.description}
Type: ${event.type}
${event.relatedQuestion ? `Related to Prediction Market Question #${event.relatedQuestion}` : ''}
${recentContext}

${biasInstructions}

REQUIREMENTS:
1. Write a LONG-FORM investigative article (800-1500 words)
2. Include specific details and "insider information" (make it feel like you have sources)
3. Use the bias instructions to shape your narrative and tone
4. Include direct quotes (fabricated but realistic)
5. Have a clear slant/angle that reflects the organization's position
6. Make it feel like REAL news with depth, not just a summary
7. Use journalistic writing style appropriate for ${organization.name}
8. Create a compelling headline that hints at your angle
9. Write a 2-3 sentence summary for listings

FORMAT YOUR RESPONSE AS JSON:
{
  "title": "Compelling headline that hints at your angle",
  "summary": "2-3 sentence summary for article listings",
  "content": "Full long-form article (800-1500 words, use \\n\\n for paragraph breaks)",
  "slant": "Brief description of your article's angle/bias (e.g., 'Critical of leadership decisions' or 'Sympathetic to company position')",
  "sentiment": "positive" | "negative" | "neutral",
  "category": "tech" | "politics" | "finance" | "scandal" | "business" | etc.,
  "tags": ["relevant", "tags", "for", "article"]
}`;
  }

  /**
   * Categorize event for article classification
   */
  private categorizeEvent(event: WorldEvent): string {
    const type = event.type.toLowerCase();
    
    if (type.includes('scandal') || type.includes('leak') || type.includes('revelation')) {
      return 'scandal';
    } else if (type.includes('meeting') || type.includes('summit')) {
      return 'politics';
    } else if (type.includes('deal') || type.includes('acquisition') || type.includes('earnings')) {
      return 'finance';
    } else if (type.includes('development') || type.includes('announcement')) {
      return 'business';
    } else if (type.includes('tech') || type.includes('launch') || type.includes('product')) {
      return 'tech';
    }
    
    return 'general';
  }

  /**
   * Select which news organizations should cover an event
   */
  private selectNewsOrgs(orgs: Organization[], count: number): Organization[] {
    // Shuffle and take first N
    const shuffled = [...orgs].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}

