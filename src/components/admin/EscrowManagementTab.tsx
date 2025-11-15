'use client'

import { useEffect, useState, useTransition } from 'react'
import { RefreshCw, DollarSign, ArrowLeftRight, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { toast } from 'sonner'
import { Skeleton } from '@/components/shared/Skeleton'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Note: Admin API routes use cookie-based authentication via requireAdmin middleware
// The privy-token cookie is automatically sent with requests, so explicit Authorization header is optional
// However, we can include it if available for consistency with other admin components
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  // Try to get token from window if available (some admin components use this)
  return (window as { __privyAccessToken?: string }).__privyAccessToken || null
}

const EscrowSchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  recipient: z.object({
    id: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    profileImageUrl: z.string().nullable(),
  }),
  adminId: z.string(),
  admin: z.object({
    id: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  amountUSD: z.string(),
  amountWei: z.string(),
  status: z.enum(['pending', 'paid', 'refunded', 'expired']),
  reason: z.string().nullable(),
  paymentRequestId: z.string().nullable(),
  paymentTxHash: z.string().nullable(),
  refundTxHash: z.string().nullable(),
  refundedBy: z.string().nullable(),
  refundedByUser: z.object({
    id: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
  }).nullable(),
  refundedAt: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
})
type Escrow = z.infer<typeof EscrowSchema>

type StatusFilter = 'all' | 'pending' | 'paid' | 'refunded' | 'expired'

export function EscrowManagementTab() {
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, startRefresh] = useTransition()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundTxHash, setRefundTxHash] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [isRefunding, setIsRefunding] = useState(false)

  useEffect(() => {
    fetchEscrows()
  }, [statusFilter])

  const fetchEscrows = (showRefreshing = false) => {
    const fetchLogic = async () => {
      const token = getAuthToken()
      const params = new URLSearchParams({
        limit: '100',
      })
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`/api/admin/moderation-escrow/list?${params}`, {
        headers,
      })
      if (!response.ok) throw new Error('Failed to fetch escrows')
      const data = await response.json()
      const validation = z.array(EscrowSchema).safeParse(data.escrows)
      if (!validation.success) {
        throw new Error('Invalid escrow data structure')
      }
      setEscrows(validation.data || [])
      setLoading(false)
    }

    if (showRefreshing) {
      startRefresh(fetchLogic)
    } else {
      fetchLogic()
    }
  }

  const handleRefund = async () => {
    if (!selectedEscrow || !refundTxHash.trim()) {
      toast.error('Refund transaction hash is required')
      return
    }

    setIsRefunding(true)
    try {
      const token = getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/admin/moderation-escrow/refund', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          escrowId: selectedEscrow.id,
          refundTxHash: refundTxHash.trim(),
          reason: refundReason.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to refund escrow')
      }

      toast.success('Escrow refunded successfully')
      setShowRefundModal(false)
      setSelectedEscrow(null)
      setRefundTxHash('')
      setRefundReason('')
      fetchEscrows(true)
    } catch (error) {
      logger.error('Failed to refund escrow', { error }, 'EscrowManagementTab')
      toast.error(error instanceof Error ? error.message : 'Failed to refund escrow')
    } finally {
      setIsRefunding(false)
    }
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return `$${num.toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/20 text-green-500'
      case 'refunded':
        return 'bg-blue-500/20 text-blue-500'
      case 'expired':
        return 'bg-gray-500/20 text-gray-500'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-500'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4" />
      case 'refunded':
        return <ArrowLeftRight className="w-4 h-4" />
      case 'expired':
        return <XCircle className="w-4 h-4" />
      case 'pending':
        return <Clock className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Escrow Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {escrows.length} {escrows.length === 1 ? 'escrow payment' : 'escrow payments'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => fetchEscrows(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'paid', 'refunded', 'expired'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded transition-colors',
              statusFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Escrows List */}
      {escrows.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 bg-card border border-border rounded-2xl">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No escrow payments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {escrows.map((escrow) => (
            <div
              key={escrow.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={escrow.recipient.profileImageUrl ?? undefined}
                      alt={escrow.recipient.displayName || escrow.recipient.username || 'User'}
                      size="sm"
                    />
                    <div>
                      <div className="font-medium">
                        {escrow.recipient.displayName || escrow.recipient.username || 'Unknown User'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Admin: {escrow.admin.displayName || escrow.admin.username || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Amount: </span>
                      <span className="font-semibold text-green-600">{formatCurrency(escrow.amountUSD)}</span>
                    </div>
                    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs', getStatusColor(escrow.status))}>
                      {getStatusIcon(escrow.status)}
                      {escrow.status.charAt(0).toUpperCase() + escrow.status.slice(1)}
                    </div>
                  </div>

                  {escrow.reason && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Reason: </span>
                      {escrow.reason}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">Created: </span>
                      {formatDate(escrow.createdAt)}
                    </div>
                    {escrow.paymentTxHash && (
                      <div>
                        <span className="font-medium">Payment TX: </span>
                        <a
                          href={`https://basescan.org/tx/${escrow.paymentTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-mono"
                        >
                          {escrow.paymentTxHash.slice(0, 10)}...{escrow.paymentTxHash.slice(-8)}
                        </a>
                      </div>
                    )}
                    {escrow.refundTxHash && (
                      <div>
                        <span className="font-medium">Refund TX: </span>
                        <a
                          href={`https://basescan.org/tx/${escrow.refundTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-mono"
                        >
                          {escrow.refundTxHash.slice(0, 10)}...{escrow.refundTxHash.slice(-8)}
                        </a>
                      </div>
                    )}
                    {escrow.refundedAt && escrow.refundedByUser && (
                      <div>
                        <span className="font-medium">Refunded by: </span>
                        {escrow.refundedByUser.displayName || escrow.refundedByUser.username || 'Unknown'} on{' '}
                        {formatDate(escrow.refundedAt)}
                      </div>
                    )}
                  </div>
                </div>

                {escrow.status === 'paid' && !escrow.refundTxHash && (
                  <button
                    onClick={() => {
                      setSelectedEscrow(escrow)
                      setShowRefundModal(true)
                    }}
                    className="px-3 py-1.5 text-sm font-medium rounded bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Refund
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedEscrow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <ArrowLeftRight className="w-5 h-5 text-blue-500" />
              Refund Escrow Payment
            </h2>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm text-muted-foreground">Recipient</div>
                <div className="font-medium">
                  {selectedEscrow.recipient.displayName || selectedEscrow.recipient.username || 'Unknown User'}
                </div>
                <div className="text-sm text-muted-foreground mt-2">Amount</div>
                <div className="font-semibold text-green-600">{formatCurrency(selectedEscrow.amountUSD)}</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Refund Transaction Hash <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={refundTxHash}
                  onChange={(e) => setRefundTxHash(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason (optional)</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason for refund..."
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRefundModal(false)
                    setSelectedEscrow(null)
                    setRefundTxHash('')
                    setRefundReason('')
                  }}
                  disabled={isRefunding}
                  className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefund}
                  disabled={isRefunding || !refundTxHash.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRefunding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4" />
                      Refund Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

