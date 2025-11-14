'use client';

import { FeedCommentSection } from '@/components/feed/FeedCommentSection';
import { InteractionBar } from '@/components/interactions';
import { PostCard } from '@/components/posts/PostCard';
import { PageContainer } from '@/components/shared/PageContainer';
import { WidgetSidebar } from '@/components/shared/WidgetSidebar';
import { useInteractionStore } from '@/stores/interactionStore';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { BouncingLogo } from '@/components/shared/BouncingLogo';

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export default function PostPage({ params }: PostPageProps) {
  const { id: postId } = use(params);
  const router = useRouter();
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  
  // Function to open comment modal when comment button is clicked
  const handleCommentClick = () => {
    setIsCommentModalOpen(true);
  };

  // Function to update post interactions from store
  const updatePostInteractions = () => {
    if (post) {
      const { postInteractions } = useInteractionStore.getState();
      const storeData = postInteractions.get(postId);
      
      if (storeData) {
        setPost((prev) => prev ? {
          ...prev,
          likeCount: storeData.likeCount,
          commentCount: storeData.commentCount,
          shareCount: storeData.shareCount,
          isLiked: storeData.isLiked,
          isShared: storeData.isShared,
        } : null);
      }
    }
  };

  const [post, setPost] = useState<{
    id: string;
    type?: string;
    content: string;
    fullContent?: string | null;
    articleTitle?: string | null;
    byline?: string | null;
    biasScore?: number | null;
    sentiment?: string | null;
    slant?: string | null;
    category?: string | null;
    authorId: string;
    authorName: string;
    authorUsername?: string | null;
    timestamp: string;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    isLiked: boolean;
    isShared: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPost = async () => {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/posts/${postId}`);
      const result = await response.json();
      
      const postData = result.data || result;

      const { postInteractions } = useInteractionStore.getState();
      const storeData = postInteractions.get(postId);

      setPost({
        id: postData.id,
        type: postData.type || 'post',
        content: postData.content,
        fullContent: postData.fullContent || null,
        articleTitle: postData.articleTitle || null,
        byline: postData.byline || null,
        biasScore: postData.biasScore !== undefined ? postData.biasScore : null,
        sentiment: postData.sentiment || null,
        slant: postData.slant || null,
        category: postData.category || null,
        authorId: postData.authorId,
        authorName: postData.authorName,
        authorUsername: postData.authorUsername || null,
        timestamp: postData.timestamp,
        likeCount: storeData?.likeCount ?? postData.likeCount ?? 0,
        commentCount: storeData?.commentCount ?? postData.commentCount ?? 0,
        shareCount: storeData?.shareCount ?? postData.shareCount ?? 0,
        isLiked: storeData?.isLiked ?? postData.isLiked ?? false,
        isShared: storeData?.isShared ?? postData.isShared ?? false,
      });
      setIsLoading(false);
    };

    loadPost();
  }, [postId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <BouncingLogo size={32} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Post Not Found</h1>
          <p className="text-muted-foreground mb-4">{error || 'The post you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/feed')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      {/* Desktop: Multi-column layout */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Left: Post content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop: Top bar with back button */}
          <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0 border-b border-border">
            <div className="px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-[#0066FF]" />
                  <h1 className="font-semibold text-lg">Post</h1>
                </div>
              </div>
            </div>
          </div>

          {/* Post content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto w-full">
              {/* Post */}
              <div className="border-b border-border">
                {post.type === 'article' && post.fullContent ? (
                  // Article detail view
                  <article className="px-4 sm:px-6 py-4 sm:py-5">
                    {/* Category badge */}
                    {post.category && (
                      <div className="mb-4">
                        <span className="px-3 py-1 bg-[#0066FF]/20 text-[#0066FF] rounded text-sm font-semibold uppercase">
                          {post.category}
                        </span>
                      </div>
                    )}
                    
                    {/* Article title */}
                    <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 leading-tight">
                      {post.articleTitle || 'Untitled Article'}
                    </h1>
                    
                    {/* Article metadata */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
                      <span className="font-semibold text-[#0066FF]">{post.authorName}</span>
                      {post.byline && (
                        <>
                          <span>·</span>
                          <span>{post.byline}</span>
                        </>
                      )}
                      <span>·</span>
                      <time>{new Date(post.timestamp).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}</time>
                    </div>
                    
                    {/* Bias warning */}
                    {post.biasScore !== null && post.biasScore !== undefined && Math.abs(post.biasScore) >= 0.3 && (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
                        <div className="flex items-start gap-2">
                          <span className="text-yellow-500 text-lg">⚠️</span>
                          <div>
                            <p className="text-sm font-semibold text-yellow-500 mb-1">Biased Coverage</p>
                            <p className="text-sm text-muted-foreground">
                              This article shows {post.biasScore > 0 ? 'favorable' : 'critical'} bias.
                              {post.slant && ` ${post.slant}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Full article content */}
                    <div className="prose prose-lg prose-invert max-w-none mb-6">
                      {post.fullContent.split('\n\n').map((paragraph, i) => (
                        <p key={i} className="text-base sm:text-lg text-foreground leading-relaxed mb-4">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    
                    {/* Interaction bar */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <InteractionBar
                        postId={post.id}
                        initialInteractions={{
                          postId: post.id,
                          likeCount: post.likeCount,
                          commentCount: post.commentCount,
                          shareCount: post.shareCount,
                          isLiked: post.isLiked,
                          isShared: post.isShared,
                        }}
                        postData={post}
                        onCommentClick={handleCommentClick}
                      />
                    </div>
                  </article>
                ) : (
                  // Regular post
                  <PostCard
                    post={post}
                    showInteractions={true}
                    isDetail
                    onCommentClick={handleCommentClick}
                  />
                )}
              </div>

              {/* Comments Section - Always visible below the post */}
              <div className="border-b border-border">
                <FeedCommentSection
                  postId={postId}
                  postData={post}
                  onCommentAdded={() => {
                    // Update post interactions after comment is added
                    setTimeout(() => {
                      updatePostInteractions();
                    }, 300);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Widget sidebar */}
        <WidgetSidebar />
      </div>

      {/* Mobile/Tablet: Single column layout */}
      <div className="lg:hidden flex flex-col flex-1 overflow-hidden">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border flex-shrink-0">
          <div className="flex items-center gap-4 px-4 py-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#0066FF]" />
              <h1 className="font-semibold text-lg">Post</h1>
            </div>
          </div>
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-y-auto">
          {/* Post */}
          <div className="border-b border-border">
            {post.type === 'article' && post.fullContent ? (
              // Article detail view
              <article className="px-4 sm:px-6 py-4 sm:py-5">
                {/* Category badge */}
                {post.category && (
                  <div className="mb-4">
                    <span className="px-3 py-1 bg-[#0066FF]/20 text-[#0066FF] rounded text-sm font-semibold uppercase">
                      {post.category}
                    </span>
                  </div>
                )}
                
                {/* Article title */}
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 leading-tight">
                  {post.articleTitle || 'Untitled Article'}
                </h1>
                
                {/* Article metadata */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
                  <span className="font-semibold text-[#0066FF]">{post.authorName}</span>
                  {post.byline && (
                    <>
                      <span>·</span>
                      <span>{post.byline}</span>
                    </>
                  )}
                  <span>·</span>
                  <time>{new Date(post.timestamp).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}</time>
                </div>
                
                {/* Bias warning */}
                {post.biasScore !== null && post.biasScore !== undefined && Math.abs(post.biasScore) >= 0.3 && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-500">⚠️</span>
                      <div>
                        <p className="text-xs font-semibold text-yellow-500 mb-1">Biased Coverage</p>
                        <p className="text-xs text-muted-foreground">
                          {post.biasScore > 0 ? 'Favorable' : 'Critical'} bias.
                          {post.slant && ` ${post.slant}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Full article content */}
                <div className="prose prose-invert max-w-none mb-4">
                  {post.fullContent.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-base text-foreground leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
                
                {/* Interaction bar */}
                <div className="mt-4 pt-4 border-t border-border">
                  <InteractionBar
                    postId={post.id}
                    initialInteractions={{
                      postId: post.id,
                      likeCount: post.likeCount,
                      commentCount: post.commentCount,
                      shareCount: post.shareCount,
                      isLiked: post.isLiked,
                      isShared: post.isShared,
                    }}
                    postData={post}
                    onCommentClick={handleCommentClick}
                  />
                </div>
              </article>
            ) : (
              // Regular post
              <PostCard
                post={post}
                showInteractions={true}
                isDetail
                onCommentClick={handleCommentClick}
              />
            )}
          </div>

          {/* Comments Section - Always visible below the post */}
          <div className="border-b border-border">
            <FeedCommentSection
              postId={postId}
              postData={post}
              onCommentAdded={() => {
                // Update post interactions after comment is added
                setTimeout(() => {
                  updatePostInteractions();
                }, 300);
              }}
            />
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      {isCommentModalOpen && (
        <FeedCommentSection
          postId={postId}
          postData={post}
          onClose={() => setIsCommentModalOpen(false)}
          onCommentAdded={() => {
            // Update post interactions after comment is added
            // Note: modal is already closed by onClose callback
            setTimeout(() => {
              updatePostInteractions();
            }, 300);
          }}
        />
      )}
    </PageContainer>
  );
}
