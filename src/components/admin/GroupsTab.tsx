'use client'

import { useState, useCallback, useEffect, useTransition } from 'react'
import { Users, Search, Calendar, MessageCircle, User as UserIcon, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
// import { toast } from 'sonner'
import { z } from 'zod'

const ParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  isNPC: z.boolean(),
  profileImageUrl: z.string().nullable(),
  joinedAt: z.coerce.date(),
});
// type Participant = z.infer<typeof ParticipantSchema>;

const MessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
  sender: z.object({
    id: z.string(),
    name: z.string(),
    isNPC: z.boolean(),
  }),
});
// type Message = z.infer<typeof MessageSchema>;

const GroupChatSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  groupType: z.string(),
  creatorId: z.string().nullable(),
  creatorName: z.string(),
  memberCount: z.number(),
  messageCount: z.number(),
  participants: z.array(ParticipantSchema),
  recentMessages: z.array(MessageSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
type GroupChat = z.infer<typeof GroupChatSchema>;

export function GroupsTab() {
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null)
  const [sortBy, setSortBy] = useState<'createdAt' | 'memberCount' | 'messageCount'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isRefreshing, startRefresh] = useTransition();

  const fetchGroups = useCallback(async () => {
    startRefresh(async () => {
      setIsLoading(true)
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null

      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `/api/admin/groups?sortBy=${sortBy}&sortOrder=${sortOrder}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch groups')
      }

      const data = await response.json()
      const validation = z.array(GroupChatSchema).safeParse(data.data.groups);
      if (!validation.success) {
        throw new Error('Invalid group data structure');
      }
      setGroups(validation.data || [])
      setIsLoading(false)
    });
  }, [sortBy, sortOrder, startRefresh])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const filteredGroups = groups.filter(group =>
    (group.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    group.creatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getGroupTypeLabel = (type: string) => {
    switch (type) {
      case 'npc-only':
        return 'NPC Only'
      case 'npc-mixed':
        return 'NPC + Users'
      case 'user':
        return 'User Created'
      default:
        return 'Unknown'
    }
  }

  const getGroupTypeColor = (type: string) => {
    switch (type) {
      case 'npc-only':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
      case 'npc-mixed':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
      case 'user':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Group Chats</h2>
          <span className="text-sm text-muted-foreground">
            ({filteredGroups.length} {filteredGroups.length === 1 ? 'group' : 'groups'})
          </span>
        </div>
        <button
          onClick={fetchGroups}
          disabled={isLoading || isRefreshing}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-4 h-4', (isLoading || isRefreshing) && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search groups by name, creator, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:border-primary'
            )}
          />
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className={cn(
              'px-4 py-2 rounded-lg border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:border-primary'
            )}
          >
            <option value="createdAt">Created Date</option>
            <option value="memberCount">Member Count</option>
            <option value="messageCount">Message Count</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className={cn(
              'px-4 py-2 rounded-lg border border-border',
              'bg-background hover:bg-muted transition-colors'
            )}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Groups List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No group chats found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className={cn(
                'bg-card border border-border rounded-lg p-4 space-y-3',
                'hover:border-primary transition-colors cursor-pointer',
                selectedGroup?.id === group.id && 'border-primary'
              )}
              onClick={() => setSelectedGroup(group)}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {group.name || 'Unnamed Group'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ID: {group.id}
                  </p>
                </div>
                <span
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium border whitespace-nowrap',
                    getGroupTypeColor(group.groupType)
                  )}
                >
                  {getGroupTypeLabel(group.groupType)}
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                  <span>{group.memberCount} members</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  <span>{group.messageCount} messages</span>
                </div>
              </div>

              {/* Creator */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Creator:</span>
                <span className="font-medium">{group.creatorName}</span>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Participants Preview */}
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Participants:</p>
                <div className="flex flex-wrap gap-1">
                  {group.participants.slice(0, 5).map((participant) => (
                    <span
                      key={participant.id}
                      className={cn(
                        'px-2 py-1 rounded text-xs',
                        participant.isNPC
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      {participant.name}
                    </span>
                  ))}
                  {group.participants.length > 5 && (
                    <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                      +{group.participants.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Group Details */}
      {selectedGroup && (
        <div className="bg-card border border-primary rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Group Details</h3>
            <button
              onClick={() => setSelectedGroup(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          {/* Full Participant List */}
          <div>
            <h4 className="font-medium mb-2">All Participants ({selectedGroup.memberCount})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedGroup.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{participant.name}</span>
                    {participant.isNPC && (
                      <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        NPC
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Joined {new Date(participant.joinedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Messages */}
          {selectedGroup.recentMessages.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Recent Messages</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedGroup.recentMessages.map((message) => (
                  <div
                    key={message.id}
                    className="p-3 rounded bg-muted/50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{message.sender.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

