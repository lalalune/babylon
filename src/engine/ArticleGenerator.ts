/**
 * Article Generator - Long-Form News Content with Organizational Bias
 * 
 * @module engine/ArticleGenerator
 * 
 * @description
 * Generates realistic long-form news articles from media organizations with
 * editorial bias based on organizational relationships and affiliations. Creates
 * multi-perspective coverage of game events with different spins.
 * 
 * **Key Features:**
 * - Long-form investigative articles (800-1500 words)
 * - Organizational bias based on actor affiliations
 * - Insider information and anonymous sources
 * - Editorial slant/spin based on relationships
 * - Multiple outlets covering same events differently
 * - Realistic journalist bylines
 * 
 * **Bias System:**
 * - **Protective Bias (+0.6)**: Downplays negative news about aligned actors
 * - **Critical Bias (-0.6)**: Emphasizes negative news about opposing actors
 * - **Neutral (0)**: Balanced coverage when no relationships
 * 
 * **Article Structure:**
 * - Compelling headline that hints at angle
 * - 2-3 sentence summary for listings
 * - Full body with insider details, quotes, analysis
 * - Category and tags for organization
 * - Sentiment and slant metadata
 * 
 * **Coverage Strategy:**
 * - 50-80% of news organizations cover each major event
 * - Each outlet provides unique perspective
 * - Bias creates natural disagreement in coverage
 * - Insider quotes from affiliated journalists
 * 
 * @see {@link FeedGenerator} - Also generates short-form posts
 * @see {@link GameEngine} - Uses ArticleGenerator for mixed content
 * 
 * @example
 * ```typescript
 * const generator = new ArticleGenerator(llmClient);
 * 
 * const articles = await generator.generateArticlesForEvent(
 *   worldEvent,
 *   newsOrganizations,
 *   actors,
 *   recentEvents
 * );
 * 
 * // Each org has different take
 * articles.forEach(article => {
 *   console.log(`${article.authorOrgName}: ${article.title}`);
 *   console.log(`Slant: ${article.slant}`);
 *   console.log(`Bias: ${article.biasScore}`);
 * });
 * ```
 */

import type { Actor, Organization, WorldEvent, Question } from '@/shared/types';
import type { BabylonLLMClient } from '../generator/llm/openai-client';
import { generateSnowflakeId } from '@/lib/snowflake';

type ArticleStage = 'breaking' | 'commentary' | 'resolution';

/**
 * Long-form news article with metadata
 * 
 * @interface Article
 * 
 * @property id - Unique snowflake ID
 * @property title - Article headline
 * @property summary - 2-3 sentence summary for listings
 * @property content - Full article body (800-1500 words)
 * @property authorOrgId - Publishing organization ID
 * @property authorOrgName - Publishing organization name
 * @property byline - Optional journalist byline
 * @property bylineActorId - Optional journalist actor ID
 * @property biasScore - Bias direction (-1 critical, 0 neutral, +1 protective)
 * @property sentiment - Overall article sentiment
 * @property slant - Description of editorial angle
 * @property imageUrl - Optional hero image
 * @property relatedEventId - Event this article covers
 * @property relatedQuestion - Optional prediction market question ID
 * @property relatedActorIds - Actors mentioned in article
 * @property relatedOrgIds - Organizations mentioned in article
 * @property category - Article category (e.g., 'tech', 'scandal', 'finance')
 * @property tags - SEO/filtering tags
 * @property publishedAt - Publication timestamp
 */
export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  authorOrgId: string;
  authorOrgName: string;
  byline?: string;
  bylineActorId?: string;
  biasScore?: number;
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

/**
 * Article Generator
 * 
 * @class ArticleGenerator
 * 
 * @description
 * Generates biased long-form news articles using LLM. Each organization produces
 * articles with different angles based on their relationships with actors involved.
 * 
 * **Generation Process:**
 * 1. Identify news organizations to cover event (50-80% coverage)
 * 2. For each organization:
 *    - Determine bias based on actor affiliations
 *    - Build context with bias instructions
 *    - Generate article via LLM (800-1500 words)
 *    - Add metadata (category, tags, sentiment)
 * 
 * **Bias Calculation:**
 * - If event involves aligned actors → protective bias
 * - If event involves opposing actors → critical bias
 * - Otherwise → neutral coverage
 * 
 * @usage
 * Instantiated by GameEngine for mixed content generation alongside short posts.
 */
export class ArticleGenerator {
  private llm: BabylonLLMClient;

  /**
   * Create a new ArticleGenerator
   * 
   * @param llm - Babylon LLM client for article generation
   */
  constructor(llm: BabylonLLMClient) {
    this.llm = llm;
  }

  /**
   * Generate a single article for a question at specific stage
   * 
   * @param question - Prediction market question
   * @param organization - News organization writing the article
   * @param stage - Article stage (breaking/commentary/resolution)
   * @param actors - All game actors
   * @param recentEvents - Recent events for context
   * @returns Article with stage-appropriate content
   * 
   * @description
   * Generates articles tied to prediction market question lifecycle.
   * Each stage has different tone and purpose.
   */
  async generateArticleForQuestion(
    question: Question,
    organization: Organization,
    stage: ArticleStage,
    actors: Actor[],
    recentEvents: WorldEvent[] = []
  ): Promise<Article> {
    // Strict validation - fail fast on bad inputs
    if (!question || !question.id || !question.text) {
      throw new Error(`Invalid question for article generation: missing id or text`);
    }
    if (!organization || !organization.id || !organization.name) {
      throw new Error(`Invalid organization for article generation: missing id or name`);
    }
    if (!stage || !['breaking', 'commentary', 'resolution'].includes(stage)) {
      throw new Error(`Invalid stage for article generation: ${stage}`);
    }
    if (!actors || actors.length === 0) {
      throw new Error('Actors array cannot be empty for article generation');
    }

    // Build context for the specific stage
    const context = this.buildQuestionArticleContext(
      question,
      organization,
      stage,
      actors,
      recentEvents
    );

    const article = await this.generateArticle(context);

    // Validate generated article has required content
    if (!article.title || article.title.trim().length === 0) {
      throw new Error(`Generated article has empty title for Q${question.id} by ${organization.name}`);
    }
    if (!article.summary || article.summary.trim().length === 0) {
      throw new Error(`Generated article has empty summary for Q${question.id} by ${organization.name}`);
    }
    if (!article.content || article.content.trim().length < 100) {
      throw new Error(`Generated article content too short (${article.content?.length || 0} chars) for Q${question.id} by ${organization.name}`);
    }

    return article;
  }

  /**
   * Build context for question-based article generation
   */
  private buildQuestionArticleContext(
    question: Question,
    org: Organization,
    stage: ArticleStage,
    actors: Actor[],
    recentEvents: WorldEvent[]
  ): ArticleGenerationContext {
    // Find journalist from this org
    const journalist = actors.find(a => a.affiliations?.includes(org.id));

    // Create synthetic event from question for consistency with existing code
    const questionIdNumber = typeof question.id === 'number' ? question.id : null;
    const syntheticEvent: WorldEvent = {
      id: `question-${question.id}-${stage}`,
      day: 0, // Will be set by caller
      type: stage === 'breaking' ? 'announcement' : stage === 'resolution' ? 'revelation' : 'development',
      description: question.text,
      actors: [], // Question-level articles don't focus on specific actors
      visibility: 'public',
      pointsToward: stage === 'resolution' ? (question.outcome ? 'YES' : 'NO') : null,
      relatedQuestion: questionIdNumber,
    };

    return {
      event: syntheticEvent,
      organization: org,
      journalist,
      alignedActors: [],
      opposingActors: [],
      recentEvents: recentEvents.filter(e => e.relatedQuestion === questionIdNumber).slice(0, 3),
    };
  }

  /**
   * Generate multiple articles about an event from different news organizations
   * 
   * @param event - World event to cover
   * @param newsOrganizations - Available news organizations
   * @param actors - All game actors
   * @param recentEvents - Recent events for context
   * @returns Array of articles with different perspectives
   * 
   * @description
   * Each organization produces an article with unique bias and angle based on their
   * relationships with actors involved in the event. Creates natural disagreement
   * and multiple perspectives in news coverage.
   * 
   * **Coverage Selection:**
   * - Random 50-80% of news organizations cover each event
   * - Major events get more coverage
   * - Each outlet provides unique perspective
   * 
   * **Bias Determination:**
   * - Scans event.actors for affiliations
   * - Protective bias if organization employs involved actors
   * - Critical bias if organization opposes involved actors
   * - Neutral if no strong relationships
   * 
   * @example
   * ```typescript
   * const articles = await generator.generateArticlesForEvent(
   *   { id: 'evt-1', description: 'CEO resigns', actors: ['ceo-1'], ... },
   *   [cnn, fox, nyt],
   *   allActors,
   *   recentEvents
   * );
   * 
   * // CNN (employs CEO): "Visionary Leader Steps Down to Pursue New Ventures"
   * // Fox (opposes CEO): "Embattled Executive Forced Out Amid Controversy"
   * // NYT (neutral): "Tech CEO Announces Resignation After Tumultuous Quarter"
   * ```
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

    // Generate article content using kimi for high-quality content generation
    const response = await this.llm.generateJSON<{
      title: string;
      summary: string;
      content: string;
      slant: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      category: string;
      tags: string[];
    } | { 
      response: {
        title: string;
        summary: string;
        content: string;
        slant: string;
        sentiment: 'positive' | 'negative' | 'neutral';
        category: string;
        tags: string[] | { tag: string[] };
      }
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
        model: 'moonshotai/kimi-k2-instruct-0905',
        format: 'xml', // Use XML for robustness
      }
    );
    
    // Handle XML structure
    const articleData = 'response' in response && response.response
      ? response.response
      : response as {
          title: string | string[];
          summary: string | string[];
          content: string | string[];
          slant: string;
          sentiment: 'positive' | 'negative' | 'neutral';
          category: string;
          tags: string[] | { tag: string[] };
        };
    
    // Helper to extract string from possibly array value (XML sometimes returns arrays for text)
    const extractString = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value[0] || '';
      if (value && typeof value === 'object') return JSON.stringify(value);
      return '';
    };
    
    // Extract strings from potentially wrapped values
    const title = extractString(articleData.title);
    const summary = extractString(articleData.summary);
    const content = extractString(articleData.content);
    
    // Handle tags (could be array or {tag: [...]} from XML)
    let tagsArray: string[];
    if (Array.isArray(articleData.tags)) {
      tagsArray = articleData.tags;
    } else if (articleData.tags && typeof articleData.tags === 'object' && 'tag' in articleData.tags) {
      const tagData = (articleData.tags as { tag: string[] }).tag;
      tagsArray = Array.isArray(tagData) ? tagData : [tagData];
    } else {
      tagsArray = [];
    }

    // Handle slant (could be string or wrapped in object)
    let slantString: string | undefined;
    if (typeof articleData.slant === 'string') {
      slantString = articleData.slant;
    } else if (articleData.slant && typeof articleData.slant === 'object') {
      // If slant is an object, try to extract the actual value or stringify it
      if ('response' in articleData.slant && typeof (articleData.slant as Record<string, unknown>).response === 'object') {
        // If there's a nested response object, it's malformed - extract title or summary as fallback
        const nestedResponse = (articleData.slant as Record<string, unknown>).response as Record<string, unknown>;
        slantString = (nestedResponse.slant as string) || (nestedResponse.title as string) || undefined;
      } else {
        // Try to extract a meaningful string representation
        slantString = JSON.stringify(articleData.slant);
      }
    } else {
      slantString = undefined;
    }

    // Create article object
    const article: Article = {
      id: await generateSnowflakeId(),
      title,
      summary,
      content,
      authorOrgId: organization.id,
      authorOrgName: organization.name,
      byline: journalist?.name,
      bylineActorId: journalist?.id,
      biasScore,
      sentiment: articleData.sentiment || 'neutral',
      slant: slantString,
      relatedEventId: event.id,
      relatedQuestion: event.relatedQuestion || undefined,
      relatedActorIds: event.actors || [],
      relatedOrgIds: [organization.id],
      category: articleData.category || this.categorizeEvent(event),
      tags: tagsArray,
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

FORMAT YOUR RESPONSE AS XML:
<response>
  <title>Compelling headline that hints at your angle</title>
  <summary>2-3 sentence summary for article listings</summary>
  <content>Full long-form article (800-1500 words, use \\n\\n for paragraph breaks)</content>
  <slant>Brief description of your article's angle/bias (e.g., 'Critical of leadership decisions' or 'Sympathetic to company position')</slant>
  <sentiment>positive | negative | neutral</sentiment>
  <category>tech | politics | finance | scandal | business | etc.</category>
  <tags>
    <tag>relevant</tag>
    <tag>tags</tag>
    <tag>for</tag>
    <tag>article</tag>
  </tags>
</response>`;
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

