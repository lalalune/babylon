/**
 * Babylon Game Evaluators
 *
 * Eliza evaluators for analyzing prediction markets and making trading decisions
 */

import type { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";
import { BabylonClientService } from "../plugin";
import type { BabylonMarket, MarketAnalysis } from "../types";

/**
 * Extended State interface for market analysis evaluator
 */
interface MarketAnalysisState extends State {
  marketId?: string;
  minConfidence?: number;
  analysis?: MarketAnalysis | null;
  analyses?: MarketAnalysis[];
  marketCount?: number;
  market?: BabylonMarket;
  error?: string;
}

/**
 * Extended State interface for portfolio management evaluator
 */
interface PortfolioManagementState extends State {
  positions?: Array<{
    id: string;
    marketId: string;
    side: boolean;
    shares: number;
    avgPrice: number;
    currentValue: number;
    pnl: number;
  }>;
  wallet?: {
    balance: number;
    availableBalance: number;
    lockedBalance: number;
  };
  portfolioMetrics?: {
    totalPositionValue: number;
    totalPnL: number;
    profitablePositions: number;
    losingPositions: number;
    exposureRatio: number;
    winRate: number;
  };
  recommendations?: string[];
  error?: string;
}

/**
 * Character settings interface for trading strategies
 */
interface TradingCharacterSettings {
  strategies?: string[];
  riskTolerance?: number;
}

/**
 * Market Analysis Evaluator
 *
 * Analyzes prediction markets and provides trading recommendations
 */
export const marketAnalysisEvaluator: Evaluator = {
  name: "MARKET_ANALYSIS",
  similes: ["ANALYZE_MARKET", "EVALUATE_TRADE", "ASSESS_OPPORTUNITY"],
  description: "Analyze prediction markets and provide trading recommendations",
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    // Always validate if we have markets to analyze
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    );
    if (!babylonService) return false;

    const content = message.content.text?.toLowerCase() || "";
    const hasAnalysisIntent =
      content.includes("analyze") ||
      content.includes("what do you think") ||
      content.includes("should i") ||
      content.includes("opinion") ||
      content.includes("recommendation");

    return hasAnalysisIntent;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<void> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )!;

    const client = babylonService.getClient();

    const analysisState = state as MarketAnalysisState;
    
    const marketId =
      analysisState?.marketId ||
      (message.content as { metadata?: { marketId?: string } })?.metadata?.marketId;
    const minConfidence = analysisState?.minConfidence || 0.6;

    if (!marketId) {
      const markets = await client.getActiveMarkets();

      if (markets.length === 0) {
        analysisState.analysis = null;
        analysisState.error = "No active markets found";
        return;
      }

      const analyses: MarketAnalysis[] = [];

      for (const market of markets) {
        const analysis = await analyzeMarket(runtime, market);
        if (analysis && analysis.confidence >= minConfidence) {
          analyses.push(analysis);
        }
      }

      analyses.sort((a, b) => b.confidence - a.confidence);

      analysisState.analyses = analyses.slice(0, 3);
      analysisState.marketCount = markets.length;
    } else {
      const market = await client.getMarket(marketId);

      const analysis = await analyzeMarket(runtime, market);

      analysisState.analysis = analysis;
      analysisState.market = market;
    }
  },
  examples: [
    {
      prompt: "User asks for market analysis",
      messages: [
        {
          name: "{{name1}}",
          content: {
            text: "What do you think about this market?",
          },
        },
        {
          name: "{{agent}}",
          content: {
            text: "Let me analyze the market dynamics...",
          },
        },
      ],
      outcome:
        "Agent provides detailed market analysis with confidence score and recommendation",
    },
  ],
};

/**
 * Analyze a specific market
 */
async function analyzeMarket(
  runtime: IAgentRuntime,
  market: BabylonMarket,
): Promise<MarketAnalysis> {
  // Get character personality for trading style
  const character = runtime.character;
  const settings = character.settings as TradingCharacterSettings | undefined;
  const strategies = settings?.strategies || ["fundamental"];
  const riskTolerance = settings?.riskTolerance || 0.5;

  // Basic market metrics
  const yesPrice = market.yesPrice;
  const noPrice = market.noPrice;
  const totalVolume = market.totalVolume;
  const liquidityScore = Math.min(totalVolume / 1000, 1.0); // Higher volume = more liquid

  // Validate price consistency (yes + no should equal ~1.0)
  const priceSum = yesPrice + noPrice;
  if (Math.abs(priceSum - 1.0) > 0.01) {
    runtime.logger.warn(
      `Price inconsistency in market ${market.id}: yes=${yesPrice}, no=${noPrice}, sum=${priceSum}`,
    );
  }

  // Price momentum (simplified - would be better with historical data)
  const priceBias = yesPrice > 0.5 ? "yes" : "no";
  const priceStrength = Math.abs(yesPrice - 0.5) * 2; // 0 to 1 scale

  // Strategy-specific analysis
  let recommendation: MarketAnalysis["recommendation"] = "hold";
  let confidence = 0.5;
  let reasoning = "";
  let targetSide: "yes" | "no" = "yes";

  if (
    strategies.includes("momentum") ||
    strategies.includes("volume-analysis")
  ) {
    // Momentum strategy: Follow the trend
    if (priceStrength > 0.3 && liquidityScore > 0.3) {
      recommendation = priceStrength > 0.6 ? "strong_buy" : "buy";
      confidence = priceStrength * liquidityScore * riskTolerance;
      targetSide = priceBias;
      reasoning = `Strong ${priceBias.toUpperCase()} momentum with price at ${(yesPrice * 100).toFixed(1)}% and volume of $${totalVolume.toFixed(0)}. Trend is clear.`;
    } else {
      recommendation = "hold";
      confidence = 0.4;
      reasoning = `Weak momentum signals. Price at ${(yesPrice * 100).toFixed(1)}%, waiting for clearer trend.`;
    }
  } else if (
    strategies.includes("contrarian") ||
    strategies.includes("arbitrage")
  ) {
    // Contrarian strategy: Look for mispricing
    if (priceStrength > 0.6) {
      // Market is strongly biased - look for reversal
      recommendation = "buy";
      confidence = (1 - priceStrength) * riskTolerance;
      targetSide = priceBias === "yes" ? "no" : "yes";
      reasoning = `Contrarian opportunity: Market heavily biased to ${priceBias.toUpperCase()} at ${(yesPrice * 100).toFixed(1)}%. Potential reversal on ${targetSide.toUpperCase()} side.`;
    } else {
      recommendation = "hold";
      confidence = 0.3;
      reasoning = `No clear contrarian opportunity. Market fairly balanced at ${(yesPrice * 100).toFixed(1)}%.`;
    }
  } else {
    // Fundamental/conservative strategy
    if (liquidityScore > 0.5 && priceStrength < 0.4) {
      recommendation = "buy";
      confidence = liquidityScore * (1 - priceStrength) * riskTolerance;
      targetSide = priceBias;
      reasoning = `Moderate opportunity with good liquidity. Market at ${(yesPrice * 100).toFixed(1)}% with $${totalVolume.toFixed(0)} volume.`;
    } else {
      recommendation = "hold";
      confidence = 0.4;
      reasoning = `Market conditions unclear. Price ${(yesPrice * 100).toFixed(1)}%, volume $${totalVolume.toFixed(0)}. Waiting for better entry.`;
    }
  }

  // Risk level assessment
  let riskLevel: "low" | "medium" | "high" = "medium";
  if (liquidityScore < 0.3) riskLevel = "high";
  else if (liquidityScore > 0.7 && priceStrength < 0.4) riskLevel = "low";

  // Suggested amount based on confidence and risk tolerance
  const baseAmount = 10;
  const suggestedAmount =
    baseAmount *
    confidence *
    riskTolerance *
    (riskLevel === "high" ? 0.5 : riskLevel === "low" ? 2.0 : 1.0);

  return {
    marketId: market.id,
    recommendation,
    confidence: Math.min(confidence, 1.0),
    reasoning,
    targetSide,
    suggestedAmount: Math.max(1, Math.round(suggestedAmount)),
    riskLevel,
  };
}

/**
 * Portfolio Management Evaluator
 *
 * Monitors agent's positions and recommends portfolio actions
 */
export const portfolioManagementEvaluator: Evaluator = {
  name: "PORTFOLIO_MANAGEMENT",
  similes: ["MANAGE_PORTFOLIO", "REVIEW_POSITIONS", "RISK_MANAGEMENT"],
  description: "Monitor positions and manage portfolio risk",
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    );
    if (!babylonService) return false;

    const content = message.content.text?.toLowerCase() || "";
    const hasPortfolioIntent =
      content.includes("portfolio") ||
      content.includes("positions") ||
      content.includes("risk") ||
      content.includes("exposure");

    return hasPortfolioIntent;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<void> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )!;

    const client = babylonService.getClient();
    const portfolioState = state as PortfolioManagementState;

    const messageText = message.content.text?.toLowerCase() || "";
    const focusOnRisk = messageText.includes("risk");
    const focusOnPnL =
      messageText.includes("profit") ||
      messageText.includes("loss") ||
      messageText.includes("pnl");

    const positions = await client.getPositions();
    const wallet = await client.getWallet();

    const totalPositionValue = positions.reduce(
      (sum, p) => sum + p.currentValue,
      0,
    );
    const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
    const profitablePositions = positions.filter((p) => p.pnl > 0).length;
    const losingPositions = positions.filter((p) => p.pnl < 0).length;

    const exposureRatio = totalPositionValue / (wallet.balance || 1);
    const winRate =
      positions.length > 0 ? profitablePositions / positions.length : 0;

    const recommendations: string[] = [];

    if (exposureRatio > 0.8) {
      recommendations.push(
        "⚠️ High exposure: Consider reducing position sizes",
      );
    }

    if (losingPositions > profitablePositions && positions.length >= 3) {
      recommendations.push(
        "📉 More losers than winners: Review trading strategy",
      );
    }

    if (totalPnL < -wallet.balance * 0.1) {
      const priority = focusOnPnL ? "🚨🚨" : "🚨";
      recommendations.push(
        `${priority} Significant losses: Consider implementing stop-losses`,
      );
    }

    if (positions.length === 0 && wallet.availableBalance > 50) {
      recommendations.push(
        "💡 No active positions: Consider opening new trades",
      );
    }

    if (focusOnRisk && exposureRatio > 0) {
      recommendations.push(
        `📊 Current risk level: ${(exposureRatio * 100).toFixed(1)}% of balance in positions`,
      );
    }

    portfolioState.positions = positions;
    portfolioState.wallet = wallet;
    portfolioState.portfolioMetrics = {
      totalPositionValue,
      totalPnL,
      profitablePositions,
      losingPositions,
      exposureRatio,
      winRate,
    };
    portfolioState.recommendations = recommendations;
  },
  examples: [
    {
      prompt: "User requests portfolio review",
      messages: [
        {
          name: "{{name1}}",
          content: {
            text: "How is my portfolio doing?",
          },
        },
        {
          name: "{{agent}}",
          content: {
            text: "Analyzing your positions and portfolio health...",
          },
        },
      ],
      outcome:
        "Agent provides portfolio metrics including P&L, win rate, and recommendations",
    },
  ],
};

/**
 * Extended State interface for social interaction evaluator
 */
interface SocialInteractionState extends State {
  posts?: Array<{
    id: string;
    content: string;
    authorId: string;
    timestamp: string;
    likeCount: number;
    commentCount: number;
  }>;
  topPosts?: Array<{
    id: string;
    content: string;
    authorId: string;
    timestamp: string;
    likeCount: number;
    commentCount: number;
  }>;
  topAuthors?: string[];
  shouldLike?: boolean;
  shouldComment?: boolean;
  shouldFollow?: boolean;
  shouldPost?: boolean;
  targetPostId?: string;
  targetUserId?: string;
  interactionReason?: string;
}

/**
 * Social Interaction Evaluator
 * 
 * Evaluates whether the agent should interact socially (like, comment, follow, post)
 * Based on feed context and agent personality
 */
export const socialInteractionEvaluator: Evaluator = {
  name: "SOCIAL_INTERACTION",
  similes: ["SOCIAL_FEED", "INTERACT", "ENGAGE"],
  description: "Evaluate social feed and decide on interactions",
  examples: [
    {
      prompt: "User requests social feed evaluation",
      messages: [
        {
          name: "{{name1}}",
          content: {
            text: "Check the social feed and see if there are any interesting posts",
          },
        },
        {
          name: "{{agent}}",
          content: {
            text: "Evaluating recent posts for interactions...",
          },
        },
      ],
      outcome:
        "Agent evaluates feed posts and decides on social interactions (like, comment, follow, or create post)",
    },
  ],
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    );
    if (!babylonService) return false;

    // Always validate for autonomous social interaction
    // Can also be triggered by messages about social feed
    const content = message.content.text?.toLowerCase() || "";
    const hasSocialIntent =
      content.includes("feed") ||
      content.includes("posts") ||
      content.includes("social") ||
      content.includes("interact") ||
      String(message.entityId) === "system"; // System-triggered (from service)

    return hasSocialIntent;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<void> => {
    const socialState = state as SocialInteractionState;
    
    // Extract preferences from message content if present
    const messageText = message.content.text?.toLowerCase() || "";
    const prefersLikes = messageText.includes("like") || messageText.includes("favorite");
    const prefersComments = messageText.includes("comment") || messageText.includes("reply");
    const prefersFollows = messageText.includes("follow") || messageText.includes("subscribe");
    const prefersPosts = messageText.includes("post") || messageText.includes("create");
    
    // Log what triggered this evaluation
    if (message.content.text) {
      runtime.logger.debug(
        `Social interaction evaluator triggered by: ${message.content.text.substring(0, 100)}`,
      );
    }
    
    // Get posts from provider data
    const posts = (socialState.posts || socialState.data?.posts) as Array<{
      id: string;
      content: string;
      authorId: string;
      timestamp: string;
      likeCount: number;
      commentCount: number;
    }> | undefined;

    if (!posts || posts.length === 0) {
      runtime.logger.debug("No posts available for social interaction");
      return;
    }

    const character = runtime.character;
    const characterTopics = character.topics || [];
    
    // Decision logic with personality-driven probabilities
    // Adjust probabilities based on message preferences
    const shouldLike = prefersLikes ? Math.random() < 0.7 : Math.random() < 0.4; // Higher if user mentioned likes
    const shouldComment = prefersComments ? Math.random() < 0.5 : Math.random() < 0.15; // Higher if user mentioned comments
    const shouldFollow = prefersFollows ? Math.random() < 0.6 : Math.random() < 0.2; // Higher if user mentioned follows
    const shouldPost = prefersPosts ? Math.random() < 0.4 : Math.random() < 0.1; // Higher if user mentioned posts

    // Find interesting posts (high engagement or related to character topics)
    const interestingPosts = posts.filter((post) => {
      const hasEngagement = post.likeCount > 0 || post.commentCount > 0;
      const matchesTopics = characterTopics.some((topic) =>
        post.content.toLowerCase().includes(topic.toLowerCase())
      );
      return hasEngagement || matchesTopics;
    });

    // Select target post if we should interact
    let targetPost: typeof posts[0] | undefined;
    if (shouldLike || shouldComment) {
      if (interestingPosts.length > 0) {
        // Weighted selection: prefer high engagement posts
        const sorted = interestingPosts.sort(
          (a, b) => (b.likeCount + b.commentCount) - (a.likeCount + a.commentCount)
        );
        targetPost = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
      } else {
        targetPost = posts[Math.floor(Math.random() * posts.length)];
      }
    }

    // Select target user for following
    let targetUserId: string | undefined;
    if (shouldFollow) {
      const authorEngagement = new Map<string, number>();
      posts.forEach((post) => {
        const engagement = post.likeCount + post.commentCount;
        const current = authorEngagement.get(post.authorId) || 0;
        authorEngagement.set(post.authorId, current + engagement);
      });

      const sortedAuthors = Array.from(authorEngagement.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (sortedAuthors.length > 0) {
        const selectedAuthor = sortedAuthors[Math.floor(Math.random() * sortedAuthors.length)];
        if (selectedAuthor) {
          targetUserId = selectedAuthor[0];
        }
      }
    }

    // Store decisions in state for action handlers
    socialState.shouldLike = shouldLike && !!targetPost;
    socialState.shouldComment = shouldComment && !!targetPost;
    socialState.shouldFollow = shouldFollow && !!targetUserId;
    socialState.shouldPost = shouldPost;
    socialState.targetPostId = targetPost?.id;
    socialState.targetUserId = targetUserId;
    
    if (targetPost) {
      socialState.interactionReason = `Post has ${targetPost.likeCount} likes and ${targetPost.commentCount} comments`;
    }

    runtime.logger.debug(
      `Social interaction evaluation complete: like=${socialState.shouldLike}, comment=${socialState.shouldComment}, follow=${socialState.shouldFollow}, post=${socialState.shouldPost}`,
    );
  },
};

// Export all evaluators
export const babylonGameEvaluators: Evaluator[] = [
  marketAnalysisEvaluator,
  portfolioManagementEvaluator,
  socialInteractionEvaluator,
];
