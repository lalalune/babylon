'use client'

import { useEffect, useState, useTransition } from 'react'
import { Search, Users, Shield, RefreshCw, Ban, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { toast } from 'sonner'
import { Skeleton } from '@/components/shared/Skeleton'
import { z } from 'zod'

const UserSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  walletAddress: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  isActor: z.boolean(),
  isAdmin: z.boolean(),
  isBanned: z.boolean(),
  bannedAt: z.string().nullable(),
  bannedReason: z.string().nullable(),
  bannedBy: z.string().nullable(),
  virtualBalance: z.string(),
  totalDeposited: z.string(),
  totalWithdrawn: z.string(),
  lifetimePnL: z.string(),
  reputationPoints: z.number(),
  referralCount: z.number(),
  onChainRegistered: z.boolean(),
  nftTokenId: z.number().nullable(),
  hasFarcaster: z.boolean(),
  hasTwitter: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  _count: z.object({
    comments: z.number(),
    reactions: z.number(),
    positions: z.number(),
    following: z.number(),
    followedBy: z.number(),
    reportsReceived: z.number().optional(),
    blocksReceived: z.number().optional(),
    mutesReceived: z.number().optional(),
    reportsSent: z.number().optional(),
  }).optional(),
  _moderation: z.object({
    reportsReceived: z.number(),
    blocksReceived: z.number(),
    mutesReceived: z.number(),
    reportsSent: z.number(),
    reportRatio: z.number(),
    blockRatio: z.number(),
    muteRatio: z.number(),
    badUserScore: z.number(),
  }).optional(),
});
type User = z.infer<typeof UserSchema>;

type FilterType = 'all' | 'actors' | 'users' | 'banned' | 'admins'
type SortByType = 'created' | 'balance' | 'reputation' | 'username' | 'reports_received' | 'blocks_received' | 'mutes_received' | 'report_ratio' | 'block_ratio' | 'bad_user_score'

export function UserManagementTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, startRefresh] = useTransition();
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortByType>('created')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showBanModal, setShowBanModal] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [isBanning, startBanning] = useTransition();

  useEffect(() => {
    fetchUsers()
  }, [filter, sortBy, searchQuery])

  const fetchUsers = (showRefreshing = false) => {
    const fetchLogic = async () => {
      const params = new URLSearchParams({
        limit: '50',
        filter,
        sortBy,
        sortOrder: 'desc',
      });
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      const validation = z.array(UserSchema).safeParse(data.users);
      if (!validation.success) {
        throw new Error('Invalid user data structure');
      }
      setUsers(validation.data || []);
      setLoading(false);
    };

    if (showRefreshing) {
      startRefresh(fetchLogic);
    } else {
      fetchLogic();
    }
  };

  const handleBanUser = (user: User, action: 'ban' | 'unban') => {
    if (action === 'ban' && !banReason.trim()) {
      toast.error('Please provide a reason for banning');
      return;
    }

    startBanning(async () => {
      const response = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'ban' ? banReason : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      toast.success(action === 'ban' ? 'User banned successfully' : 'User unbanned successfully');
      setShowBanModal(false);
      setBanReason('');
      setSelectedUser(null);
      fetchUsers(true);
    });
  };

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
      <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-colors">
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
              <span>Posts: {user._count?.comments ?? 0}</span>
              <span>Reactions: {user._count?.reactions ?? 0}</span>
              <span>Positions: {user._count?.positions ?? 0}</span>
              <span>Followers: {user._count?.followedBy ?? 0}</span>
              <span>Following: {user._count?.following ?? 0}</span>
            </div>

            {/* Moderation Metrics */}
            {user._moderation && (user._moderation.reportsReceived > 0 || user._moderation.blocksReceived > 0 || user._moderation.mutesReceived > 0) && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 space-y-2">
                <div className="text-xs font-medium text-yellow-600 flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  Moderation Metrics
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Reports</div>
                    <div className="font-bold text-red-500">{user._moderation.reportsReceived}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Blocks</div>
                    <div className="font-bold text-orange-500">{user._moderation.blocksReceived}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Mutes</div>
                    <div className="font-bold text-yellow-600">{user._moderation.mutesReceived}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bad Score</div>
                    <div className={cn(
                      'font-bold',
                      user._moderation.badUserScore > 10 ? 'text-red-500' :
                      user._moderation.badUserScore > 5 ? 'text-orange-500' :
                      'text-yellow-600'
                    )}>
                      {user._moderation.badUserScore.toFixed(1)}
                    </div>
                  </div>
                </div>
                {(user._moderation.reportRatio > 0 || user._moderation.blockRatio > 0) && (
                  <div className="flex gap-3 text-xs text-muted-foreground pt-1 border-t border-yellow-500/20">
                    <span>Report Ratio: {user._moderation.reportRatio.toFixed(2)}</span>
                    <span>Block Ratio: {user._moderation.blockRatio.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

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
                  disabled={isBanning}
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
                  disabled={isBanning}
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
        <div className="space-y-3 w-full">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
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
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:border-border"
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
              className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-border"
            >
              <optgroup label="General">
                <option value="created">Join Date</option>
                <option value="balance">Balance</option>
                <option value="reputation">Reputation</option>
                <option value="username">Username</option>
              </optgroup>
              <optgroup label="Moderation">
                <option value="bad_user_score">Bad User Score</option>
                <option value="reports_received">Reports Received</option>
                <option value="blocks_received">Blocks Received</option>
                <option value="mutes_received">Mutes Received</option>
                <option value="report_ratio">Report Ratio</option>
                <option value="block_ratio">Block Ratio</option>
              </optgroup>
            </select>
          </div>

          <button
            onClick={() => fetchUsers(true)}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
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
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
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
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-border resize-none"
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
                disabled={isBanning}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBanUser(selectedUser, 'ban')}
                disabled={isBanning || !banReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 text-primary-foreground rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBanning ? (
                  <>
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

