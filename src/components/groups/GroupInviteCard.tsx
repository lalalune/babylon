'use client'

import { useState } from 'react'
import { Users, Check, X, Loader2 } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'

interface GroupInviteCardProps {
  inviteId: string
  groupId: string
  groupName: string
  groupDescription?: string | null
  memberCount: number
  invitedAt: Date | string
  onAccepted?: (groupId: string, chatId?: string) => void
  onDeclined?: () => void
}

export function GroupInviteCard({
  inviteId,
  groupId,
  groupName,
  groupDescription,
  memberCount,
  invitedAt,
  onAccepted,
  onDeclined,
}: GroupInviteCardProps) {
  const { getAccessToken } = usePrivy()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>('pending')
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setLoading(true)
    setError(null)

    const token = await getAccessToken()
    const response = await fetch(`/api/groups/invites/${inviteId}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const data = await response.json()
      setLoading(false)
      throw new Error(data.error || 'Failed to accept invite')
    }

    const data = await response.json()
    setStatus('accepted')
    onAccepted?.(groupId, data.chatId)
    setLoading(false)
  }

  const handleDecline = async () => {
    setLoading(true)
    setError(null)

    const token = await getAccessToken()
    const response = await fetch(`/api/groups/invites/${inviteId}/decline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const data = await response.json()
      setLoading(false)
      throw new Error(data.error || 'Failed to decline invite')
    }

    setStatus('declined')
    onDeclined?.()
    setLoading(false)
  }

  if (status === 'accepted') {
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Invitation Accepted</p>
            <p className="text-xs text-muted-foreground">
              You are now a member of {groupName}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'declined') {
    return (
      <div className="p-4 bg-muted/50 border border-muted rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <X className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Invitation Declined</p>
            <p className="text-xs text-muted-foreground">
              You declined the invitation to {groupName}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-sidebar border border-border rounded-lg shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">{groupName}</h3>
            {groupDescription && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {groupDescription}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{memberCount} members</span>
              <span>·</span>
              <span>
                {new Date(invitedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 inline animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 inline mr-1" />
                Accept
              </>
            )}
          </button>
          <button
            onClick={handleDecline}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-sidebar border border-border hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 inline animate-spin" />
            ) : (
              <>
                <X className="w-4 h-4 inline mr-1" />
                Decline
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

