/**
 * Block User Modal
 */

'use client';

import { useState, useTransition } from 'react';
import { X, Ban } from 'lucide-react';
import { toast } from 'sonner';

interface BlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetDisplayName: string;
  onSuccess?: () => void;
}

export function BlockUserModal({
  isOpen,
  onClose,
  targetUserId,
  targetDisplayName,
  onSuccess,
}: BlockUserModalProps) {
  const [reason, setReason] = useState('');
  const [isBlocking, startBlocking] = useTransition();

  const handleBlock = () => {
    startBlocking(async () => {
      const response = await fetch(`/api/users/${targetUserId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block',
          reason: reason || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to block user');
        return;
      }

      toast.success(`Blocked ${targetDisplayName}`);
      onClose();
      onSuccess?.();
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Ban className="w-5 h-5 text-orange-500" />
            Block User
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-muted-foreground mb-4">
          Are you sure you want to block <strong>{targetDisplayName}</strong>?
        </p>

        <div className="bg-muted/50 border border-border rounded-lg p-3 mb-4">
          <p className="text-sm text-muted-foreground">
            Blocking will:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
            <li>Remove them from your followers</li>
            <li>Hide their posts from your feed</li>
            <li>Prevent them from seeing your posts</li>
            <li>Prevent them from messaging you</li>
          </ul>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you blocking this user?"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isBlocking}
            className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleBlock}
            disabled={isBlocking}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isBlocking ? (
              <>Blocking...</>
            ) : (
              <>
                <Ban className="w-4 h-4" />
                Block User
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


