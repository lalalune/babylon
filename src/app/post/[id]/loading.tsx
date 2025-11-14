import { PageContainer } from '@/components/shared/PageContainer'
import { PostCardSkeleton, Skeleton } from '@/components/shared/Skeleton'

export default function PostDetailLoading() {
  return (
    <PageContainer noPadding className="flex flex-col min-h-screen">
      {/* Desktop */}
      <div className="hidden lg:flex flex-1">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 border-l border-r border-[rgba(120,120,120,0.5)]">
          <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-[700px] mx-auto">
              {/* Post Detail */}
              <PostCardSkeleton />
              
              {/* Comments Section */}
              <div className="p-4 sm:p-6 space-y-4">
                <Skeleton className="h-6 w-32 max-w-full mb-4" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 pb-4 border-b border-border/5">
                    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Skeleton className="h-4 w-24 max-w-full" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4 max-w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Widget placeholder */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-border/5 bg-background" />
      </div>

      {/* Mobile/Tablet */}
      <div className="flex lg:hidden flex-1 overflow-y-auto">
        <div className="w-full">
          {/* Post Detail */}
          <PostCardSkeleton />
          
          {/* Comments Section */}
          <div className="p-4 space-y-4">
            <Skeleton className="h-5 w-24 max-w-full mb-4" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-3 pb-4 border-b border-border/5">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Skeleton className="h-4 w-20 max-w-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

