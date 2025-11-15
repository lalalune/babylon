'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Bot, Play, Pause, AlertCircle, CheckCircle, Activity, Clock, User, Zap, Star, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface RunningAgent {
  id: string
  name: string
  displayName: string
  description: string | null
  profileImageUrl: string | null
  creatorId: string
  creatorName: string | null
  modelTier: 'free' | 'pro'
  pointsBalance: number
  
  // Autonomous status
  autonomousEnabled: boolean
  autonomousTrading: boolean
  autonomousPosting: boolean
  autonomousCommenting: boolean
  autonomousDMs: boolean
  autonomousGroupChats: boolean
  
  // Performance
  lifetimePnL: number
  totalTrades: number
  winRate: number
  reputationScore: number
  averageFeedbackScore: number
  totalFeedbackCount: number
  
  // Status
  agentStatus: string | null
  errorMessage: string | null
  lastTickAt: Date | null
  lastChatAt: Date | null
  
  // Timing
  createdAt: Date
  updatedAt: Date
  
  // Recent logs count
  recentLogsCount: number
  recentErrorsCount: number
}

interface AgentStats {
  total: number
  running: number
  paused: number
  error: number
  totalActions24h: number
}

export function AgentsTab() {
  const [agents, setAgents] = useState<RunningAgent[]>([])
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'paused' | 'error'>('all')
  const [sortBy, setSortBy] = useState<'reputation' | 'pnl' | 'trades' | 'winRate' | 'name'>('reputation')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchData = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/agents', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch agents')

      const result = await response.json()
      setAgents(result.data.agents)
      setStats(result.data.stats)
      setLoading(false)
    } catch (error) {
      logger.error('Failed to load agents', { error }, 'AgentsTab')
      toast.error('Failed to load agents')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleToggleAgent = async (agentId: string, enable: boolean) => {
    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(`/api/admin/agents/${agentId}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: enable }),
      })

      if (!response.ok) throw new Error('Failed to toggle agent')

      toast.success(`Agent ${enable ? 'enabled' : 'paused'}`)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to toggle agent')
    }
  }

  const handlePauseAll = async () => {
    if (!confirm('⚠️ EMERGENCY: Pause ALL autonomous agents? This will stop all autonomous trading, posting, and messaging immediately.')) {
      return
    }

    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/admin/agents/pause-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to pause all agents')

      const result = await response.json()
      toast.success(`Paused ${result.data.paused} agents`)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pause all')
    }
  }

  const handleResumeAll = async () => {
    if (!confirm('Resume ALL autonomous agents? They will start trading, posting, and messaging again.')) {
      return
    }

    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/admin/agents/resume-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to resume all agents')

      const result = await response.json()
      toast.success(`Resumed ${result.data.resumed} agents`)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resume all')
    }
  }

  const filteredAgents = agents
    .filter(a => {
      if (filterStatus === 'running') return a.autonomousEnabled && a.agentStatus === 'running'
      if (filterStatus === 'paused') return !a.autonomousEnabled || a.agentStatus === 'paused'
      if (filterStatus === 'error') return a.agentStatus === 'error' || a.recentErrorsCount > 0
      return true
    })
    .filter(a => 
      searchQuery === '' ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.creatorName?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortBy) {
        case 'reputation':
          aValue = a.reputationScore
          bValue = b.reputationScore
          break
        case 'pnl':
          aValue = a.lifetimePnL
          bValue = b.lifetimePnL
          break
        case 'trades':
          aValue = a.totalTrades
          bValue = b.totalTrades
          break
        case 'winRate':
          aValue = a.winRate
          bValue = b.winRate
          break
        case 'name':
          aValue = a.displayName.toLowerCase()
          bValue = b.displayName.toLowerCase()
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortOrder === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })

  const getStatusColor = (agent: RunningAgent) => {
    if (agent.agentStatus === 'error' || agent.recentErrorsCount > 0) return 'text-red-500'
    if (agent.autonomousEnabled && agent.agentStatus === 'running') return 'text-green-500'
    return 'text-yellow-500'
  }

  const getStatusIcon = (agent: RunningAgent) => {
    if (agent.agentStatus === 'error' || agent.recentErrorsCount > 0) return <AlertCircle className="w-4 h-4" />
    if (agent.autonomousEnabled && agent.agentStatus === 'running') return <CheckCircle className="w-4 h-4" />
    return <Pause className="w-4 h-4" />
  }

  const getStatusText = (agent: RunningAgent) => {
    if (agent.agentStatus === 'error') return 'Error'
    if (agent.recentErrorsCount > 0) return `${agent.recentErrorsCount} errors`
    if (agent.autonomousEnabled && agent.agentStatus === 'running') return 'Running'
    if (agent.autonomousEnabled) return 'Enabled'
    return 'Paused'
  }

  const getRunDuration = (agent: RunningAgent) => {
    if (!agent.lastTickAt) return 'Never run'
    const now = new Date()
    const lastTick = new Date(agent.lastTickAt)
    const diffMs = now.getTime() - lastTick.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'Just now'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Autonomous Agents</h2>
          <p className="text-muted-foreground mt-1">
            Monitor and manage all running AI agents in the system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePauseAll}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors flex items-center gap-2"
          >
            <Pause className="w-4 h-4" />
            Emergency: Pause All
          </button>
          <button
            onClick={handleResumeAll}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Resume All
          </button>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
            <div className="flex items-center justify-between mb-2">
              <Bot className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
            <div className="text-sm text-muted-foreground">Total Agents</div>
          </div>

          <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold text-green-500">{stats.running}</span>
            </div>
            <div className="text-sm text-muted-foreground">Running</div>
          </div>

          <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-yellow-500/20">
            <div className="flex items-center justify-between mb-2">
              <Pause className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-500">{stats.paused}</span>
            </div>
            <div className="text-sm text-muted-foreground">Paused</div>
          </div>

          <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-red-500/20">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold text-red-500">{stats.error}</span>
            </div>
            <div className="text-sm text-muted-foreground">Errors</div>
          </div>
        </div>
      )}

      {/* Filters & Sort */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2">
            {(['all', 'running', 'paused', 'error'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  filterStatus === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <div className="flex gap-2">
            {(['reputation', 'pnl', 'trades', 'winRate', 'name'] as const).map((sort) => (
              <button
                key={sort}
                onClick={() => {
                  if (sortBy === sort) {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortBy(sort)
                    setSortOrder(sort === 'name' ? 'asc' : 'desc')
                  }
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1',
                  sortBy === sort
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {sort === 'reputation' && <Star className="w-3 h-3" />}
                {sort.charAt(0).toUpperCase() + sort.slice(1)}
                {sortBy === sort && (
                  sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agents List */}
      <div className="space-y-3">
        {filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bot className="w-12 h-12 mb-4 opacity-50" />
            <p>No agents found</p>
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border hover:border-primary/50 transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {agent.displayName.charAt(0)}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{agent.displayName}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {agent.description || 'No description'}
                      </p>
                    </div>
                    <div className={cn('flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium', getStatusColor(agent))}>
                      {getStatusIcon(agent)}
                      {getStatusText(agent)}
                    </div>
                  </div>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {agent.autonomousTrading && (
                      <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">Trading</span>
                    )}
                    {agent.autonomousPosting && (
                      <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">Posting</span>
                    )}
                    {agent.autonomousCommenting && (
                      <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">Commenting</span>
                    )}
                    {agent.autonomousDMs && (
                      <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">DMs</span>
                    )}
                    {agent.autonomousGroupChats && (
                      <span className="text-xs px-2 py-1 rounded bg-pink-500/20 text-pink-400">Groups</span>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Reputation
                      </div>
                      <div className={cn(
                        'font-mono text-xs font-semibold',
                        agent.reputationScore >= 80 ? 'text-green-500' :
                        agent.reputationScore >= 60 ? 'text-yellow-500' :
                        agent.reputationScore >= 40 ? 'text-orange-500' :
                        'text-red-500'
                      )}>
                        {Math.round(agent.reputationScore)}/100
                      </div>
                      {agent.totalFeedbackCount > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {agent.totalFeedbackCount} reviews
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Model</div>
                      <div className="font-mono text-xs capitalize">{agent.modelTier}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Points</div>
                      <div className="font-mono text-xs">{agent.pointsBalance}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">P&L</div>
                      <div className={cn(
                        'font-mono text-xs',
                        agent.lifetimePnL >= 0 ? 'text-green-500' : 'text-red-500'
                      )}>
                        {agent.lifetimePnL >= 0 ? '+' : ''}${agent.lifetimePnL.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Trades</div>
                      <div className="font-mono text-xs">{agent.totalTrades}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Win Rate</div>
                      <div className="font-mono text-xs">{(agent.winRate * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  {/* Timing & Creator */}
                  <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{agent.creatorName || 'System'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Last tick: {getRunDuration(agent)}</span>
                    </div>
                    {agent.recentLogsCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>{agent.recentLogsCount} actions (24h)</span>
                      </div>
                    )}
                    {agent.recentErrorsCount > 0 && (
                      <div className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="w-3 h-3" />
                        <span>{agent.recentErrorsCount} errors</span>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {agent.errorMessage && (
                    <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/20">
                      <div className="text-xs text-red-400 font-mono line-clamp-2">
                        {agent.errorMessage}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleAgent(agent.id, !agent.autonomousEnabled)
                    }}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      agent.autonomousEnabled
                        ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500'
                        : 'bg-green-500/20 hover:bg-green-500/30 text-green-500'
                    )}
                    title={agent.autonomousEnabled ? 'Pause' : 'Resume'}
                  >
                    {agent.autonomousEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <a
                    href={`/agents/${agent.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-500 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="View Details"
                  >
                    <Zap className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

