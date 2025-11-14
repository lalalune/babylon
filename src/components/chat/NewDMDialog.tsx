'use client'

import { Avatar } from '@/components/shared/Avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePrivy } from '@privy-io/react-auth'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface User {
  id: string
  displayName: string | null
  username: string | null
  profileImageUrl: string | null
  bio: string | null
}

interface NewDMDialogProps {
  isOpen: boolean
  onClose: () => void
  onChatCreated: (chatId: string) => void
}

export function NewDMDialog({ isOpen, onClose, onChatCreated }: NewDMDialogProps) {
  const { getAccessToken } = usePrivy()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSearchResults([])
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      setError(null)

      try {
        const token = await getAccessToken()
        if (!token) {
          setError('Authentication required')
          setIsSearching(false)
          return
        }

        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error('Failed to search users')
        }

        const data = await response.json()
        setSearchResults(data.users || [])
      } catch (err) {
        console.error('Search error:', err)
        setError('Failed to search users. Please try again.')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery, getAccessToken])

  const handleCreateDM = async (userId: string) => {
    setIsCreating(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) {
        setError('Authentication required')
        setIsCreating(false)
        return
      }

      const response = await fetch('/api/chats/dm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create DM')
      }

      const data = await response.json()
      onChatCreated(data.chat.id)
      onClose()
    } catch (err) {
      console.error('Create DM error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create conversation')
    } finally {
      setIsCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-bold">New Direct Message</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sidebar-accent/30 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or display name..."
              autoFocus
              className={cn(
                'w-full pl-9 pr-9 py-2 rounded-lg text-sm',
                'bg-sidebar-accent/50',
                'text-foreground placeholder:text-muted-foreground',
                'outline-none border border-border focus:border-blue-500',
                'transition-colors'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-500 mt-2">{error}</p>
          )}
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : searchQuery.trim().length < 2 ? (
            <div className="text-center py-12 px-4">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Type at least 2 characters to search for users
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 px-4">
              <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No users found matching &quot;{searchQuery}&quot;
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleCreateDM(user.id)}
                  disabled={isCreating}
                  className={cn(
                    'w-full p-4 flex items-center gap-3',
                    'hover:bg-sidebar-accent/30 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'text-left'
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
                    <div className="font-semibold text-sm text-foreground">
                      {user.displayName || user.username || 'Unknown User'}
                    </div>
                    {user.username && (
                      <div className="text-xs text-muted-foreground">
                        @{user.username}
                      </div>
                    )}
                    {user.bio && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {user.bio}
                      </div>
                    )}
                  </div>
                  {isCreating && <Loader2 className="w-5 h-5 animate-spin" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button onClick={onClose} variant="outline" className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
