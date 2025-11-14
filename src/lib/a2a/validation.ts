import { z } from 'zod';
import { JsonValueSchema } from '@/types/common';

export const DiscoverParamsSchema = z.object({
  filters: z.object({
    strategies: z.array(z.string()).optional(),
    minReputation: z.number().optional(),
    markets: z.array(z.string()).optional(),
  }).optional(),
  limit: z.number().optional(),
});

export const GetAgentInfoParamsSchema = z.object({
  agentId: z.string(),
});

export const GetMarketDataParamsSchema = z.object({
  marketId: z.string(),
});

export const GetMarketPricesParamsSchema = z.object({
    marketId: z.string(),
});

export const SubscribeMarketParamsSchema = z.object({
  marketId: z.string(),
});

export const ProposeCoalitionParamsSchema = z.object({
  name: z.string(),
  targetMarket: z.string(),
  strategy: z.string(),
  minMembers: z.number(),
  maxMembers: z.number(),
});

export const JoinCoalitionParamsSchema = z.object({
  coalitionId: z.string(),
});

export const CoalitionMessageParamsSchema = z.object({
  coalitionId: z.string(),
  messageType: z.enum(['analysis', 'vote', 'action', 'coordination']),
  content: z.record(z.string(), JsonValueSchema),
});

export const LeaveCoalitionParamsSchema = z.object({
  coalitionId: z.string(),
});

export const RequestAnalysisParamsSchema = z.object({
  marketId: z.string(),
  paymentOffer: z.string().optional(),
  deadline: z.number(),
});

export const PaymentRequestParamsSchema = z.object({
  to: z.string(),
  amount: z.string(),
  service: z.string(),
  metadata: z.record(z.string(), JsonValueSchema).optional(),
  from: z.string().optional(),
});

export const PaymentReceiptParamsSchema = z.object({
  requestId: z.string(),
  txHash: z.string(),
});

export const GetAnalysesParamsSchema = z.object({
    marketId: z.string(),
    limit: z.number().optional(),
});

// ==================== Market Operations ====================
export const GetPredictionsParamsSchema = z.object({
  userId: z.string().optional(),
  status: z.enum(['active', 'resolved']).optional(),
});

export const GetPerpetualsParamsSchema = z.object({});

export const BuySharesParamsSchema = z.object({
  marketId: z.string(),
  outcome: z.enum(['YES', 'NO']),
  amount: z.number().positive(),
});

export const SellSharesParamsSchema = z.object({
  positionId: z.string(),
  shares: z.number().positive(),
});

export const OpenPositionParamsSchema = z.object({
  ticker: z.string(),
  side: z.enum(['LONG', 'SHORT']),
  amount: z.number().positive(),
  leverage: z.number().min(1).max(100),
});

export const ClosePositionParamsSchema = z.object({
  positionId: z.string(),
});

export const GetPositionsParamsSchema = z.object({
  userId: z.string().optional(),
});

// ==================== Social Features ====================
export const GetFeedParamsSchema = z.object({
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
  following: z.boolean().optional(),
  type: z.enum(['post', 'article']).optional(),
});

export const GetPostParamsSchema = z.object({
  postId: z.string(),
});

export const CreatePostParamsSchema = z.object({
  content: z.string().min(1).max(5000),
  type: z.enum(['post', 'article']).optional().default('post'),
});

export const DeletePostParamsSchema = z.object({
  postId: z.string(),
});

export const LikePostParamsSchema = z.object({
  postId: z.string(),
});

export const SharePostParamsSchema = z.object({
  postId: z.string(),
  comment: z.string().optional(),
});

export const GetCommentsParamsSchema = z.object({
  postId: z.string(),
  limit: z.number().optional().default(50),
});

export const CreateCommentParamsSchema = z.object({
  postId: z.string(),
  content: z.string().min(1).max(2000),
});

export const DeleteCommentParamsSchema = z.object({
  commentId: z.string(),
});

export const LikeCommentParamsSchema = z.object({
  commentId: z.string(),
});

// ==================== User Management ====================
export const GetUserProfileParamsSchema = z.object({
  userId: z.string(),
});

export const UpdateProfileParamsSchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().max(500).optional(),
  username: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

export const GetBalanceParamsSchema = z.object({});

export const GetUserPositionsParamsSchema = z.object({
  userId: z.string(),
});

export const FollowUserParamsSchema = z.object({
  userId: z.string(),
});

export const UnfollowUserParamsSchema = z.object({
  userId: z.string(),
});

export const GetFollowersParamsSchema = z.object({
  userId: z.string(),
  limit: z.number().optional().default(50),
});

export const GetFollowingParamsSchema = z.object({
  userId: z.string(),
  limit: z.number().optional().default(50),
});

export const SearchUsersParamsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(20),
});

// ==================== Pools ====================
export const GetPoolsParamsSchema = z.object({});

export const GetPoolInfoParamsSchema = z.object({
  poolId: z.string(),
});

export const DepositToPoolParamsSchema = z.object({
  poolId: z.string(),
  amount: z.number().positive(),
});

export const WithdrawFromPoolParamsSchema = z.object({
  poolId: z.string(),
  amount: z.number().positive(),
});

export const GetPoolDepositsParamsSchema = z.object({
  userId: z.string(),
});

// ==================== Trades ====================
export const GetTradesParamsSchema = z.object({
  limit: z.number().optional().default(50),
  marketId: z.string().optional(),
});

export const GetTradeHistoryParamsSchema = z.object({
  userId: z.string(),
  limit: z.number().optional().default(50),
});

// ==================== Chats & Messaging ====================
export const GetChatsParamsSchema = z.object({
  filter: z.enum(['all', 'dms', 'groups']).optional(),
});

export const GetChatMessagesParamsSchema = z.object({
  chatId: z.string(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

export const SendMessageParamsSchema = z.object({
  chatId: z.string(),
  content: z.string().min(1).max(5000),
});

export const CreateGroupParamsSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string()).min(1),
});

export const LeaveChatParamsSchema = z.object({
  chatId: z.string(),
});

export const GetUnreadCountParamsSchema = z.object({});

// ==================== Notifications ====================
export const GetNotificationsParamsSchema = z.object({
  limit: z.number().optional().default(100),
});

export const MarkNotificationsReadParamsSchema = z.object({
  notificationIds: z.array(z.string()),
});

export const GetGroupInvitesParamsSchema = z.object({});

export const AcceptGroupInviteParamsSchema = z.object({
  inviteId: z.string(),
});

export const DeclineGroupInviteParamsSchema = z.object({
  inviteId: z.string(),
});

// ==================== Leaderboard & Stats ====================
export const GetLeaderboardParamsSchema = z.object({
  page: z.number().optional().default(1),
  pageSize: z.number().optional().default(100),
  pointsType: z.enum(['all', 'earned', 'referral']).optional().default('all'),
  minPoints: z.number().optional().default(0),
});

export const GetUserStatsParamsSchema = z.object({
  userId: z.string(),
});

export const GetSystemStatsParamsSchema = z.object({});

// ==================== Rewards & Referrals ====================
export const GetReferralsParamsSchema = z.object({});

export const GetReferralStatsParamsSchema = z.object({});

export const GetReferralCodeParamsSchema = z.object({});

// ==================== Reputation ====================
export const GetReputationParamsSchema = z.object({
  userId: z.string().optional(),
});

export const GetReputationBreakdownParamsSchema = z.object({
  userId: z.string(),
});

// ==================== Trending & Discovery ====================
export const GetTrendingTagsParamsSchema = z.object({
  limit: z.number().optional().default(20),
});

export const GetPostsByTagParamsSchema = z.object({
  tag: z.string(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
});

// ==================== Organizations ====================
export const GetOrganizationsParamsSchema = z.object({
  limit: z.number().optional().default(50),
});

