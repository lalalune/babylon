'use client'

import { useState, useEffect } from 'react'
import { Avatar } from '@/components/shared/Avatar'
import { Loader2, Search, X, Check, Users } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

interface User {
  id: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
}

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated: (groupId: string, chatId: string) => void
}

export function CreateGroupModal({ isOpen, onClose, onGroupCreated }: CreateGroupModalProps) {
  const { getAccessToken } = usePrivy()
  const { user } = useAuthStore()
  const [groupName, setGroupName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setGroupName('')
      setSearchQuery('')
      setSearchResults([])
      setSelectedUsers([])
      setError(null)
    }
  }, [isOpen])

  // Search for users
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
        setSearchResults(data.users || [])
      }
      setSearching(false)
    }

    const debounce = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, getAccessToken])

  const handleAddUser = (user: User) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId))
  }

  const handleCreateGroup = async () => {
    // Generate group name if not provided
    let finalGroupName = groupName.trim()
    
    if (!finalGroupName) {
      // Auto-generate from members
      const memberNames = selectedUsers.slice(0, 2).map(u => u.displayName || u.username || 'User')
      const currentUserName = user?.displayName || user?.username || 'You'
      
      if (selectedUsers.length === 0) {
        setError('Please add at least one member or enter a group name')
        return
      } else if (selectedUsers.length === 1) {
        finalGroupName = `${currentUserName}, ${memberNames[0]}`
      } else if (selectedUsers.length === 2) {
        finalGroupName = `${currentUserName}, ${memberNames[0]}, ${memberNames[1]}`
      } else {
        finalGroupName = `${currentUserName}, ${memberNames[0]}, ${memberNames[1]} +${selectedUsers.length - 2}`
      }
    }

    setCreating(true)
    setError(null)

    const token = await getAccessToken()
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: finalGroupName,
        memberIds: selectedUsers.map((u) => u.id),
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      setCreating(false)
      throw new Error(data.error || 'Failed to create group')
    }

    const data = await response.json()
    onGroupCreated(data.group.id, data.group.chatId)
    onClose()
  }

  if (!isOpen) return null

  const handleClose = () => {
    if (creating) return // Prevent closing during creation
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className="bg-background border border-border rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Create New Group</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={creating}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Group Name (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Group Name <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
              </label>
              <input
                id="groupName"
                type="text"
                placeholder="Leave blank to auto-name from members..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={100}
                className="w-full px-4 py-3 bg-sidebar border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                disabled={creating}
              />
              {groupName && (
                <p className="text-xs text-muted-foreground mt-1">
                  {groupName.length}/100 characters
                </p>
              )}
            </div>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Members ({selectedUsers.length})
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-sidebar border border-border rounded-lg">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border border-border"
                    >
                      <Avatar
                        imageUrl={user.profileImageUrl || undefined}
                        name={user.username || user.displayName || '?'}
                        size="sm"
                      />
                      <span className="text-sm">
                        {user.displayName || user.username || 'Unknown'}
                      </span>
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="text-muted-foreground hover:text-foreground ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Search */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Add Members
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by username or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-10 py-3 bg-sidebar border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                )}
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                {searchResults.map((user) => {
                  const isSelected = selectedUsers.find((u) => u.id === user.id)
                  return (
                    <button
                      key={user.id}
                      onClick={() => !isSelected && handleAddUser(user)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 transition-colors text-left',
                        isSelected
                          ? 'bg-muted/50 cursor-not-allowed opacity-50'
                          : 'hover:bg-sidebar'
                      )}
                      disabled={!!isSelected}
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
                        {user.username && (
                          <div className="text-xs text-muted-foreground truncate">
                            @{user.username}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-green-500" />}
                    </button>
                  )
                })}
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No users found
              </div>
            )}

            {!searchQuery && selectedUsers.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground bg-sidebar border border-dashed border-border rounded-lg">
                <p>Search for users to add to your group</p>
                <p className="text-xs mt-1">Group name will auto-generate if not specified</p>
              </div>
            )}
          </div>

          {/* Preview of auto-generated name */}
          {!groupName && selectedUsers.length > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Auto-name preview:</strong>{' '}
                {(() => {
                  const memberNames = selectedUsers.slice(0, 2).map(u => u.displayName || u.username || 'User')
                  const currentUserName = user?.displayName || user?.username || 'You'
                  
                  if (selectedUsers.length === 1) {
                    return `${currentUserName}, ${memberNames[0]}`
                  } else if (selectedUsers.length === 2) {
                    return `${currentUserName}, ${memberNames[0]}, ${memberNames[1]}`
                  } else {
                    return `${currentUserName}, ${memberNames[0]}, ${memberNames[1]} +${selectedUsers.length - 2}`
                  }
                })()}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-sidebar border border-border rounded-lg hover:bg-accent transition-colors"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={creating || selectedUsers.length === 0}
              className={cn(
                'flex-1 px-4 py-3 rounded-lg font-medium transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create Group${selectedUsers.length > 0 ? ` (${selectedUsers.length + 1} members)` : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
