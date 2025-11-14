'use client';

import { cn } from '@/lib/utils';
import { MoreVertical, Reply, Trash2, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/shared/Avatar';
import { TaggedText } from '@/components/shared/TaggedText';
import { VerifiedBadge, isNpcIdentifier } from '@/components/shared/VerifiedBadge';
import { LikeButton } from './LikeButton';
import { CommentInput } from './CommentInput';
import type { CommentCardProps } from '@/types/interactions';

const MAX_DEPTH = 5; // Maximum nesting depth for replies

export function CommentCard({
  comment,
  postId,
  onReply,
  onEdit,
  onDelete,
  onReplySubmit,
  depth = 0,
  maxDepth = MAX_DEPTH,
  className,
}: CommentCardProps) {
  const router = useRouter();
  const [showActions, setShowActions] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(true);

  const isMaxDepth = depth >= maxDepth;
  const hasReplies = comment.replies && comment.replies.length > 0;

  const showVerifiedBadge = isNpcIdentifier(comment.userId);

  const handleReply = () => {
    setIsReplying(true);
    if (onReply) {
      onReply(comment.id);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowActions(false);
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== comment.content) {
      onEdit(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete && confirm('Are you sure you want to delete this comment?')) {
      onDelete(comment.id);
    }
    setShowActions(false);
  };

  return (
    <div
      className={cn(
        'flex gap-3',
        depth > 0 && 'ml-8 pl-4 border-l-2 border-border',
        className
      )}
    >
      {/* Avatar - Round */}
      <div className="shrink-0">
        <Avatar
          id={comment.userId}
          name={comment.userName}
          size="sm"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header: Username/handle on left, timestamp and actions on right */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-semibold text-sm truncate">
              {comment.userName}
            </span>
            {showVerifiedBadge && <VerifiedBadge size="sm" className="-ml-1" />}
            <span className="text-xs text-muted-foreground truncate">
              @{comment.userUsername || comment.userName}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Timestamp - Right aligned */}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>

            {/* Actions menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActions(!showActions)}
                className={cn(
                  'p-1 rounded-md',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-muted transition-colors'
                )}
              >
                <MoreVertical size={16} />
              </button>

              {showActions && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowActions(false)}
                  />

                  {/* Dropdown */}
                  <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] bg-popover border border-border rounded-md shadow-lg py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="w-full px-3 py-2 text-sm text-left text-destructive hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Replying to indicator */}
        {comment.parentCommentId && comment.parentCommentAuthorName && (
          <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
            <span>Replying to</span>
            <span className="text-primary font-medium">@{comment.parentCommentAuthorName}</span>
          </div>
        )}

        {/* Comment body - Below name/handle row */}
        {isEditing ? (
          <div className="mb-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 text-sm bg-muted rounded-md border border-border focus:outline-none focus:border-border resize-none min-h-[60px]"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-2">
            <TaggedText
              text={comment.content}
              onTagClick={(tag) => {
                router.push(`/feed?search=${encodeURIComponent(tag)}`)
              }}
            />
          </p>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-4">
          {/* Like button */}
          <LikeButton
            targetId={comment.id}
            targetType="comment"
            initialLiked={comment.isLiked}
            initialCount={comment.likeCount}
            size="sm"
            showCount
          />

          {/* Reply button */}
          {!isMaxDepth && (
            <button
              type="button"
              onClick={handleReply}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Reply size={14} />
              <span>Reply</span>
            </button>
          )}

          {/* Toggle replies button */}
          {hasReplies && (
            <button
              type="button"
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showReplies ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>

        {/* Reply input */}
        {isReplying && (
          <div className="mt-3">
            <CommentInput
              postId={postId}
              parentCommentId={comment.id}
              placeholder={`Reply to ${comment.userName}...`}
              replyingToName={comment.userName}
              autoFocus
              onSubmit={async (replyComment) => {
                setIsReplying(false);
                // Call onReplySubmit callback if provided to handle optimistic update
                if (onReplySubmit && replyComment) {
                  onReplySubmit(replyComment);
                }
              }}
              onCancel={() => setIsReplying(false)}
            />
          </div>
        )}

        {/* Nested replies */}
        {hasReplies && showReplies && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentCard
                key={reply.id}
                comment={reply}
                postId={postId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReplySubmit={onReplySubmit}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
