'use client'

import { MarketOverviewPanel } from './MarketOverviewPanel'
import { TopMoversPanel } from './TopMoversPanel'

interface MarketsWidgetSidebarProps {
  onMarketClick?: (market: {
    ticker: string
    name: string
    currentPrice: number
    change24h: number
    changePercent24h: number
    organizationId?: string
    high24h?: number
    low24h?: number
    volume24h?: number
    openInterest?: number
    fundingRate?: {
      rate: number
      nextFundingTime: string
      predictedRate: number
    }
    maxLeverage?: number
    minOrderSize?: number
  }) => void
}

export function MarketsWidgetSidebar({ onMarketClick }: MarketsWidgetSidebarProps) {
  return (
    <div className="hidden xl:flex flex-col w-96 shrink-0 overflow-y-auto bg-sidebar p-4 gap-4">
      {/* Top: Market Overview */}
      <div className="shrink-0">
        <MarketOverviewPanel />
      </div>

      {/* Middle: Top Movers */}
      <div className="flex-1 flex flex-col min-h-[200px]">
        <TopMoversPanel onMarketClick={onMarketClick} />
      </div>
    </div>
  )
}

