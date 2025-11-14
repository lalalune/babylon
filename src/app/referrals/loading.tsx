import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton, StatsCardSkeleton } from '@/components/shared/Skeleton'

export default function ReferralsLoading() {
  return (
    <PageContainer>
      <div className="w-full max-w-4xl mx-auto space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        {/* Referral Code Section */}
        <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4">
          <Skeleton className="h-6 w-40 max-w-full" />
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-12 flex-1 min-w-[200px] rounded-lg" />
            <Skeleton className="h-12 w-24 flex-shrink-0 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>

        {/* Referrals List */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-32 max-w-full mb-3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-card/50 backdrop-blur rounded-lg border border-border">
              <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
              <Skeleton className="h-5 w-20 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

