'use client'

import { useAccount } from 'wagmi'
import { usePosition } from '@/lib/betting/hooks/usePosition'
import type { Market } from '@/lib/betting/types'

export function PositionSummary({ market }: { market: Market }) {
  const { address } = useAccount()
  const { position, isLoading } = usePosition(market.sessionId, address)

  if (!address) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold mb-4">Your Position</h3>
        <p className="text-gray-400 text-center py-8">Connect wallet to view position</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold mb-4">Your Position</h3>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    )
  }

  const hasPosition = position && (position.yesShares > BigInt(0) || position.noShares > BigInt(0))
  const totalSpent = position ? Number(position.totalSpent) / 1e18 : 0
  const totalReceived = position ? Number(position.totalReceived) / 1e18 : 0
  const netPnL = totalReceived - totalSpent

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-semibold mb-4">Your Position</h3>

      {!hasPosition ? (
        <p className="text-gray-400 text-center py-8">No position yet</p>
      ) : (
        <div className="space-y-4">
          {/* Shares */}
          <div>
            <div className="text-sm text-gray-400 mb-2">Shares Owned</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-900/20 p-3 rounded">
                <div className="text-xs text-gray-400">YES</div>
                <div className="text-xl font-bold text-green-400">
                  {(Number(position!.yesShares) / 1e18).toFixed(2)}
                </div>
              </div>
              <div className="bg-red-900/20 p-3 rounded">
                <div className="text-xs text-gray-400">NO</div>
                <div className="text-xl font-bold text-red-400">
                  {(Number(position!.noShares) / 1e18).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Financials */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Total Spent</span>
              <span>{totalSpent.toFixed(2)} tokens</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Total Received</span>
              <span>{totalReceived.toFixed(2)} tokens</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-gray-400">Net P&L</span>
              <span className={netPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                {netPnL >= 0 ? '+' : ''}{netPnL.toFixed(2)} tokens
              </span>
            </div>
          </div>

          {/* Claim Button */}
          {market.resolved && !position?.hasClaimed && (
            <button className="w-full bg-green-600 hover:bg-green-700 text-primary-foreground font-semibold py-3 rounded-lg transition-colors">
              Claim Winnings
            </button>
          )}

          {position?.hasClaimed && (
            <div className="text-center py-2 text-green-400 text-sm">
              ✓ Winnings claimed
            </div>
          )}
        </div>
      )}
    </div>
  )
}

