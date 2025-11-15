/**
 * Signal Extraction Service
 * 
 * **INTERNAL USE ONLY - NOT EXPOSED TO AGENTS**
 * 
 * Aggregates and analyzes signal from feed posts for:
 * - Internal game engine decision making
 * - NPC trading decisions
 * - Admin debugging and monitoring
 * - Testing and validation
 * 
 * ⚠️ SECURITY: This service reveals weighted predictions and should NEVER
 * be exposed via public API. Agents must analyze the raw feed themselves.
 * 
 * Weights evidence by source reliability and tracks signal strength over time.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface SignalAnalysis {
  marketId: string;
  questionText: string;
  
  // Aggregated signal
  yesSignal: number;      // Weighted YES evidence
  noSignal: number;       // Weighted NO evidence
  netSignal: number;      // yesSignal - noSignal
  signalStrength: number; // 0-1, how strong the evidence is
  
  // Signal distribution
  totalPosts: number;
  signalPosts: number;  // Posts with clear signal
  noisePosts: number;   // Posts without signal
  signalRatio: number;  // signalPosts / totalPosts
  
  // By source type
  insiderSignal: { yes: number; no: number };
  expertSignal: { yes: number; no: number };
  journalistSignal: { yes: number; no: number };
  
  // Top sources
  topYesSources: Array<{ name: string; reliability: number; weight: number }>;
  topNoSources: Array<{ name: string; reliability: number; weight: number }>;
  
  // Temporal signal
  earlySignal: { yes: number; no: number }; // Days 1-10
  midSignal: { yes: number; no: number };   // Days 11-20
  lateSignal: { yes: number; no: number };  // Days 21-30
  
  // Recommendation
  suggestedOutcome: 'YES' | 'NO' | 'UNCERTAIN';
  confidence: number; // 0-1, how confident the suggestion is
}

export class SignalExtractionService {
  /**
   * Extract and aggregate signal for a prediction market
   */
  static async extractMarketSignal(questionNumber: number): Promise<SignalAnalysis> {
    // Get the question
    const question = await prisma.question.findUnique({
      where: { questionNumber },
      select: {
        id: true,
        questionNumber: true,
        text: true,
      },
    });

    if (!question) {
      throw new Error(`Question ${questionNumber} not found`);
    }

    // Get all posts related to this question
    // Note: Signal metadata (pointsToward, clueStrength) currently stored in-memory during game
    // For now, we analyze post content and use gameId to find related posts
    const posts = await prisma.post.findMany({
      where: {
        gameId: question.id, // Posts associated with this question's game
        deletedAt: null,
      },
      select: {
        id: true,
        content: true,
        authorId: true,
        dayNumber: true,
        sentiment: true,
        biasScore: true,
        type: true,
        createdAt: true,
      },
      take: 1000, // Limit to prevent huge queries
    });
    
    // Get author information separately
    const authorIds = [...new Set(posts.map(p => p.authorId))];
    const users = await prisma.user.findMany({
      where: {
        id: { in: authorIds },
      },
      select: {
        id: true,
        displayName: true,
        isActor: true,
      },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Get actor reliability scores for NPC posts
    const npcPosts = posts.filter(p => {
      const user = userMap.get(p.authorId);
      return user?.isActor;
    });
    const npcIds = npcPosts.map(p => p.authorId);
    
    const actors = await prisma.actor.findMany({
      where: {
        id: { in: npcIds },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    const actorMap = new Map(actors.map(a => [a.id, a]));

    // Initialize signal accumulators
    let yesSignal = 0;
    let noSignal = 0;
    
    const byType = {
      insider: { yes: 0, no: 0 },
      expert: { yes: 0, no: 0 },
      journalist: { yes: 0, no: 0 },
    };
    
    const byPeriod = {
      early: { yes: 0, no: 0 },
      mid: { yes: 0, no: 0 },
      late: { yes: 0, no: 0 },
    };

    const yesSources: Array<{ name: string; reliability: number; weight: number }> = [];
    const noSources: Array<{ name: string; reliability: number; weight: number }> = [];

    let signalPosts = 0;

    // Process each post
    // NOTE: Currently posts don't have pointsToward in DB
    // We use sentiment analysis as a proxy for signal
    for (const post of posts) {
      // Skip non-NPC posts (only NPCs provide signal)
      const user = userMap.get(post.authorId);
      if (!user?.isActor) {
        continue;
      }

      // Get actor reliability
      const actor = actorMap.get(post.authorId);
      if (!actor) continue;
      
      const reliability = this.getDefaultReliability(actor.role || null);
      
      // Use sentiment as a proxy for signal direction
      // Positive sentiment = YES signal, Negative sentiment = NO signal
      const sentiment = post.sentiment === 'positive' ? 0.8 : 
                       post.sentiment === 'negative' ? -0.8 :
                       post.biasScore || 0;
      
      // Only count posts with clear signal (abs sentiment > 0.3)
      if (Math.abs(sentiment) < 0.3) {
        continue; // Neutral posts don't provide signal
      }

      signalPosts++;

      // Default clue strength based on post type and day
      const dayNum = post.dayNumber || 1;
      const clueStrength = post.type === 'article' ? 0.8 :  // Articles are stronger signal
                          dayNum > 20 ? 0.7 :                // Late game posts stronger
                          dayNum > 10 ? 0.5 :                // Mid game moderate
                          0.3;                               // Early game weak
      
      // Calculate signal weight (reliability × clue strength × sentiment strength)
      const weight = reliability * clueStrength * Math.abs(sentiment);

      // Accumulate signal
      if (sentiment > 0) {
        yesSignal += weight;
        yesSources.push({
          name: user.displayName || actor.name,
          reliability,
          weight,
        });
      } else {
        noSignal += weight;
        noSources.push({
          name: user.displayName || actor.name,
          reliability,
          weight,
        });
      }

      // Accumulate by type
      const role = actor.role?.toLowerCase() || 'other';
      const isYesSignal = sentiment > 0;
      if (role.includes('insider') || role.includes('whistleblower')) {
        byType.insider[isYesSignal ? 'yes' : 'no'] += weight;
      } else if (role.includes('expert') || role.includes('analyst')) {
        byType.expert[isYesSignal ? 'yes' : 'no'] += weight;
      } else if (role.includes('journalist') || role.includes('reporter')) {
        byType.journalist[isYesSignal ? 'yes' : 'no'] += weight;
      }

      // Accumulate by period
      const day = post.dayNumber || 0;
      const isYesPeriod = sentiment > 0;
      if (day <= 10) {
        byPeriod.early[isYesPeriod ? 'yes' : 'no'] += weight;
      } else if (day <= 20) {
        byPeriod.mid[isYesPeriod ? 'yes' : 'no'] += weight;
      } else {
        byPeriod.late[isYesPeriod ? 'yes' : 'no'] += weight;
      }
    }

    // Calculate metrics
    const totalPosts = posts.length;
    const noisePosts = totalPosts - signalPosts;
    const signalRatio = totalPosts > 0 ? signalPosts / totalPosts : 0;
    
    const netSignal = yesSignal - noSignal;
    const totalSignal = yesSignal + noSignal;
    const signalStrength = totalSignal > 0 ? Math.abs(netSignal) / totalSignal : 0;

    // Determine suggested outcome
    let suggestedOutcome: 'YES' | 'NO' | 'UNCERTAIN';
    if (signalStrength < 0.2) {
      suggestedOutcome = 'UNCERTAIN';
    } else {
      suggestedOutcome = netSignal > 0 ? 'YES' : 'NO';
    }

    const confidence = signalStrength;

    // Sort sources by weight
    yesSources.sort((a, b) => b.weight - a.weight);
    noSources.sort((a, b) => b.weight - a.weight);

    logger.info('Signal extraction complete', {
      questionNumber,
      yesSignal: yesSignal.toFixed(2),
      noSignal: noSignal.toFixed(2),
      netSignal: netSignal.toFixed(2),
      signalRatio: (signalRatio * 100).toFixed(1) + '%',
      suggestedOutcome,
      confidence: (confidence * 100).toFixed(1) + '%',
    }, 'SignalExtractionService');

    return {
      marketId: question.id,
      questionText: question.text,
      yesSignal,
      noSignal,
      netSignal,
      signalStrength,
      totalPosts,
      signalPosts,
      noisePosts,
      signalRatio,
      insiderSignal: byType.insider,
      expertSignal: byType.expert,
      journalistSignal: byType.journalist,
      topYesSources: yesSources.slice(0, 5),
      topNoSources: noSources.slice(0, 5),
      earlySignal: byPeriod.early,
      midSignal: byPeriod.mid,
      lateSignal: byPeriod.late,
      suggestedOutcome,
      confidence,
    };
  }

  /**
   * Get default reliability score based on actor role
   * TODO: Replace with actual tracked reliability from database
   */
  private static getDefaultReliability(role: string | null): number {
    if (!role) return 0.5;

    const roleLower = role.toLowerCase();
    
    // Insiders and whistleblowers are most reliable
    if (roleLower.includes('insider') || roleLower.includes('whistleblower')) {
      return 0.9;
    }
    
    // Experts are moderately reliable
    if (roleLower.includes('expert') || roleLower.includes('analyst')) {
      return 0.7;
    }
    
    // Journalists are somewhat reliable
    if (roleLower.includes('journalist') || roleLower.includes('reporter')) {
      return 0.6;
    }
    
    // Politicians are less reliable
    if (roleLower.includes('politician') || roleLower.includes('senator')) {
      return 0.3;
    }
    
    // Deceivers and conspiracy theorists are unreliable
    if (roleLower.includes('deceiver') || roleLower.includes('conspiracy')) {
      return 0.1;
    }
    
    // Default moderate reliability
    return 0.5;
  }

  /**
   * Get simplified signal summary for quick agent consumption
   */
  static async getQuickSignal(questionNumber: number): Promise<{
    outcome: 'YES' | 'NO' | 'UNCERTAIN';
    confidence: number;
    yesEvidence: number;
    noEvidence: number;
  }> {
    const analysis = await this.extractMarketSignal(questionNumber);
    
    return {
      outcome: analysis.suggestedOutcome,
      confidence: analysis.confidence,
      yesEvidence: analysis.yesSignal,
      noEvidence: analysis.noSignal,
    };
  }
}

