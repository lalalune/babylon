'use client';

import { PageContainer } from '@/components/shared/PageContainer';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { Skeleton } from '@/components/shared/Skeleton';

interface ArticlePageProps {
  params: Promise<{ id: string }>;
}

interface ArticlePost {
  id: string;
  type: string;
  content: string;
  fullContent: string | null;
  articleTitle: string | null;
  byline: string | null;
  biasScore: number | null;
  sentiment: string | null;
  slant: string | null;
  category: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorProfileImageUrl: string | null;
  timestamp: string;
}

export default function ArticlePage({ params }: ArticlePageProps) {
  const { id: articleId } = use(params);
  const router = useRouter();
  
  const [article, setArticle] = useState<ArticlePost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadArticle = async () => {
      setIsLoading(true);
      setError(null);

      // Fetch from posts API since articles are posts with type='article'
      const response = await fetch(`/api/posts/${articleId}`).catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
        throw err;
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        const errorMsg = result.error?.message || 'Failed to load article';
        setError(errorMsg);
        setIsLoading(false);
        throw new Error(errorMsg);
      }

      const articleData = result.data || result;
      
      // Verify it's actually an article
      if (articleData.type !== 'article') {
        // Redirect to regular post page if not an article
        router.replace(`/post/${articleId}`);
        return;
      }
      
      setArticle(articleData);
      setIsLoading(false);
    };

    loadArticle();
  }, [articleId, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-feed px-4 py-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-3">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
          <p className="text-muted-foreground mb-4">{error || 'The article you are looking for does not exist.'}</p>
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

  const publishedDate = new Date(article.timestamp);

  return (
    <PageContainer>
      {/* Desktop: Multi-column layout */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Left: Article content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop: Top bar with back button */}
          <div className="sticky top-0 z-10 bg-background shadow-sm shrink-0 border-b border-border">
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
                  <h1 className="font-semibold text-lg">Article</h1>
                </div>
              </div>
            </div>
          </div>

          {/* Article content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-feed mx-auto w-full">
              <article className="px-4 sm:px-6 py-4 sm:py-5">
                {/* Article title */}
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 leading-tight">
                  {article.articleTitle}
                </h1>
                
                {/* Article metadata */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
                  <span className="font-semibold text-[#0066FF]">{article.authorName}</span>
                  {article.byline && (
                    <>
                      <span>·</span>
                      <span>{article.byline}</span>
                    </>
                  )}
                  <span>·</span>
                  <time>{publishedDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}</time>
                </div>
                
                {/* Bias warning */}
                {article.biasScore !== null && article.biasScore !== undefined && Math.abs(article.biasScore) >= 0.3 && (
                  <div className="px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
                    <div className="flex items-start gap-3">
                      <span className="text-yellow-500 text-lg">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-yellow-500 mb-1">Biased Coverage</p>
                        <p className="text-sm text-muted-foreground">
                          This article shows {article.biasScore > 0 ? 'favorable' : 'critical'} bias.
                          {article.slant && ` ${article.slant}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Full article content */}
                <div className="prose prose-lg prose-invert max-w-none mb-6">
                  {(article.fullContent || article.content).split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-base sm:text-lg text-foreground leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Single column layout */}
      <div className="lg:hidden flex flex-col flex-1 overflow-hidden">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border shrink-0">
          <div className="flex items-center gap-4 px-4 py-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#0066FF]" />
              <h1 className="font-semibold text-lg">Article</h1>
            </div>
          </div>
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-y-auto">
          <article className="px-4 sm:px-6 py-4 sm:py-5">
            {/* Article title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 leading-tight">
              {article.articleTitle}
            </h1>
            
            {/* Article metadata */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
              <span className="font-semibold text-[#0066FF]">{article.authorName}</span>
              {article.byline && (
                <>
                  <span>·</span>
                  <span>{article.byline}</span>
                </>
              )}
              <span>·</span>
              <time>{publishedDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}</time>
            </div>
            
            {/* Bias warning */}
            {article.biasScore !== null && article.biasScore !== undefined && Math.abs(article.biasScore) >= 0.3 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-500">⚠️</span>
                  <div>
                    <p className="text-xs font-semibold text-yellow-500 mb-1">Biased Coverage</p>
                    <p className="text-xs text-muted-foreground">
                      {article.biasScore > 0 ? 'Favorable' : 'Critical'} bias.
                      {article.slant && ` ${article.slant}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Full article content */}
            <div className="prose prose-invert max-w-none mb-4">
              {(article.fullContent || article.content).split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-base text-foreground leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        </div>
      </div>
    </PageContainer>
  );
}

