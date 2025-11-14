'use client'

import { useState } from 'react'
import { LatestNewsPanel } from '@/components/feed/LatestNewsPanel'
import { TrendingPanel } from '@/components/feed/TrendingPanel'
import { MarketsPanel } from '@/components/feed/MarketsPanel'
import { EntitySearchAutocomplete } from '@/components/explore/EntitySearchAutocomplete'

export function WidgetSidebar() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="hidden xl:flex flex-col w-96 flex-shrink-0">
      <div className="flex flex-col px-4 py-6 gap-6 xl:sticky xl:top-0 xl:max-h-screen xl:overflow-y-auto">
        <div className="flex-shrink-0">
          <EntitySearchAutocomplete
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search users..."
          />
        </div>

        <div className="flex-shrink-0">
          <LatestNewsPanel />
        </div>

        <div className="flex-shrink-0">
          <TrendingPanel />
        </div>

        <div className="flex-shrink-0">
          <MarketsPanel />
        </div>
      </div>
    </div>
  )
}


