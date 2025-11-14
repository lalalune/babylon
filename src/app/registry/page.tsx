'use client'

/**
 * ERC8004 Registry Page
 * 
 * Comprehensive view of all entities in the Babylon ecosystem:
 * - Users (with on-chain ERC8004 registration)
 * - Agents (AI agents from Agent0 network)
 * - Actors (NPCs from the game)
 * - Apps (game platforms and services)
 */

import { useState, useEffect } from 'react'
import { Search, Users, Bot, Building2, UserCircle, ExternalLink, Shield, Wallet, TrendingUp, Activity, X, AlertCircle } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { PageContainer } from '@/components/shared/PageContainer'
import { SearchBar } from '@/components/shared/SearchBar'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface RegistryEntity {
  type: 'user' | 'actor' | 'agent' | 'app'
  id: string
  name: string
  username?: string
  bio?: string
  description?: string
  imageUrl?: string
  walletAddress?: string
  onChainRegistered?: boolean
  nftTokenId?: number | null
  agent0TokenId?: number | null
  tokenId?: number
  metadataCID?: string
  mcpEndpoint?: string
  a2aEndpoint?: string
  balance?: string
  reputationPoints?: number
  tier?: string
  role?: string
  domain?: string[]
  hasPool?: boolean
  capabilities?: Record<string, unknown>
  reputation?: {
    trustScore: number
    accuracyScore: number
    totalBets: number
    winningBets: number
  }
  stats?: {
    positions?: number
    comments?: number
    reactions?: number
    followers?: number
    following?: number
    pools?: number
    trades?: number
  }
  createdAt?: string
  registrationTxHash?: string
  registrationTimestamp?: string
}

interface RegistryData {
  users: RegistryEntity[]
  actors: RegistryEntity[]
  agents: RegistryEntity[]
  apps: RegistryEntity[]
  totals: {
    users: number
    actors: number
    agents: number
    apps: number
    total: number
  }
}

export default function RegistryPage() {
  const [data, setData] = useState<RegistryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onChainOnly, setOnChainOnly] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'actors' | 'agents' | 'apps'>('all')

  useEffect(() => {
    fetchRegistry()
  }, [onChainOnly])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRegistry()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchRegistry = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (onChainOnly) params.set('onChainOnly', 'true')
      
      const response = await fetch(`/api/registry/all?${params}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        setData(result.data)
      } else {
        setError(result.error?.message || 'Failed to fetch registry data')
      }
    } catch (error) {
      console.error('Failed to fetch registry:', error)
      setError('Failed to connect to the registry')
    } finally {
      setLoading(false)
    }
  }

  const renderBadge = (_type: string, label: string, icon: React.ReactNode, color: string) => {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold',
        color
      )}>
        {icon}
        {label}
      </span>
    )
  }

  const renderEntityCard = (entity: RegistryEntity) => {
    const getBadgeColor = () => {
      switch (entity.type) {
        case 'user': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
        case 'actor': return 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
        case 'agent': return 'bg-green-500/10 text-green-500 border border-green-500/20'
        case 'app': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
        default: return 'bg-muted text-muted-foreground'
      }
    }

    const getProfileUrl = () => {
      if (entity.type === 'user' && entity.username) {
        return `/profile/${entity.username}`
      }
      return null
    }

    const profileUrl = getProfileUrl()

    const cardContent = (
      <>
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-start gap-3">
            <Avatar
              src={entity.imageUrl}
              name={entity.name}
              size="lg"
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate text-foreground">
                    {entity.name}
                  </h3>
                  {entity.username && (
                    <p className="text-sm text-muted-foreground">
                      @{entity.username}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {entity.type === 'user' && renderBadge('user', 'User', <UserCircle className="h-3 w-3" />, getBadgeColor())}
                  {entity.type === 'actor' && renderBadge('actor', 'Actor', <Users className="h-3 w-3" />, getBadgeColor())}
                  {entity.type === 'agent' && renderBadge('agent', 'Agent', <Bot className="h-3 w-3" />, getBadgeColor())}
                  {entity.type === 'app' && renderBadge('app', 'App', <Building2 className="h-3 w-3" />, getBadgeColor())}
                </div>
              </div>
              
              {(entity.bio || entity.description) && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {entity.bio || entity.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* On-chain status */}
          {entity.onChainRegistered && (
            <div className="flex items-center gap-2 text-sm bg-green-500/5 border border-green-500/20 rounded-lg p-2">
              <Shield className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-green-500 font-medium flex-1">On-chain registered</span>
              {entity.nftTokenId && (
                <span className="text-xs font-mono bg-green-500/10 px-2 py-0.5 rounded">
                  #{entity.nftTokenId}
                </span>
              )}
            </div>
          )}

          {/* Agent0 registration */}
          {entity.agent0TokenId && (
            <div className="flex items-center gap-2 text-sm bg-blue-500/5 border border-blue-500/20 rounded-lg p-2">
              <Bot className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-blue-500 font-medium flex-1">Agent0 Token</span>
              <span className="text-xs font-mono bg-blue-500/10 px-2 py-0.5 rounded">
                #{entity.agent0TokenId}
              </span>
            </div>
          )}

          {/* Wallet address */}
          {entity.walletAddress && (
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <code className="text-xs text-muted-foreground font-mono truncate flex-1">
                {entity.walletAddress.slice(0, 6)}...{entity.walletAddress.slice(-4)}
              </code>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  navigator.clipboard.writeText(entity.walletAddress!)
                }}
                className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
              >
                Copy
              </button>
            </div>
          )}

          {/* Balance & Reputation */}
          <div className="grid grid-cols-2 gap-2">
            {entity.balance && (
              <div className="flex items-center gap-2 text-sm bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
                <TrendingUp className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Balance</div>
                  <div className="font-semibold truncate text-foreground">
                    {parseFloat(entity.balance).toLocaleString()} BAB
                  </div>
                </div>
              </div>
            )}
            {entity.reputationPoints !== undefined && (
              <div className="flex items-center gap-2 text-sm bg-purple-500/5 border border-purple-500/20 rounded-lg p-2">
                <Activity className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Reputation</div>
                  <div className="font-semibold truncate text-foreground">
                    {entity.reputationPoints.toLocaleString()} pts
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Agent0 reputation */}
          {entity.reputation && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-1">Trust Score</div>
                <div className="font-semibold text-foreground">{entity.reputation.trustScore.toFixed(2)}</div>
              </div>
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-1">Accuracy</div>
                <div className="font-semibold text-foreground">{entity.reputation.accuracyScore.toFixed(2)}%</div>
              </div>
            </div>
          )}

          {/* Stats */}
          {entity.stats && Object.keys(entity.stats).length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-sm">
              {entity.stats.followers !== undefined && (
                <div>
                  <span className="text-muted-foreground">Followers:</span>{' '}
                  <span className="font-semibold text-foreground">{entity.stats.followers}</span>
                </div>
              )}
              {entity.stats.positions !== undefined && (
                <div>
                  <span className="text-muted-foreground">Positions:</span>{' '}
                  <span className="font-semibold text-foreground">{entity.stats.positions}</span>
                </div>
              )}
              {entity.stats.pools !== undefined && (
                <div>
                  <span className="text-muted-foreground">Pools:</span>{' '}
                  <span className="font-semibold text-foreground">{entity.stats.pools}</span>
                </div>
              )}
              {entity.stats.trades !== undefined && (
                <div>
                  <span className="text-muted-foreground">Trades:</span>{' '}
                  <span className="font-semibold text-foreground">{entity.stats.trades}</span>
                </div>
              )}
            </div>
          )}

          {/* Tier for actors */}
          {entity.tier && (
            <div className="pt-2">
              <span className="inline-block px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-xs font-bold">
                {entity.tier}
              </span>
            </div>
          )}

          {/* Domain tags for actors */}
          {entity.domain && entity.domain.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {entity.domain.slice(0, 3).map((d: string) => (
                <span key={d} className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                  {d}
                </span>
              ))}
              {entity.domain.length > 3 && (
                <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                  +{entity.domain.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Endpoints for agents/apps */}
          {(entity.a2aEndpoint || entity.mcpEndpoint) && (
            <div className="space-y-1 pt-2 border-t border-border text-xs">
              {entity.a2aEndpoint && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">A2A:</span>
                  <a 
                    href={entity.a2aEndpoint} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-500 hover:text-blue-400 flex items-center gap-1 truncate transition-colors"
                  >
                    <span className="truncate">{entity.a2aEndpoint}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              )}
              {entity.mcpEndpoint && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">MCP:</span>
                  <a 
                    href={entity.mcpEndpoint} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-500 hover:text-blue-400 flex items-center gap-1 truncate transition-colors"
                  >
                    <span className="truncate">{entity.mcpEndpoint}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </>
    )

    if (profileUrl) {
      return (
        <Link
          key={entity.id}
          href={profileUrl}
          className={cn(
            'block bg-card border border-border rounded-xl overflow-hidden transition-all duration-200',
            'hover:shadow-lg hover:border-[#0066FF]/50 cursor-pointer'
          )}
        >
          {cardContent}
        </Link>
      )
    }

    return (
      <div
        key={entity.id}
        className="block bg-card border border-border rounded-xl overflow-hidden transition-all duration-200"
      >
        {cardContent}
      </div>
    )
  }

  const allEntities = data ? [
    ...data.users,
    ...data.actors,
    ...data.agents,
    ...data.apps
  ] : []

  const getActiveEntities = () => {
    if (!data) return []
    switch (activeTab) {
      case 'users': return data.users
      case 'actors': return data.actors
      case 'agents': return data.agents
      case 'apps': return data.apps
      default: return allEntities
    }
  }

  const activeEntities = getActiveEntities()

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">ERC8004 Registry</h1>
          <p className="text-muted-foreground text-lg">
            Browse all registered entities in the Babylon ecosystem
          </p>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, username, or description..."
            />
          </div>
          <button
            onClick={() => setOnChainOnly(!onChainOnly)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all duration-200 whitespace-nowrap',
              onChainOnly
                ? 'bg-[#0066FF] text-white hover:bg-[#0052CC]'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'
            )}
          >
            <Shield className="h-4 w-4" />
            On-chain Only
            {onChainOnly && <X className="h-4 w-4" />}
          </button>
        </div>

        {/* Stats overview */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Total</div>
              <div className="text-3xl font-bold text-foreground">{data.totals.total}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <UserCircle className="h-4 w-4" />
                <span>Users</span>
              </div>
              <div className="text-3xl font-bold text-foreground">{data.totals.users}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span>Actors</span>
              </div>
              <div className="text-3xl font-bold text-foreground">{data.totals.actors}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <Bot className="h-4 w-4" />
                <span>Agents</span>
              </div>
              <div className="text-3xl font-bold text-foreground">{data.totals.agents}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span>Apps</span>
              </div>
              <div className="text-3xl font-bold text-foreground">{data.totals.apps}</div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto mb-4 flex justify-center">
                <BouncingLogo size={48} />
              </div>
              <p className="text-muted-foreground">Loading registry data...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load registry</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <button
                onClick={fetchRegistry}
                className="px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Tabs and content */}
        {!loading && !error && data && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-4 py-2 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap',
                  activeTab === 'all'
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                All ({data.totals.total})
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap',
                  activeTab === 'users'
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <UserCircle className="h-4 w-4" />
                Users ({data.totals.users})
              </button>
              <button
                onClick={() => setActiveTab('actors')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap',
                  activeTab === 'actors'
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <Users className="h-4 w-4" />
                Actors ({data.totals.actors})
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap',
                  activeTab === 'agents'
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <Bot className="h-4 w-4" />
                Agents ({data.totals.agents})
              </button>
              <button
                onClick={() => setActiveTab('apps')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap',
                  activeTab === 'apps'
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <Building2 className="h-4 w-4" />
                Apps ({data.totals.apps})
              </button>
            </div>

            {/* Entity grid */}
            {activeEntities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeEntities.map(entity => renderEntityCard(entity))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No entities found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
