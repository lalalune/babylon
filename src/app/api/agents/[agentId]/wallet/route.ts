/**
 * Agent Points Wallet API
 * 
 * @route GET /api/agents/[agentId]/wallet - Get balance and transaction history
 * @route POST /api/agents/[agentId]/wallet - Deposit or withdraw points
 * @access Authenticated (owner only)
 * 
 * @description
 * Manage agent points wallet, view balance, and access transaction history.
 * Points are used for all agent operations: chat interactions, trading,
 * posting, and other autonomous actions.
 * 
 * **Points System:**
 * - Chat messages: 1 point per message
 * - Trading operations: Variable based on complexity
 * - Social posts: 1-5 points depending on content
 * - Autonomous actions: Points deducted per action
 * 
 * **GET - Retrieve Wallet Information**
 * 
 * Returns complete wallet details including current balance, lifetime
 * totals, and recent transaction history.
 * 
 * @param {string} agentId - Agent user ID (path parameter)
 * 
 * @returns {object} Wallet information
 * @property {boolean} success - Operation success
 * @property {object} balance - Balance details
 * @property {number} balance.current - Current points balance
 * @property {number} balance.totalDeposited - Lifetime deposits
 * @property {number} balance.totalWithdrawn - Lifetime withdrawals
 * @property {number} balance.totalSpent - Lifetime points spent
 * @property {array} transactions - Recent transactions (last 100)
 * 
 * **POST - Deposit or Withdraw Points**
 * 
 * Add points to or remove points from agent's wallet. User must have
 * sufficient points balance for deposits.
 * 
 * @param {string} agentId - Agent user ID (path parameter)
 * @param {string} action - Transaction type: 'deposit' | 'withdraw' (required)
 * @param {number} amount - Points amount (required, must be positive)
 * 
 * @returns {object} Updated balance information
 * @property {boolean} success - Operation success
 * @property {object} balance - Updated balance details
 * @property {string} message - Confirmation message
 * 
 * @throws {400} Invalid action or amount
 * @throws {404} Agent not found or unauthorized
 * @throws {500} Internal server error or insufficient balance
 * 
 * @example
 * ```typescript
 * // Get wallet info
 * const wallet = await fetch(`/api/agents/${agentId}/wallet`, {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { balance, transactions } = await wallet.json();
 * 
 * // Deposit points
 * await fetch(`/api/agents/${agentId}/wallet`, {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     action: 'deposit',
 *     amount: 500
 *   })
 * });
 * 
 * // Withdraw points
 * await fetch(`/api/agents/${agentId}/wallet`, {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     action: 'withdraw',
 *     amount: 100
 *   })
 * });
 * ```
 * 
 * @see {@link /lib/agents/services/AgentService} Points management
 * @see {@link /src/app/agents/[agentId]/page.tsx} Wallet UI
 */

import type { NextRequest} from 'next/server'
import { NextResponse } from 'next/server'
import { agentService } from '@/lib/agents/services/AgentService'
import { logger } from '@/lib/logger'
import { authenticateUser } from '@/lib/server-auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const user = await authenticateUser(req)
  const { agentId } = await params

  const agent = await agentService.getAgent(agentId, user.id)

  const transactions = await prisma.agentPointsTransaction.findMany({
    where: { agentUserId: agentId },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  return NextResponse.json({
    success: true,
    balance: {
      current: agent!.agentPointsBalance,
      totalDeposited: agent!.agentTotalDeposited,
      totalWithdrawn: agent!.agentTotalWithdrawn,
      totalSpent: agent!.agentTotalPointsSpent
    },
    transactions: transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
      relatedId: tx.relatedId,
      createdAt: tx.createdAt.toISOString()
    }))
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const user = await authenticateUser(req)
  const { agentId } = await params
  const body = await req.json()

  const { action, amount } = body

  let agent
  if (action === 'deposit') {
    agent = await agentService.depositPoints(agentId, user.id, amount)
    logger.info(`Deposited ${amount} points to agent ${agentId}`, undefined, 'AgentsAPI')
  } else {
    agent = await agentService.withdrawPoints(agentId, user.id, amount)
    logger.info(`Withdrew ${amount} points from agent ${agentId}`, undefined, 'AgentsAPI')
  }

  return NextResponse.json({
    success: true,
    balance: {
      current: agent.agentPointsBalance,
      totalDeposited: agent.agentTotalDeposited,
      totalWithdrawn: agent.agentTotalWithdrawn
    },
    message: `${action === 'deposit' ? 'Deposited' : 'Withdrew'} ${amount} points successfully`
  })
}

