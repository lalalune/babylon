'use client'

import { useEffect, useState, useCallback } from 'react'
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Activity, 
  MessageSquare, 
  FileText, 
  Users, 
  Zap,
  Clock,
  TrendingUp,
  Database,
  Cpu
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Skeleton'
import { WorldFactsSection } from './WorldFactsSection'

interface GameState {
  id: string
  isRunning: boolean
  currentDay: number
  currentDate: string
  startedAt: string | null
  pausedAt: string | null
  lastTickAt: string | null
  timeSinceLastTickMs: number | null
  tickIntervalMs: number
  uptimeMs: number
  uptimeMinutes: number
  uptimeHours: number
  estimatedTotalTicks: number
}

interface GameStats {
  gameState: GameState
  totals: {
    posts: number
    articles: number
    groupChats: number
    chatMessages: number
    llmCalls: number
    avgMessagesPerChat: number
  }
  last24Hours: {
    posts: number
    articles: number
    groupChats: number
    messages: number
    llmCalls: number
  }
  lastHour: {
    posts: number
    articles: number
    groupChats: number
    messages: number
    llmCalls: number
  }
  last5Minutes: {
    posts: number
    articles: number
    messages: number
    llmCalls: number
  }
  lastMinute: {
    posts: number
    articles: number
    messages: number
    llmCalls: number
  }
  rates: {
    postsPerMinute: number
    articlesPerMinute: number
    messagesPerMinute: number
    llmCallsPerMinute: number
    postsPerMinuteAvgHour: number
    articlesPerMinuteAvgHour: number
    messagesPerMinuteAvgHour: number
    llmCallsPerMinuteAvgHour: number
    postsPerMinuteAvgDay: number
    articlesPerMinuteAvgDay: number
    messagesPerMinuteAvgDay: number
    llmCallsPerMinuteAvgDay: number
  }
  llmStats: {
    totalCalls24h: number
    totalPromptTokens24h: number
    totalCompletionTokens24h: number
    totalTokens24h: number
    avgLatencyMs24h: number | null
  }
}

export function GameControlTab() {
  const [stats, setStats] = useState<GameStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/game-stats')
      if (!response.ok) throw new Error('Failed to fetch game stats')
      const data = await response.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(fetchStats, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [autoRefresh, fetchStats])

  const handleGameControl = async (action: 'start' | 'pause') => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/game/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      
      if (!response.ok) throw new Error(`Failed to ${action} game`)
      
      // Refresh stats immediately
      await fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} game`)
    } finally {
      setActionLoading(false)
    }
  }

  const formatUptime = (minutes: number) => {
    if (minutes < 1) return '< 1 min'
    if (minutes < 60) return `${Math.round(minutes)} min`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours < 24) return `${hours}h ${mins}m`
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h`
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
    return value.toLocaleString()
  }

  const StatCard = ({ 
    icon: Icon, 
    label, 
    value,
    subValue,
    color = 'blue',
    trend
  }: { 
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | number
    subValue?: string
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow'
    trend?: 'up' | 'down' | 'neutral'
  }) => {
    const colorClasses = {
      blue: 'text-blue-500 bg-blue-500/10',
      green: 'text-green-500 bg-green-500/10',
      purple: 'text-purple-500 bg-purple-500/10',
      orange: 'text-orange-500 bg-orange-500/10',
      red: 'text-red-500 bg-red-500/10',
      yellow: 'text-yellow-500 bg-yellow-500/10',
    }

    return (
      <div className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className={cn('p-2 rounded-lg', colorClasses[color].split(' ')[1])}>
            <Icon className={cn('w-5 h-5', colorClasses[color].split(' ')[0])} />
          </div>
          {trend && (
            <TrendingUp className={cn(
              'w-4 h-4',
              trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
            )} />
          )}
        </div>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {subValue && (
          <div className="text-xs text-muted-foreground mt-1">{subValue}</div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="text-center text-red-500 p-8">
        {error || 'Failed to load game statistics'}
      </div>
    )
  }

  const { gameState, totals, rates, llmStats, lastMinute } = stats

  return (
    <div className="space-y-6">
      {/* Game Control Header */}
      <div className="bg-gradient-to-br from-card to-accent/20 border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Game Simulation Control</h2>
            <p className="text-muted-foreground">
              Manage autonomous game simulation and monitor real-time statistics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm transition-colors',
                autoRefresh 
                  ? 'bg-green-500/20 text-green-500' 
                  : 'bg-gray-500/20 text-gray-500'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', autoRefresh && 'animate-spin')} />
            </button>
            <button
              onClick={() => fetchStats()}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
            >
              Refresh Now
            </button>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleGameControl('start')}
            disabled={actionLoading || gameState.isRunning}
            className={cn(
              'flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-semibold transition-all',
              gameState.isRunning
                ? 'bg-green-500/20 text-green-500 border-2 border-green-500/50 cursor-default'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            )}
          >
            {gameState.isRunning ? (
              <>
                <Activity className="w-5 h-5 animate-pulse" />
                Game Running
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Start Game
              </>
            )}
          </button>
          
          <button
            onClick={() => handleGameControl('pause')}
            disabled={actionLoading || !gameState.isRunning}
            className={cn(
              'flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-semibold transition-all',
              !gameState.isRunning
                ? 'bg-gray-500/20 text-gray-500 border-2 border-gray-500/50 cursor-default'
                : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
            )}
          >
            <Pause className="w-5 h-5" />
            {!gameState.isRunning ? 'Game Paused' : 'Pause Game'}
          </button>
        </div>

        {/* Game State Info */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Uptime</div>
            <div className="font-semibold">{formatUptime(gameState.uptimeMinutes)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Game Day</div>
            <div className="font-semibold">Day {gameState.currentDay}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Total Ticks</div>
            <div className="font-semibold">{formatNumber(gameState.estimatedTotalTicks)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Last Tick</div>
            <div className="font-semibold">
              {gameState.timeSinceLastTickMs !== null
                ? `${Math.round(gameState.timeSinceLastTickMs / 1000)}s ago`
                : 'Never'}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Activity (Last Minute) */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Live Activity (Last Minute)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={FileText}
            label="Posts Created"
            value={lastMinute.posts}
            subValue={`${rates.postsPerMinute}/min`}
            color="blue"
          />
          <StatCard
            icon={FileText}
            label="Articles Published"
            value={lastMinute.articles}
            subValue={`${rates.articlesPerMinute}/min`}
            color="purple"
          />
          <StatCard
            icon={MessageSquare}
            label="Messages Sent"
            value={lastMinute.messages}
            subValue={`${rates.messagesPerMinute}/min`}
            color="green"
          />
          <StatCard
            icon={Cpu}
            label="LLM Calls"
            value={lastMinute.llmCalls}
            subValue={`${rates.llmCallsPerMinute}/min`}
            color="orange"
          />
        </div>
      </div>

      {/* Total Statistics */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />
          Cumulative Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            icon={FileText}
            label="Total Posts"
            value={formatNumber(totals.posts)}
            color="blue"
          />
          <StatCard
            icon={FileText}
            label="Total Articles"
            value={formatNumber(totals.articles)}
            color="purple"
          />
          <StatCard
            icon={Users}
            label="Group Chats"
            value={formatNumber(totals.groupChats)}
            color="green"
          />
          <StatCard
            icon={MessageSquare}
            label="Chat Messages"
            value={formatNumber(totals.chatMessages)}
            color="green"
          />
          <StatCard
            icon={Activity}
            label="Avg Msgs/Chat"
            value={totals.avgMessagesPerChat.toFixed(1)}
            color="yellow"
          />
          <StatCard
            icon={Cpu}
            label="Total LLM Calls"
            value={formatNumber(totals.llmCalls)}
            color="orange"
          />
        </div>
      </div>

      {/* Average Rates */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-500" />
          Average Rates (Per Minute)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-blue-500" />
              <h4 className="font-semibold">Posts</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Instant</span>
                <span className="font-semibold">{rates.postsPerMinute}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hour Avg</span>
                <span className="font-semibold">{rates.postsPerMinuteAvgHour.toFixed(2)}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Day Avg</span>
                <span className="font-semibold">{rates.postsPerMinuteAvgDay.toFixed(2)}/min</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-purple-500" />
              <h4 className="font-semibold">Articles</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Instant</span>
                <span className="font-semibold">{rates.articlesPerMinute}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hour Avg</span>
                <span className="font-semibold">{rates.articlesPerMinuteAvgHour.toFixed(2)}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Day Avg</span>
                <span className="font-semibold">{rates.articlesPerMinuteAvgDay.toFixed(2)}/min</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-green-500" />
              <h4 className="font-semibold">Messages</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Instant</span>
                <span className="font-semibold">{rates.messagesPerMinute}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hour Avg</span>
                <span className="font-semibold">{rates.messagesPerMinuteAvgHour.toFixed(2)}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Day Avg</span>
                <span className="font-semibold">{rates.messagesPerMinuteAvgDay.toFixed(2)}/min</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-orange-500" />
              <h4 className="font-semibold">LLM Calls</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Instant</span>
                <span className="font-semibold">{rates.llmCallsPerMinute}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hour Avg</span>
                <span className="font-semibold">{rates.llmCallsPerMinuteAvgHour.toFixed(2)}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Day Avg</span>
                <span className="font-semibold">{rates.llmCallsPerMinuteAvgDay.toFixed(2)}/min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LLM Usage Statistics (Last 24h) */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Cpu className="w-5 h-5 text-orange-500" />
          LLM Usage (Last 24 Hours)
        </h3>
        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Calls</div>
              <div className="text-2xl font-bold">{formatNumber(llmStats.totalCalls24h)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Prompt Tokens</div>
              <div className="text-2xl font-bold">{formatNumber(llmStats.totalPromptTokens24h)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Completion Tokens</div>
              <div className="text-2xl font-bold">{formatNumber(llmStats.totalCompletionTokens24h)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Avg Latency</div>
              <div className="text-2xl font-bold">
                {llmStats.avgLatencyMs24h !== null 
                  ? `${llmStats.avgLatencyMs24h}ms`
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* World Facts Section */}
      <WorldFactsSection />
    </div>
  )
}

