/**
 * Points Leaderboard API
 * 
 * @description
 * Returns platform-wide leaderboard ranking users by reputation points,
 * earned points, or referral points. Provides paginated results with
 * comprehensive user statistics and rankings.
 * 
 * **Leaderboard Types:**
 * - **all:** Total reputation points (default)
 * - **earned:** Points earned through activity
 * - **referral:** Points earned from referrals
 * 
 * **Features:**
 * - Configurable minimum points threshold
 * - Pagination support
 * - Multiple sorting categories
 * - User statistics and metadata
 * - Real-time rankings
 * 
 * **User Stats Include:**
 * - Total points and breakdown
 * - Profile information
 * - Activity metrics
 * - Rank position
 * 
 * @openapi
 * /api/leaderboard:
 *   get:
 *     tags:
 *       - Leaderboard
 *     summary: Get points leaderboard
 *     description: Returns paginated leaderboard ranking users by reputation points
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 100
 *         description: Results per page
 *       - in: query
 *         name: minPoints
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 500
 *         description: Minimum points threshold
 *       - in: query
 *         name: pointsType
 *         schema:
 *           type: string
 *           enum: [all, earned, referral]
 *           default: all
 *         description: Points category to rank by
 *     responses:
 *       200:
 *         description: Leaderboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                       id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       points:
 *                         type: number
 *                       profileImageUrl:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                 minPoints:
 *                   type: integer
 *                 pointsCategory:
 *                   type: string
 * 
 * @example
 * ```typescript
 * // Get top 50 users by reputation
 * const response = await fetch('/api/leaderboard?page=1&pageSize=50');
 * const { leaderboard, pagination } = await response.json();
 * 
 * // Get referral leaders
 * const referralLeaders = await fetch('/api/leaderboard?pointsType=referral&minPoints=1000');
 * 
 * // Display leaderboard
 * leaderboard.forEach(user => {
 *   console.log(`#${user.rank}: ${user.displayName} - ${user.points} points`);
 * });
 * ```
 * 
 * @see {@link /lib/services/points-service} Points calculation
 * @see {@link /src/app/leaderboard/page.tsx} Leaderboard UI
 */

import type { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { LeaderboardQuerySchema } from '@/lib/validation/schemas/common'
import { PointsService } from '@/lib/services/points-service'
import { logger } from '@/lib/logger'

/**
 * GET /api/leaderboard
 * Get leaderboard with pagination and filtering
 * Query params:
 *  - page: number (default 1)
 *  - pageSize: number (default 100, max 100)
 *  - minPoints: number (default 500)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  // Parse and validate query parameters
  const queryParams = Object.fromEntries(searchParams.entries())
  const { page, pageSize, minPoints, pointsType } = LeaderboardQuerySchema.parse(queryParams)

  const pointsCategory = (pointsType ?? 'all') as 'all' | 'earned' | 'referral'

  const leaderboard = await PointsService.getLeaderboard(page, pageSize, minPoints, pointsCategory)

  logger.info('Leaderboard fetched successfully', {
    page,
    pageSize,
    minPoints,
    pointsCategory,
    totalCount: leaderboard.totalCount
  }, 'GET /api/leaderboard')

  return successResponse({
    leaderboard: leaderboard.users,
    pagination: {
      page: leaderboard.page,
      pageSize: leaderboard.pageSize,
      totalCount: leaderboard.totalCount,
      totalPages: leaderboard.totalPages,
    },
    minPoints: pointsCategory === 'all' ? minPoints : 0,
    pointsCategory: leaderboard.pointsCategory,
  })
});

