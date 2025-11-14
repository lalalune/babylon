'use client'

import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton } from '@/components/shared/Skeleton'

export default function FeedLoading() {
  return (
    <PageContainer noPadding className="flex flex-col min-h-screen w-full overflow-visible">
      {/* Centered loading state */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <Skeleton className="h-32 w-full max-w-2xl" />
        <Skeleton className="h-32 w-full max-w-2xl" />
        <Skeleton className="h-32 w-full max-w-2xl" />
      </div>
    </PageContainer>
  )
}



