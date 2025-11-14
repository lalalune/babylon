'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Avatar } from '@/components/shared/Avatar';
import { z } from 'zod';

const _ArticleCardPostSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  content: z.string(),
  fullContent: z.string().nullable().optional(),
  articleTitle: z.string().nullable().optional(),
  byline: z.string().nullable().optional(),
  biasScore: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  authorId: z.string(),
  authorName: z.string(),
  authorUsername: z.string().nullable().optional(),
  authorProfileImageUrl: z.string().nullable().optional(),
  timestamp: z.string(),
});

export type ArticleCardProps = {
  post: z.infer<typeof _ArticleCardPostSchema>;
  className?: string;
  onClick?: () => void;
};

export const ArticleCard = memo(function ArticleCard({
  post,
  className,
  onClick,
}: ArticleCardProps) {
  const publishedDate = new Date(post.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - publishedDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeAgo: string;
  if (diffMinutes < 1) timeAgo = 'Just now';
  else if (diffMinutes < 60) timeAgo = `${diffMinutes}m ago`;
  else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
  else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
  else timeAgo = publishedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <article
      className={cn(
        'px-4 py-3',
        'hover:bg-muted/30 cursor-pointer transition-all duration-200',
        'w-full overflow-hidden',
        'border-b border-border/5',
        className
      )}
      onClick={handleClick}
    >
      {/* Header: Avatar + Author + Timestamp */}
      <div className="flex items-start gap-3 w-full mb-3">
        {/* Avatar */}
        <Link
          href={`/profile/${post.authorId}`}
          className="shrink-0 hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar
            id={post.authorId}
            name={post.authorName}
            type="business"
            size="md"
            src={post.authorProfileImageUrl || undefined}
          />
        </Link>

        {/* Author name and timestamp */}
        <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
          <div className="flex flex-col min-w-0">
            <Link
              href={`/profile/${post.authorId}`}
              className="font-semibold text-lg sm:text-xl text-foreground hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {post.authorName}
            </Link>
          </div>
          <time className="text-muted-foreground text-base shrink-0 ml-2" title={publishedDate.toLocaleString()}>
            {timeAgo}
          </time>
        </div>
      </div>

      {/* Article Title with Read More Button */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight flex-1">
          {post.articleTitle || 'Untitled Article'}
        </h2>
        <button
          className="inline-flex items-center gap-2 px-3 py-2 bg-[#0066FF] hover:bg-[#2952d9] text-primary-foreground text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
          onClick={handleClick}
        >
          Read Full Article →
        </button>
      </div>

      {/* Article Metadata */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-muted-foreground">
        {post.byline && <span>{post.byline}</span>}
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

      {/* Article Summary */}
      <div className="text-foreground leading-relaxed whitespace-pre-wrap break-words mb-3">
        {post.content}
      </div>
    </article>
  );
});

