'use client';

/**
 * Group Details Modal
 * 
 * Shows group details with member management for admins
 */

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import { Crown, UserMinus, UserPlus, Shield, Settings, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GroupMember {
  userId: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  joinedAt: string;
  isAdmin: boolean;
}

interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  members: GroupMember[];
  isCurrentUserAdmin: boolean;
}

interface GroupDetailsModalProps {
  groupId: string;
  onClose: () => void;
  onGroupUpdated: () => void;
}

export function GroupDetailsModal({ groupId, onClose, onGroupUpdated }: GroupDetailsModalProps) {
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadGroup = async () => {
    const response = await fetch(`/api/user-groups/${groupId}`);
    const data = await response.json();

    if (!response.ok) {
      toast.error('Failed to load group details');
      onClose();
      throw new Error(data.error || 'Failed to load group');
    }

    setGroup(data.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    const response = await fetch(`/api/user-groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to remove member');
    }

    toast.success('Member removed');
    loadGroup();
    onGroupUpdated();
  };

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    const url = isCurrentlyAdmin
      ? `/api/user-groups/${groupId}/admins/${userId}`
      : `/api/user-groups/${groupId}/admins`;

    const response = await fetch(url, {
      method: isCurrentlyAdmin ? 'DELETE' : 'POST',
      headers: isCurrentlyAdmin ? undefined : {
        'Content-Type': 'application/json',
      },
      body: isCurrentlyAdmin ? undefined : JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update admin status');
    }

    toast.success(isCurrentlyAdmin ? 'Admin privileges revoked' : 'Admin privileges granted');
    loadGroup();
    onGroupUpdated();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
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
            <h2 className="text-xl font-bold">{isLoading ? 'Loading...' : group?.name || 'Group Details'}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : group ? (
            <div className="space-y-4">
              {/* Add Member Button */}
              {group.isCurrentUserAdmin && (
                <div className="flex justify-end">
                  <button
                    className="px-3 py-1.5 text-sm font-medium bg-sidebar border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    <UserPlus className="h-4 w-4 inline mr-1" />
                    Add Member
                  </button>
                </div>
              )}

              {/* Members */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold">
                  Members ({group.members.length})
                </label>
                
                <div className="space-y-2">
                  {group.members.map((member) => {
                    const isCreator = member.userId === group.createdById
                    return (
                      <div
                        key={member.userId}
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

                        {/* Actions */}
                        {group.isCurrentUserAdmin && !isCreator && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleAdmin(member.userId, member.isAdmin)}
                              className="p-2 hover:bg-background rounded-md transition-colors"
                              title={member.isAdmin ? 'Remove Admin' : 'Make Admin'}
                            >
                              <Shield className={cn(
                                "w-4 h-4",
                                member.isAdmin ? 'text-primary' : 'text-muted-foreground'
                              )} />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              className="p-2 hover:bg-background rounded-md transition-colors"
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
  );
}

