'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useTrade } from '@/lib/betting/hooks/useTrade'
import type { Market } from '@/lib/betting/types'

export function TradingInterface({ market }: { market: Market }) {
  const { address } = useAccount()
  const { buyShares, isLoading } = useTrade(market.sessionId)
  const [amount, setAmount] = useState('')
  const [side, setSide] = useState<'yes' | 'no'>('yes')

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) return

    await buyShares(side === 'yes', parseFloat(amount))
    setAmount('')
  }

  if (market.resolved) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h3 className="text-2xl font-bold mb-2">Market Resolved</h3>
        <p className="text-gray-400 mb-6">
          Outcome: <span className={market.outcome ? 'text-green-400' : 'text-red-400'}>
            {market.outcome ? 'YES' : 'NO'}
          </span>
        </p>
        <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-semibold">
          Claim Winnings
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-semibold mb-6">Trade Shares</h3>

      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setSide('yes')}
          className={`p-4 rounded-lg border-2 transition-all ${
            side === 'yes'
              ? 'border-green-500 bg-green-900/30'
              : 'border-gray-700 bg-gray-900 hover:border-gray-600'
          }`}
        >
          <div className="text-sm text-gray-400 mb-1">YES</div>
          <div className="text-3xl font-bold text-green-400">{market.yesPrice.toFixed(0)}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {(Number(market.yesShares) / 1e18).toFixed(2)} shares
          </div>
        </button>
        <button
          onClick={() => setSide('no')}
          className={`p-4 rounded-lg border-2 transition-all ${
            side === 'no'
              ? 'border-red-500 bg-red-900/30'
              : 'border-gray-700 bg-gray-900 hover:border-gray-600'
          }`}
        >
          <div className="text-sm text-gray-400 mb-1">NO</div>
          <div className="text-3xl font-bold text-red-400">{market.noPrice.toFixed(0)}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {(Number(market.noShares) / 1e18).toFixed(2)} shares
          </div>
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">Amount (tokens)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-primary-foreground placeholder-gray-500 focus:outline-none focus:border-blue-500"
          disabled={!address || market.resolved}
        />
      </div>

      {/* Trade Button */}
      {!address ? (
        <div className="text-center py-4 text-gray-400">
          Connect wallet to trade
        </div>
      ) : (
        <button
          onClick={handleTrade}
          disabled={!amount || parseFloat(amount) <= 0 || isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isLoading ? 'Trading...' : `Buy ${side.toUpperCase()} Shares`}
        </button>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-900 rounded-lg text-sm">
        <div className="flex justify-between mb-2">
          <span className="text-gray-400">Your Balance</span>
          <span className="font-semibold">0.00 tokens</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Platform Fee</span>
          <span className="font-semibold">1%</span>
        </div>
      </div>
    </div>
  )
}

