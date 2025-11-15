'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/shared/Avatar'
import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton } from '@/components/shared/Skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Bot, ArrowLeft, MessageCircle, Activity, TrendingUp, FileText, Settings } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AgentChat } from '@/components/agents/AgentChat'
import { AgentWallet } from '@/components/agents/AgentWallet'
import { AgentLogs } from '@/components/agents/AgentLogs'
import { AgentSettings } from '@/components/agents/AgentSettings'
import { AgentPerformance } from '@/components/agents/AgentPerformance'

interface Agent {
  id: string
  name: string
  description?: string
  profileImageUrl?: string
  system: string
  bio?: string[]
  personality?: string
  tradingStrategy?: string
  pointsBalance: number
  totalDeposited: number
  totalWithdrawn: number
  totalPointsSpent: number
  isActive: boolean
  autonomousEnabled: boolean
  modelTier: 'free' | 'pro'
  status: string
  errorMessage?: string
  lifetimePnL: string
  totalTrades: number
  profitableTrades: number
  winRate: number
  lastTickAt?: string
  lastChatAt?: string
  walletAddress?: string
  agent0TokenId?: number
  onChainRegistered: boolean
  a2aEnabled?: boolean
  createdAt: string
  updatedAt: string
}

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { authenticated, ready, getAccessToken } = useAuth()
  const agentId = params.agentId as string
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAgent = useCallback(async () => {
    setLoading(true)
    const token = await getAccessToken()
    
    if (!token) {
      console.error('No access token available')
      toast.error('Authentication required')
      router.push('/agents')
      setLoading(false)
      return
    }
    
    const res = await fetch(`/api/agents/${agentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).catch(() => {
      toast.error('Failed to load agent')
      setLoading(false)
      throw new Error('Failed to load agent')
    })

    if (res.ok) {
      const data = await res.json()
      setAgent(data.agent)
    } else {
      toast.error('Agent not found')
      router.push('/agents')
    }
    
    setLoading(false)
  }, [agentId, getAccessToken, router])

  useEffect(() => {
    if (ready && authenticated && agentId) {
      fetchAgent()
    }
  }, [ready, authenticated, agentId, fetchAgent])

  if (!ready || !authenticated) {
    return (
      <PageContainer>
        <div className="p-4 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-32" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="p-4 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-32" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!agent) {
    return (
      <PageContainer>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg border border-[#0066FF]/20">
            <Bot className="w-16 h-16 mb-4 text-muted-foreground" />
            <h3 className="text-2xl font-bold mb-2">Agent Not Found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This agent doesn't exist or you don't have access to it
            </p>
            <Link href="/agents">
              <button className="px-6 py-2 rounded-lg font-medium bg-[#0066FF] hover:bg-[#2952d9] text-primary-foreground transition-colors">
                Back to Agents
              </button>
            </Link>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="p-4 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => router.push('/agents')}
            variant="ghost"
            className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Button>
        </div>

        {/* Agent Info Card */}
        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <div className="flex items-center gap-4">
          <Avatar
            id={agent.id}
            name={agent.name}
            type="user"
            size="lg"
            src={agent.profileImageUrl}
            imageUrl={agent.profileImageUrl}
          />
          <div>
            <h1 className="text-2xl font-bold mb-1">{agent.name}</h1>
            {agent.description && (
              <p className="text-foreground/80 mb-2">{agent.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm">
              <span className={agent.autonomousEnabled ? 'text-green-400' : 'text-foreground/80'}>
                {agent.autonomousEnabled ? (
                  <>
                    <Activity className="w-3 h-3 inline mr-1" />
                    Autonomous Active
                  </>
                ) : (
                  'Autonomous Disabled'
                )}
              </span>
              <span className="text-foreground">•</span>
              <span className="text-foreground/80 capitalize">{agent.modelTier} Mode</span>
              {agent.onChainRegistered && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-blue-400">Agent0 #{agent.agent0TokenId}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border text-center place-items-center">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Balance</div>
            <div className="text-xl font-semibold">{agent.pointsBalance} pts</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">P&L</div>
            <div className={cn(
              'text-xl font-semibold',
              parseFloat(agent.lifetimePnL) >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {parseFloat(agent.lifetimePnL).toFixed(2)}
            </div>
          </div>
        </div>
        </div>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-muted/50">
          <TabsTrigger value="chat" className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground">
            <MessageCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground">
            <TrendingUp className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground">
            <FileText className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground">
            <Settings className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="wallet" className="data-[state=active]:bg-[#0066FF] data-[state=active]:text-primary-foreground">
            <Bot className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Wallet</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="chat">
            <AgentChat agent={agent} onUpdate={fetchAgent} />
          </TabsContent>

          <TabsContent value="performance">
            <AgentPerformance agent={agent} />
          </TabsContent>

          <TabsContent value="logs">
            <AgentLogs agentId={agent.id} />
          </TabsContent>

          <TabsContent value="settings">
            <AgentSettings agent={agent} onUpdate={fetchAgent} />
          </TabsContent>

          <TabsContent value="wallet">
            <AgentWallet agent={agent} onUpdate={fetchAgent} />
          </TabsContent>
        </div>
      </Tabs>
      </div>
    </PageContainer>
  )
}

