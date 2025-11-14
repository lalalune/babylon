'use client';

/**
 * Admin Panel - Group Chats View
 * 
 * View all group chats in the system with:
 * - Filtering by creator
 * - Sorting by various fields
 * - Message viewing
 * - Group type filtering
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
// import { toast } from 'sonner';
import { z } from 'zod';

const GroupParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  isNPC: z.boolean(),
  profileImageUrl: z.string().nullable(),
  joinedAt: z.string(),
});

const MessageSenderSchema = z.object({
  id: z.string(),
  name: z.string(),
  isNPC: z.boolean(),
});

const RecentMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  sender: MessageSenderSchema,
});

const GroupChatSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  groupType: z.string(),
  creatorId: z.string().nullable(),
  creatorName: z.string(),
  memberCount: z.number(),
  messageCount: z.number(),
  participants: z.array(GroupParticipantSchema),
  recentMessages: z.array(RecentMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
type GroupChat = z.infer<typeof GroupChatSchema>;

const FullMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  sender: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string().nullable(),
    isNPC: z.boolean(),
    profileImageUrl: z.string().nullable(),
  }),
});
type FullMessage = z.infer<typeof FullMessageSchema>;

export function GroupChatsAdmin() {
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creatorFilter, setCreatorFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [fullMessages, setFullMessages] = useState<Record<string, FullMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<Record<string, boolean>>({});

  const loadGroups = async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      sortBy,
      sortOrder,
    });
    
    if (creatorFilter) {
      params.append('creator', creatorFilter);
    }

    const response = await fetch(`/api/admin/groups?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load groups');
    }

    const validation = z.array(GroupChatSchema).safeParse(data.data.groups);
    if (!validation.success) {
      throw new Error('Invalid group data structure');
    }
    setGroups(validation.data);
    setIsLoading(false);
  };

  const loadMessages = async (groupId: string) => {
    if (fullMessages[groupId]) {
      // Already loaded
      return;
    }

    setLoadingMessages(prev => ({ ...prev, [groupId]: true }));
    
    const response = await fetch(`/api/admin/groups/${groupId}/messages?limit=100`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load messages');
    }

    const validation = z.array(FullMessageSchema).safeParse(data.data.messages);
    if (!validation.success) {
      throw new Error('Invalid message data structure');
    }

    setFullMessages(prev => ({
      ...prev,
      [groupId]: validation.data,
    }));
    setLoadingMessages(prev => ({ ...prev, [groupId]: false }));
  };

  const toggleGroup = async (groupId: string) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupId);
      await loadMessages(groupId);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [sortBy, sortOrder]);

  const handleFilterApply = () => {
    loadGroups();
  };

  const getGroupTypeBadge = (type: string) => {
    switch (type) {
      case 'npc-only':
        return <Badge variant="secondary">NPC Only</Badge>;
      case 'npc-mixed':
        return <Badge variant="default">Alpha Group</Badge>;
      case 'user':
        return <Badge variant="outline">User Group</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading groups...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Group Chats Admin</span>
            <Button onClick={loadGroups} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-2 block">Filter by Creator</label>
              <div className="flex gap-2">
                <Input
                  value={creatorFilter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreatorFilter(e.target.value)}
                  placeholder="Creator name..."
                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleFilterApply()}
                />
                <Button onClick={handleFilterApply}>Apply</Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created Date</SelectItem>
                  <SelectItem value="memberCount">Member Count</SelectItem>
                  <SelectItem value="messageCount">Message Count</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Order</label>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{groups.length}</div>
                <div className="text-sm text-muted-foreground">Total Groups</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {groups.reduce((sum, g) => sum + g.memberCount, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Members</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {groups.reduce((sum, g) => sum + g.messageCount, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Messages</div>
              </CardContent>
            </Card>
          </div>

          {/* Groups List */}
          {groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No groups found
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const isExpanded = expandedGroup === group.id;
                const messages = fullMessages[group.id] || group.recentMessages;
                const isLoadingMsgs = loadingMessages[group.id];

                return (
                  <Card key={group.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">
                              {group.name || `Group ${group.id.slice(0, 8)}`}
                            </h3>
                            {getGroupTypeBadge(group.groupType)}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Creator: <span className="font-medium">{group.creatorName}</span></div>
                            <div className="flex gap-4">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {group.memberCount} members
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {group.messageCount} messages
                              </span>
                            </div>
                            <div>Created: {new Date(group.createdAt).toLocaleString()}</div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleGroup(group.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          {/* Participants */}
                          <div>
                            <h4 className="font-medium mb-2">Participants ({group.participants.length})</h4>
                            <div className="flex flex-wrap gap-2">
                              {group.participants.map(p => (
                                <Badge key={p.id} variant={p.isNPC ? 'secondary' : 'outline'}>
                                  {p.name} {p.isNPC && '(NPC)'}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Messages */}
                          <div>
                            <h4 className="font-medium mb-2">
                              Messages {!isLoadingMsgs && `(showing ${messages.length})`}
                            </h4>
                            {isLoadingMsgs ? (
                              <div className="text-center py-4 text-muted-foreground">
                                Loading messages...
                              </div>
                            ) : messages.length === 0 ? (
                              <div className="text-center py-4 text-muted-foreground">
                                No messages yet
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {messages.map(msg => (
                                  <div key={msg.id} className="border rounded p-3">
                                    <div className="flex items-start justify-between mb-1">
                                      <span className="font-medium text-sm">
                                        {msg.sender.name}
                                        {msg.sender.isNPC && (
                                          <Badge variant="secondary" className="ml-2 text-xs">
                                            NPC
                                          </Badge>
                                        )}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(msg.createdAt).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="text-sm">{msg.content}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

