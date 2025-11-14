'use client'

import { PageContainer } from '@/components/shared/PageContainer'
import { cn } from '@/lib/utils'
import { Activity } from 'lucide-react'
import { useEffect, useState } from 'react'

interface GameStats {
  totalPosts: number
  activeQuestions: number
  totalCompanies: number
}

interface EngineStatus {
  isRunning: boolean
  currentDay?: number
  currentDate?: string
  speed?: number
  lastTickAt?: string
}

export default function GamePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<GameStats | null>(null)
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadGameData = async () => {
    setRefreshing(true)
    const response = await fetch('/api/stats')
    const data = await response.json()
    setStats(data.stats)
    setEngineStatus(data.engineStatus)
    setError(null)
    setLoading(false)
    setRefreshing(false)
  }

  // Initial load
  useEffect(() => {
    loadGameData()
    
    // Refresh every 10 seconds
    const interval = setInterval(loadGameData, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading game status...</div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer className="flex flex-col items-center justify-center gap-4">
        <div className="text-lg text-destructive">⚠️ {error}</div>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          The continuous game engine may not be running. Start it with: <code className="bg-muted px-2 py-1 rounded">bun run daemon</code>
        </p>
      </PageContainer>
    )
  }

  const currentDate = engineStatus?.currentDate ? new Date(engineStatus.currentDate) : new Date()
  const lastTick = engineStatus?.lastTickAt ? new Date(engineStatus.lastTickAt) : null

  return (
    <PageContainer className="overflow-y-auto pb-24 md:pb-4">
      <div className="max-w-[600px] mx-auto px-4 pt-4 space-y-4">
        {/* Engine Status Card */}
        <div className={cn(
          'bg-card border border-border rounded-2xl p-6',
          'shadow-md'
        )}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Continuous Game Engine</h2>
            <div className="flex items-center gap-2">
              <Activity className={cn(
                "w-4 h-4",
                engineStatus?.isRunning ? "text-green-500 animate-pulse" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-sm font-medium",
                engineStatus?.isRunning ? "text-green-500" : "text-muted-foreground"
              )}>
                {engineStatus?.isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>

          {/* Current Game Time */}
          <div className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Current Game Date</div>
              <div className="text-2xl font-bold" style={{ color: '#0066FF' }}>
                {currentDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Day {engineStatus?.currentDay || 1}
              </div>
            </div>

            {lastTick && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Last Tick</div>
                <div className="text-sm">
                  {lastTick.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Game Stats Card */}
        <div className={cn(
          'bg-card border border-border rounded-2xl p-6',
          'shadow-md'
        )}>
          <h3 className="text-sm font-semibold mb-4">Game Statistics</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Posts</div>
              <div className="text-2xl font-bold" style={{ color: '#0066FF' }}>
                {stats?.totalPosts?.toLocaleString() || '0'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Active Questions</div>
              <div className="text-2xl font-bold" style={{ color: '#0066FF' }}>
                {stats?.activeQuestions || '0'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Companies</div>
              <div className="text-2xl font-bold" style={{ color: '#0066FF' }}>
                {stats?.totalCompanies || '0'}
              </div>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <button
            onClick={loadGameData}
            disabled={refreshing}
            className={cn(
              'px-6 py-3 rounded-lg font-semibold',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-300'
            )}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>

        {/* Info Card */}
        <div className={cn(
          'bg-card border border-border rounded-2xl p-6',
          'shadow-md'
        )}>
          <h3 className="text-sm font-semibold mb-3">About Continuous Mode</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              The continuous game engine runs in real-time, generating 10-20 posts per minute and updating markets automatically.
            </p>
            <p>
              Posts appear in the <span className="text-foreground font-medium">Home</span> feed as they&apos;re generated.
              Prediction markets update in the <span className="text-foreground font-medium">Markets</span> tab.
            </p>
            <p className="text-xs mt-4 p-3 bg-muted rounded-lg">
              <span className="font-medium">Start daemon:</span> <code>bun run daemon</code>
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
