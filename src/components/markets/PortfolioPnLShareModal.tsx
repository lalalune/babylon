'use client'

import { useState, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { Twitter } from 'lucide-react'
import { ArrowUpRight, Check, Copy, Download, Link as LinkIcon, X } from 'lucide-react'
import { PortfolioPnLShareCard } from '@/components/markets/PortfolioPnLShareCard'
import type { PortfolioPnLSnapshot } from '@/hooks/usePortfolioPnL'
import type { User } from '@/stores/authStore'
import { trackExternalShare } from '@/lib/share/trackExternalShare'

function FarcasterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1000 1000" fill="currentColor" aria-hidden="true">
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
      <path d="M128.889 253.333L157.778 351.111H182.222V844.444H128.889V253.333Z" />
      <path d="M871.111 253.333L842.222 351.111H817.778V844.444H871.111V253.333Z" />
    </svg>
  )
}

interface PortfolioPnLShareModalProps {
  isOpen: boolean
  onClose: () => void
  data: PortfolioPnLSnapshot | null
  user: User | null
  lastUpdated: number | null
}

export function PortfolioPnLShareModal({
  isOpen,
  onClose,
  data,
  user,
  lastUpdated,
}: PortfolioPnLShareModalProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState<'twitter' | 'farcaster' | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/markets` : 'https://babylon.game'

  const cardTimestamp = useMemo(() => {
    if (lastUpdated) return new Date(lastUpdated)
    return new Date()
  }, [lastUpdated])

  if (!isOpen) return null

  const canShare = Boolean(data && user)

  const shareText = data
    ? `My Babylon P&L is ${data.totalPnL >= 0 ? '+' : ''}$${Math.abs(data.totalPnL).toFixed(
        2,
      )}. Trading narratives, sharing the upside.`
    : 'Check out the markets on Babylon.'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      void trackExternalShare({
        platform: 'link',
        contentType: 'market',
        contentId: 'portfolio-pnl',
        url: shareUrl,
        userId: user?.id,
      })
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleDownload = async () => {
    if (!cardRef.current || !data || !user) return
    setIsDownloading(true)
    try {
      const htmlToImage = await import('html-to-image')
      const dataUrl = await htmlToImage.toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#050816',
      })

      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `babylon-pnl-${Date.now()}.png`
      link.click()
      void trackExternalShare({
        platform: 'download',
        contentType: 'market',
        contentId: 'portfolio-pnl',
        url: shareUrl,
        userId: user?.id,
      })
      toast.success('P&L card downloaded')
    } catch {
      toast.error('Failed to download card')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleShare = async (platform: 'twitter' | 'farcaster') => {
    if (!canShare || !user || !data) return

    setSharing(platform)
    const message =
      platform === 'twitter'
        ? `${shareText} ${shareUrl}`
        : `${shareText}\n\n${shareUrl} #BabylonMarkets`

    try {
      if (platform === 'twitter') {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`
        window.open(twitterUrl, '_blank', 'width=550,height=420')
      } else {
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(message)}`
        window.open(warpcastUrl, '_blank', 'width=550,height=600')
      }

      await trackExternalShare({
        platform,
        contentType: 'market',
        contentId: 'portfolio-pnl',
        url: shareUrl,
        userId: user?.id,
      })
    } catch {
      toast.error('Failed to initiate share')
    } finally {
      setSharing(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#050816] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Share Your P&amp;L</h2>
            <p className="text-xs text-white/60">Show off your Babylon performance card</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close P&L share modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="rounded-xl border border-white/10 bg-black/50 p-4">
              {canShare ? (
                <div ref={cardRef} className="flex items-center justify-center">
                  <PortfolioPnLShareCard data={data!} user={user!} timestamp={cardTimestamp} />
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-white/70">
                  Sign in to generate your personalized P&amp;L card.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!canShare || isDownloading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#050816] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDownloading ? (
                <>
                  <Download className="h-4 w-4 animate-pulse" />
                  Preparing download...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download P&amp;L Card
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-white/50">
              Download a 1200x630 PNG ready for social sharing. Includes your latest P&amp;L snapshot
              and Babylon branding.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Share Options
              </h3>
              <p className="mt-1 text-xs text-white/50">
                Post directly to your favorite social platform and earn points.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleShare('twitter')}
              disabled={!canShare || sharing === 'twitter'}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-left text-white transition hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Twitter className="h-5 w-5 text-sky-400" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Share to X</span>
                <span className="text-xs text-white/60">
                  Launch a pre-filled post with your latest P&amp;L snapshot.
                </span>
              </div>
              <ArrowUpRight className="ml-auto h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => handleShare('farcaster')}
              disabled={!canShare || sharing === 'farcaster'}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-left text-white transition hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FarcasterIcon className="h-5 w-5 text-purple-400" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Share to Farcaster</span>
                <span className="text-xs text-white/60">
                  Cast your performance card straight to your followers.
                </span>
              </div>
              <ArrowUpRight className="ml-auto h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white transition hover:border-white/20 hover:bg-white/10"
            >
              <LinkIcon className="h-5 w-5 text-white/60" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Copy share link</span>
                <span className="text-xs text-white/60">
                  Paste anywhere or drop into group chats.
                </span>
              </div>
              {copied ? <Check className="ml-auto h-4 w-4 text-emerald-400" /> : <Copy className="ml-auto h-4 w-4" />}
            </button>

            <div className="mt-2 rounded-xl border border-white/10 bg-[#0B1224] p-4 text-xs text-white/60">
              <p className="font-semibold text-white/80">Pro Tips</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Mention @Babylon to get featured in the daily recap.</li>
                <li>Add market tickers or prediction questions you crushed.</li>
                <li>Tag a friend to challenge their performance.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

