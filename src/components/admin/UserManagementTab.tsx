'use client'

import { useEffect, useState } from 'react'
import { Search, Users, Shield, RefreshCw, Ban, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { toast } from 'sonner'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface User {
  id: string
  username: string | null
  displayName: string | null
  walletAddress: string | null
  profileImageUrl: string | null
  isActor: boolean
  isAdmin: boolean
  isBanned: boolean
  bannedAt: string | null
  bannedReason: string | null
  bannedBy: string | null
  virtualBalance: string
  totalDeposited: string
  totalWithdrawn: string
  lifetimePnL: string
  reputationPoints: number
  referralCount: number
  onChainRegistered: boolean
  nftTokenId: number | null
  hasFarcaster: boolean
  hasTwitter: boolean
  createdAt: string
  updatedAt: string
  _count: {
    comments: number
    reactions: number
    positions: number
    following: number
    followedBy: number
  }
}

type FilterType = 'all' | 'actors' | 'users' | 'banned' | 'admins'
type SortByType = 'created' | 'balance' | 'reputation' | 'username'

export function UserManagementTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortByType>('created')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showBanModal, setShowBanModal] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [banning, setBanning] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [filter, sortBy, searchQuery])

  const fetchUsers = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const params = new URLSearchParams({
        limit: '50',
        filter,
        sortBy,
        sortOrder: 'desc',
      })
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleBanUser = async (user: User, action: 'ban' | 'unban') => {
    if (action === 'ban' && !banReason.trim()) {
      toast.error('Please provide a reason for banning')
      return
    }

    setBanning(true)
    try {
      const response = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'ban' ? banReason : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update user')
      }

      toast.success(action === 'ban' ? 'User banned successfully' : 'User unbanned successfully')
      setShowBanModal(false)
      setBanReason('')
      setSelectedUser(null)
      fetchUsers(true)
    } catch (error) {
      console.error('Failed to ban/unban user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update user')
    } finally {
      setBanning(false)
    }
  }

  const formatCurrency = (value: string) => {
    const num = parseFloat(value)
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const UserRow = ({ user }: { user: User }) => {
    const displayName = user.displayName || user.username || 'Anonymous'

    return (
      <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
        <div className="flex items-start gap-4">
          {/* Avatar and Basic Info */}
          <Avatar
            src={user.profileImageUrl || undefined}
            alt={displayName}
            size="md"
          />

          <div className="flex-1 min-w-0 space-y-2">
            {/* Name and Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg truncate">{displayName}</span>
              {user.username && user.displayName !== user.username && (
                <span className="text-sm text-muted-foreground">@{user.username}</span>
              )}
              {user.isAdmin && (
                <span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-orange-500 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Admin
                </span>
              )}
              {user.isActor && (
                <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-500">
                  NPC
                </span>
              )}
              {user.isBanned && (
                <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-500 flex items-center gap-1">
                  <Ban className="w-3 h-3" />
                  Banned
                </span>
              )}
              {user.onChainRegistered && (
                <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-500">
                  On-chain
                </span>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Balance</div>
                <div className="font-bold text-green-600">{formatCurrency(user.virtualBalance)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">P&L</div>
                <div className={cn(
                  'font-bold',
                  parseFloat(user.lifetimePnL) >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatCurrency(user.lifetimePnL)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Reputation</div>
                <div className="font-bold">{user.reputationPoints}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Joined</div>
                <div className="font-medium">{formatDate(user.createdAt)}</div>
              </div>
            </div>

            {/* Activity Stats */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Posts: {user._count.comments}</span>
              <span>Reactions: {user._count.reactions}</span>
              <span>Positions: {user._count.positions}</span>
              <span>Followers: {user._count.followedBy}</span>
              <span>Following: {user._count.following}</span>
            </div>

            {/* Wallet Address */}
            {user.walletAddress && (
              <div className="text-xs text-muted-foreground font-mono">
                {user.walletAddress}
              </div>
            )}

            {/* Ban Info */}
            {user.isBanned && user.bannedReason && (
              <div className="text-sm bg-red-500/10 border border-red-500/20 rounded p-2">
                <div className="font-medium text-red-500">Ban Reason:</div>
                <div className="text-xs text-muted-foreground">{user.bannedReason}</div>
                {user.bannedAt && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Banned on {formatDate(user.bannedAt)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {!user.isActor && (
            <div className="flex flex-col gap-2">
              {user.isBanned ? (
                <button
                  onClick={() => handleBanUser(user, 'unban')}
                  disabled={banning}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Unban
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedUser(user)
                    setShowBanModal(true)
                  }}
                  disabled={banning}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Ban className="w-4 h-4" />
                  Ban
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <BouncingLogo size={48} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by username, display name, or wallet address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        {/* Filter and Sort */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {(['all', 'users', 'actors', 'banned', 'admins'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByType)}
              className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="created">Join Date</option>
              <option value="balance">Balance</option>
              <option value="reputation">Reputation</option>
              <option value="username">Username</option>
            </select>
          </div>

          <button
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Users List */}
      {users.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Ban User</h2>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to ban <strong>{selectedUser.displayName || selectedUser.username}</strong>?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reason for ban <span className="text-red-500">*</span>
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Explain why this user is being banned..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBanModal(false)
                  setBanReason('')
                  setSelectedUser(null)
                }}
                disabled={banning}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBanUser(selectedUser, 'ban')}
                disabled={banning || !banReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {banning ? (
                  <>
                    <BouncingLogo size={16} />
                    Banning...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Ban User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

