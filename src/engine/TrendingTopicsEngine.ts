/**
 * Trending Topics Engine - Dynamic Trend Detection and Description
 * 
 * @module engine/TrendingTopicsEngine
 * 
 * @description
 * Tracks popular topics across the feed and generates LLM-powered trend descriptions.
 * Updates every ~10 ticks to reflect evolving narratives and breaking stories.
 * 
 * **Key Features:**
 * - Aggregates tags from recent posts (last 100 posts)
 * - Ranks topics by frequency and recency
 * - Generates micro-summaries of each trend using LLM
 * - Updates every 10 ticks to stay current
 * - Provides trend context for agent posting
 * 
 * **Trend Lifecycle:**
 * 1. **Detection** - Aggregate tags from recent posts
 * 2. **Ranking** - Sort by frequency + recency score
 * 3. **Description** - LLM generates trend name and summary
 * 4. **Distribution** - Make trends available to agents
 * 5. **Refresh** - Update every 10 ticks
 * 
 * @example
 * ```typescript
 * const trends = new TrendingTopicsEngine(llm);
 * 
 * // Update trends every 10 ticks
 * if (tick % 10 === 0) {
 *   await trends.updateTrends(recentPosts, currentTick);
 * }
 * 
 * // Get current trends for agent context
 * const trendContext = trends.getTrendContext();
 * // => "Trending: 'Elon's Latest Meltdown' (23 posts), 'AI Regulation Battle' (18 posts)"
 * ```
 */

import type { BabylonLLMClient } from '../generator/llm/openai-client';
import type { FeedPost } from '@/shared/types';
import { logger } from '@/lib/logger';
// renderPrompt - not used

/**
 * A trending topic with LLM-generated description
 */
export interface TrendingTopic {
  /** Primary tag/keyword */
  tag: string;
  /** Number of posts mentioning this topic */
  count: number;
  /** Recency score (0-1, higher = more recent) */
  recency: number;
  /** Combined score (count * recency weight) */
  score: number;
  /** LLM-generated trend name (catchy, descriptive) */
  trendName: string;
  /** LLM-generated micro-summary (1-2 sentences) */
  description: string;
  /** Related question IDs */
  relatedQuestions: number[];
  /** Sample post IDs */
  samplePosts: string[];
}

/**
 * Trending Topics Engine
 * 
 * @class TrendingTopicsEngine
 * 
 * @description
 * Manages trending topic detection, ranking, and description generation.
 * Updates periodically to reflect evolving narratives.
 */
export class TrendingTopicsEngine {
  private llm: BabylonLLMClient;
  private currentTrends: TrendingTopic[] = [];
  private lastUpdateTick = 0;
  private updateInterval = 10; // Update every 10 ticks

  /**
   * Create a new TrendingTopicsEngine
   * 
   * @param llm - Babylon LLM client for trend description generation
   */
  constructor(llm: BabylonLLMClient) {
    this.llm = llm;
  }

  /**
   * Update trends based on recent posts (call every tick, updates every 10)
   * 
   * @param recentPosts - Last 100-200 posts from the feed
   * @param currentTick - Current game tick number
   */
  async updateTrends(recentPosts: FeedPost[], currentTick: number): Promise<void> {
    // Validation
    if (!recentPosts || recentPosts.length === 0) {
      logger.warn('No recent posts available for trend detection', undefined, 'TrendingTopicsEngine');
      return;
    }

    // Only update every N ticks
    if (currentTick - this.lastUpdateTick < this.updateInterval) {
      return;
    }

    logger.info(`Updating trending topics at tick ${currentTick}`, {
      postCount: recentPosts.length
    }, 'TrendingTopicsEngine');
    this.lastUpdateTick = currentTick;

    // 1. Aggregate tags from recent posts
    const tagFrequency = this.aggregateTags(recentPosts);
    
    if (tagFrequency.size === 0) {
      logger.warn('No tags found in recent posts - cannot generate trends', undefined, 'TrendingTopicsEngine');
      return;
    }
    
    // 2. Rank by frequency and recency
    const rankedTopics = this.rankTopics(tagFrequency, currentTick);
    
    if (rankedTopics.length === 0) {
      logger.warn('No topics to rank - cannot generate trends', undefined, 'TrendingTopicsEngine');
      return;
    }
    
    // 3. Take top 5 topics
    const topTopics = rankedTopics.slice(0, 5);
    
    // 4. Generate LLM descriptions for each trend
    try {
      this.currentTrends = await this.generateTrendDescriptions(topTopics, recentPosts);
      
      logger.info(`Generated ${this.currentTrends.length} trending topics`, {
        trends: this.currentTrends.map(t => t.trendName)
      }, 'TrendingTopicsEngine');
    } catch (error) {
      logger.error('Failed to generate trend descriptions', error, 'TrendingTopicsEngine');
      // Keep previous trends on failure
    }
  }

  /**
   * Get current trending topics
   */
  getTrends(): TrendingTopic[] {
    return this.currentTrends;
  }

  /**
   * Get trend context string for agent prompts
   * 
   * @returns Formatted string describing current trends
   * 
   * @example
   * "Trending: 'Elon's Latest Meltdown' (23 posts), 'AI Regulation Battle' (18 posts), ..."
   */
  getTrendContext(): string {
    if (this.currentTrends.length === 0) {
      return 'No trending topics yet.';
    }

    const trendList = this.currentTrends
      .slice(0, 3) // Top 3 trends
      .map(t => `"${t.trendName}" (${t.count} posts)`)
      .join(', ');

    return `🔥 Trending: ${trendList}`;
  }

  /**
   * Get detailed trend context for agent prompts
   * 
   * @returns Formatted trend context - NEVER empty string
   * @throws Error if called before first trend update
   */
  getDetailedTrendContext(): string {
    if (this.currentTrends.length === 0) {
      // Return helpful context instead of empty string
      return `
━━━ TRENDING TOPICS ━━━
No trending topics yet - post more to create trends!
━━━━━━━━━━━━━━━━━━━━━━
`;
    }

    const trendList = this.currentTrends.map((t, i) => {
      if (!t.trendName || !t.description) {
        throw new Error(`Invalid trend at index ${i}: missing trendName or description`);
      }
      return `${i + 1}. "${t.trendName}" (${t.count} posts)
   ${t.description}`;
    }).join('\n');

    return `
━━━ TRENDING TOPICS ━━━
${trendList}
━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  /**
   * Aggregate tags from recent posts
   */
  private aggregateTags(posts: FeedPost[]): Map<string, {
    count: number;
    posts: FeedPost[];
    relatedQuestions: Set<number>;
  }> {
    const tagMap = new Map<string, {
      count: number;
      posts: FeedPost[];
      relatedQuestions: Set<number>;
    }>();

    for (const post of posts) {
      if (!post.tags || post.tags.length === 0) continue;

      for (const tag of post.tags) {
        const normalized = tag.toLowerCase().trim();
        if (!normalized) continue;

        if (!tagMap.has(normalized)) {
          tagMap.set(normalized, {
            count: 0,
            posts: [],
            relatedQuestions: new Set(),
          });
        }

        const entry = tagMap.get(normalized)!;
        entry.count++;
        entry.posts.push(post);
        
        if (post.relatedQuestion) {
          entry.relatedQuestions.add(post.relatedQuestion);
        }
      }
    }

    return tagMap;
  }

  /**
   * Rank topics by frequency and recency
   */
  private rankTopics(
    tagFrequency: Map<string, {
      count: number;
      posts: FeedPost[];
      relatedQuestions: Set<number>;
    }>,
    currentTick: number
  ): Array<{
    tag: string;
    count: number;
    recency: number;
    score: number;
    relatedQuestions: number[];
    samplePosts: string[];
  }> {
    const topics: Array<{
      tag: string;
      count: number;
      recency: number;
      score: number;
      relatedQuestions: number[];
      samplePosts: string[];
    }> = [];

    for (const [tag, data] of tagFrequency.entries()) {
      // Calculate recency score (recent posts weighted higher)
      const mostRecentPost = data.posts.reduce((latest, post) => {
        const postTime = new Date(post.timestamp).getTime();
        const latestTime = new Date(latest.timestamp).getTime();
        return postTime > latestTime ? post : latest;
      });

      // Recency score: 1.0 for current tick, decaying to 0.5 for older posts
      const ticksAgo = currentTick - (mostRecentPost.day || 0);
      const recency = Math.max(0.5, 1.0 - (ticksAgo * 0.05));

      // Combined score: count * recency (favors frequent + recent)
      const score = data.count * recency;

      topics.push({
        tag,
        count: data.count,
        recency,
        score,
        relatedQuestions: Array.from(data.relatedQuestions),
        samplePosts: data.posts.slice(0, 5).map(p => p.id),
      });
    }

    // Sort by score (highest first)
    return topics.sort((a, b) => b.score - a.score);
  }

  /**
   * Generate LLM descriptions for trends
   */
  private async generateTrendDescriptions(
    topics: Array<{
      tag: string;
      count: number;
      recency: number;
      score: number;
      relatedQuestions: number[];
      samplePosts: string[];
    }>,
    allPosts: FeedPost[]
  ): Promise<TrendingTopic[]> {
    if (topics.length === 0) {
      throw new Error('Cannot generate trend descriptions for empty topics array');
    }

    const trends: TrendingTopic[] = [];

    // Generate descriptions in batch for efficiency
    const topicsList = topics.map((topic, i) => {
      // Get sample posts for this topic
      const samplePosts = allPosts
        .filter(p => topic.samplePosts.includes(p.id))
        .slice(0, 5);

      if (samplePosts.length === 0) {
        throw new Error(`Topic "${topic.tag}" has no sample posts - cannot generate description`);
      }

      const posts = samplePosts
        .map(p => {
          if (!p.authorName || !p.content) {
            throw new Error(`Invalid post data for trending: missing authorName or content`);
          }
          return `@${p.authorName}: "${p.content}"`;
        })
        .join('\n   ');

      return `${i + 1}. Tag: "${topic.tag}" (${topic.count} posts)
   Sample posts:
   ${posts}
   
   Generate catchy trend name (3-6 words) and brief description (1-2 sentences).`;
    }).join('\n\n');

    if (!topicsList || topicsList.trim().length === 0) {
      throw new Error('Failed to build topics list for LLM prompt - empty content');
    }

    const prompt = `You are analyzing trending topics on a social media platform.

TRENDING TOPICS (by frequency + recency):
${topicsList}

For each topic, create:
1. A catchy, descriptive trend name (3-6 words, title case)
2. A micro-summary (1-2 sentences) of what people are discussing

Be satirical, witty, and capture the essence of the conversation.

Respond with XML:
<response>
  <trends>
    <trend>
      <trendName>Elon's 3am Twitter Meltdown</trendName>
      <description>Tech CEO's late-night posting spree raises eyebrows among investors. Market analysts question decision-making at scale.</description>
    </trend>
    <!-- More trends... -->
  </trends>
</response>`;

    const rawResponse = await this.llm.generateJSON<{
      trends: Array<{
        trendName: string;
        description: string;
      }>;
    } | {
      response: {
        trends: Array<{
          trendName: string;
          description: string;
        }> | {
          trend: Array<{
            trendName: string;
            description: string;
          }>;
        };
      };
    }>(
      prompt,
      undefined,
      { 
        temperature: 0.85,
        maxTokens: 2000,
        format: 'xml',
      }
    );

    // Handle XML structure with strict validation
    let trendDescriptions: Array<{ trendName: string; description: string }> = [];
    
    if ('response' in rawResponse && rawResponse.response) {
      const response = rawResponse.response;
      if (Array.isArray(response.trends)) {
        trendDescriptions = response.trends;
      } else if (response.trends && typeof response.trends === 'object' && 'trend' in response.trends) {
        const trendData = (response.trends as { trend: Array<{ trendName: string; description: string }> }).trend;
        trendDescriptions = Array.isArray(trendData) ? trendData : [trendData];
      }
    } else if ('trends' in rawResponse && Array.isArray(rawResponse.trends)) {
      trendDescriptions = rawResponse.trends;
    }

    if (trendDescriptions.length === 0) {
      throw new Error('LLM returned no trend descriptions');
    }

    if (trendDescriptions.length < topics.length) {
      logger.warn(`LLM returned fewer descriptions (${trendDescriptions.length}) than topics (${topics.length})`, undefined, 'TrendingTopicsEngine');
    }

    // Combine with topic data and validate each trend
    topics.forEach((topic, i) => {
      const desc = trendDescriptions[i];
      if (!desc) {
        logger.warn(`No description for topic ${i}: ${topic.tag}`, undefined, 'TrendingTopicsEngine');
        return;
      }

      // Validate trend has meaningful content
      const trendName = desc.trendName?.trim();
      const description = desc.description?.trim();

      if (!trendName || trendName.length === 0) {
        logger.warn(`Empty trend name for "${topic.tag}" - using tag as fallback`, undefined, 'TrendingTopicsEngine');
      }

      if (!description || description.length === 0) {
        logger.warn(`Empty description for "${topic.tag}" - using default`, undefined, 'TrendingTopicsEngine');
      }

      trends.push({
        tag: topic.tag,
        count: topic.count,
        recency: topic.recency,
        score: topic.score,
        trendName: trendName || topic.tag,
        description: description || `${topic.count} posts discussing ${topic.tag}`,
        relatedQuestions: topic.relatedQuestions,
        samplePosts: topic.samplePosts,
      });
    });

    if (trends.length === 0) {
      throw new Error('Failed to generate any valid trends from LLM response');
    }

    return trends;
  }

  /**
   * Set update interval (default: 10 ticks)
   */
  setUpdateInterval(ticks: number): void {
    this.updateInterval = ticks;
  }
}

