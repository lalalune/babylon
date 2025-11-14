'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/shared/Avatar'
import { Search, X, Loader2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrivy } from '@privy-io/react-auth'

interface User {
  id: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
  bio: string | null
}

interface InviteUsersModalProps {
  isOpen: boolean
  onClose: () => void
  onInvite: (userIds: string[]) => Promise<void>
  chatId?: string
  chatName?: string
  currentParticipantIds?: string[]
}

export function InviteUsersModal({
  isOpen,
  onClose,
  onInvite,
  chatId: _chatId,
  chatName,
  currentParticipantIds = [],
}: InviteUsersModalProps) {
  const { getAccessToken } = usePrivy()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setError(null)

    const token = await getAccessToken()
    if (!token) {
      setError('Authentication required')
      setIsSearching(false)
      return
    }

    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      setIsSearching(false)
      throw new Error('Failed to search users')
    }

    const data = await response.json()
    // Filter out users already in the chat
    const filteredUsers = data.users.filter(
      (user: User) => !currentParticipantIds.includes(user.id)
    )
    setSearchResults(filteredUsers)
    setIsSearching(false)
  }, [getAccessToken, currentParticipantIds])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, searchUsers])

  const handleSelectUser = (user: User) => {
    if (selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id))
    } else {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  const handleInvite = async () => {
    if (selectedUsers.length === 0) return

    setIsInviting(true)
    setError(null)

    await onInvite(selectedUsers.map((u) => u.id))
    // Reset and close
    setSelectedUsers([])
    setSearchQuery('')
    setSearchResults([])
    onClose()
    setIsInviting(false)
  }

  const handleClose = () => {
    if (!isInviting) {
      setSelectedUsers([])
      setSearchQuery('')
      setSearchResults([])
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader>
            <DialogTitle>Invite Users {chatName && `to ${chatName}`}</DialogTitle>
            <DialogDescription>
              Search for users by username or name to invite them to the chat
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-4 space-y-4">
          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-sidebar-accent/30 rounded-lg">
              {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border border-border"
              >
                <Avatar
                  id={user.id}
                  name={user.displayName || user.username || 'User'}
                  type="user"
                  size="sm"
                  imageUrl={user.profileImageUrl || undefined}
                />
                <span className="text-sm font-medium">
                  {user.displayName || user.username}
                </span>
                  <button
                    onClick={() => handleSelectUser(user)}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by username or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-9 pr-9 py-2.5 rounded-lg text-sm',
                'bg-sidebar-accent/50 border border-border',
                'text-foreground placeholder:text-muted-foreground',
                'outline-none focus:ring-2 focus:ring-primary/50'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-muted-foreground/20 rounded-full p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] border-t border-border">
          {isSearching ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="divide-y divide-border">
              {searchResults.map((user) => {
                const isSelected = selectedUsers.find((u) => u.id === user.id)
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={cn(
                      'w-full p-3 flex items-center gap-3 hover:bg-sidebar-accent/50 transition-colors text-left',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <Avatar
                      id={user.id}
                      name={user.displayName || user.username || 'User'}
                      type="user"
                      size="md"
                      imageUrl={user.profileImageUrl || undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {user.displayName || user.username || 'User'}
                      </div>
                      {user.username && user.displayName && (
                        <div className="text-xs text-muted-foreground truncate">
                          @{user.username}
                        </div>
                      )}
                      {user.bio && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {user.bio}
                        </div>
                      )}
                    </div>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-border'
                      )}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : searchQuery.trim().length >= 2 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <UserPlus className="w-12 h-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No users found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Search className="w-12 h-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Search for users to invite
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Type at least 2 characters
              </p>
            </div>
          )}
        </div>

        <div className="p-6 pt-4 border-t border-border">
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isInviting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={selectedUsers.length === 0 || isInviting}
            >
              {isInviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Inviting...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite {selectedUsers.length > 0 && `(${selectedUsers.length})`}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

