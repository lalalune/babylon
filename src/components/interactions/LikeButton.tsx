'use client';

import { cn } from '@/lib/utils';
import { Heart, Laugh, Frown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useInteractionStore } from '@/stores/interactionStore';
import type { LikeButtonProps } from '@/types/interactions';
import { Skeleton } from '@/components/shared/Skeleton';
import { useSocialTracking } from '@/hooks/usePostHog';

// Reaction configuration type
type ReactionConfig = {
  readonly icon: React.ComponentType<{ size?: number; className?: string }>;
  readonly color: string;
  readonly bgColor: string;
  readonly hoverColor: string;
  readonly label: string;
  readonly fill: boolean;
};

// Reaction types with icons and colors
const REACTION_TYPES: Record<string, ReactionConfig> = {
  like: {
    icon: Heart,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    hoverColor: 'hover:bg-red-500/20',
    label: 'Like',
    fill: false,
  },
  love: {
    icon: Heart,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    hoverColor: 'hover:bg-pink-500/20',
    label: 'Love',
    fill: true,
  },
  laugh: {
    icon: Laugh,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    hoverColor: 'hover:bg-yellow-500/20',
    label: 'Laugh',
    fill: false,
  },
  sad: {
    icon: Frown,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    hoverColor: 'hover:bg-blue-500/20',
    label: 'Sad',
    fill: false,
  },
};

type ReactionType = keyof typeof REACTION_TYPES;

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

export function LikeButton({
  targetId,
  targetType,
  initialLiked = false,
  initialCount = 0,
  initialReactionType = 'like',
  size = 'md',
  showCount = true,
  className,
}: LikeButtonProps & { initialReactionType?: ReactionType }) {
  const [currentReaction, setCurrentReaction] = useState<ReactionType>(initialReactionType);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressStartTime = useRef<number>(0);

  const { toggleLike, toggleCommentLike, postInteractions, commentInteractions, loadingStates } = useInteractionStore();
  const { trackPostLike } = useSocialTracking();

  // Get state from store instead of local state
  const storeData = targetType === 'post' 
    ? postInteractions.get(targetId)
    : commentInteractions.get(targetId);
  
  const isLiked = storeData?.isLiked ?? initialLiked;
  const likeCount = storeData?.likeCount ?? initialCount;
  const isLoading = loadingStates.get(targetId) ?? false;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleClick = async () => {
    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    const willBeLiked = !isLiked;
    if (targetType === 'post') {
      await toggleLike(targetId);
      // Track like action (client-side for instant feedback)
      if (willBeLiked) {
        trackPostLike(targetId, true);
      }
    } else {
      await toggleCommentLike(targetId);
    }
  };

  const handleReactionSelect = async (reactionType: ReactionType) => {
    setShowReactionPicker(false);
    setCurrentReaction(reactionType);

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    if (targetType === 'post') {
      await toggleLike(targetId);
    } else {
      await toggleCommentLike(targetId);
    }
  };

  const handleMouseDown = () => {
    longPressStartTime.current = Date.now();
    longPressTimer.current = setTimeout(() => {
      setShowReactionPicker(true);
    }, 500); // 500ms long press
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    const pressDuration = Date.now() - longPressStartTime.current;

    // If it was a short press and reaction picker isn't showing, treat as click
    if (pressDuration < 500 && !showReactionPicker) {
      handleClick();
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const reaction = REACTION_TYPES[currentReaction]!;
  const Icon = reaction.icon;

  return (
    <div className="relative">
      {/* Main Like Button */}
      <button
        type="button"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={isLoading}
        className={cn(
          'flex items-center transition-all duration-200',
          'bg-transparent hover:opacity-70',
          isLiked ? reaction.color : 'text-muted-foreground',
          sizeClasses[size],
          isAnimating && 'scale-110',
          isLoading && 'opacity-50 cursor-wait',
          className
        )}
      >
        {isLoading ? (
          <Skeleton className={cn("rounded", skeletonSizes[size])} />
        ) : (
          <Icon
            size={iconSizes[size]}
            className={cn(
              'transition-all duration-200',
              isLiked && reaction.fill && 'fill-current',
              isAnimating && 'animate-bounce'
            )}
          />
        )}
        {showCount && likeCount > 0 && (
          <span className="font-medium tabular-nums">{likeCount}</span>
        )}
      </button>

      {/* Reaction Picker Popup */}
      {showReactionPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowReactionPicker(false)}
          />

          {/* Reaction Options */}
          <div
            className={cn(
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50',
              'flex items-center gap-2 p-2',
              'bg-popover border border-border rounded-full shadow-lg',
              'animate-in fade-in slide-in-from-bottom-2 duration-200'
            )}
          >
            {(Object.keys(REACTION_TYPES) as ReactionType[]).map((type) => {
              const reactionOption = REACTION_TYPES[type]!;
              const OptionIcon = reactionOption.icon;
              const isSelected = isLiked && currentReaction === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleReactionSelect(type)}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200',
                    'hover:scale-125 active:scale-110',
                    reactionOption.hoverColor,
                    isSelected && cn(reactionOption.bgColor, 'scale-110')
                  )}
                  title={reactionOption.label}
                >
                  <OptionIcon
                    size={20}
                    className={cn(
                      reactionOption.color,
                      reactionOption.fill && isSelected && 'fill-current'
                    )}
                  />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
