/**
 * Human Review Tab
 * 
 * Shows appeals that need human review after staking
 */

'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertCircle, DollarSign } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { Skeleton } from '@/components/shared/Skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Appeal {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  bannedAt: Date | null
  bannedReason: string | null
  bannedBy: string | null
  isScammer: boolean
  isCSAM: boolean
  appealCount: number
  appealStaked: boolean
  appealStakeAmount: number | null
  appealStakeTxHash: string | null
  appealSubmittedAt: Date | null
  falsePositiveHistory: unknown
  earnedPoints: number
  totalDeposited: number
  totalWithdrawn: number
  lifetimePnL: number
}

export function HumanReviewTab() {
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)

  useEffect(() => {
    fetchAppeals()
  }, [])

  const fetchAppeals = async () => {
    try {
      const response = await fetch('/api/admin/moderation/human-review')
      if (!response.ok) {
        throw new Error('Failed to fetch appeals')
      }
      const data = await response.json()
      setAppeals(data.appeals || [])
    } catch {
      toast.error('Failed to load appeals')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (userId: string, action: 'approve' | 'deny', reasoning: string) => {
    const response = await fetch(`/api/admin/moderation/human-review/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reasoning }),
    })

    if (!response.ok) {
      const error = await response.json()
      toast.error(error.message || 'Failed to process appeal')
      return
    }

    toast.success(`Appeal ${action === 'approve' ? 'approved' : 'denied'} successfully`)
    setShowActionModal(false)
    setSelectedAppeal(null)
    fetchAppeals()
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Human Review Queue</h2>
        <p className="text-muted-foreground">
          Appeals that require human review after staking $10. Review carefully and decide whether to restore the account or confirm permanent ban.
        </p>
      </div>

      {appeals.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No appeals pending human review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map((appeal) => (
            <div
              key={appeal.id}
              className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <Avatar
                  src={appeal.profileImageUrl || undefined}
                  alt={appeal.displayName || appeal.username || 'User'}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold">
                      {appeal.displayName || appeal.username || appeal.id}
                    </h3>
                    {appeal.isScammer && (
                      <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-500">
                        Scammer
                      </span>
                    )}
                    {appeal.isCSAM && (
                      <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-500">
                        CSAM
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Banned At</div>
                      <div className="font-medium">{formatDate(appeal.bannedAt)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Stake Amount</div>
                      <div className="font-medium flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {appeal.appealStakeAmount?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Earned Points</div>
                      <div className="font-medium">{appeal.earnedPoints}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Deposited</div>
                      <div className="font-medium">${Number(appeal.totalDeposited).toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-muted-foreground mb-1">Ban Reason</div>
                    <div className="text-sm bg-muted/50 rounded p-2">{appeal.bannedReason || 'No reason provided'}</div>
                  </div>

                  {(() => {
                    const history = appeal.falsePositiveHistory
                    if (history && Array.isArray(history) && history.length > 0) {
                      return (
                        <div className="mb-4">
                          <div className="text-sm text-muted-foreground mb-1">False Positive History</div>
                          <div className="text-sm bg-yellow-500/10 rounded p-2">
                            This user has {history.length} previous false positive(s)
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedAppeal(appeal)
                        setShowActionModal(true)
                      }}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Review Appeal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showActionModal && selectedAppeal && (
        <ActionModal
          appeal={selectedAppeal}
          onClose={() => {
            setShowActionModal(false)
            setSelectedAppeal(null)
          }}
          onAction={handleAction}
        />
      )}
    </div>
  )
}

interface ActionModalProps {
  appeal: Appeal
  onClose: () => void
  onAction: (userId: string, action: 'approve' | 'deny', reasoning: string) => void
}

function ActionModal({ appeal, onAction, onClose }: ActionModalProps) {
  const [action, setAction] = useState<'approve' | 'deny'>('approve')
  const [reasoning, setReasoning] = useState('')
  const [isSubmitting, startSubmit] = useTransition()

  const handleSubmit = () => {
    if (!reasoning.trim()) {
      toast.error('Please provide reasoning for your decision')
      return
    }

    startSubmit(() => {
      onAction(appeal.id, action, reasoning)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Review Appeal</h2>

        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2">User</div>
          <div className="flex items-center gap-2">
            <Avatar
              src={appeal.profileImageUrl || undefined}
              alt={appeal.displayName || appeal.username || 'User'}
              size="sm"
            />
            <span className="font-medium">{appeal.displayName || appeal.username || appeal.id}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Decision</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as 'approve' | 'deny')}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
          >
            <option value="approve">Approve - Restore Account (False Positive)</option>
            <option value="deny">Deny - Confirm Permanent Ban</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Reasoning</label>
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder="Explain your decision..."
            className="w-full px-3 py-2 bg-background border border-border rounded-lg resize-none"
            rows={6}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !reasoning.trim()}
            className={cn(
              'flex-1 px-4 py-2 rounded-lg transition-colors',
              action === 'approve'
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-red-500 text-white hover:bg-red-600',
              'disabled:opacity-50'
            )}
          >
            {isSubmitting ? 'Processing...' : action === 'approve' ? 'Approve Appeal' : 'Deny Appeal'}
          </button>
        </div>
      </div>
    </div>
  )
}

