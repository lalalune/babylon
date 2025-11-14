'use client'

import Link from 'next/link'
import type { Market } from '@/lib/betting/types'

export function MarketCard({ market }: { market: Market }) {
  const formatVolume = (volume: bigint) => {
    const num = Number(volume) / 1e18
    if (num > 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toFixed(0)
  }

  return (
    <Link href={`/betting/market/${market.sessionId}`}>
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-all cursor-pointer group">
        {/* Question */}
        <h3 className="text-lg font-semibold mb-4 group-hover:text-blue-400 transition-colors">
          {market.question}
        </h3>

        {/* Status Badge */}
        <div className="flex items-center gap-2 mb-4">
          {market.resolved ? (
            <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded">
              Resolved: {market.outcome ? 'YES' : 'NO'}
            </span>
          ) : market.finalized ? (
            <span className="px-2 py-1 bg-yellow-900 text-yellow-300 text-xs rounded">
              Oracle Finalized
            </span>
          ) : (
            <span className="px-2 py-1 bg-blue-900 text-blue-300 text-xs rounded">
              Active
            </span>
          )}
          <span className="text-xs text-gray-500">
            #{market.questionNumber}
          </span>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-900/20 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">YES</div>
            <div className="text-2xl font-bold text-green-400">
              {market.yesPrice.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatVolume(market.yesShares)} shares
            </div>
          </div>
          <div className="bg-red-900/20 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">NO</div>
            <div className="text-2xl font-bold text-red-400">
              {market.noPrice.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatVolume(market.noShares)} shares
            </div>
          </div>
        </div>

        {/* Volume */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Total Volume</span>
          <span className="font-semibold">{formatVolume(market.totalVolume)} tokens</span>
        </div>

        {/* Action */}
        {!market.resolved && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-primary-foreground font-semibold py-2 px-4 rounded transition-colors">
              Trade Now →
            </button>
          </div>
        )}
      </div>
    </Link>
  )
}

