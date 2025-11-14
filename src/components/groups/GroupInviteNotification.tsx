'use client';

/**
 * Group Invite Notification Component
 * 
 * Displays group invites in notifications with accept/decline actions
 */

import { useState } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import { Users, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GroupInviteNotificationProps {
  inviteId: string;
  groupName: string;
  groupDescription?: string | null;
  inviterName: string;
  inviterImage?: string | null;
  memberCount?: number;
  onAccept?: () => void;
  onDecline?: () => void;
}

export function GroupInviteNotification({
  inviteId,
  groupName,
  groupDescription,
  inviterName,
  inviterImage,
  memberCount,
  onAccept,
  onDecline,
}: GroupInviteNotificationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isResponded, setIsResponded] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    const response = await fetch(`/api/user-groups/invites/${inviteId}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
      setIsLoading(false);
      throw new Error(data.error || 'Failed to accept invite');
    }

    toast.success(`You joined ${groupName}!`);
    setIsResponded(true);
    onAccept?.();
    setIsLoading(false);
  };

  const handleDecline = async () => {
    setIsLoading(true);
    const response = await fetch(`/api/user-groups/invites/${inviteId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      setIsLoading(false);
      throw new Error(data.error || 'Failed to decline invite');
    }

    toast.success('Invite declined');
    setIsResponded(true);
    onDecline?.();
    setIsLoading(false);
  };

  if (isResponded) {
    return null;
  }

  return (
    <div className="p-4 bg-sidebar border border-border rounded-lg shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar
          imageUrl={inviterImage || undefined}
          name={inviterName}
          size="md"
        />

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Group Invitation</span>
            </div>
            
            <p className="text-sm mb-2">
              <span className="font-medium">{inviterName}</span> invited you to join{' '}
              <span className="font-medium">{groupName}</span>
            </p>

            {groupDescription && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {groupDescription}
              </p>
            )}

            {memberCount !== undefined && (
              <p className="text-xs text-muted-foreground">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 inline animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 inline mr-1" />
                  Accept
                </>
              )}
            </button>
            <button
              onClick={handleDecline}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg font-medium bg-background border border-border hover:bg-accent transition-colors disabled:opacity-50 text-sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 inline animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 inline mr-1" />
                  Decline
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

