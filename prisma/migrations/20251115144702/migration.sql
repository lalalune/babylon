-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_PROFILE', 'PENDING_ONCHAIN', 'ONCHAIN_IN_PROGRESS', 'ONCHAIN_FAILED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Actor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT[],
    "personality" TEXT,
    "tier" TEXT,
    "affiliations" TEXT[],
    "postStyle" TEXT,
    "postExample" TEXT[],
    "role" TEXT,
    "initialLuck" TEXT NOT NULL DEFAULT 'medium',
    "initialMood" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hasPool" BOOLEAN NOT NULL DEFAULT false,
    "profileImageUrl" TEXT,
    "reputationPoints" INTEGER NOT NULL DEFAULT 10000,
    "tradingBalance" DECIMAL(18,2) NOT NULL DEFAULT 10000,
    "isTest" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMutual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ActorFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorRelationship" (
    "id" TEXT NOT NULL,
    "actor1Id" TEXT NOT NULL,
    "actor2Id" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "sentiment" DOUBLE PRECISION NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "history" TEXT,
    "affects" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActorRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "prompt" TEXT,
    "completion" TEXT,
    "thinking" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentUserId" TEXT NOT NULL,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "modelUsed" TEXT,
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentUserId" TEXT NOT NULL,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPerformanceMetrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "averageGameScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastGameScore" DOUBLE PRECISION,
    "lastGamePlayedAt" TIMESTAMP(3),
    "normalizedPnL" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "profitableTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageROI" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharpeRatio" DOUBLE PRECISION,
    "totalFeedbackCount" INTEGER NOT NULL DEFAULT 0,
    "averageFeedbackScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "averageRating" DOUBLE PRECISION,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "trustLevel" TEXT NOT NULL DEFAULT 'UNRATED',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onChainReputationSync" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "onChainTrustScore" DOUBLE PRECISION,
    "onChainAccuracyScore" DOUBLE PRECISION,
    "firstActivityAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPerformanceMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentGoal" (
    "id" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target" JSONB,
    "priority" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentGoalAction" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionId" TEXT,
    "impact" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentGoalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPointsTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentUserId" TEXT NOT NULL,
    "managerUserId" TEXT NOT NULL,

    CONSTRAINT "AgentPointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTrade" (
    "id" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "marketId" TEXT,
    "ticker" TEXT,
    "action" TEXT NOT NULL,
    "side" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "pnl" DOUBLE PRECISION,
    "reasoning" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentUserId" TEXT NOT NULL,

    CONSTRAINT "AgentTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "relatedId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "npcAdminId" TEXT,
    "gameId" TEXT,
    "dayNumber" INTEGER,
    "relatedQuestion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatParticipant" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "kickedAt" TIMESTAMP(3),
    "kickReason" TEXT,
    "addedBy" TEXT,

    CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAdmin" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT NOT NULL,

    CONSTRAINT "ChatAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatInvite" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ChatInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DMAcceptance" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otherUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "DMAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT,
    "fromAgentId" TEXT,
    "toUserId" TEXT,
    "toAgentId" TEXT,
    "score" INTEGER NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "category" TEXT,
    "gameId" TEXT,
    "tradeId" TEXT,
    "positionId" TEXT,
    "interactionType" TEXT NOT NULL,
    "onChainTxHash" TEXT,
    "agent0TokenId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unfollowedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "followReason" TEXT,

    CONSTRAINT "FollowStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "currentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "isContinuous" BOOLEAN NOT NULL DEFAULT true,
    "speed" INTEGER NOT NULL DEFAULT 60000,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastTickAt" TIMESTAMP(3),
    "lastSnapshotAt" TIMESTAMP(3),
    "activeQuestions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChatMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "npcAdminId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sweepReason" TEXT,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "GroupChatMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "gameId" TEXT,
    "dayNumber" INTEGER,
    "yesShares" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "noShares" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "liquidity" DECIMAL(18,6) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" BOOLEAN,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "onChainMarketId" TEXT,
    "onChainResolutionTxHash" TEXT,
    "onChainResolved" BOOLEAN NOT NULL DEFAULT false,
    "oracleAddress" TEXT,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionPriceHistory" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "yesPrice" DOUBLE PRECISION NOT NULL,
    "noPrice" DOUBLE PRECISION NOT NULL,
    "yesShares" DECIMAL(24,8) NOT NULL,
    "noShares" DECIMAL(24,8) NOT NULL,
    "liquidity" DECIMAL(24,8) NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NPCTrade" (
    "id" TEXT NOT NULL,
    "npcActorId" TEXT NOT NULL,
    "poolId" TEXT,
    "marketType" TEXT NOT NULL,
    "ticker" TEXT,
    "marketId" TEXT,
    "action" TEXT NOT NULL,
    "side" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "sentiment" DOUBLE PRECISION,
    "reason" TEXT,
    "postId" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NPCTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "postId" TEXT,
    "commentId" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "groupId" TEXT,
    "inviteId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "userId" TEXT,
    "returnPath" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING_PROFILE',
    "referralCode" TEXT,
    "payload" JSONB,
    "profileApplied" BOOLEAN NOT NULL DEFAULT false,
    "profileCompletedAt" TIMESTAMP(3),
    "onchainStartedAt" TIMESTAMP(3),
    "onchainCompletedAt" TIMESTAMP(3),
    "lastError" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OracleCommitment" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "saltEncrypted" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OracleCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OracleTransaction" (
    "id" TEXT NOT NULL,
    "questionId" TEXT,
    "txType" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blockNumber" INTEGER,
    "gasUsed" BIGINT,
    "gasPrice" BIGINT,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "OracleTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "canBeInvolved" BOOLEAN NOT NULL DEFAULT true,
    "initialPrice" DOUBLE PRECISION,
    "currentPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerpPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "leverage" INTEGER NOT NULL,
    "liquidationPrice" DOUBLE PRECISION NOT NULL,
    "unrealizedPnL" DOUBLE PRECISION NOT NULL,
    "unrealizedPnLPercent" DOUBLE PRECISION NOT NULL,
    "fundingPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "realizedPnL" DOUBLE PRECISION,
    "settledAt" TIMESTAMP(3),
    "settledToChain" BOOLEAN NOT NULL DEFAULT false,
    "settlementTxHash" TEXT,

    CONSTRAINT "PerpPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "pointsBefore" INTEGER NOT NULL,
    "pointsAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentAmount" TEXT,
    "paymentRequestId" TEXT,
    "paymentTxHash" TEXT,
    "paymentVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "npcActorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDeposits" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimePnL" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "performanceFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "totalFeesCollected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "priceChange24h" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tvl" DECIMAL(18,2),
    "volume24h" DECIMAL(18,2),

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolDeposit" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "shares" DECIMAL(18,6) NOT NULL,
    "currentValue" DECIMAL(18,2) NOT NULL,
    "unrealizedPnL" DECIMAL(18,2) NOT NULL,
    "depositedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnAmount" DECIMAL(18,2),

    CONSTRAINT "PoolDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolPosition" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "ticker" TEXT,
    "marketId" TEXT,
    "side" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION,
    "leverage" INTEGER,
    "liquidationPrice" DOUBLE PRECISION,
    "unrealizedPnL" DOUBLE PRECISION NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "realizedPnL" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" BOOLEAN NOT NULL,
    "shares" DECIMAL(18,6) NOT NULL,
    "avgPrice" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outcome" BOOLEAN,
    "pnl" DECIMAL(18,2),
    "questionId" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "gameId" TEXT,
    "dayNumber" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleTitle" TEXT,
    "biasScore" DOUBLE PRECISION,
    "byline" TEXT,
    "category" TEXT,
    "fullContent" TEXT,
    "sentiment" TEXT,
    "slant" TEXT,
    "type" TEXT NOT NULL DEFAULT 'post',
    "deletedAt" TIMESTAMP(3),
    "commentOnPostId" TEXT,
    "parentCommentId" TEXT,
    "originalPostId" TEXT,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileUpdateLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changedFields" TEXT[],
    "backendSigned" BOOLEAN NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileUpdateLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "outcome" BOOLEAN NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolutionDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "resolvedOutcome" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "oracleCommitBlock" INTEGER,
    "oracleCommitTxHash" TEXT,
    "oracleCommitment" TEXT,
    "oracleError" TEXT,
    "oraclePublishedAt" TIMESTAMP(3),
    "oracleRevealBlock" INTEGER,
    "oracleRevealTxHash" TEXT,
    "oracleSaltEncrypted" TEXT,
    "oracleSessionId" TEXT,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'like',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT,
    "url" TEXT,
    "pointsAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationDetails" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ShareAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPrice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "change" DOUBLE PRECISION NOT NULL,
    "changePercent" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "openPrice" DOUBLE PRECISION,
    "highPrice" DOUBLE PRECISION,
    "lowPrice" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,

    CONSTRAINT "StockPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingFee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeType" TEXT NOT NULL,
    "tradeId" TEXT,
    "marketId" TEXT,
    "feeAmount" DECIMAL(18,2) NOT NULL,
    "platformFee" DECIMAL(18,2) NOT NULL,
    "referrerFee" DECIMAL(18,2) NOT NULL,
    "referrerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradingFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendingTag" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "postCount" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "relatedContext" TEXT,

    CONSTRAINT "TrendingTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitterOAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oauth1Token" TEXT NOT NULL,
    "oauth1TokenSecret" TEXT NOT NULL,
    "screenName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitterOAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT,
    "username" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "profileImageUrl" TEXT,
    "isActor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "personality" TEXT,
    "postStyle" TEXT,
    "postExample" TEXT,
    "virtualBalance" DECIMAL(18,2) NOT NULL DEFAULT 1000,
    "totalDeposited" DECIMAL(18,2) NOT NULL DEFAULT 1000,
    "totalWithdrawn" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimePnL" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "hasProfileImage" BOOLEAN NOT NULL DEFAULT false,
    "hasUsername" BOOLEAN NOT NULL DEFAULT false,
    "hasBio" BOOLEAN NOT NULL DEFAULT false,
    "profileSetupCompletedAt" TIMESTAMP(3),
    "farcasterUsername" TEXT,
    "hasFarcaster" BOOLEAN NOT NULL DEFAULT false,
    "hasTwitter" BOOLEAN NOT NULL DEFAULT false,
    "nftTokenId" INTEGER,
    "onChainRegistered" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwardedForFarcaster" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwardedForProfile" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwardedForProfileImage" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwardedForTwitter" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwardedForUsername" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwardedForWallet" BOOLEAN NOT NULL DEFAULT false,
    "referralCode" TEXT,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "referredBy" TEXT,
    "registrationTxHash" TEXT,
    "reputationPoints" INTEGER NOT NULL DEFAULT 1000,
    "twitterUsername" TEXT,
    "bannerDismissCount" INTEGER NOT NULL DEFAULT 0,
    "bannerLastShown" TIMESTAMP(3),
    "coverImageUrl" TEXT,
    "showFarcasterPublic" BOOLEAN NOT NULL DEFAULT true,
    "showTwitterPublic" BOOLEAN NOT NULL DEFAULT true,
    "showWalletPublic" BOOLEAN NOT NULL DEFAULT true,
    "usernameChangedAt" TIMESTAMP(3),
    "agent0FeedbackCount" INTEGER,
    "agent0MetadataCID" TEXT,
    "agent0RegisteredAt" TIMESTAMP(3),
    "agent0TokenId" INTEGER,
    "agent0TrustScore" DOUBLE PRECISION,
    "bannedAt" TIMESTAMP(3),
    "bannedBy" TEXT,
    "bannedReason" TEXT,
    "farcasterDisplayName" TEXT,
    "farcasterFid" TEXT,
    "farcasterPfpUrl" TEXT,
    "farcasterVerifiedAt" TIMESTAMP(3),
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isScammer" BOOLEAN NOT NULL DEFAULT false,
    "isCSAM" BOOLEAN NOT NULL DEFAULT false,
    "appealCount" INTEGER NOT NULL DEFAULT 0,
    "appealStaked" BOOLEAN NOT NULL DEFAULT false,
    "appealStakeAmount" DECIMAL(18,2),
    "appealStakeTxHash" TEXT,
    "appealStatus" TEXT,
    "appealSubmittedAt" TIMESTAMP(3),
    "appealReviewedAt" TIMESTAMP(3),
    "falsePositiveHistory" JSONB,
    "privyId" TEXT,
    "registrationBlockNumber" BIGINT,
    "registrationGasUsed" BIGINT,
    "registrationTimestamp" TIMESTAMP(3),
    "role" TEXT,
    "totalFeesEarned" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalFeesPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "twitterAccessToken" TEXT,
    "twitterId" TEXT,
    "twitterRefreshToken" TEXT,
    "twitterTokenExpiresAt" TIMESTAMP(3),
    "twitterVerifiedAt" TIMESTAMP(3),
    "tosAccepted" BOOLEAN NOT NULL DEFAULT false,
    "tosAcceptedAt" TIMESTAMP(3),
    "tosAcceptedVersion" TEXT DEFAULT '2025-11-11',
    "privacyPolicyAccepted" BOOLEAN NOT NULL DEFAULT false,
    "privacyPolicyAcceptedAt" TIMESTAMP(3),
    "privacyPolicyAcceptedVersion" TEXT DEFAULT '2025-11-11',
    "invitePoints" INTEGER NOT NULL DEFAULT 0,
    "earnedPoints" INTEGER NOT NULL DEFAULT 0,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "waitlistPosition" INTEGER,
    "waitlistJoinedAt" TIMESTAMP(3),
    "isWaitlistActive" BOOLEAN NOT NULL DEFAULT false,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwardedForEmail" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "waitlistGraduatedAt" TIMESTAMP(3),
    "agentCount" INTEGER NOT NULL DEFAULT 0,
    "totalAgentPnL" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "agentErrorMessage" TEXT,
    "agentLastChatAt" TIMESTAMP(3),
    "agentLastTickAt" TIMESTAMP(3),
    "agentMessageExamples" JSONB,
    "agentModelTier" TEXT NOT NULL DEFAULT 'free',
    "agentPersonality" TEXT,
    "agentPointsBalance" INTEGER NOT NULL DEFAULT 0,
    "agentStatus" TEXT NOT NULL DEFAULT 'idle',
    "agentStyle" JSONB,
    "agentSystem" TEXT,
    "agentTotalDeposited" INTEGER NOT NULL DEFAULT 0,
    "agentTotalPointsSpent" INTEGER NOT NULL DEFAULT 0,
    "agentTotalWithdrawn" INTEGER NOT NULL DEFAULT 0,
    "agentTradingStrategy" TEXT,
    "autonomousCommenting" BOOLEAN NOT NULL DEFAULT false,
    "autonomousDMs" BOOLEAN NOT NULL DEFAULT false,
    "autonomousGroupChats" BOOLEAN NOT NULL DEFAULT false,
    "autonomousPosting" BOOLEAN NOT NULL DEFAULT false,
    "autonomousTrading" BOOLEAN NOT NULL DEFAULT false,
    "a2aEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isAgent" BOOLEAN NOT NULL DEFAULT false,
    "managedBy" TEXT,
    "agentGoals" JSONB,
    "agentDirectives" JSONB,
    "agentConstraints" JSONB,
    "agentPersonaPrompt" TEXT,
    "agentPlanningHorizon" TEXT NOT NULL DEFAULT 'single',
    "agentRiskTolerance" TEXT NOT NULL DEFAULT 'medium',
    "agentMaxActionsPerTick" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActorFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActorFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroupAdmin" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT NOT NULL,

    CONSTRAINT "UserGroupAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroupInvite" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "message" TEXT,

    CONSTRAINT "UserGroupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT NOT NULL,

    CONSTRAINT "UserGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "npcId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "wasFollowed" BOOLEAN NOT NULL DEFAULT false,
    "wasInvitedToChat" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetCache" (
    "widget" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetCache_pkey" PRIMARY KEY ("widget")
);

-- CreateTable
CREATE TABLE "WorldEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actors" TEXT[],
    "relatedQuestion" INTEGER,
    "pointsToward" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "gameId" TEXT,
    "dayNumber" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_call_logs" (
    "id" TEXT NOT NULL,
    "trajectoryId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "latencyMs" INTEGER,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "actionType" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "messagesJson" TEXT,
    "response" TEXT NOT NULL,
    "reasoning" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL,
    "maxTokens" INTEGER NOT NULL,
    "topP" DOUBLE PRECISION,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_outcomes" (
    "id" TEXT NOT NULL,
    "windowId" VARCHAR(50) NOT NULL,
    "stockTicker" VARCHAR(20),
    "startPrice" DECIMAL(10,2),
    "endPrice" DECIMAL(10,2),
    "changePercent" DECIMAL(5,2),
    "sentiment" VARCHAR(20),
    "newsEvents" JSONB,
    "predictionMarketId" TEXT,
    "question" TEXT,
    "outcome" VARCHAR(20),
    "finalProbability" DECIMAL(5,4),
    "volume" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trained_models" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "baseModel" TEXT NOT NULL,
    "trainingBatch" TEXT,
    "status" TEXT NOT NULL DEFAULT 'training',
    "deployedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "storagePath" TEXT NOT NULL,
    "benchmarkScore" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "avgReward" DOUBLE PRECISION,
    "evalMetrics" JSONB,
    "wandbRunId" TEXT,
    "wandbArtifactId" TEXT,
    "agentsUsing" INTEGER NOT NULL DEFAULT 0,
    "totalInferences" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trained_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_batches" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "baseModel" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "trajectoryIds" TEXT NOT NULL,
    "rankingsJson" TEXT,
    "rewardsJson" TEXT NOT NULL,
    "trainingLoss" DOUBLE PRECISION,
    "policyImprovement" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "training_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajectories" (
    "id" TEXT NOT NULL,
    "trajectoryId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "windowId" VARCHAR(50),
    "windowHours" INTEGER NOT NULL DEFAULT 1,
    "episodeId" VARCHAR(100),
    "scenarioId" VARCHAR(100),
    "batchId" VARCHAR(100),
    "stepsJson" TEXT NOT NULL,
    "rewardComponentsJson" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "totalReward" DOUBLE PRECISION NOT NULL,
    "episodeLength" INTEGER NOT NULL,
    "finalStatus" TEXT NOT NULL,
    "finalBalance" DOUBLE PRECISION,
    "finalPnL" DOUBLE PRECISION,
    "tradesExecuted" INTEGER,
    "postsCreated" INTEGER,
    "aiJudgeReward" DOUBLE PRECISION,
    "aiJudgeReasoning" TEXT,
    "judgedAt" TIMESTAMP(3),
    "isTrainingData" BOOLEAN NOT NULL DEFAULT true,
    "isEvaluation" BOOLEAN NOT NULL DEFAULT false,
    "usedInTraining" BOOLEAN NOT NULL DEFAULT false,
    "trainedInBatch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trajectories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_judgments" (
    "id" TEXT NOT NULL,
    "trajectoryId" TEXT NOT NULL,
    "judgeModel" TEXT NOT NULL,
    "judgeVersion" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "componentScoresJson" TEXT,
    "rank" INTEGER,
    "normalizedScore" DOUBLE PRECISION,
    "groupId" TEXT,
    "reasoning" TEXT NOT NULL,
    "strengthsJson" TEXT,
    "weaknessesJson" TEXT,
    "criteriaJson" TEXT NOT NULL,
    "judgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_judgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMute" (
    "id" TEXT NOT NULL,
    "muterId" TEXT NOT NULL,
    "mutedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "reportedPostId" TEXT,
    "reportType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "wandbModel" TEXT,
    "wandbEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldFact" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSSFeedSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetched" TIMESTAMP(3),
    "fetchErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RSSFeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSSHeadline" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "rawData" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RSSHeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParodyHeadline" (
    "id" TEXT NOT NULL,
    "originalHeadlineId" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "originalSource" TEXT NOT NULL,
    "parodyTitle" TEXT NOT NULL,
    "parodyContent" TEXT,
    "characterMappings" JSONB NOT NULL,
    "organizationMappings" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParodyHeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterMapping" (
    "id" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "parodyName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "aliases" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMapping" (
    "id" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "parodyName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "aliases" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationEscrow" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "amountUSD" DECIMAL(18,2) NOT NULL,
    "amountWei" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "paymentRequestId" TEXT,
    "paymentTxHash" TEXT,
    "refundTxHash" TEXT,
    "refundedBy" TEXT,
    "refundedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationEscrow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Actor_hasPool_idx" ON "Actor"("hasPool");

-- CreateIndex
CREATE INDEX "Actor_reputationPoints_idx" ON "Actor"("reputationPoints" DESC);

-- CreateIndex
CREATE INDEX "Actor_role_idx" ON "Actor"("role");

-- CreateIndex
CREATE INDEX "Actor_tier_idx" ON "Actor"("tier");

-- CreateIndex
CREATE INDEX "ActorFollow_followerId_idx" ON "ActorFollow"("followerId");

-- CreateIndex
CREATE INDEX "ActorFollow_followingId_idx" ON "ActorFollow"("followingId");

-- CreateIndex
CREATE INDEX "ActorFollow_isMutual_idx" ON "ActorFollow"("isMutual");

-- CreateIndex
CREATE UNIQUE INDEX "ActorFollow_followerId_followingId_key" ON "ActorFollow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "ActorRelationship_actor1Id_idx" ON "ActorRelationship"("actor1Id");

-- CreateIndex
CREATE INDEX "ActorRelationship_actor2Id_idx" ON "ActorRelationship"("actor2Id");

-- CreateIndex
CREATE INDEX "ActorRelationship_relationshipType_idx" ON "ActorRelationship"("relationshipType");

-- CreateIndex
CREATE INDEX "ActorRelationship_sentiment_idx" ON "ActorRelationship"("sentiment");

-- CreateIndex
CREATE INDEX "ActorRelationship_strength_idx" ON "ActorRelationship"("strength");

-- CreateIndex
CREATE UNIQUE INDEX "ActorRelationship_actor1Id_actor2Id_key" ON "ActorRelationship"("actor1Id", "actor2Id");

-- CreateIndex
CREATE INDEX "AgentLog_agentUserId_createdAt_idx" ON "AgentLog"("agentUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentLog_level_idx" ON "AgentLog"("level");

-- CreateIndex
CREATE INDEX "AgentLog_type_createdAt_idx" ON "AgentLog"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentMessage_agentUserId_createdAt_idx" ON "AgentMessage"("agentUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentMessage_role_idx" ON "AgentMessage"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPerformanceMetrics_userId_key" ON "AgentPerformanceMetrics"("userId");

-- CreateIndex
CREATE INDEX "AgentPerformanceMetrics_gamesPlayed_idx" ON "AgentPerformanceMetrics"("gamesPlayed" DESC);

-- CreateIndex
CREATE INDEX "AgentPerformanceMetrics_normalizedPnL_idx" ON "AgentPerformanceMetrics"("normalizedPnL" DESC);

-- CreateIndex
CREATE INDEX "AgentPerformanceMetrics_reputationScore_idx" ON "AgentPerformanceMetrics"("reputationScore" DESC);

-- CreateIndex
CREATE INDEX "AgentPerformanceMetrics_trustLevel_idx" ON "AgentPerformanceMetrics"("trustLevel");

-- CreateIndex
CREATE INDEX "AgentPerformanceMetrics_updatedAt_idx" ON "AgentPerformanceMetrics"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "AgentGoal_agentUserId_status_idx" ON "AgentGoal"("agentUserId", "status");

-- CreateIndex
CREATE INDEX "AgentGoal_priority_idx" ON "AgentGoal"("priority" DESC);

-- CreateIndex
CREATE INDEX "AgentGoal_status_idx" ON "AgentGoal"("status");

-- CreateIndex
CREATE INDEX "AgentGoal_createdAt_idx" ON "AgentGoal"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentGoalAction_goalId_idx" ON "AgentGoalAction"("goalId");

-- CreateIndex
CREATE INDEX "AgentGoalAction_agentUserId_createdAt_idx" ON "AgentGoalAction"("agentUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentGoalAction_actionType_idx" ON "AgentGoalAction"("actionType");

-- CreateIndex
CREATE INDEX "AgentPointsTransaction_agentUserId_createdAt_idx" ON "AgentPointsTransaction"("agentUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentPointsTransaction_managerUserId_createdAt_idx" ON "AgentPointsTransaction"("managerUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentPointsTransaction_type_idx" ON "AgentPointsTransaction"("type");

-- CreateIndex
CREATE INDEX "AgentTrade_agentUserId_executedAt_idx" ON "AgentTrade"("agentUserId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "AgentTrade_marketType_marketId_idx" ON "AgentTrade"("marketType", "marketId");

-- CreateIndex
CREATE INDEX "AgentTrade_ticker_idx" ON "AgentTrade"("ticker");

-- CreateIndex
CREATE INDEX "BalanceTransaction_type_idx" ON "BalanceTransaction"("type");

-- CreateIndex
CREATE INDEX "BalanceTransaction_userId_createdAt_idx" ON "BalanceTransaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Chat_gameId_dayNumber_idx" ON "Chat"("gameId", "dayNumber");

-- CreateIndex
CREATE INDEX "Chat_groupId_idx" ON "Chat"("groupId");

-- CreateIndex
CREATE INDEX "Chat_isGroup_idx" ON "Chat"("isGroup");

-- CreateIndex
CREATE INDEX "Chat_createdBy_idx" ON "Chat"("createdBy");

-- CreateIndex
CREATE INDEX "Chat_npcAdminId_idx" ON "Chat"("npcAdminId");

-- CreateIndex
CREATE INDEX "Chat_relatedQuestion_idx" ON "Chat"("relatedQuestion");

-- CreateIndex
CREATE INDEX "ChatParticipant_chatId_idx" ON "ChatParticipant"("chatId");

-- CreateIndex
CREATE INDEX "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");

-- CreateIndex
CREATE INDEX "ChatParticipant_chatId_isActive_idx" ON "ChatParticipant"("chatId", "isActive");

-- CreateIndex
CREATE INDEX "ChatParticipant_lastMessageAt_idx" ON "ChatParticipant"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatParticipant_userId_isActive_idx" ON "ChatParticipant"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ChatParticipant_chatId_userId_key" ON "ChatParticipant"("chatId", "userId");

-- CreateIndex
CREATE INDEX "ChatAdmin_chatId_idx" ON "ChatAdmin"("chatId");

-- CreateIndex
CREATE INDEX "ChatAdmin_userId_idx" ON "ChatAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAdmin_chatId_userId_key" ON "ChatAdmin"("chatId", "userId");

-- CreateIndex
CREATE INDEX "ChatInvite_chatId_idx" ON "ChatInvite"("chatId");

-- CreateIndex
CREATE INDEX "ChatInvite_invitedUserId_status_idx" ON "ChatInvite"("invitedUserId", "status");

-- CreateIndex
CREATE INDEX "ChatInvite_status_idx" ON "ChatInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChatInvite_chatId_invitedUserId_key" ON "ChatInvite"("chatId", "invitedUserId");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Comment_deletedAt_idx" ON "Comment"("deletedAt");

-- CreateIndex
CREATE INDEX "Comment_parentCommentId_idx" ON "Comment"("parentCommentId");

-- CreateIndex
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comment_postId_deletedAt_idx" ON "Comment"("postId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DMAcceptance_chatId_key" ON "DMAcceptance"("chatId");

-- CreateIndex
CREATE INDEX "DMAcceptance_status_createdAt_idx" ON "DMAcceptance"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DMAcceptance_userId_status_idx" ON "DMAcceptance"("userId", "status");

-- CreateIndex
CREATE INDEX "Favorite_targetUserId_idx" ON "Favorite"("targetUserId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_targetUserId_key" ON "Favorite"("userId", "targetUserId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Feedback_fromUserId_idx" ON "Feedback"("fromUserId");

-- CreateIndex
CREATE INDEX "Feedback_gameId_idx" ON "Feedback"("gameId");

-- CreateIndex
CREATE INDEX "Feedback_interactionType_idx" ON "Feedback"("interactionType");

-- CreateIndex
CREATE INDEX "Feedback_score_idx" ON "Feedback"("score" DESC);

-- CreateIndex
CREATE INDEX "Feedback_toAgentId_idx" ON "Feedback"("toAgentId");

-- CreateIndex
CREATE INDEX "Feedback_toUserId_idx" ON "Feedback"("toUserId");

-- CreateIndex
CREATE INDEX "Feedback_toUserId_interactionType_idx" ON "Feedback"("toUserId", "interactionType");

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "FollowStatus_npcId_idx" ON "FollowStatus"("npcId");

-- CreateIndex
CREATE INDEX "FollowStatus_userId_isActive_idx" ON "FollowStatus"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FollowStatus_userId_npcId_key" ON "FollowStatus"("userId", "npcId");

-- CreateIndex
CREATE INDEX "Game_isContinuous_idx" ON "Game"("isContinuous");

-- CreateIndex
CREATE INDEX "Game_isRunning_idx" ON "Game"("isRunning");

-- CreateIndex
CREATE UNIQUE INDEX "GameConfig_key_key" ON "GameConfig"("key");

-- CreateIndex
CREATE INDEX "GameConfig_key_idx" ON "GameConfig"("key");

-- CreateIndex
CREATE INDEX "GroupChatMembership_chatId_isActive_idx" ON "GroupChatMembership"("chatId", "isActive");

-- CreateIndex
CREATE INDEX "GroupChatMembership_lastMessageAt_idx" ON "GroupChatMembership"("lastMessageAt");

-- CreateIndex
CREATE INDEX "GroupChatMembership_userId_isActive_idx" ON "GroupChatMembership"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GroupChatMembership_userId_chatId_key" ON "GroupChatMembership"("userId", "chatId");

-- CreateIndex
CREATE INDEX "Market_createdAt_idx" ON "Market"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Market_gameId_dayNumber_idx" ON "Market"("gameId", "dayNumber");

-- CreateIndex
CREATE INDEX "Market_onChainMarketId_idx" ON "Market"("onChainMarketId");

-- CreateIndex
CREATE INDEX "Market_resolved_endDate_idx" ON "Market"("resolved", "endDate");

-- CreateIndex
CREATE INDEX "PredictionPriceHistory_marketId_createdAt_idx" ON "PredictionPriceHistory"("marketId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "NPCTrade_executedAt_idx" ON "NPCTrade"("executedAt" DESC);

-- CreateIndex
CREATE INDEX "NPCTrade_marketType_ticker_idx" ON "NPCTrade"("marketType", "ticker");

-- CreateIndex
CREATE INDEX "NPCTrade_npcActorId_executedAt_idx" ON "NPCTrade"("npcActorId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "NPCTrade_poolId_executedAt_idx" ON "NPCTrade"("poolId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_groupId_idx" ON "Notification"("groupId");

-- CreateIndex
CREATE INDEX "Notification_inviteId_idx" ON "Notification"("inviteId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_type_read_idx" ON "Notification"("userId", "type", "read");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthState_state_idx" ON "OAuthState"("state");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingIntent_userId_key" ON "OnboardingIntent"("userId");

-- CreateIndex
CREATE INDEX "OnboardingIntent_createdAt_idx" ON "OnboardingIntent"("createdAt");

-- CreateIndex
CREATE INDEX "OnboardingIntent_status_idx" ON "OnboardingIntent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OracleCommitment_questionId_key" ON "OracleCommitment"("questionId");

-- CreateIndex
CREATE INDEX "OracleCommitment_createdAt_idx" ON "OracleCommitment"("createdAt");

-- CreateIndex
CREATE INDEX "OracleCommitment_questionId_idx" ON "OracleCommitment"("questionId");

-- CreateIndex
CREATE INDEX "OracleCommitment_sessionId_idx" ON "OracleCommitment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "OracleTransaction_txHash_key" ON "OracleTransaction"("txHash");

-- CreateIndex
CREATE INDEX "OracleTransaction_questionId_idx" ON "OracleTransaction"("questionId");

-- CreateIndex
CREATE INDEX "OracleTransaction_status_createdAt_idx" ON "OracleTransaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OracleTransaction_txHash_idx" ON "OracleTransaction"("txHash");

-- CreateIndex
CREATE INDEX "OracleTransaction_txType_idx" ON "OracleTransaction"("txType");

-- CreateIndex
CREATE INDEX "Organization_currentPrice_idx" ON "Organization"("currentPrice");

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- CreateIndex
CREATE INDEX "PerpPosition_organizationId_idx" ON "PerpPosition"("organizationId");

-- CreateIndex
CREATE INDEX "PerpPosition_settledToChain_idx" ON "PerpPosition"("settledToChain");

-- CreateIndex
CREATE INDEX "PerpPosition_ticker_idx" ON "PerpPosition"("ticker");

-- CreateIndex
CREATE INDEX "PerpPosition_userId_closedAt_idx" ON "PerpPosition"("userId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointsTransaction_paymentRequestId_key" ON "PointsTransaction"("paymentRequestId");

-- CreateIndex
CREATE INDEX "PointsTransaction_createdAt_idx" ON "PointsTransaction"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PointsTransaction_paymentRequestId_idx" ON "PointsTransaction"("paymentRequestId");

-- CreateIndex
CREATE INDEX "PointsTransaction_reason_idx" ON "PointsTransaction"("reason");

-- CreateIndex
CREATE INDEX "PointsTransaction_userId_createdAt_idx" ON "PointsTransaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Pool_isActive_idx" ON "Pool"("isActive");

-- CreateIndex
CREATE INDEX "Pool_npcActorId_idx" ON "Pool"("npcActorId");

-- CreateIndex
CREATE INDEX "Pool_status_idx" ON "Pool"("status");

-- CreateIndex
CREATE INDEX "Pool_totalValue_idx" ON "Pool"("totalValue");

-- CreateIndex
CREATE INDEX "Pool_volume24h_idx" ON "Pool"("volume24h");

-- CreateIndex
CREATE INDEX "PoolDeposit_poolId_userId_idx" ON "PoolDeposit"("poolId", "userId");

-- CreateIndex
CREATE INDEX "PoolDeposit_poolId_withdrawnAt_idx" ON "PoolDeposit"("poolId", "withdrawnAt");

-- CreateIndex
CREATE INDEX "PoolDeposit_userId_depositedAt_idx" ON "PoolDeposit"("userId", "depositedAt" DESC);

-- CreateIndex
CREATE INDEX "PoolPosition_marketType_marketId_idx" ON "PoolPosition"("marketType", "marketId");

-- CreateIndex
CREATE INDEX "PoolPosition_marketType_ticker_idx" ON "PoolPosition"("marketType", "ticker");

-- CreateIndex
CREATE INDEX "PoolPosition_poolId_closedAt_idx" ON "PoolPosition"("poolId", "closedAt");

-- CreateIndex
CREATE INDEX "Position_marketId_idx" ON "Position"("marketId");

-- CreateIndex
CREATE INDEX "Position_questionId_idx" ON "Position"("questionId");

-- CreateIndex
CREATE INDEX "Position_status_idx" ON "Position"("status");

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "Position"("userId");

-- CreateIndex
CREATE INDEX "Position_userId_marketId_idx" ON "Position"("userId", "marketId");

-- CreateIndex
CREATE INDEX "Position_userId_status_idx" ON "Position"("userId", "status");

-- CreateIndex
CREATE INDEX "Post_authorId_timestamp_idx" ON "Post"("authorId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Post_authorId_type_timestamp_idx" ON "Post"("authorId", "type", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Post_commentOnPostId_idx" ON "Post"("commentOnPostId");

-- CreateIndex
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");

-- CreateIndex
CREATE INDEX "Post_gameId_dayNumber_idx" ON "Post"("gameId", "dayNumber");

-- CreateIndex
CREATE INDEX "Post_parentCommentId_idx" ON "Post"("parentCommentId");

-- CreateIndex
CREATE INDEX "Post_originalPostId_idx" ON "Post"("originalPostId");

-- CreateIndex
CREATE INDEX "Post_timestamp_idx" ON "Post"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "Post_type_deletedAt_timestamp_idx" ON "Post"("type", "deletedAt", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Post_type_timestamp_idx" ON "Post"("type", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "PostTag_postId_idx" ON "PostTag"("postId");

-- CreateIndex
CREATE INDEX "PostTag_tagId_createdAt_idx" ON "PostTag"("tagId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "PostTag_postId_tagId_key" ON "PostTag"("postId", "tagId");

-- CreateIndex
CREATE INDEX "ProfileUpdateLog_userId_createdAt_idx" ON "ProfileUpdateLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Question_questionNumber_key" ON "Question"("questionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Question_oracleSessionId_key" ON "Question"("oracleSessionId");

-- CreateIndex
CREATE INDEX "Question_createdDate_idx" ON "Question"("createdDate" DESC);

-- CreateIndex
CREATE INDEX "Question_oraclePublishedAt_idx" ON "Question"("oraclePublishedAt");

-- CreateIndex
CREATE INDEX "Question_oracleSessionId_idx" ON "Question"("oracleSessionId");

-- CreateIndex
CREATE INDEX "Question_status_resolutionDate_idx" ON "Question"("status", "resolutionDate");

-- CreateIndex
CREATE INDEX "Reaction_commentId_idx" ON "Reaction"("commentId");

-- CreateIndex
CREATE INDEX "Reaction_postId_idx" ON "Reaction"("postId");

-- CreateIndex
CREATE INDEX "Reaction_userId_idx" ON "Reaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_commentId_userId_type_key" ON "Reaction"("commentId", "userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_postId_userId_type_key" ON "Reaction"("postId", "userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referralCode_key" ON "Referral"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_referralCode_idx" ON "Referral"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_referredUserId_idx" ON "Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_status_createdAt_idx" ON "Referral"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Share_createdAt_idx" ON "Share"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Share_postId_idx" ON "Share"("postId");

-- CreateIndex
CREATE INDEX "Share_userId_idx" ON "Share"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Share_userId_postId_key" ON "Share"("userId", "postId");

-- CreateIndex
CREATE INDEX "ShareAction_contentType_idx" ON "ShareAction"("contentType");

-- CreateIndex
CREATE INDEX "ShareAction_platform_idx" ON "ShareAction"("platform");

-- CreateIndex
CREATE INDEX "ShareAction_userId_createdAt_idx" ON "ShareAction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ShareAction_verified_idx" ON "ShareAction"("verified");

-- CreateIndex
CREATE INDEX "StockPrice_isSnapshot_timestamp_idx" ON "StockPrice"("isSnapshot", "timestamp");

-- CreateIndex
CREATE INDEX "StockPrice_organizationId_timestamp_idx" ON "StockPrice"("organizationId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "StockPrice_timestamp_idx" ON "StockPrice"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "TradingFee_createdAt_idx" ON "TradingFee"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "TradingFee_referrerId_createdAt_idx" ON "TradingFee"("referrerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TradingFee_tradeType_idx" ON "TradingFee"("tradeType");

-- CreateIndex
CREATE INDEX "TradingFee_userId_createdAt_idx" ON "TradingFee"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TrendingTag_calculatedAt_idx" ON "TrendingTag"("calculatedAt" DESC);

-- CreateIndex
CREATE INDEX "TrendingTag_rank_calculatedAt_idx" ON "TrendingTag"("rank", "calculatedAt" DESC);

-- CreateIndex
CREATE INDEX "TrendingTag_tagId_calculatedAt_idx" ON "TrendingTag"("tagId", "calculatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TwitterOAuthToken_userId_key" ON "TwitterOAuthToken"("userId");

-- CreateIndex
CREATE INDEX "TwitterOAuthToken_userId_idx" ON "TwitterOAuthToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_nftTokenId_key" ON "User"("nftTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_farcasterFid_key" ON "User"("farcasterFid");

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_twitterId_key" ON "User"("twitterId");

-- CreateIndex
CREATE INDEX "User_agentCount_idx" ON "User"("agentCount" DESC);

-- CreateIndex
CREATE INDEX "User_autonomousTrading_idx" ON "User"("autonomousTrading");

-- CreateIndex
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- CreateIndex
CREATE INDEX "User_earnedPoints_idx" ON "User"("earnedPoints" DESC);

-- CreateIndex
CREATE INDEX "User_invitePoints_idx" ON "User"("invitePoints" DESC);

-- CreateIndex
CREATE INDEX "User_isActor_idx" ON "User"("isActor");

-- CreateIndex
CREATE INDEX "User_isAgent_idx" ON "User"("isAgent");

-- CreateIndex
CREATE INDEX "User_isAgent_managedBy_idx" ON "User"("isAgent", "managedBy");

-- CreateIndex
CREATE INDEX "User_isBanned_isActor_idx" ON "User"("isBanned", "isActor");

-- CreateIndex
CREATE INDEX "User_isScammer_idx" ON "User"("isScammer");

-- CreateIndex
CREATE INDEX "User_isCSAM_idx" ON "User"("isCSAM");

-- CreateIndex
CREATE INDEX "User_managedBy_idx" ON "User"("managedBy");

-- CreateIndex
CREATE INDEX "User_profileComplete_createdAt_idx" ON "User"("profileComplete", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "User_referralCode_idx" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_reputationPoints_idx" ON "User"("reputationPoints" DESC);

-- CreateIndex
CREATE INDEX "User_totalAgentPnL_idx" ON "User"("totalAgentPnL" DESC);

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_waitlistJoinedAt_idx" ON "User"("waitlistJoinedAt");

-- CreateIndex
CREATE INDEX "User_waitlistPosition_idx" ON "User"("waitlistPosition");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "UserActorFollow_actorId_idx" ON "UserActorFollow"("actorId");

-- CreateIndex
CREATE INDEX "UserActorFollow_userId_idx" ON "UserActorFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserActorFollow_userId_actorId_key" ON "UserActorFollow"("userId", "actorId");

-- CreateIndex
CREATE INDEX "UserGroup_createdAt_idx" ON "UserGroup"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserGroup_createdById_idx" ON "UserGroup"("createdById");

-- CreateIndex
CREATE INDEX "UserGroupAdmin_groupId_idx" ON "UserGroupAdmin"("groupId");

-- CreateIndex
CREATE INDEX "UserGroupAdmin_userId_idx" ON "UserGroupAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupAdmin_groupId_userId_key" ON "UserGroupAdmin"("groupId", "userId");

-- CreateIndex
CREATE INDEX "UserGroupInvite_groupId_idx" ON "UserGroupInvite"("groupId");

-- CreateIndex
CREATE INDEX "UserGroupInvite_invitedUserId_status_idx" ON "UserGroupInvite"("invitedUserId", "status");

-- CreateIndex
CREATE INDEX "UserGroupInvite_status_idx" ON "UserGroupInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupInvite_groupId_invitedUserId_key" ON "UserGroupInvite"("groupId", "invitedUserId");

-- CreateIndex
CREATE INDEX "UserGroupMember_groupId_idx" ON "UserGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "UserGroupMember_userId_idx" ON "UserGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupMember_groupId_userId_key" ON "UserGroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "UserInteraction_npcId_timestamp_idx" ON "UserInteraction"("npcId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "UserInteraction_userId_npcId_timestamp_idx" ON "UserInteraction"("userId", "npcId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "UserInteraction_userId_timestamp_idx" ON "UserInteraction"("userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "WidgetCache_widget_updatedAt_idx" ON "WidgetCache"("widget", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "WorldEvent_gameId_dayNumber_idx" ON "WorldEvent"("gameId", "dayNumber");

-- CreateIndex
CREATE INDEX "WorldEvent_relatedQuestion_idx" ON "WorldEvent"("relatedQuestion");

-- CreateIndex
CREATE INDEX "WorldEvent_timestamp_idx" ON "WorldEvent"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "llm_call_logs_callId_key" ON "llm_call_logs"("callId");

-- CreateIndex
CREATE INDEX "llm_call_logs_callId_idx" ON "llm_call_logs"("callId");

-- CreateIndex
CREATE INDEX "llm_call_logs_timestamp_idx" ON "llm_call_logs"("timestamp");

-- CreateIndex
CREATE INDEX "llm_call_logs_trajectoryId_idx" ON "llm_call_logs"("trajectoryId");

-- CreateIndex
CREATE INDEX "market_outcomes_windowId_idx" ON "market_outcomes"("windowId");

-- CreateIndex
CREATE INDEX "market_outcomes_windowId_stockTicker_idx" ON "market_outcomes"("windowId", "stockTicker");

-- CreateIndex
CREATE UNIQUE INDEX "trained_models_modelId_key" ON "trained_models"("modelId");

-- CreateIndex
CREATE INDEX "trained_models_status_idx" ON "trained_models"("status");

-- CreateIndex
CREATE INDEX "trained_models_version_idx" ON "trained_models"("version");

-- CreateIndex
CREATE INDEX "trained_models_deployedAt_idx" ON "trained_models"("deployedAt");

-- CreateIndex
CREATE UNIQUE INDEX "training_batches_batchId_key" ON "training_batches"("batchId");

-- CreateIndex
CREATE INDEX "training_batches_scenarioId_idx" ON "training_batches"("scenarioId");

-- CreateIndex
CREATE INDEX "training_batches_status_createdAt_idx" ON "training_batches"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "trajectories_trajectoryId_key" ON "trajectories"("trajectoryId");

-- CreateIndex
CREATE INDEX "trajectories_agentId_startTime_idx" ON "trajectories"("agentId", "startTime");

-- CreateIndex
CREATE INDEX "trajectories_aiJudgeReward_idx" ON "trajectories"("aiJudgeReward");

-- CreateIndex
CREATE INDEX "trajectories_isTrainingData_usedInTraining_idx" ON "trajectories"("isTrainingData", "usedInTraining");

-- CreateIndex
CREATE INDEX "trajectories_scenarioId_createdAt_idx" ON "trajectories"("scenarioId", "createdAt");

-- CreateIndex
CREATE INDEX "trajectories_trainedInBatch_idx" ON "trajectories"("trainedInBatch");

-- CreateIndex
CREATE INDEX "trajectories_windowId_agentId_idx" ON "trajectories"("windowId", "agentId");

-- CreateIndex
CREATE INDEX "trajectories_windowId_idx" ON "trajectories"("windowId");

-- CreateIndex
CREATE UNIQUE INDEX "reward_judgments_trajectoryId_key" ON "reward_judgments"("trajectoryId");

-- CreateIndex
CREATE INDEX "reward_judgments_overallScore_idx" ON "reward_judgments"("overallScore");

-- CreateIndex
CREATE INDEX "reward_judgments_groupId_rank_idx" ON "reward_judgments"("groupId", "rank");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

-- CreateIndex
CREATE INDEX "UserBlock_createdAt_idx" ON "UserBlock"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "UserMute_muterId_idx" ON "UserMute"("muterId");

-- CreateIndex
CREATE INDEX "UserMute_mutedId_idx" ON "UserMute"("mutedId");

-- CreateIndex
CREATE INDEX "UserMute_createdAt_idx" ON "UserMute"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserMute_muterId_mutedId_key" ON "UserMute"("muterId", "mutedId");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_idx" ON "Report"("reportedUserId");

-- CreateIndex
CREATE INDEX "Report_reportedPostId_idx" ON "Report"("reportedPostId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_priority_status_idx" ON "Report"("priority", "status");

-- CreateIndex
CREATE INDEX "Report_category_idx" ON "Report"("category");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Report_reportedUserId_status_idx" ON "Report"("reportedUserId", "status");

-- CreateIndex
CREATE INDEX "Report_reportedPostId_status_idx" ON "Report"("reportedPostId", "status");

-- CreateIndex
CREATE INDEX "WorldFact_category_isActive_idx" ON "WorldFact"("category", "isActive");

-- CreateIndex
CREATE INDEX "WorldFact_priority_idx" ON "WorldFact"("priority" DESC);

-- CreateIndex
CREATE INDEX "WorldFact_lastUpdated_idx" ON "WorldFact"("lastUpdated" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WorldFact_category_key_key" ON "WorldFact"("category", "key");

-- CreateIndex
CREATE INDEX "RSSFeedSource_isActive_lastFetched_idx" ON "RSSFeedSource"("isActive", "lastFetched");

-- CreateIndex
CREATE INDEX "RSSFeedSource_category_idx" ON "RSSFeedSource"("category");

-- CreateIndex
CREATE INDEX "RSSHeadline_sourceId_publishedAt_idx" ON "RSSHeadline"("sourceId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "RSSHeadline_publishedAt_idx" ON "RSSHeadline"("publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ParodyHeadline_originalHeadlineId_key" ON "ParodyHeadline"("originalHeadlineId");

-- CreateIndex
CREATE INDEX "ParodyHeadline_isUsed_generatedAt_idx" ON "ParodyHeadline"("isUsed", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "ParodyHeadline_generatedAt_idx" ON "ParodyHeadline"("generatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterMapping_realName_key" ON "CharacterMapping"("realName");

-- CreateIndex
CREATE INDEX "CharacterMapping_category_isActive_idx" ON "CharacterMapping"("category", "isActive");

-- CreateIndex
CREATE INDEX "CharacterMapping_priority_idx" ON "CharacterMapping"("priority" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMapping_realName_key" ON "OrganizationMapping"("realName");

-- CreateIndex
CREATE INDEX "OrganizationMapping_category_isActive_idx" ON "OrganizationMapping"("category", "isActive");

-- CreateIndex
CREATE INDEX "OrganizationMapping_priority_idx" ON "OrganizationMapping"("priority" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationEscrow_paymentRequestId_key" ON "ModerationEscrow"("paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationEscrow_paymentTxHash_key" ON "ModerationEscrow"("paymentTxHash");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationEscrow_refundTxHash_key" ON "ModerationEscrow"("refundTxHash");

-- CreateIndex
CREATE INDEX "ModerationEscrow_recipientId_createdAt_idx" ON "ModerationEscrow"("recipientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModerationEscrow_adminId_idx" ON "ModerationEscrow"("adminId");

-- CreateIndex
CREATE INDEX "ModerationEscrow_status_idx" ON "ModerationEscrow"("status");

-- CreateIndex
CREATE INDEX "ModerationEscrow_paymentRequestId_idx" ON "ModerationEscrow"("paymentRequestId");

-- CreateIndex
CREATE INDEX "ModerationEscrow_paymentTxHash_idx" ON "ModerationEscrow"("paymentTxHash");

-- CreateIndex
CREATE INDEX "ModerationEscrow_createdAt_idx" ON "ModerationEscrow"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ActorFollow" ADD CONSTRAINT "ActorFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorFollow" ADD CONSTRAINT "ActorFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorRelationship" ADD CONSTRAINT "ActorRelationship_actor1Id_fkey" FOREIGN KEY ("actor1Id") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorRelationship" ADD CONSTRAINT "ActorRelationship_actor2Id_fkey" FOREIGN KEY ("actor2Id") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPerformanceMetrics" ADD CONSTRAINT "AgentPerformanceMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGoal" ADD CONSTRAINT "AgentGoal_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGoalAction" ADD CONSTRAINT "AgentGoalAction_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "AgentGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGoalAction" ADD CONSTRAINT "AgentGoalAction_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPointsTransaction" ADD CONSTRAINT "AgentPointsTransaction_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPointsTransaction" ADD CONSTRAINT "AgentPointsTransaction_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrade" ADD CONSTRAINT "AgentTrade_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransaction" ADD CONSTRAINT "BalanceTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAdmin" ADD CONSTRAINT "ChatAdmin_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionPriceHistory" ADD CONSTRAINT "PredictionPriceHistory_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NPCTrade" ADD CONSTRAINT "NPCTrade_npcActorId_fkey" FOREIGN KEY ("npcActorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NPCTrade" ADD CONSTRAINT "NPCTrade_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingIntent" ADD CONSTRAINT "OnboardingIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_npcActorId_fkey" FOREIGN KEY ("npcActorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolDeposit" ADD CONSTRAINT "PoolDeposit_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolPosition" ADD CONSTRAINT "PoolPosition_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("questionNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_commentOnPostId_fkey" FOREIGN KEY ("commentOnPostId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_originalPostId_fkey" FOREIGN KEY ("originalPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileUpdateLog" ADD CONSTRAINT "ProfileUpdateLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAction" ADD CONSTRAINT "ShareAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPrice" ADD CONSTRAINT "StockPrice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingFee" ADD CONSTRAINT "TradingFee_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingFee" ADD CONSTRAINT "TradingFee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendingTag" ADD CONSTRAINT "TrendingTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwitterOAuthToken" ADD CONSTRAINT "TwitterOAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managedBy_fkey" FOREIGN KEY ("managedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActorFollow" ADD CONSTRAINT "UserActorFollow_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActorFollow" ADD CONSTRAINT "UserActorFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupAdmin" ADD CONSTRAINT "UserGroupAdmin_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupMember" ADD CONSTRAINT "UserGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_judgments" ADD CONSTRAINT "reward_judgments_trajectoryId_fkey" FOREIGN KEY ("trajectoryId") REFERENCES "trajectories"("trajectoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMute" ADD CONSTRAINT "UserMute_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMute" ADD CONSTRAINT "UserMute_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSSHeadline" ADD CONSTRAINT "RSSHeadline_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RSSFeedSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParodyHeadline" ADD CONSTRAINT "ParodyHeadline_originalHeadlineId_fkey" FOREIGN KEY ("originalHeadlineId") REFERENCES "RSSHeadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEscrow" ADD CONSTRAINT "ModerationEscrow_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEscrow" ADD CONSTRAINT "ModerationEscrow_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEscrow" ADD CONSTRAINT "ModerationEscrow_refundedBy_fkey" FOREIGN KEY ("refundedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
