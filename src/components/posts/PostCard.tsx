'use client';

import { memo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/shared/Avatar';
import { TaggedText } from '@/components/shared/TaggedText';
import { VerifiedBadge, isNpcIdentifier } from '@/components/shared/VerifiedBadge';
import { InteractionBar } from '@/components/interactions';
import { useFontSize } from '@/contexts/FontSizeContext';
import { getProfileUrl } from '@/lib/profile-utils';
import type { PostInteraction } from '@/types/interactions';

export interface PostCardProps {
  post: {
    id: string;
    type?: string; // "post" | "article"
    content: string;
    articleTitle?: string | null;
    byline?: string | null;
    biasScore?: number | null;
    sentiment?: string | null;
    category?: string | null;
    authorId: string;
    authorName: string;
    authorUsername?: string | null;
    authorProfileImageUrl?: string | null;
    timestamp: string;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    isLiked?: boolean;
    isShared?: boolean;
  };
  className?: string;
  onClick?: () => void;
  onCommentClick?: () => void;
  showInteractions?: boolean;
  isDetail?: boolean;
}

export const PostCard = memo(function PostCard({
  post,
  className,
  onClick,
  onCommentClick,
  showInteractions = true,
  isDetail = false,
}: PostCardProps) {
  const router = useRouter();
  const { fontSize } = useFontSize();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsMobile(window.innerWidth < 640);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const postDate = new Date(post.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - postDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeAgo: string;
  if (diffMinutes < 1) timeAgo = 'Just now';
  else if (diffMinutes < 60) timeAgo = `${diffMinutes}m ago`;
  else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
  else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
  else timeAgo = postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const initialInteractions: PostInteraction = {
    postId: post.id,
    likeCount: post.likeCount ?? 0,
    commentCount: post.commentCount ?? 0,
    shareCount: post.shareCount ?? 0,
    isLiked: post.isLiked ?? false,
    isShared: post.isShared ?? false,
  };

  const showVerifiedBadge = isNpcIdentifier(post.authorId);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <article
      className={cn(
        'px-4 sm:px-6 py-4 sm:py-5',
        !isDetail && 'hover:bg-muted/30 cursor-pointer transition-all duration-200',
        'w-full overflow-hidden',
        'border-b border-border/5',
        className
      )}
      style={{
        fontSize: `${fontSize}rem`,
      }}
      onClick={!isDetail ? handleClick : undefined}
    >
      {/* Row 1: Avatar + Name/Handle/Timestamp Header */}
      <div className="flex items-start gap-3 sm:gap-4 w-full mb-2">
        {/* Avatar - Clickable, Round */}
        <Link
          href={getProfileUrl(post.authorId, post.authorUsername)}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar
            id={post.authorId}
            name={post.authorName}
            type={post.type === 'article' ? 'business' : 'actor'}
            size="md"
            src={post.authorProfileImageUrl || undefined}
            scaleFactor={isDetail ? fontSize : fontSize * (isDesktop ? 1.4 : isMobile ? 0.8 : 1)}
          />
        </Link>

        {/* Header: Name/Handle block on left, Timestamp on right */}
        <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
          {/* Name and Handle stacked vertically */}
          <div className="flex flex-col min-w-0">
            {/* Name row with verified badge */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                href={getProfileUrl(post.authorId, post.authorUsername)}
                className="font-semibold text-lg sm:text-xl text-foreground hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {post.authorName}
              </Link>
              {showVerifiedBadge && <VerifiedBadge size="md" className="sm:w-6 sm:h-6" />}
            </div>
            {/* Handle row */}
            <Link
              href={getProfileUrl(post.authorId, post.authorUsername)}
              className="text-muted-foreground text-base hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              @{post.authorUsername || post.authorId}
            </Link>
          </div>
          {/* Timestamp - Right aligned */}
          <time className="text-muted-foreground text-base flex-shrink-0 ml-2" title={postDate.toLocaleString()}>
            {timeAgo}
          </time>
        </div>
      </div>

      {/* Row 2: Post Content - Full width */}
      {post.type === 'article' ? (
        // Article card - Show title, summary, and "Read more" button
        <div className="w-full mb-3">
          {/* Article title */}
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 leading-tight">
            {post.articleTitle || 'Untitled Article'}
          </h2>
          
          {/* Article metadata */}
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-muted-foreground">
            {post.byline && <span>{post.byline}</span>}
            {post.category && (
              <>
                {post.byline && <span>·</span>}
                <span className="px-2 py-0.5 bg-[#0066FF]/20 text-[#0066FF] rounded text-xs font-semibold uppercase">
                  {post.category}
                </span>
              </>
            )}
            {post.biasScore !== null && post.biasScore !== undefined && Math.abs(post.biasScore) >= 0.3 && (
              <>
                <span>·</span>
                <span className={cn(
                  "text-xs font-semibold",
                  post.biasScore > 0 ? "text-green-500" : "text-red-500"
                )}>
                  {post.biasScore > 0 ? '↗ Favorable' : '↘ Critical'}
                </span>
              </>
            )}
          </div>

          {/* Article summary */}
          <div className="text-foreground leading-relaxed whitespace-pre-wrap break-words mb-3">
            {post.content}
          </div>

          {/* Read more button */}
          {!isDetail && (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0066FF] hover:bg-[#2952d9] text-white font-semibold rounded-lg transition-colors"
              onClick={handleClick}
            >
              Read Full Article →
            </button>
          )}
        </div>
      ) : (
        // Regular post - Show content as normal
        <div className="text-foreground leading-relaxed whitespace-pre-wrap break-words w-full mb-3 post-content">
          <TaggedText
            text={post.content || ''}
            onTagClick={(tag) => {
              router.push(`/feed?search=${encodeURIComponent(tag)}`)
            }}
          />
        </div>
      )}

      {/* Row 3: Interaction Bar - Full width */}
      {showInteractions && (
        <div onClick={(e) => e.stopPropagation()} className="w-full">
          <InteractionBar
            postId={post.id}
            initialInteractions={initialInteractions}
            onCommentClick={onCommentClick}
            postData={post}
          />
        </div>
      )}
    </article>
  );
});

