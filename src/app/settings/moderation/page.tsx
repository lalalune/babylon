/**
 * Moderation Settings Page
 * 
 * Manage blocked and muted users
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PageContainer } from '@/components/shared/PageContainer';
import { Ban, VolumeX, UserX, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { Skeleton } from '@/components/shared/Skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BlockedUser {
  id: string;
  createdAt: string;
  reason: string | null;
  blocked: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
  };
}

interface MutedUser {
  id: string;
  createdAt: string;
  reason: string | null;
  muted: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
  };
}

type Tab = 'blocked' | 'muted';

export default function ModerationSettingsPage() {
  const { authenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('blocked');
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authenticated) {
      fetchBlockedUsers();
      fetchMutedUsers();
    }
  }, [authenticated]);

  const fetchBlockedUsers = async () => {
    const response = await fetch('/api/moderation/blocks');
    if (!response.ok) {
      console.error('Failed to fetch blocked users');
      toast.error('Failed to load blocked users');
      setLoading(false);
      return;
    }
    
    const data = await response.json();
    setBlockedUsers(data.blocks || []);
    setLoading(false);
  };

  const fetchMutedUsers = async () => {
    const response = await fetch('/api/moderation/mutes');
    if (!response.ok) {
      console.error('Failed to fetch muted users');
      toast.error('Failed to load muted users');
      return;
    }
    
    const data = await response.json();
    setMutedUsers(data.mutes || []);
  };

  const handleUnblock = async (userId: string, displayName: string) => {
    const response = await fetch(`/api/users/${userId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unblock' }),
    });

    if (!response.ok) {
      toast.error('Failed to unblock user');
      return;
    }
    
    toast.success(`Unblocked ${displayName}`);
    fetchBlockedUsers();
  };

  const handleUnmute = async (userId: string, displayName: string) => {
    const response = await fetch(`/api/users/${userId}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unmute' }),
    });

    if (!response.ok) {
      toast.error('Failed to unmute user');
      return;
    }
    
    toast.success(`Unmuted ${displayName}`);
    fetchMutedUsers();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!authenticated) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please log in to view moderation settings.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Moderation Settings</h1>
          <p className="text-muted-foreground">
            Manage your blocked and muted users
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('blocked')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 -mb-[1px]',
              activeTab === 'blocked'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            <Ban className="w-4 h-4" />
            Blocked ({blockedUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('muted')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 -mb-[1px]',
              activeTab === 'muted'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            <VolumeX className="w-4 h-4" />
            Muted ({mutedUsers.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            {/* Blocked Users */}
            {activeTab === 'blocked' && (
              <div className="space-y-3">
                {blockedUsers.length === 0 ? (
                  <div className="text-center py-12 bg-card border border-border rounded-lg">
                    <UserX className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                    <p className="text-muted-foreground">No blocked users</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Users you block will appear here
                    </p>
                  </div>
                ) : (
                  blockedUsers.map((block) => {
                    const user = block.blocked;
                    const displayName = user.displayName || user.username || 'User';
                    
                    return (
                      <div
                        key={block.id}
                        className="bg-card border border-border rounded-lg p-4 flex items-center gap-4"
                      >
                        <Avatar
                          src={user.profileImageUrl || undefined}
                          alt={displayName}
                          size="md"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{displayName}</div>
                          {user.username && (
                            <div className="text-sm text-muted-foreground">
                              @{user.username}
                            </div>
                          )}
                          {block.reason && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Reason: {block.reason}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Blocked {formatDate(block.createdAt)}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleUnblock(user.id, displayName)}
                          className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Unblock
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Muted Users */}
            {activeTab === 'muted' && (
              <div className="space-y-3">
                {mutedUsers.length === 0 ? (
                  <div className="text-center py-12 bg-card border border-border rounded-lg">
                    <VolumeX className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                    <p className="text-muted-foreground">No muted users</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Users you mute will appear here
                    </p>
                  </div>
                ) : (
                  mutedUsers.map((mute) => {
                    const user = mute.muted;
                    const displayName = user.displayName || user.username || 'User';
                    
                    return (
                      <div
                        key={mute.id}
                        className="bg-card border border-border rounded-lg p-4 flex items-center gap-4"
                      >
                        <Avatar
                          src={user.profileImageUrl || undefined}
                          alt={displayName}
                          size="md"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{displayName}</div>
                          {user.username && (
                            <div className="text-sm text-muted-foreground">
                              @{user.username}
                            </div>
                          )}
                          {mute.reason && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Reason: {mute.reason}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Muted {formatDate(mute.createdAt)}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleUnmute(user.id, displayName)}
                          className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Unmute
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}


