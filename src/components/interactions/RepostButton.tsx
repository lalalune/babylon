'use client';

import { cn } from '@/lib/utils';
import { Repeat2, X } from 'lucide-react';
import { useState } from 'react';
import { useInteractionStore } from '@/stores/interactionStore';
import { useFeedStore } from '@/stores/feedStore';
import { useAuth } from '@/hooks/useAuth';
import { useLoginModal } from '@/hooks/useLoginModal';
import type { RepostButtonProps } from '@/types/interactions';
import type { FeedPost } from '@/shared/types';
import { Skeleton } from '@/components/shared/Skeleton';
// // import { toast } from 'sonner';

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

const skeletonSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-5 h-5',
};

export function RepostButton({
  postId,
  shareCount,
  initialShared = false,
  size = 'md',
  showCount = true,
  className,
  postData,
}: RepostButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [quoteComment, setQuoteComment] = useState('');

  const { toggleShare, postInteractions, loadingStates } = useInteractionStore();
  const { addOptimisticPost } = useFeedStore();
  
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
      // Show modal for new share
      setShowConfirmation(true);
      setQuoteComment('');
    }
  };

  const handleShare = async () => {
    const commentToSend = quoteComment.trim() || undefined;
    const isQuote = !!commentToSend;
    
    // Close confirmation modal
    setShowConfirmation(false);

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    const response = await toggleShare(postId, commentToSend);
    
    // If this is a quote post and we got repost data back, add it optimistically to the feed
    if (response && response.repostPost && isQuote) {
      const repostData = response.repostPost;
      const optimisticPost: FeedPost = {
        id: repostData.id,
        content: repostData.content,
        author: repostData.authorId,
        authorId: repostData.authorId,
        authorName: repostData.authorName,
        authorUsername: repostData.authorUsername || undefined,
        authorProfileImageUrl: repostData.authorProfileImageUrl || undefined,
        timestamp: repostData.timestamp,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        isLiked: false,
        isShared: false,
        // Repost metadata
        isRepost: repostData.isRepost || false,
        originalPostId: repostData.originalPostId || null,
        originalAuthorId: repostData.originalAuthorId || null,
        originalAuthorName: repostData.originalAuthorName || null,
        originalAuthorUsername: repostData.originalAuthorUsername || null,
        originalAuthorProfileImageUrl: repostData.originalAuthorProfileImageUrl || null,
        originalContent: repostData.originalContent || null,
        quoteComment: repostData.quoteComment || null,
      };
      
      // Add to feed optimistically
      addOptimisticPost(optimisticPost);
    }
    
    // Reset state
    setQuoteComment('');
  };
  
  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Share Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        aria-label={isShared ? 'Unrepost' : 'Repost'}
        aria-pressed={isShared}
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
          <Skeleton className={cn("rounded", skeletonSizes[size])} />
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

      {/* Repost Modal - X/Farcaster Style */}
      {showConfirmation && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => {
              setShowConfirmation(false);
              setQuoteComment('');
            }}
          />

          {/* Modal - Mobile */}
          <div className="fixed inset-x-4 top-20 bottom-auto z-50 md:hidden rounded-2xl border border-white/10 bg-[#050816] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmation(false);
                    setQuoteComment('');
                  }}
                  className="text-foreground/70 hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
                <h2 className="text-lg font-semibold text-foreground">
                  {quoteComment.trim() ? 'Quote' : 'Repost'}
                </h2>
              </div>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isLoading}
                  aria-label={quoteComment.trim() ? 'Post quote' : 'Post repost'}
                  className={cn(
                    'px-4 py-1.5 rounded-full font-semibold text-sm',
                    'bg-green-600 text-primary-foreground',
                    'hover:bg-green-700 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <span role="status" aria-live="polite">Posting...</span>
                  ) : (
                    'Post'
                  )}
                </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Quote Comment Textarea */}
              <textarea
                value={quoteComment}
                onChange={(e) => setQuoteComment(e.target.value)}
                placeholder="Add your thoughts (optional)"
                maxLength={500}
                rows={3}
                aria-label="Quote comment"
                aria-describedby="char-count-mobile"
                className={cn(
                  'w-full p-3 rounded-xl mb-1',
                  'border-0 bg-transparent',
                  'text-foreground placeholder:text-foreground/40',
                  'resize-none focus:outline-none',
                  'transition-colors'
                )}
                autoFocus
              />
              
              {/* Character Count */}
              {quoteComment.length > 0 && (
                <div className="flex justify-end mb-3">
                  <span 
                    id="char-count-mobile"
                    className={cn(
                      'text-xs',
                      quoteComment.length > 450 ? 'text-red-400' : 'text-foreground/40'
                    )}
                  >
                    {quoteComment.length}/500
                  </span>
                </div>
              )}
              
              {/* Original Post Preview */}
              {postData && (
                <div className={cn(
                  'rounded-xl border border-white/10 p-4 mt-4',
                  'bg-white/5'
                )}>
                  {/* Original Post Author */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-foreground text-sm font-semibold shrink-0">
                      {postData.authorName[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm truncate">
                          {postData.authorName}
                        </span>
                        <span className="text-foreground/40 text-xs">
                          {formatTime(postData.timestamp)}
                        </span>
                      </div>
                      <span className="text-foreground/50 text-xs">
                        @{postData.authorUsername || postData.authorId}
                      </span>
                    </div>
                  </div>
                  
                  {/* Original Post Content */}
                  <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {postData.content}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Modal - Desktop */}
          <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-4">
            <div className="rounded-2xl border border-white/10 bg-[#050816] shadow-2xl w-full max-w-[580px] max-h-[85vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmation(false);
                      setQuoteComment('');
                    }}
                    className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    <X size={20} />
                  </button>
                  <h2 className="text-lg font-semibold text-primary-foreground">
                    {quoteComment.trim() ? 'Quote' : 'Repost'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isLoading}
                  aria-label={quoteComment.trim() ? 'Post quote' : 'Post repost'}
                  className={cn(
                    'px-5 py-2 rounded-full font-semibold text-sm',
                    'bg-green-600 text-primary-foreground',
                    'hover:bg-green-700 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center gap-2'
                  )}
                >
                  {isLoading ? (
                    <span role="status" aria-live="polite" className="flex items-center gap-2">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      Posting...
                    </span>
                  ) : (
                    'Post'
                  )}
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* Quote Comment Textarea */}
                <textarea
                  value={quoteComment}
                  onChange={(e) => setQuoteComment(e.target.value)}
                  placeholder="Add your thoughts (optional)"
                  maxLength={500}
                  rows={4}
                  aria-label="Quote comment"
                  aria-describedby="char-count-desktop"
                  className={cn(
                    'w-full p-4 rounded-xl mb-1',
                    'border-0 bg-transparent',
                    'text-primary-foreground text-base placeholder:text-primary-foreground/40',
                    'resize-none focus:outline-none',
                    'transition-colors'
                  )}
                  autoFocus
                />
                
                {/* Character Count */}
                {quoteComment.length > 0 && (
                  <div className="flex justify-end mb-4">
                    <span 
                      id="char-count-desktop"
                      className={cn(
                        'text-sm',
                        quoteComment.length > 450 ? 'text-red-400' : 'text-foreground/40'
                      )}
                    >
                      {quoteComment.length}/500
                    </span>
                  </div>
                )}
                
                {/* Original Post Preview */}
                {postData && (
                  <div className={cn(
                    'rounded-xl border border-white/10 p-5 mt-4',
                    'bg-white/5'
                  )}>
                    {/* Original Post Author */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-foreground font-semibold shrink-0">
                        {postData.authorName[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary-foreground truncate">
                            {postData.authorName}
                          </span>
                          <span className="text-primary-foreground/40 text-sm">
                            {formatTime(postData.timestamp)}
                          </span>
                        </div>
                        <span className="text-primary-foreground/50 text-sm">
                          @{postData.authorUsername || postData.authorId}
                        </span>
                      </div>
                    </div>
                    
                    {/* Original Post Content */}
                    <p className="text-primary-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                      {postData.content}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
