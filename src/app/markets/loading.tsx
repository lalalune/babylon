import { PageContainer } from '@/components/shared/PageContainer'
import { WidgetPanelSkeleton, Skeleton } from '@/components/shared/Skeleton'

export default function MarketsLoading() {
  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Desktop: Content + Widgets layout */}
      <div className="hidden xl:flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background shadow-sm shrink-0">
            <div className="px-3 py-3 sm:px-4 sm:py-4 space-y-3 sm:space-y-4">
              {/* Tabs */}
              <div className="flex gap-0 overflow-x-auto scrollbar-hide">
                {['Dashboard', 'Perps', 'Predictions', 'Pools'].map((tab) => (
                  <div key={tab} className="flex-1 px-3 sm:px-4 py-2.5">
                    <Skeleton className="h-5 w-20 mx-auto" />
                  </div>
                ))}
              </div>

              {/* Wallet Balance placeholder */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>

          {/* Content - Dashboard layout */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
            {/* Two-column grid for trending sections */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Trending Perpetuals */}
              <div className="bg-card/50 backdrop-blur rounded-2xl px-4 py-3 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-6 w-40" />
                </div>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <Skeleton className="h-4 w-16 mb-1" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <div className="text-right ml-3">
                          <Skeleton className="h-4 w-20 mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hot Predictions */}
              <div className="bg-card/50 backdrop-blur rounded-2xl px-4 py-3 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30">
                      <Skeleton className="h-4 w-full mb-2" />
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Full-width section for pools */}
            <div className="bg-card/50 backdrop-blur rounded-2xl px-4 py-3 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-6 w-48" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="px-4 py-3 rounded-lg bg-muted/30">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <div className="flex gap-3">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Widget Sidebar */}
        <div className="w-96 shrink-0 bg-sidebar px-4 py-3 space-y-4">
          {/* Market Overview Panel */}
          <div className="bg-card/50 backdrop-blur rounded-2xl px-4 py-3 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between items-center mb-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Top Movers Panel */}
          <div className="bg-card/50 backdrop-blur rounded-2xl px-4 py-3 border border-border">
            <Skeleton className="h-6 w-28 mb-3" />
            
            {/* Top Gainers */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center p-1.5">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="text-right ml-2">
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Losers */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center p-1.5">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="text-right ml-2">
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Full width content */}
      <div className="flex xl:hidden flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background shadow-sm shrink-0">
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Tabs */}
            <div className="flex gap-0 overflow-x-auto scrollbar-hide">
              {['Dashboard', 'Perps', 'Predictions', 'Pools'].map((tab) => (
                <div key={tab} className="flex-1 px-3 sm:px-4 py-2.5">
                  <Skeleton className="h-5 w-16 mx-auto" />
                </div>
              ))}
            </div>

            {/* Wallet Balance placeholder */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </div>

        {/* Content - Dashboard layout */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Trending sections */}
          <WidgetPanelSkeleton />
          <WidgetPanelSkeleton />
          
          {/* Pools section */}
          <WidgetPanelSkeleton />
        </div>
      </div>
    </PageContainer>
  )
}

