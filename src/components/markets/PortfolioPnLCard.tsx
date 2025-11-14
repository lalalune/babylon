import { type PortfolioPnLSnapshot } from '@/hooks/usePortfolioPnL'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight, RefreshCcw, Share2 } from 'lucide-react'

interface PortfolioPnLCardProps {
  data: PortfolioPnLSnapshot | null
  loading: boolean
  error: string | null
  onShare: () => void
  onRefresh: () => void
  lastUpdated: number | null
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

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) return ''
  const diffMs = Date.now() - timestamp
  if (diffMs < 0) return ''
  const diffMinutes = Math.round(diffMs / (1000 * 60))
  if (diffMinutes <= 1) return 'Updated just now'
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `Updated ${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `Updated ${diffDays}d ago`
}

export function PortfolioPnLCard({
  data,
  loading,
  error,
  onShare,
  onRefresh,
  lastUpdated,
}: PortfolioPnLCardProps) {
  const totalPnL = data?.totalPnL ?? 0
  const pnlIsPositive = totalPnL >= 0

  return (
    <section className="rounded-xl border border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/10 via-purple-500/10 to-[#0066FF]/5 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your P&amp;L
          </h2>
          <p className="text-xs text-muted-foreground">{formatRelativeTime(lastUpdated)}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Refresh P&L"
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={loading || !data}
            className="inline-flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-[#0B1C3D] shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" />
            Share P&amp;L
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="h-10 w-64 animate-pulse rounded bg-white/20" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((key) => (
              <div key={key} className="h-16 rounded-lg bg-white/10" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="mt-6 rounded-lg bg-white/10 p-4 text-sm text-white/80">
          <p className="font-medium text-white">Unable to load P&amp;L</p>
          <p className="mt-1 text-white/80">{error}</p>
        </div>
      ) : (
        data && (
          <>
            <div className="mt-6 flex items-center gap-3">
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
                  pnlIsPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400',
                )}
              >
                {pnlIsPositive ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {pnlIsPositive ? 'Profit' : 'Loss'}
              </div>
              <p className="text-4xl font-bold text-white sm:text-5xl">
                {pnlIsPositive ? '+' : ''}
                {formatCurrency(totalPnL)}
              </p>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur">
                <dt className="text-xs uppercase text-white/70">Net Contributions</dt>
                <dd className="text-base font-semibold text-white">
                  {formatCurrency(data.netContributions)}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur">
                <dt className="text-xs uppercase text-white/70">Account Equity</dt>
                <dd className="text-base font-semibold text-white">
                  {formatCurrency(data.accountEquity)}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur">
                <dt className="text-xs uppercase text-white/70">Available Cash</dt>
                <dd className="text-base font-semibold text-white">
                  {formatCurrency(data.availableBalance)}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur">
                <dt className="text-xs uppercase text-white/70">Unrealized P&amp;L</dt>
                <dd className="text-base font-semibold text-white">
                  {formatCurrency(data.totalUnrealizedPnL)}
                </dd>
                <p className="mt-1 text-xs text-white/70">
                  Perps {formatCurrency(data.unrealizedPerpPnL)} · Predictions{' '}
                  {formatCurrency(data.unrealizedPredictionPnL)} · Pools{' '}
                  {formatCurrency(data.unrealizedPoolPnL)}
                </p>
              </div>
            </dl>
          </>
        )
      )}
    </section>
  )
}

