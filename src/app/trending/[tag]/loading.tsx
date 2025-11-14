import { PageContainer } from '@/components/shared/PageContainer'
import { FeedSkeleton, Skeleton } from '@/components/shared/Skeleton'

export default function TrendingTagLoading() {
  return (
    <PageContainer noPadding className="flex flex-col min-h-screen">
      {/* Desktop */}
      <div className="hidden lg:flex flex-1">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 border-l border-r border-[rgba(120,120,120,0.5)]">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background shadow-sm p-4 sm:p-6 border-b border-border/5">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 max-w-full" />
              <Skeleton className="h-4 w-32 max-w-full" />
            </div>
          </div>

          {/* Posts */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-[700px] mx-auto">
              <FeedSkeleton count={8} />
            </div>
          </div>
        </div>

        {/* Right: Widget placeholder */}
        <div className="w-80 xl:w-96 shrink-0 border-l border-border/5 bg-background" />
      </div>

      {/* Mobile/Tablet */}
      <div className="flex lg:hidden flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background shadow-sm p-4 border-b border-border/5">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40 max-w-full" />
            <Skeleton className="h-3 w-24 max-w-full" />
          </div>
        </div>

        {/* Posts */}
        <div className="flex-1 overflow-y-auto">
          <FeedSkeleton count={6} />
        </div>
      </div>
    </PageContainer>
  )
}

