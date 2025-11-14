'use client';

import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

interface DeleteButtonProps {
  postId: string;
  postAuthorId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onDeleted?: () => void;
}

const sizeClasses = {
  sm: 'h-8 px-2 text-xs gap-1',
  md: 'h-10 px-3 text-sm gap-1.5',
  lg: 'h-12 px-4 text-base gap-2',
};

const iconSizes = {
  sm: 16,
  md: 18,
  lg: 20,
};

export function DeleteButton({
  postId,
  postAuthorId,
  size = 'md',
  className,
  onDeleted,
}: DeleteButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();

  // Only show delete button if user is the author
  if (!user || user.id !== postAuthorId) {
    return null;
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    const response = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setIsDeleting(false);
      setShowConfirmation(false);
      throw new Error(data.error || 'Failed to delete post');
    }

    logger.info('Post deleted successfully', { postId, userId: user.id }, 'DeleteButton');
    
    // Call callback if provided
    if (onDeleted) {
      onDeleted();
    }

    // Refresh the page to remove the post from view
    window.location.reload();
  };

  const handleClick = () => {
    setShowConfirmation(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDeleting}
        className={cn(
          'flex items-center bg-transparent hover:text-red-500 transition-all duration-200',
          sizeClasses[size],
          isDeleting && 'opacity-50 cursor-not-allowed',
          className
        )}
        title="Delete post"
      >
        <Trash2 size={iconSizes[size]} />
      </button>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowConfirmation(false)}
        >
          <div
            className="bg-background border border-border rounded-lg p-6 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Delete Post?</h3>
            <p className="text-muted-foreground mb-4">
              This post will be permanently deleted. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-primary-foreground transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

