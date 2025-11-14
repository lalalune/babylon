'use client'

import { useEffect, useState, useCallback } from 'react'
import { Database, RefreshCw, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TrainingDataStats {
  summary: {
    totalTrajectories: number
    totalWindows: number
    readyWindows: number
    minAgentsRequired: number
  }
  windows: Array<{
    windowId: string
    trajectoryCount: number
    avgSteps: number
    avgPnl: number
  }>
  readyWindows: Array<{
    windowId: string
    trajectoryCount: number
    avgSteps: number
    avgPnl: number
  }>
  recentTrajectories: Array<{
    id: string
    trajectoryId: string
    agentId: string
    windowId: string
    episodeLength: number
    finalPnL: number | null
    tradesExecuted: number | null
    createdAt: string
  }>
  qualityMetrics: {
    avgEpisodeLength: number
    avgPnl: number
    trainingDataQuality: string
  }
}

export function TrainingDataTab() {
  const [data, setData] = useState<TrainingDataStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/training-data', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch training data')

      const result = await response.json()
      setData(result.data)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load training data:', error)
      toast.error('Failed to load training data')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Failed to load training data statistics
      </div>
    )
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'good': return 'text-green-500'
      case 'fair': return 'text-yellow-500'
      case 'low': return 'text-red-500'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Training Data Status</h2>
          <p className="text-muted-foreground mt-1">
            Monitor collected trajectories and training readiness
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
        >
          <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
          <div className="flex items-center justify-between mb-2">
            <Database className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-bold">{data.summary.totalTrajectories}</span>
          </div>
          <div className="text-sm text-muted-foreground">Total Trajectories</div>
        </div>

        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <span className="text-2xl font-bold">{data.summary.totalWindows}</span>
          </div>
          <div className="text-sm text-muted-foreground">Time Windows</div>
        </div>

        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-2xl font-bold">{data.summary.readyWindows}</span>
          </div>
          <div className="text-sm text-muted-foreground">Ready for Training</div>
          <div className="text-xs text-muted-foreground mt-1">
            (≥{data.summary.minAgentsRequired} agents)
          </div>
        </div>

        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className={cn('w-5 h-5', getQualityColor(data.qualityMetrics.trainingDataQuality))} />
            <span className={cn('text-2xl font-bold capitalize', getQualityColor(data.qualityMetrics.trainingDataQuality))}>
              {data.qualityMetrics.trainingDataQuality}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">Data Quality</div>
        </div>
      </div>

      {/* Quality Metrics */}
      <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <h3 className="text-lg font-semibold mb-4">Quality Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Avg Episode Length</div>
            <div className="text-2xl font-mono">{data.qualityMetrics.avgEpisodeLength.toFixed(1)} steps</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Avg P&L</div>
            <div className={cn(
              'text-2xl font-mono',
              data.qualityMetrics.avgPnl >= 0 ? 'text-green-500' : 'text-red-500'
            )}>
              ${data.qualityMetrics.avgPnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Ready Windows */}
      {data.readyWindows.length > 0 && (
        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
          <h3 className="text-lg font-semibold mb-4">Ready for Training ({data.readyWindows.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.readyWindows.slice(0, 10).map((window) => (
              <div
                key={window.windowId}
                className="p-3 rounded-lg bg-green-500/10 border border-green-500/20"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm">{window.windowId}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {window.trajectoryCount} agents • {window.avgSteps.toFixed(0)} avg steps
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      'text-sm font-mono',
                      window.avgPnl >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {window.avgPnl >= 0 ? '+' : ''}${window.avgPnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">avg P&L</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trajectories */}
      <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <h3 className="text-lg font-semibold mb-4">Recent Trajectories</h3>
        {data.recentTrajectories.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.recentTrajectories.map((traj) => (
              <div
                key={traj.id}
                className="p-3 rounded-lg bg-accent/50 border border-border"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {traj.windowId}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                        {traj.episodeLength} steps
                      </span>
                    </div>
                    <div className="text-sm font-mono truncate">
                      {traj.trajectoryId.substring(0, 20)}...
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Agent: {traj.agentId.substring(0, 12)}... • 
                      {traj.tradesExecuted ? ` ${traj.tradesExecuted} trades` : ' No trades'}
                    </div>
                  </div>
                  <div className="text-right">
                    {traj.finalPnL !== null && (
                      <div className={cn(
                        'text-sm font-mono',
                        traj.finalPnL >= 0 ? 'text-green-500' : 'text-red-500'
                      )}>
                        {traj.finalPnL >= 0 ? '+' : ''}${traj.finalPnL.toFixed(2)}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(traj.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No trajectories recorded yet
          </div>
        )}
      </div>

      {/* Status Messages */}
      {data.summary.totalTrajectories === 0 && (
        <div className="p-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-2 text-yellow-200">
                No Training Data Collected
              </p>
              <p className="text-yellow-200/80 mb-3">
                Enable trajectory recording to collect training data:
              </p>
              <code className="block p-3 rounded bg-black/30 text-xs font-mono text-yellow-100">
                RECORD_AGENT_TRAJECTORIES=true
              </code>
              <p className="text-yellow-200/80 mt-3">
                Then run agents through benchmarks or wait for game ticks to collect data.
              </p>
            </div>
          </div>
        </div>
      )}

      {data.summary.readyWindows === 0 && data.summary.totalTrajectories > 0 && (
        <div className="p-6 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-2 text-blue-200">
                Not Ready for Training
              </p>
              <p className="text-blue-200/80">
                Need at least {data.summary.minAgentsRequired} trajectories per window for GRPO training.
                Current windows have fewer agents. Run more benchmarks or wait for more game ticks.
              </p>
            </div>
          </div>
        </div>
      )}

      {data.summary.readyWindows > 0 && (
        <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-2 text-green-200">
                Ready for Training!
              </p>
              <p className="text-green-200/80 mb-3">
                {data.summary.readyWindows} window{data.summary.readyWindows > 1 ? 's' : ''} ready with sufficient data.
                You can now run RL training:
              </p>
              <code className="block p-3 rounded bg-black/30 text-xs font-mono text-green-100">
                cd python{'\n'}
                MODE=single python -m src.training.babylon_trainer
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

