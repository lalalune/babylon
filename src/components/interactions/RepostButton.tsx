'use client';

import { cn } from '@/lib/utils';
import { Repeat2, X } from 'lucide-react';
import { useState } from 'react';
import { useInteractionStore } from '@/stores/interactionStore';
import { useAuth } from '@/hooks/useAuth';
import { useLoginModal } from '@/hooks/useLoginModal';
import type { RepostButtonProps } from '@/types/interactions';
import { BouncingLogo } from '@/components/shared/BouncingLogo';

const sizeClasses = {
  sm: 'h-8 px-2 text-xs gap-1',
  md: 'h-10 px-3 text-sm gap-1.5',
  lg: 'h-12 px-4 text-base gap-2',
};

const iconSizes = {
  sm: 18,
  md: 20,
  lg: 22,
};

export function RepostButton({
  postId,
  shareCount,
  initialShared = false,
  size = 'md',
  showCount = true,
  className,
}: RepostButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const { toggleShare, postInteractions, loadingStates } = useInteractionStore();
  
  // Get state from store instead of local state
  const storeData = postInteractions.get(postId);
  const isShared = storeData?.isShared ?? initialShared;
  const count = storeData?.shareCount ?? shareCount;
  const isLoading = loadingStates.get(`share-${postId}`) ?? false;

  const { authenticated } = useAuth();
  const { showLoginModal } = useLoginModal();

  const handleClick = () => {
    if (!authenticated) {
      showLoginModal({
        title: 'Login to Share',
        message: 'Log in to share posts with your followers.',
      });
      return;
    }
    if (isShared) {
      // If already shared, unshare immediately
      handleShare();
    } else {
      // Show confirmation for new share
      setShowConfirmation(true);
    }
  };

  const handleShare = async () => {
    // Close confirmation modal
    setShowConfirmation(false);

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    await toggleShare(postId);
  };

  return (
    <>
      {/* Share Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          'flex items-center transition-all duration-200',
          'bg-transparent hover:opacity-70',
          isShared ? 'text-green-600' : 'text-muted-foreground',
          sizeClasses[size],
          isAnimating && 'scale-110',
          isLoading && 'opacity-50 cursor-wait',
          className
        )}
      >
        {isLoading ? (
          <BouncingLogo size={iconSizes[size]} />
        ) : (
          <Repeat2
            size={iconSizes[size]}
            className={cn(
              'transition-all duration-200',
              isAnimating && 'rotate-180'
            )}
          />
        )}
        {showCount && count > 0 && (
          <span className="font-medium tabular-nums">{count}</span>
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={() => setShowConfirmation(false)}
          />

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
            <div className="bg-popover border border-border rounded-lg shadow-lg p-6 m-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Share Post</h3>
                <button
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <p className="text-muted-foreground mb-6">
                Share this post to your profile? It will appear in your followers&apos; feeds.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg',
                    'border border-border',
                    'hover:bg-muted transition-colors'
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg',
                    'bg-green-600 text-white',
                    'hover:bg-green-700 transition-colors',
                    'font-medium'
                  )}
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
