'use client'

import { useEffect, useState } from 'react'
import { Search, Shield, RefreshCw, UserPlus, UserMinus, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { toast } from 'sonner'
import { Skeleton } from '@/components/shared/Skeleton'

interface AdminUser {
  id: string
  username: string | null
  displayName: string | null
  walletAddress: string | null
  profileImageUrl: string | null
  isActor: boolean
  isAdmin: boolean
  createdAt: string
  updatedAt: string
  onChainRegistered: boolean
  hasFarcaster: boolean
  hasTwitter: boolean
}

interface AvailableUser {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  walletAddress: string | null
  isActor: boolean
}

export function AdminManagementTab() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchAdmins()
  }, [])

  const fetchAdmins = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    const response = await fetch('/api/admin/admins')
    if (!response.ok) throw new Error('Failed to fetch admins')
    const data = await response.json()
    setAdmins(data.admins || [])
    setLoading(false)
    setRefreshing(false)
  }

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setAvailableUsers([])
      return
    }

    setLoadingUsers(true)
    const params = new URLSearchParams({
      search: query,
      limit: '10',
      filter: 'users', // Only real users, not actors
    })
    const response = await fetch(`/api/admin/users?${params}`)
    if (!response.ok) throw new Error('Failed to search users')
    const data = await response.json()
    
    // Filter out users who are already admins
    const adminIds = new Set(admins.map(a => a.id))
    const nonAdminUsers = (data.users || [])
      .filter((u: AvailableUser) => !adminIds.has(u.id) && !u.isActor)
    
    setAvailableUsers(nonAdminUsers)
    setLoadingUsers(false)
  }

  const handleAddAdmin = async (userId: string) => {
    setProcessing(true)
    const response = await fetch(`/api/admin/admins/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'promote' }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to add admin')
    }

    const result = await response.json()
    toast.success(`${result.user.displayName || result.user.username || 'User'} is now an admin`)
    setShowAddModal(false)
    setSearchQuery('')
    setAvailableUsers([])
    fetchAdmins(true)
    setProcessing(false)
  }

  const handleRemoveAdmin = async () => {
    if (!selectedUser) return

    setProcessing(true)
    const response = await fetch(`/api/admin/admins/${selectedUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'demote' }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to remove admin')
    }

    const result = await response.json()
    toast.success(`${result.user.displayName || result.user.username || 'User'} is no longer an admin`)
    setShowRemoveModal(false)
    setSelectedUser(null)
    fetchAdmins(true)
    setProcessing(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const AdminRow = ({ admin }: { admin: AdminUser }) => {
    const displayName = admin.displayName || admin.username || 'Anonymous'

    return (
      <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-colors">
        <div className="flex items-start gap-4">
          {/* Avatar and Basic Info */}
          <Avatar
            src={admin.profileImageUrl || undefined}
            alt={displayName}
            size="md"
          />

          <div className="flex-1 min-w-0 space-y-2">
            {/* Name and Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg truncate">{displayName}</span>
              {admin.username && admin.displayName !== admin.username && (
                <span className="text-sm text-muted-foreground">@{admin.username}</span>
              )}
              <span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-orange-500 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Admin
              </span>
              {admin.onChainRegistered && (
                <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-500">
                  On-chain
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {admin.hasFarcaster && (
                <span className="flex items-center gap-1">
                  <span className="text-purple-500">●</span>
                  Farcaster
                </span>
              )}
              {admin.hasTwitter && (
                <span className="flex items-center gap-1">
                  <span className="text-blue-500">●</span>
                  Twitter
                </span>
              )}
              <span>Joined: {formatDate(admin.createdAt)}</span>
            </div>

            {/* Wallet Address */}
            {admin.walletAddress && (
              <div className="text-xs text-muted-foreground font-mono truncate">
                {admin.walletAddress}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setSelectedUser(admin)
                setShowRemoveModal(true)
              }}
              disabled={processing}
              className="px-3 py-1.5 text-sm font-medium rounded bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
            >
              <UserMinus className="w-4 h-4" />
              Remove Admin
            </button>
          </div>
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
      {/* Header with Actions */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            Admin Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {admins.length} {admins.length === 1 ? 'admin' : 'admins'} with full system access
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => fetchAdmins(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Admin
          </button>
        </div>
      </div>

      {/* Admins List */}
      {admins.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 bg-card border border-border rounded-2xl">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No admins found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => (
            <AdminRow key={admin.id} admin={admin} />
          ))}
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Add Admin</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setSearchQuery('')
                  setAvailableUsers([])
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-muted-foreground mb-4 text-sm">
              Search for a user to grant admin privileges. Admins have full access to all system functions.
            </p>
            
            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by username, display name, or wallet..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchUsers(e.target.value)
                }}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-auto space-y-2">
              {loadingUsers && (
                <div className="text-center py-4 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Searching...
                </div>
              )}

              {!loadingUsers && searchQuery && availableUsers.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No users found
                </div>
              )}

              {!loadingUsers && availableUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <Avatar
                    src={user.profileImageUrl || undefined}
                    alt={user.displayName || user.username || 'User'}
                    size="sm"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {user.displayName || user.username || 'Anonymous'}
                    </div>
                    {user.username && user.displayName !== user.username && (
                      <div className="text-xs text-muted-foreground">@{user.username}</div>
                    )}
                  </div>

                  <button
                    onClick={() => handleAddAdmin(user.id)}
                    disabled={processing}
                    className="px-3 py-1.5 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {processing ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Remove Admin Confirmation Modal */}
      {showRemoveModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4 text-orange-500">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Remove Admin Privileges</h2>
            </div>
            
            <p className="text-muted-foreground mb-4">
              Are you sure you want to remove admin privileges from{' '}
              <strong className="text-foreground">
                {selectedUser.displayName || selectedUser.username || 'this user'}
              </strong>?
            </p>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-muted-foreground">
                This user will lose access to all admin functions including user management, 
                system stats, and configuration settings.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRemoveModal(false)
                  setSelectedUser(null)
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveAdmin}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-500 text-primary-foreground rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  'Removing...'
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    Remove Admin
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


