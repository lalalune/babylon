'use client'

import { useState, useEffect } from 'react'
import { Avatar } from '@/components/shared/Avatar'
import { Loader2, Shield, UserMinus, UserPlus, Crown, Trash2, Search, X, Settings, LogOut } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

interface Member {
  id: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
  isAdmin: boolean
  joinedAt: Date | string
}

interface GroupDetails {
  id: string
  name: string
  description: string | null
  members: Member[]
  isAdmin: boolean
  isCreator: boolean
  createdById: string
}

interface User {
  id: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
}

interface GroupManagementModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string | null
  onGroupUpdated?: () => void
}

export function GroupManagementModal({
  isOpen,
  onClose,
  groupId,
  onGroupUpdated,
}: GroupManagementModalProps) {
  const { getAccessToken } = usePrivy()
  const { user } = useAuthStore()
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Add member state
  const [showAddMember, setShowAddMember] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  
  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{
    type: 'remove' | 'promote' | 'demote' | 'delete' | 'leave'
    userId?: string
    userName?: string
  } | null>(null)

  // Load group details
  useEffect(() => {
    if (!isOpen || !groupId) {
      setGroupDetails(null)
      setError(null)
      setShowAddMember(false)
      return
    }

    const loadGroupDetails = async () => {
      setLoading(true)
      setError(null)
      const token = await getAccessToken()
      const response = await fetch(`/api/groups/${groupId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        setLoading(false)
        throw new Error('Failed to load group details')
      }

      const data = await response.json()
      setGroupDetails(data.group)
      setLoading(false)
    }

    loadGroupDetails()
  }, [isOpen, groupId, getAccessToken])

  // Search for users to add
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const searchUsers = async () => {
      setSearching(true)
      const token = await getAccessToken()
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Filter out existing members
        const existingMemberIds = groupDetails?.members.map((m) => m.id) || []
        setSearchResults(
          (data.users || []).filter((u: User) => !existingMemberIds.includes(u.id))
        )
      }
      setSearching(false)
    }

    const debounce = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, getAccessToken, groupDetails])

  const handleAddMember = async (userId: string) => {
    if (!groupId) return

    setActionLoading(userId)
    const token = await getAccessToken()
    const response = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      setActionLoading(null)
      throw new Error('Failed to add member')
    }

    // Reload group details
    const detailsResponse = await fetch(`/api/groups/${groupId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (detailsResponse.ok) {
      const data = await detailsResponse.json()
      setGroupDetails(data.group)
    }

    setSearchQuery('')
    setSearchResults([])
    onGroupUpdated?.()
    setActionLoading(null)
  }

  const handleRemoveMember = async (userId: string) => {
    if (!groupId) return

    setActionLoading(userId)
    const token = await getAccessToken()
    const response = await fetch(`/api/groups/${groupId}/members?userId=${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      setActionLoading(null)
      setConfirmAction(null)
      throw new Error('Failed to remove member')
    }

    // Reload group details
    const detailsResponse = await fetch(`/api/groups/${groupId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (detailsResponse.ok) {
      const data = await detailsResponse.json()
      setGroupDetails(data.group)
    }

    onGroupUpdated?.()
    setActionLoading(null)
    setConfirmAction(null)
  }

  const handlePromoteToAdmin = async (userId: string) => {
    if (!groupId) return

    setActionLoading(userId)
    const token = await getAccessToken()
    const response = await fetch(`/api/groups/${groupId}/admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      setActionLoading(null)
      setConfirmAction(null)
      throw new Error('Failed to promote member')
    }

    // Reload group details
    const detailsResponse = await fetch(`/api/groups/${groupId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (detailsResponse.ok) {
      const data = await detailsResponse.json()
      setGroupDetails(data.group)
    }

    onGroupUpdated?.()
    setActionLoading(null)
    setConfirmAction(null)
  }

  const handleDemoteAdmin = async (userId: string) => {
    if (!groupId) return

    setActionLoading(userId)
    const token = await getAccessToken()
    const response = await fetch(`/api/groups/${groupId}/admins?userId=${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      setActionLoading(null)
      setConfirmAction(null)
      throw new Error('Failed to remove admin status')
    }

    // Reload group details
    const detailsResponse = await fetch(`/api/groups/${groupId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (detailsResponse.ok) {
      const data = await detailsResponse.json()
      setGroupDetails(data.group)
    }

    onGroupUpdated?.()
    setActionLoading(null)
    setConfirmAction(null)
  }

  const handleDeleteGroup = async () => {
    if (!groupId) return

    setActionLoading('delete')
    const token = await getAccessToken()
    const response = await fetch(`/api/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      setActionLoading(null)
      setConfirmAction(null)
      throw new Error('Failed to delete group')
    }

    onGroupUpdated?.()
    onClose()
  }

  const handleLeaveGroup = async () => {
    if (!groupId || !user) return

    setActionLoading('leave')
    const token = await getAccessToken()
    const response = await fetch(`/api/groups/${groupId}/members?userId=${user.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      setActionLoading(null)
      setConfirmAction(null)
      throw new Error('Failed to leave group')
    }

    onGroupUpdated?.()
    onClose()
  }

  const handleConfirmAction = () => {
    if (!confirmAction) return

    switch (confirmAction.type) {
      case 'remove':
        if (confirmAction.userId) handleRemoveMember(confirmAction.userId)
        break
      case 'promote':
        if (confirmAction.userId) handlePromoteToAdmin(confirmAction.userId)
        break
      case 'demote':
        if (confirmAction.userId) handleDemoteAdmin(confirmAction.userId)
        break
      case 'delete':
        handleDeleteGroup()
        break
      case 'leave':
        handleLeaveGroup()
        break
    }
  }

  if (!isOpen || !groupId) return null

  const handleClose = () => {
    if (actionLoading) return // Prevent closing during actions
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleClose()
          }
        }}
      >
        <div
          className="bg-background border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{groupDetails?.name || 'Group Settings'}</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              disabled={!!actionLoading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : groupDetails ? (
              <div className="space-y-4">
                {/* Action Buttons */}
                <div className="flex justify-end gap-2">
                  {/* Leave Group (everyone can do this) */}
                  {!groupDetails.isCreator && (
                    <button
                      onClick={() => setConfirmAction({ type: 'leave' })}
                      disabled={!!actionLoading}
                      className="px-4 py-2 text-sm font-medium text-yellow-600 border border-yellow-600 rounded-lg hover:bg-yellow-600/10 transition-colors disabled:opacity-50"
                    >
                      <LogOut className="w-4 h-4 inline mr-2" />
                      Leave Group
                    </button>
                  )}
                  
                  {/* Delete Group (admins only) */}
                  {groupDetails.isAdmin && (
                    <button
                      onClick={() => setConfirmAction({ type: 'delete' })}
                      disabled={!!actionLoading}
                      className="px-4 py-2 text-sm font-medium text-red-500 border border-red-500 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 inline mr-2" />
                      Delete Group
                    </button>
                  )}
                </div>

                {/* Members Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold">
                      Members ({groupDetails.members.length})
                    </label>
                    {groupDetails.isAdmin && (
                      <button
                        onClick={() => setShowAddMember(!showAddMember)}
                        className="px-3 py-1.5 text-sm font-medium bg-sidebar border border-border rounded-lg hover:bg-accent transition-colors"
                      >
                        {showAddMember ? (
                          <>
                            <X className="w-4 h-4 inline mr-1" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 inline mr-1" />
                            Add Member
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Add Member Section */}
                  {showAddMember && groupDetails.isAdmin && (
                    <div className="space-y-2 p-3 bg-sidebar border border-border rounded-lg">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-10 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                        />
                        {searching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                        )}
                      </div>

                      {searchResults.length > 0 && (
                        <div className="border border-border rounded-lg overflow-hidden max-h-[150px] overflow-y-auto bg-background">
                          {searchResults.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => handleAddMember(user.id)}
                              disabled={actionLoading === user.id}
                              className="w-full flex items-center gap-2 p-2.5 hover:bg-sidebar transition-colors text-left disabled:opacity-50"
                            >
                              <Avatar
                                imageUrl={user.profileImageUrl || undefined}
                                name={user.username || user.displayName || '?'}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {user.displayName || user.username || 'Unknown'}
                                </div>
                              </div>
                              {actionLoading === user.id && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Members */}
                  <div className="space-y-2">
                    {groupDetails.members.map((member) => {
                      const isCreator = member.id === groupDetails.createdById
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 bg-sidebar border border-border rounded-lg hover:bg-sidebar/80 transition-colors"
                        >
                          <Avatar
                            imageUrl={member.profileImageUrl || undefined}
                            name={member.username || member.displayName || '?'}
                            size="md"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {member.displayName || member.username || 'Unknown'}
                              </span>
                              {isCreator && (
                                <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                              )}
                              {member.isAdmin && (
                                <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            {member.username && (
                              <div className="text-xs text-muted-foreground truncate">
                                @{member.username}
                              </div>
                            )}
                          </div>

                          {/* Actions (only for admins, not for creator) */}
                          {groupDetails.isAdmin && !isCreator && (
                            <div className="flex items-center gap-1">
                              {!member.isAdmin ? (
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      type: 'promote',
                                      userId: member.id,
                                      userName: member.displayName || member.username || 'this user',
                                    })
                                  }
                                  disabled={!!actionLoading}
                                  className="p-2 hover:bg-background rounded-md transition-colors disabled:opacity-50"
                                  title="Make Admin"
                                >
                                  <Shield className="w-4 h-4 text-primary" />
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    setConfirmAction({
                                      type: 'demote',
                                      userId: member.id,
                                      userName: member.displayName || member.username || 'this user',
                                    })
                                  }
                                  disabled={!!actionLoading}
                                  className="p-2 hover:bg-background rounded-md transition-colors disabled:opacity-50"
                                  title="Remove Admin"
                                >
                                  <Shield className="w-4 h-4 text-muted-foreground" />
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'remove',
                                    userId: member.id,
                                    userName: member.displayName || member.username || 'this user',
                                  })
                                }
                                disabled={!!actionLoading}
                                className="p-2 hover:bg-background rounded-md transition-colors disabled:opacity-50"
                                title="Remove Member"
                              >
                                <UserMinus className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              setConfirmAction(null)
            }
          }}
        >
          <div
            className="bg-background border border-border rounded-xl w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">
                {confirmAction.type === 'delete' && 'Delete Group?'}
                {confirmAction.type === 'remove' && 'Remove Member?'}
                {confirmAction.type === 'promote' && 'Make Admin?'}
                {confirmAction.type === 'demote' && 'Remove Admin?'}
                {confirmAction.type === 'leave' && 'Leave Group?'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {confirmAction.type === 'delete' &&
                  'This will permanently delete the group and all its data. This action cannot be undone.'}
                {confirmAction.type === 'remove' &&
                  `Remove ${confirmAction.userName} from this group? They can be re-invited later.`}
                {confirmAction.type === 'promote' &&
                  `Give ${confirmAction.userName} admin privileges? They will be able to manage members and settings.`}
                {confirmAction.type === 'demote' &&
                  `Remove admin privileges from ${confirmAction.userName}? They will remain a regular member.`}
                {confirmAction.type === 'leave' &&
                  'Are you sure you want to leave this group? You will need to be re-invited to join again.'}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={!!actionLoading}
                  className="flex-1 px-4 py-2.5 bg-sidebar border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={!!actionLoading}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50',
                    confirmAction.type === 'delete' || confirmAction.type === 'remove'
                      ? 'bg-red-500 text-primary-foreground hover:bg-red-600'
                      : confirmAction.type === 'leave'
                      ? 'bg-yellow-500 text-primary-foreground hover:bg-yellow-600'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 inline animate-spin" />
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

