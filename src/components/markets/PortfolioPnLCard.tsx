import { type PortfolioPnLSnapshot } from '@/hooks/usePortfolioPnL'
import { Share2, Sparkles } from 'lucide-react'

interface PortfolioPnLCardProps {
  data: PortfolioPnLSnapshot | null
  loading: boolean
  error: string | null
  onShare: () => void
  setShowBuyPointsModal: (show: boolean) => void
}

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

function formatCurrency(value: number | null | undefined) {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return formatter.format(safeValue)
}

export function PortfolioPnLCard({
  data,
  loading,
  error,
  onShare,
  setShowBuyPointsModal
}: PortfolioPnLCardProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-md font-semibold uppercase tracking-wide text-muted-foreground">
          Your Portfolio
        </h2>
        <div className="flex items-center gap-3">
          {/* <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-2 text-foreground backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Refresh portfolio P&L"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button> */}
          <button
            type="button"
            onClick={onShare}
            disabled={loading || !data}
            className="inline-flex items-center gap-3 rounded-lg bg-white/90 px-3 py-3 text-sm font-semibold text-[#0B1C3D] shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" />
            Share P&amp;L
          </button>
          <button
            onClick={() => setShowBuyPointsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-primary-foreground font-medium rounded-lg hover:from-yellow-600 hover:to-amber-700 transition-all shadow-md hover:shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Buy Points</span>
          </button>
        </div>
      </div>
          <section className="mt-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-purple-500/10 to-primary/5 px-4 py-3 sm:px-5 sm:py-4 shadow-sm">

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-white/40" />
            <div className="mt-2 h-9 w-32 animate-pulse rounded bg-white/60" />
          </div>
          <div className="p-4">
            <div className="h-3 w-32 animate-pulse rounded bg-white/40" />
            <div className="mt-2 h-9 w-32 animate-pulse rounded bg-white/60" />
          </div>
        </div>
      ) : error ? (
        <div className="mt-6 rounded-lg bg-white/10 px-4 py-3 text-sm text-foreground/80">
          <p className="font-medium text-foreground">Unable to load portfolio</p>
          <p className="mt-1 text-foreground/80">{error}</p>
        </div>
      ) : (
        data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4">
              <dt className="text-xs uppercase text-foreground/70">Total Points</dt>
              <dd className="mt-2 text-3xl font-bold text-foreground">
                {formatCurrency(data.accountEquity)}
              </dd>
            </div>
            <div className="p-4">
              <dt className="text-xs uppercase text-foreground/70">Available to Invest</dt>
              <dd className="mt-2 text-3xl font-bold text-foreground">
                {formatCurrency(data.availableBalance)}
              </dd>
            </div>
          </div>
        )
      )}
    </section>
    </>
  )
}

