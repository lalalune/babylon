'use client';

import { cn } from '@/lib/utils';
import { useInteractionStore } from '@/stores/interactionStore';
import type { CommentInputProps } from '@/types/interactions';
import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MAX_COMMENT_LENGTH = 5000;

export function CommentInput({
  postId,
  parentCommentId,
  placeholder = 'Write a comment...',
  autoFocus = false,
  onSubmit,
  onCancel,
  className,
  replyingToName,
}: CommentInputProps & { replyingToName?: string }) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optimisticComment, setOptimisticComment] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { addComment } = useInteractionStore();

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  const handleSubmit = async () => {
    const trimmedContent = content.trim();

    if (!trimmedContent || isSubmitting) {
      return;
    }

    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      return;
    }

    setIsSubmitting(true);
    
    // Show optimistic comment immediately
    setOptimisticComment(trimmedContent);
    
    // Clear input optimistically
    const originalContent = content;
    setContent('');
    setIsFocused(false);

    const comment = await addComment(postId, trimmedContent, parentCommentId);

    if (comment) {
      // Clear optimistic state on success
      setOptimisticComment(null);

      // Call onSubmit callback if provided (await if it returns a promise)
      if (onSubmit) {
        await Promise.resolve(onSubmit(comment));
      }
    } else {
      // Restore content if failed
      setContent(originalContent);
      setOptimisticComment(null);
    }
    
    setIsSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }

    // Cancel on Escape
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleCancel = () => {
    setContent('');
    setIsFocused(false);
    if (onCancel) {
      onCancel();
    }
  };

  const remainingChars = MAX_COMMENT_LENGTH - content.length;
  const isOverLimit = remainingChars < 0;
  const showCharCount = content.length > MAX_COMMENT_LENGTH * 0.8;

  return (
    <>
      {/* Replying to indicator */}
      {replyingToName && (
        <div className="flex items-center gap-1 mb-2 text-sm text-muted-foreground">
          <span>Replying to</span>
          <span className="text-primary font-medium">@{replyingToName}</span>
        </div>
      )}

      {/* Optimistic comment preview */}
      {optimisticComment && (
        <div className="p-3 rounded-lg border border-primary/50 bg-muted/30 mb-2 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Posting...</span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {optimisticComment}
          </p>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col gap-2 p-3 rounded-lg border transition-colors',
          isFocused
            ? 'border-primary bg-muted/50'
            : 'border-border bg-background',
          className
        )}
      >
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full resize-none bg-transparent',
          'text-sm placeholder:text-muted-foreground',
          'focus:outline-none',
          'min-h-[60px] max-h-[200px]'
        )}
        disabled={isSubmitting}
      />

      {/* Footer - Shows when focused or has content */}
      {(isFocused || content.length > 0) && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          {/* Character count */}
          <div className="flex-1 text-xs text-muted-foreground">
            {showCharCount && (
              <span className={cn(isOverLimit && 'text-destructive font-medium')}>
                {remainingChars} characters remaining
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Cancel button - only show for replies */}
            {parentCommentId && onCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-muted transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <X size={16} />
              </button>
            )}

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting || isOverLimit}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-md',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-colors',
                'text-sm font-medium',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Post</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
