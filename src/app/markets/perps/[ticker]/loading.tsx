import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton } from '@/components/shared/Skeleton'

export default function PerpDetailLoading() {
  return (
    <PageContainer>
      <div className="w-full max-w-6xl mx-auto space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-8 w-32 max-w-full" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
          <div className="text-right space-y-2 shrink-0">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border space-y-2">
              <Skeleton className="h-3 w-16 max-w-full" />
              <Skeleton className="h-6 w-24 max-w-full" />
            </div>
          ))}
        </div>

        {/* Chart Section */}
        <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border">
          <Skeleton className="h-64 sm:h-96 w-full rounded-lg" />
        </div>

        {/* Trading Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Order Form */}
          <div className="lg:col-span-2 bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 min-w-0 rounded-lg" />
              <Skeleton className="h-10 flex-1 min-w-0 rounded-lg" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>

          {/* Order Book */}
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-3">
            <Skeleton className="h-5 w-24 max-w-full mb-4" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Positions Table */}
        <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4 overflow-x-auto">
          <Skeleton className="h-6 w-32 max-w-full" />
          <div className="space-y-2 min-w-[500px]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2 sm:gap-4 p-3 bg-muted/30 rounded">
                <Skeleton className="h-4 w-20 sm:w-24" />
                <Skeleton className="h-4 w-16 sm:w-20" />
                <Skeleton className="h-4 w-16 sm:w-20" />
                <Skeleton className="h-4 w-20 sm:w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

