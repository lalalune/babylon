/**
 * News Article Pacing Engine - Controlled Article Generation
 * 
 * @module engine/NewsArticlePacingEngine
 * 
 * @description
 * Controls when news organizations publish articles to prevent feed flooding.
 * Each outlet writes maximum 1 article per question per stage (breaking, commentary, resolution).
 * 
 * **Pacing Strategy:**
 * - **Breaking Stage** (Question created): 1-2 outlets break the story
 * - **Commentary Stage** (Mid-question): 2-3 outlets provide analysis
 * - **Resolution Stage** (Question resolved): All major outlets cover outcome
 * 
 * **Volume Control:**
 * - Normal posts: HIGH volume (hundreds per day)
 * - News articles: LOW volume (1-3 per question stage)
 * - Prevents article spam while maintaining realistic news cycle
 * 
 * @example
 * ```typescript
 * const pacer = new NewsArticlePacingEngine();
 * 
 * // Check if article should be generated
 * if (pacer.shouldGenerateArticle(questionId, orgId, 'breaking')) {
 *   const article = await articleGen.generateArticle(question, org);
 *   pacer.recordArticle(questionId, orgId, 'breaking');
 * }
 * ```
 */

import { logger } from '@/lib/logger';

/**
 * Article generation stage in question lifecycle
 */
export type ArticleStage = 'breaking' | 'commentary' | 'resolution';

/**
 * Record of which orgs have published articles for which questions
 */
interface ArticleRecord {
  questionId: number;
  orgId: string;
  stage: ArticleStage;
  tick: number;
  articleId: string;
}

/**
 * News Article Pacing Engine
 * 
 * @class NewsArticlePacingEngine
 * 
 * @description
 * Manages article generation pacing to maintain realistic news cycles without
 * overwhelming the social feed with long-form content.
 * 
 * **Rules:**
 * - Each org can publish max 1 article per question per stage
 * - Breaking stage: 1-2 random orgs (race to break the story)
 * - Commentary stage: 2-3 random orgs (mid-question analysis)
 * - Resolution stage: All major outlets (definitive coverage)
 */
export class NewsArticlePacingEngine {
  private articleRecords: ArticleRecord[] = [];
  private stageOrgCounts: Map<string, Map<string, Set<string>>> = new Map(); // questionId -> stage -> Set<orgId>

  /**
   * Check if an organization should generate an article
   * 
   * @param questionId - Prediction market question ID
   * @param orgId - News organization ID
   * @param stage - Article stage (breaking/commentary/resolution)
   * @returns True if article should be generated
   * 
   * @description
   * Implements pacing rules:
   * - Returns false if org already published for this question+stage
   * - For breaking: allows only first 1-2 orgs
   * - For commentary: allows only 2-3 orgs
   * - For resolution: allows all orgs (final outcome coverage)
   */
  shouldGenerateArticle(
    questionId: number,
    orgId: string,
    stage: ArticleStage
  ): boolean {
    // Validate inputs
    if (!questionId || questionId <= 0) {
      throw new Error(`Invalid questionId: ${questionId}`);
    }
    if (!orgId || orgId.trim().length === 0) {
      throw new Error(`Invalid orgId: ${orgId}`);
    }
    if (!stage || !['breaking', 'commentary', 'resolution'].includes(stage)) {
      throw new Error(`Invalid stage: ${stage}`);
    }

    // Check if this org already published for this question+stage
    if (this.hasPublished(questionId, orgId, stage)) {
      logger.debug(`${orgId} already published ${stage} article for Q${questionId}`, undefined, 'NewsArticlePacingEngine');
      return false;
    }

    // Get current count for this question+stage
    const stageKey = `${questionId}:${stage}`;
    if (!this.stageOrgCounts.has(stageKey)) {
      this.stageOrgCounts.set(stageKey, new Map());
    }
    
    const stageMap = this.stageOrgCounts.get(stageKey)!;
    if (!stageMap.has(stage)) {
      stageMap.set(stage, new Set());
    }
    
    const orgsForStage = stageMap.get(stage)!;
    const currentCount = orgsForStage.size;

    // Apply stage-specific limits
    switch (stage) {
      case 'breaking':
        // Only first 1-2 orgs break the story (race to publish)
        return currentCount < 2;
      
      case 'commentary':
        // 2-3 orgs provide mid-question analysis
        return currentCount < 3;
      
      case 'resolution':
        // All orgs can cover final outcome (major news)
        return true; // No limit for resolution coverage
      
      default:
        return false;
    }
  }

  /**
   * Record that an article was published
   * 
   * @param questionId - Prediction market question ID
   * @param orgId - News organization ID
   * @param stage - Article stage
   * @param articleId - Generated article ID
   * @param tick - Current game tick
   */
  recordArticle(
    questionId: number,
    orgId: string,
    stage: ArticleStage,
    articleId: string,
    tick: number
  ): void {
    // Validate all inputs
    if (!questionId || questionId <= 0) {
      throw new Error(`Invalid questionId for recordArticle: ${questionId}`);
    }
    if (!orgId || orgId.trim().length === 0) {
      throw new Error(`Invalid orgId for recordArticle: ${orgId}`);
    }
    if (!stage || !['breaking', 'commentary', 'resolution'].includes(stage)) {
      throw new Error(`Invalid stage for recordArticle: ${stage}`);
    }
    if (!articleId || articleId.trim().length === 0) {
      throw new Error(`Invalid articleId for recordArticle: ${articleId}`);
    }
    if (tick < 0) {
      throw new Error(`Invalid tick for recordArticle: ${tick}`);
    }

    // Record article
    this.articleRecords.push({
      questionId,
      orgId,
      stage,
      tick,
      articleId,
    });

    // Update stage counts
    const stageKey = `${questionId}:${stage}`;
    if (!this.stageOrgCounts.has(stageKey)) {
      this.stageOrgCounts.set(stageKey, new Map());
    }
    
    const stageMap = this.stageOrgCounts.get(stageKey)!;
    if (!stageMap.has(stage)) {
      stageMap.set(stage, new Set());
    }
    
    stageMap.get(stage)!.add(orgId);

    logger.debug(`Recorded ${stage} article for Q${questionId} by ${orgId}`, {
      articleId,
      tick,
    }, 'NewsArticlePacingEngine');
  }

  /**
   * Check if org has already published for this question+stage
   */
  private hasPublished(
    questionId: number,
    orgId: string,
    stage: ArticleStage
  ): boolean {
    return this.articleRecords.some(
      r => r.questionId === questionId && r.orgId === orgId && r.stage === stage
    );
  }

  /**
   * Get all articles for a question
   */
  getArticlesForQuestion(questionId: number): ArticleRecord[] {
    return this.articleRecords.filter(r => r.questionId === questionId);
  }

  /**
   * Get stage statistics for a question
   */
  getStageStats(questionId: number): {
    breaking: number;
    commentary: number;
    resolution: number;
  } {
    const articles = this.getArticlesForQuestion(questionId);
    
    return {
      breaking: articles.filter(a => a.stage === 'breaking').length,
      commentary: articles.filter(a => a.stage === 'commentary').length,
      resolution: articles.filter(a => a.stage === 'resolution').length,
    };
  }

  /**
   * Select which orgs should publish articles this stage
   * 
   * @param availableOrgs - All news organizations
   * @param questionId - Question ID
   * @param stage - Article stage
   * @returns Orgs that should publish (respects pacing rules)
   */
  selectOrgsForStage(
    availableOrgs: Array<{ id: string; name: string }>,
    questionId: number,
    stage: ArticleStage
  ): Array<{ id: string; name: string }> {
    // Validate inputs
    if (!availableOrgs || availableOrgs.length === 0) {
      throw new Error('availableOrgs cannot be empty');
    }
    if (!questionId || questionId <= 0) {
      throw new Error(`Invalid questionId for selectOrgsForStage: ${questionId}`);
    }
    if (!stage || !['breaking', 'commentary', 'resolution'].includes(stage)) {
      throw new Error(`Invalid stage for selectOrgsForStage: ${stage}`);
    }

    // Validate each org has required fields
    for (const org of availableOrgs) {
      if (!org.id || org.id.trim().length === 0) {
        throw new Error(`Organization missing id: ${JSON.stringify(org)}`);
      }
      if (!org.name || org.name.trim().length === 0) {
        throw new Error(`Organization missing name: ${JSON.stringify(org)}`);
      }
    }

    // Filter to orgs that haven't published yet
    const eligibleOrgs = availableOrgs.filter(org =>
      this.shouldGenerateArticle(questionId, org.id, stage)
    );

    if (eligibleOrgs.length === 0) {
      logger.info(`No eligible orgs for Q${questionId} ${stage} stage - all have published`, undefined, 'NewsArticlePacingEngine');
      return [];
    }

    // Select random subset based on stage
    let count: number;
    switch (stage) {
      case 'breaking':
        count = 1 + Math.floor(Math.random() * 2); // 1-2 orgs
        break;
      case 'commentary':
        count = 2 + Math.floor(Math.random() * 2); // 2-3 orgs
        break;
      case 'resolution':
        count = Math.min(5, eligibleOrgs.length); // Up to 5 orgs
        break;
      default:
        count = 1;
    }

    // Shuffle and take N
    const shuffled = [...eligibleOrgs].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Clear records for a question (e.g., after resolution)
   */
  clearQuestion(questionId: number): void {
    this.articleRecords = this.articleRecords.filter(r => r.questionId !== questionId);
    
    // Clear stage counts
    const keysToDelete: string[] = [];
    for (const key of this.stageOrgCounts.keys()) {
      if (key.startsWith(`${questionId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.stageOrgCounts.delete(key));

    logger.info(`Cleared article records for Q${questionId}`, undefined, 'NewsArticlePacingEngine');
  }

  /**
   * Get total article count
   */
  getTotalArticles(): number {
    return this.articleRecords.length;
  }

  /**
   * Get article count by stage
   */
  getArticleCountByStage(): Record<ArticleStage, number> {
    return {
      breaking: this.articleRecords.filter(r => r.stage === 'breaking').length,
      commentary: this.articleRecords.filter(r => r.stage === 'commentary').length,
      resolution: this.articleRecords.filter(r => r.stage === 'resolution').length,
    };
  }
}

