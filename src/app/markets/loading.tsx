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
          <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0">
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* Tabs */}
              <div className="flex gap-0 overflow-x-auto scrollbar-hide">
                {['Dashboard', 'Perps', 'Predictions', 'Pools'].map((tab) => (
                  <div key={tab} className="flex-1 px-3 sm:px-4 py-2.5">
                    <Skeleton className="h-5 w-20 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Dashboard sections */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <WidgetPanelSkeleton />
              <WidgetPanelSkeleton />
            </div>
            <WidgetPanelSkeleton />
          </div>
        </div>

        {/* Widget Sidebar placeholder */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-border/5 bg-background" />
      </div>

      {/* Mobile/Tablet: Full width content */}
      <div className="flex xl:hidden flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0">
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Tabs */}
            <div className="flex gap-0 overflow-x-auto scrollbar-hide">
              {['Dashboard', 'Perps', 'Predictions', 'Pools'].map((tab) => (
                <div key={tab} className="flex-1 px-3 sm:px-4 py-2.5">
                  <Skeleton className="h-5 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <WidgetPanelSkeleton />
          <WidgetPanelSkeleton />
        </div>
      </div>
    </PageContainer>
  )
}

