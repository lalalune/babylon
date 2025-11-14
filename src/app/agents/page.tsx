'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/Avatar'
import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton } from '@/components/shared/Skeleton'
import { Plus, Bot, TrendingUp, Activity } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Agent {
  id: string
  name: string
  description?: string
  profileImageUrl?: string
  pointsBalance: number
  isActive: boolean
  autonomousEnabled: boolean
  modelTier: 'free' | 'pro'
  status: string
  lifetimePnL: string
  totalTrades: number
  winRate: number
  lastTickAt?: string
  lastChatAt?: string
  createdAt: string
}

export default function AgentsPage() {
  const { authenticated, ready, getAccessToken } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'idle'>('all')

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    const token = await getAccessToken()
    
    if (!token) {
      console.error('No access token available')
      setLoading(false)
      return
    }
    
    let url = '/api/agents'
    if (filter === 'active') {
      url += '?autonomousTrading=true'
    } else if (filter === 'idle') {
      url += '?autonomousTrading=false'
    }

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).catch((error: Error) => {
      console.error('Failed to fetch agents:', error)
      setLoading(false)
      throw error
    })

    if (res.ok) {
      const data = await res.json()
      setAgents(data.agents || [])
    }
    
    setLoading(false)
  }, [getAccessToken, filter])

  useEffect(() => {
    if (ready && authenticated) {
      fetchAgents()
    }
  }, [ready, authenticated, fetchAgents])

  if (!ready || !authenticated) {
    return (
      <PageContainer>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg border border-[#0066FF]/20">
            <Bot className="w-16 h-16 mb-4 text-[#0066FF]" />
            <h3 className="text-2xl font-bold mb-2">AI Agents</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Sign in to create and manage AI agents that can chat and trade autonomously
            </p>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Agents</h1>
            <p className="text-muted-foreground">
              Create and manage AI agents that can chat and trade autonomously
            </p>
          </div>
          <Link href="/agents/create">
            <Button className="flex text-primary-foreground items-center gap-2 bg-[#0066FF] hover:bg-[#2952d9] px-4 py-2">
              <Plus className="w-5 h-5" />
              Create Agent
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all',
              filter === 'all'
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all',
              filter === 'active'
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('idle')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all',
              filter === 'idle'
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Idle
          </button>
        </div>

        {/* Agents Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-6 rounded-lg bg-muted/30 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg border border-[#0066FF]/20">
            <Bot className="w-16 h-16 mb-4 text-[#0066FF]" />
            <h3 className="text-2xl font-bold mb-2">No Agents Yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Create your first AI agent to start trading and chatting
            </p>
            <Link href="/agents/create">
              <Button className="flex text-primary-foreground items-center gap-2 bg-[#0066FF] hover:bg-[#2952d9] px-4 py-2">
                <Plus className="w-5 h-5" />
                Create Agent
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <Link key={agent.id} href={`/agents/${agent.id}`}>
                <div className="p-6 rounded-lg bg-muted/30 hover:bg-muted transition-all cursor-pointer border border-transparent hover:border-[#0066FF]/30">
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar
                      id={agent.id}
                      name={agent.name}
                      type="user"
                      size="lg"
                      src={agent.profileImageUrl}
                      imageUrl={agent.profileImageUrl}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{agent.name}</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={agent.autonomousEnabled ? 'text-green-400' : 'text-muted-foreground'}>
                          {agent.autonomousEnabled ? (
                            <>
                              <Activity className="w-3 h-3 inline mr-1" />
                              Active
                            </>
                          ) : (
                            'Idle'
                          )}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground capitalize">{agent.modelTier}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {agent.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {agent.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Balance</div>
                      <div className="font-semibold">{agent.pointsBalance} pts</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">P&L</div>
                      <div className={cn(
                        'font-semibold flex items-center gap-1',
                        parseFloat(agent.lifetimePnL) >= 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        <TrendingUp className="w-3 h-3" />
                        {parseFloat(agent.lifetimePnL).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Trades</div>
                      <div className="font-semibold">{agent.totalTrades}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
                      <div className="font-semibold">{(agent.winRate * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

