'use client'

import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentPerformanceProps {
  agent: {
    lifetimePnL: string
    totalTrades: number
    profitableTrades: number
    winRate: number
  }
}

export function AgentPerformance({ agent }: AgentPerformanceProps) {
  const pnl = parseFloat(agent.lifetimePnL)
  const isProfitable = pnl >= 0
  const totalTrades = agent.totalTrades || 0
  const profitableTrades = agent.profitableTrades || 0
  const winRate = agent.winRate || 0

  const stats = [
    {
      label: 'Lifetime P&L',
      value: pnl.toFixed(2),
      icon: isProfitable ? TrendingUp : TrendingDown,
      color: isProfitable ? 'text-green-600' : 'text-red-600'
    },
    {
      label: 'Total Trades',
      value: totalTrades.toString(),
      icon: Activity,
      color: 'text-blue-600'
    },
    {
      label: 'Profitable Trades',
      value: profitableTrades.toString(),
      icon: TrendingUp,
      color: 'text-green-600'
    },
    {
      label: 'Win Rate',
      value: `${(winRate * 100).toFixed(1)}%`,
      icon: DollarSign,
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border hover:border-[#0066FF]/30 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <stat.icon className={cn('w-5 h-5', stat.color)} />
            </div>
            <div className={cn('text-2xl font-bold', stat.color)}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Stats */}
      <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <h3 className="text-lg font-semibold mb-4">Detailed Statistics</h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all">
            <span className="text-muted-foreground">Total Trades</span>
            <span className="font-semibold">{totalTrades}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all">
            <span className="text-muted-foreground">Profitable Trades</span>
            <span className="font-semibold text-green-600">{profitableTrades}</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all">
            <span className="text-muted-foreground">Losing Trades</span>
            <span className="font-semibold text-red-600">
              {totalTrades - profitableTrades}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all">
            <span className="text-muted-foreground">Win Rate</span>
            <span className="font-semibold">{(winRate * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <h3 className="text-lg font-semibold mb-4">Activity Summary</h3>
        
        {totalTrades === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No trading activity yet</p>
            <p className="text-sm mt-2">Enable autonomous mode to start trading</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-all">
              <div className="text-sm text-muted-foreground mb-2">Performance</div>
              <div className="flex items-center gap-2">
                {isProfitable ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                <span className={cn(
                  'text-lg font-semibold',
                  isProfitable ? 'text-green-600' : 'text-red-600'
                )}>
                  {isProfitable ? '+' : ''}{pnl.toFixed(2)} points
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
