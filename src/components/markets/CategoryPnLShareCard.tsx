import type { User } from '@/stores/authStore'

type MarketCategory = 'perps' | 'predictions' | 'pools'

interface CategoryPnLData {
  unrealizedPnL: number
  positionCount: number
  totalValue?: number
  categorySpecific?: {
    openInterest?: number
    totalShares?: number
    totalInvested?: number
  }
}

interface CategoryPnLShareCardProps {
  category: MarketCategory
  data: CategoryPnLData
  user: User
  timestamp: Date
  className?: string
}

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return formatter.format(Number.isFinite(value) ? value : 0)
}

const categoryConfig = {
  perps: {
    title: 'Perpetual Futures',
    emoji: '📈',
    gradient: 'radial-gradient(circle at top left, rgba(16, 185, 129, 0.85), rgba(10, 10, 30, 0.95)), linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(0, 102, 255, 0.35))',
  },
  predictions: {
    title: 'Prediction Markets',
    emoji: '🔮',
    gradient: 'radial-gradient(circle at top left, rgba(168, 85, 247, 0.85), rgba(10, 10, 30, 0.95)), linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(0, 102, 255, 0.35))',
  },
  pools: {
    title: 'Trading Pools',
    emoji: '💰',
    gradient: 'radial-gradient(circle at top left, rgba(249, 115, 22, 0.85), rgba(10, 10, 30, 0.95)), linear-gradient(135deg, rgba(249, 115, 22, 0.3), rgba(0, 102, 255, 0.35))',
  },
}

export function CategoryPnLShareCard({ category, data, user, timestamp, className }: CategoryPnLShareCardProps) {
  const config = categoryConfig[category]
  const displayName = user.displayName || 'Babylon Trader'
  const handle =
    user.username || user.farcasterUsername || user.twitterUsername || user.walletAddress || 'anon'
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)

  return (
    <div
      className={className}
      style={{
        width: 1200,
        height: 630,
        borderRadius: 32,
        background: config.gradient,
        color: '#F8FAFC',
        padding: '64px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'Inter, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          right: '-10%',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)',
        }}
      />

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '4px solid rgba(255,255,255,0.25)',
              position: 'relative',
            }}
          >
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={displayName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #0F1729, #172554)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  fontWeight: 700,
                }}
              >
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              {displayName}
            </p>
            <p
              style={{
                fontSize: 20,
                color: 'rgba(226, 232, 255, 0.75)',
                marginTop: 4,
              }}
            >
              @{handle}
            </p>
            <p
              style={{
                marginTop: 12,
                fontSize: 18,
                color: 'rgba(226, 232, 255, 0.65)',
              }}
            >
              {formattedDate}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'rgba(226, 232, 255, 0.75)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Babylon
          </span>
          <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg
              width="72"
              height="72"
              viewBox="0 0 624 554"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M335.957 17.5C340.737 17.504 342.501 19.3681 343.094 20.3096C343.729 21.3174 344.687 23.9438 342.627 28.5137C342.633 28.4992 342.652 28.4648 342.242 29.2568C341.935 29.8503 341.344 30.9959 340.785 32.3691C339.525 35.464 338.51 39.4643 338.833 44.334L339.679 57.084L352.081 60.1611C358.297 61.7034 365.542 63.6078 372.561 65.2227C420.856 76.3344 462.058 99.175 495.695 135.13C514.006 154.702 528.181 177.275 538.729 202.325C540.334 206.137 542.759 210.65 546.931 214.557C551.261 218.612 556.326 220.952 561.584 222.23C584.616 227.832 597.589 242.886 603.377 267.157C610.342 296.367 604.326 322.296 585.019 345.334C576.72 355.235 565.782 361.263 552.321 363.412C551.268 363.58 546.272 364.193 541.685 367.192C535.819 371.027 533.176 376.667 532.081 381.498V381.499C524.965 412.891 507.727 439.366 484.403 463.536C454.679 494.339 419.302 515.712 377.929 527.188C336.166 538.773 294.534 538.536 252.715 527.187C236.248 522.717 220.382 515.79 204.529 506.791C155.543 478.759 120.367 440.578 101.734 388.642C99.7428 383.09 96.715 376.095 90.3828 370.726C84.262 365.535 77.1453 363.582 70.5879 362.691L69.2842 362.527C50.9277 360.377 37.1504 350.001 28.1514 332.075C20.2346 316.306 16.8763 301.545 17.5947 287.686C18.3088 273.911 23.102 259.927 33.2061 245.671C41.3881 234.126 52.3576 226.913 66.0566 224.323C71.4722 223.299 77.0561 221.278 82.0352 217.214C86.9602 213.194 89.9953 208.231 92.082 203.509C108.045 167.383 131.838 137.035 162.629 111.948C190.017 89.6338 221.451 74.7558 256.223 65.8623C257.301 65.5864 260.412 64.8753 261.505 64.6553C266.179 63.7139 272.983 62.4224 279.368 58.9873C286.502 55.1493 291.898 49.4401 296.335 41.7988C305.488 26.035 318.424 17.4853 335.957 17.5Z"
                stroke="#0066FF"
                strokeWidth="35"
                fill="none"
              />
            </svg>
          </div>
        </div>
      </header>

      <main>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <span style={{ fontSize: 48 }}>{config.emoji}</span>
          <p
            style={{
              fontSize: 22,
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              color: 'rgba(226, 232, 255, 0.65)',
            }}
          >
            {config.title}
          </p>
        </div>
        <p
          style={{
            marginTop: 16,
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.05,
            color: data.unrealizedPnL >= 0 ? '#34D399' : '#F87171',
          }}
        >
          {data.unrealizedPnL >= 0 ? '+' : ''}
          {formatCurrency(data.unrealizedPnL)}
        </p>

        <div
          style={{
            marginTop: 48,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 24,
          }}
        >
          <Stat title="Open Positions" value={data.positionCount.toString()} />
          {data.totalValue !== undefined && (
            <Stat title="Total Value" value={formatCurrency(data.totalValue)} />
          )}
          {data.categorySpecific?.openInterest !== undefined && (
            <Stat title="Open Interest" value={formatCurrency(data.categorySpecific.openInterest)} />
          )}
          {data.categorySpecific?.totalShares !== undefined && (
            <Stat title="Total Shares" value={data.categorySpecific.totalShares.toFixed(2)} />
          )}
          {data.categorySpecific?.totalInvested !== undefined && (
            <Stat title="Total Invested" value={formatCurrency(data.categorySpecific.totalInvested)} />
          )}
        </div>
      </main>

      <footer
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 48,
        }}
      >
        <p
          style={{
            fontSize: 20,
            color: 'rgba(226, 232, 255, 0.65)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Trade the narrative. Share the upside.
        </p>
      </footer>
    </div>
  )
}

interface StatProps {
  title: string
  value: string
  align?: 'start' | 'center' | 'end'
}

function Stat({ title, value, align = 'center' }: StatProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems:
          align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 64, 175, 0.25))',
        borderRadius: 20,
        padding: '24px 28px',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        backdropFilter: 'blur(12px)',
        minHeight: 140,
        justifyContent: 'center',
      }}
    >
      <p
        style={{
          fontSize: 18,
          fontWeight: 500,
          color: 'rgba(226, 232, 255, 0.7)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {title}
      </p>
      <p
        style={{
          marginTop: 12,
          fontSize: 32,
          fontWeight: 700,
          color: '#F8FAFC',
        }}
      >
        {value}
      </p>
    </div>
  )
}

