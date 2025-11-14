'use client';

import { CommentCard } from '@/components/interactions/CommentCard';
import { CommentInput } from '@/components/interactions/CommentInput';
import { PostCard } from '@/components/posts/PostCard';
import { BouncingLogo } from '@/components/shared/BouncingLogo';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { useInteractionStore } from '@/stores/interactionStore';
import type { CommentData, CommentWithReplies } from '@/types/interactions';
import { MessageCircle, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface FeedCommentSectionProps {
  postId: string | null;
  postData?: {
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    authorUsername?: string | null;
    authorProfileImageUrl?: string | null;
    timestamp: string;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    isLiked: boolean;
    isShared: boolean;
  };
  onClose?: () => void;
  onCommentAdded?: () => void;
}

export function FeedCommentSection({
  postId,
  postData,
  onClose,
  onCommentAdded,
}: FeedCommentSectionProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [post, setPost] = useState<{
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    authorUsername?: string | null;
    authorProfileImageUrl?: string | null;
    timestamp: string;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    isLiked: boolean;
    isShared: boolean;
  } | null>(postData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPost, setIsLoadingPost] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');

  const { loadComments, editComment, deleteComment } = useInteractionStore();

  // Handle escape key and body scroll lock for modal
  useEffect(() => {
    if (!onClose) return; // Only for modal mode
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Load comments data function - defined before useEffect that uses it
  const loadCommentsData = useCallback(async () => {
    if (!postId) return;
    
    setIsLoading(true);
    const loadedComments = await loadComments(postId);
    setComments(loadedComments);
    setIsLoading(false);
  }, [postId, loadComments]);

  // Load post data when postId changes
  useEffect(() => {
    const loadPostData = async () => {
      if (!postId) {
        setPost(null);
        return;
      }

      // Use provided postData if available
      if (postData) {
        setPost(postData);
        return;
      }

      setIsLoadingPost(true);
      const response = await fetch(`/api/posts/${postId}`);
      if (response.ok) {
        const result = await response.json();
        setPost(result.data);
      }
      setIsLoadingPost(false);
    };

    loadPostData();
  }, [postId, postData]);

  // Load comments when postId changes
  useEffect(() => {
    if (postId) {
      loadCommentsData();
    } else {
      setComments([]);
    }
  }, [postId, loadCommentsData]);

  // Helper functions
  const removeCommentById = (
    commentList: CommentWithReplies[],
    commentId: string
  ): CommentWithReplies[] => {
    return commentList
      .filter((comment) => comment.id !== commentId)
      .map((comment) => ({
        ...comment,
        replies: removeCommentById(comment.replies, commentId),
      }));
  };

  const addReplyToComment = (
    commentList: CommentWithReplies[],
    parentCommentId: string,
    newReply: CommentWithReplies
  ): CommentWithReplies[] => {
    return commentList.map((comment) => {
      if (comment.id === parentCommentId) {
        return {
          ...comment,
          replies: [newReply, ...comment.replies],
        };
      } else if (comment.replies.length > 0) {
        return {
          ...comment,
          replies: addReplyToComment(comment.replies, parentCommentId, newReply),
        };
      }
      return comment;
    });
  };

  const findParentAuthorName = (
    commentList: CommentWithReplies[],
    parentCommentId: string
  ): string | undefined => {
    for (const comment of commentList) {
      if (comment.id === parentCommentId) {
        return comment.userName;
      }
      if (comment.replies.length > 0) {
        const found = findParentAuthorName(comment.replies, parentCommentId);
        if (found) return found;
      }
    }
    return undefined;
  };

  const handleEdit = async (commentId: string, content: string) => {
    await editComment(commentId, content);
    await loadCommentsData();
  };

  const handleDelete = async (commentId: string) => {
    if (!postId) return;
    await deleteComment(commentId, postId);
    setComments((prev) => removeCommentById(prev, commentId));
  };

  const handleReplySubmit = async (replyComment: CommentData, parentCommentId: string) => {
    if (!postId) return;
    
    const parentAuthorName = findParentAuthorName(comments, parentCommentId);
    
    const optimisticReply: CommentWithReplies = {
      id: replyComment.id,
      content: replyComment.content,
      createdAt: replyComment.createdAt instanceof Date ? replyComment.createdAt : new Date(replyComment.createdAt),
      updatedAt: replyComment.updatedAt instanceof Date ? replyComment.updatedAt : new Date(replyComment.updatedAt),
      userId: replyComment.authorId,
      userName: replyComment.author?.displayName || replyComment.author?.username || 'Unknown',
      userUsername: replyComment.author?.username || null,
      userAvatar: replyComment.author?.profileImageUrl || undefined,
      parentCommentId: replyComment.parentCommentId,
      parentCommentAuthorName: parentAuthorName,
      likeCount: replyComment._count?.reactions || 0,
      isLiked: false,
      replies: [],
    };

    setComments((prev) => addReplyToComment(prev, parentCommentId, optimisticReply));
    await new Promise(resolve => setTimeout(resolve, 200));
    await loadCommentsData();
  };

  const sortedComments = [...comments].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'popular':
        return b.likeCount - a.likeCount;
      default:
        return 0;
    }
  });

  if (!postId) {
    return null;
  }

  if (isLoadingPost) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-background items-center justify-center">
        <BouncingLogo size={32} />
        <p className="text-sm text-muted-foreground mt-4">Loading post...</p>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  // If onClose is provided, it's a modal (mobile). Otherwise, it's inline (desktop post page)
  const isModal = !!onClose;

  return (
    <>
      {/* Backdrop for modal only */}
      {isModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}
      
      {/* Modal Container - centered on desktop */}
      {isModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 pointer-events-none">
          <div
            className={cn(
              "relative w-full max-w-[700px] bg-background rounded-2xl shadow-2xl pointer-events-auto",
              "animate-in fade-in-0 zoom-in-95 duration-200",
              "max-h-[85vh] flex flex-col"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#0066FF]" />
                <h2 className="font-semibold text-base">Reply</h2>
              </div>
              <div className="w-10" /> {/* Spacer for centering */}
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Original Post - Compact view without interactions */}
              <div className="px-4 pt-3">
                <PostCard
                  post={{
                    id: post.id,
                    content: post.content,
                    authorId: post.authorId,
                    authorName: post.authorName,
                    authorUsername: post.authorUsername,
                    authorProfileImageUrl: post.authorProfileImageUrl,
                    timestamp: post.timestamp,
                    likeCount: post.likeCount,
                    commentCount: post.commentCount,
                    shareCount: post.shareCount,
                    isLiked: post.isLiked,
                    isShared: post.isShared,
                  }}
                  showInteractions={false}
                  isDetail={false}
                />
              </div>

              {/* Visual thread connector */}
              <div className="px-4">
                <div className="ml-6 border-l-2 border-border h-4" />
              </div>

              {/* Reply Input */}
              <div className="px-4 pb-4">
                <CommentInput
                  postId={postId}
                  placeholder="Post your reply..."
                  onSubmit={async (comment) => {
                    // Only proceed if comment was successfully created
                    if (!comment) return;
                    
                    // Close the modal immediately
                    if (onClose) {
                      onClose();
                    }
                    
                    // Call onCommentAdded callback if provided (after closing)
                    if (onCommentAdded) {
                      onCommentAdded();
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Non-modal inline view (for post detail page) */
        <div className="flex flex-col w-full overflow-hidden bg-background relative">
          {/* Sort options */}
          {comments.length > 1 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-background flex-shrink-0">
              <span className="text-xs text-muted-foreground">Sort:</span>
              <div className="flex gap-1">
                {(['newest', 'oldest', 'popular'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSortBy(option)}
                    className={cn(
                      'px-2 py-0.5 rounded text-xs capitalize transition-colors',
                      sortBy === option
                        ? 'bg-[#0066FF] text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comment input */}
          <div className="px-4 py-3 bg-background flex-shrink-0">
            <CommentInput
              postId={postId}
              placeholder="Post your reply..."
              onSubmit={async (comment) => {
                if (comment) {
                  // Optimistically add comment to the list immediately
                  const optimisticComment: CommentWithReplies = {
                    id: comment.id,
                    content: comment.content,
                    createdAt: comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt),
                    updatedAt: comment.updatedAt instanceof Date ? comment.updatedAt : new Date(comment.updatedAt),
                    userId: comment.authorId,
                    userName: comment.author?.displayName || comment.author?.username || 'Unknown',
                    userUsername: comment.author?.username || null,
                    userAvatar: comment.author?.profileImageUrl || undefined,
                    parentCommentId: comment.parentCommentId,
                    likeCount: comment._count?.reactions || 0,
                    isLiked: false,
                    replies: [],
                  };
                  setComments((prev) => [optimisticComment, ...prev]);
                }
                // Small delay to ensure API has processed, then reload to get full data
                await new Promise(resolve => setTimeout(resolve, 200));
                await loadCommentsData();
                
                // Call onCommentAdded callback if provided
                if (onCommentAdded) {
                  onCommentAdded();
                }
              }}
            />
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <BouncingLogo size={24} />
              </div>
            ) : sortedComments.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No comments yet"
                description="Be the first to comment!"
              />
            ) : (
              <div className="space-y-4">
                {sortedComments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    postId={postId || ''}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onReplySubmit={(replyComment) => {
                      if (replyComment.parentCommentId) {
                        handleReplySubmit(replyComment, replyComment.parentCommentId);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

