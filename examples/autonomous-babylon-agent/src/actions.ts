/**
 * Action Executor
 * 
 * Executes decisions via Babylon A2A protocol
 */

import type { BabylonA2AClient } from './a2a-client.js'
import type { Decision } from './decision.js'

export interface ActionResult {
  success: boolean
  message: string
  data?: any
  error?: string
}

/**
 * Execute agent decision via A2A
 */
export async function executeAction(
  client: BabylonA2AClient,
  decision: Decision
): Promise<ActionResult> {
    switch (decision.action) {
      case 'BUY_YES':
      case 'BUY_NO': {
        const outcome = decision.action === 'BUY_YES' ? 'YES' : 'NO'
        const result = await client.buyShares(
          decision.params.marketId,
          outcome,
        decision.params.amount
        )
        
        return {
          success: true,
          message: `Bought ${outcome} shares in market ${decision.params.marketId}`,
          data: result
        }
      }

      case 'SELL': {
        const result = await client.sellShares(
          decision.params.marketId,
        decision.params.shares
        )
        
        return {
          success: true,
          message: `Sold ${decision.params.shares} shares`,
          data: result
        }
      }

      case 'OPEN_LONG':
      case 'OPEN_SHORT': {
        const side = decision.action === 'OPEN_LONG' ? 'long' : 'short'
        const result = await client.openPosition(
          decision.params.ticker,
          side,
        decision.params.size,
        decision.params.leverage
        )
        
        return {
          success: true,
          message: `Opened ${side} position on ${decision.params.ticker}`,
          data: result
        }
      }

      case 'CLOSE_POSITION': {
        const result = await client.closePosition(decision.params.positionId)
        
        return {
          success: true,
          message: `Closed position ${decision.params.positionId}`,
          data: result
        }
      }

      case 'CREATE_POST': {
        const result = await client.createPost(decision.params.content, 'post')
        
        return {
          success: true,
          message: `Created post`,
          data: result
        }
      }

      case 'CREATE_COMMENT': {
        const result = await client.createComment(
          decision.params.postId,
          decision.params.content
        )
        
        return {
          success: true,
          message: `Created comment on ${decision.params.postId}`,
          data: result
        }
      }

      case 'HOLD':
      default:
        return {
          success: true,
          message: 'Holding - no action taken'
    }
  }
}

