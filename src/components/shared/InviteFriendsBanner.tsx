'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Trophy, Copy, Check, ExternalLink, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

interface InviteFriendsBannerProps {
  onDismiss?: () => void
}

export function InviteFriendsBanner({ onDismiss }: InviteFriendsBannerProps) {
  const { user, setUser } = useAuthStore()
  const [referralUrl, setReferralUrl] = useState<string | null>(null)
  const [copiedReferral, setCopiedReferral] = useState(false)

  useEffect(() => {
    const fetchReferralUrl = async () => {
      if (!user?.id) return
      
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) return

      const referralRes = await fetch(`/api/users/${encodeURIComponent(user.id)}/referral-code`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (referralRes.ok) {
        const data = await referralRes.json()
        setReferralUrl(data.referralUrl)
      }

      // Track banner view in local storage
      const viewKey = `banner_view_${user.id}`
      const lastView = localStorage.getItem(viewKey)
      const now = Date.now()
      
      // Store this view
      localStorage.setItem(viewKey, now.toString())
      
      // Update server if more than 1 day since last tracked
      if (!lastView || now - parseInt(lastView) > 86400000) {
        await fetch(`/api/users/${encodeURIComponent(user.id)}/update-profile`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bannerLastShown: new Date().toISOString(),
          }),
        })
      }
    }

    fetchReferralUrl()
  }, [user])

  const handleCopyReferral = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!referralUrl) return
    await navigator.clipboard.writeText(referralUrl)
    setCopiedReferral(true)
    setTimeout(() => setCopiedReferral(false), 2000)
  }

  const handleDismiss = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!user?.id) return

    // Track dismiss in local storage
    const dismissKey = `banner_dismiss_${user.id}`
    const dismissCount = parseInt(localStorage.getItem(dismissKey) || '0')
    localStorage.setItem(dismissKey, (dismissCount + 1).toString())
    localStorage.setItem(`banner_dismiss_time_${user.id}`, Date.now().toString())

    // Update server
    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (token) {
      await fetch(`/api/users/${encodeURIComponent(user.id)}/update-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bannerDismissCount: dismissCount + 1,
        }),
      })

      // Update local user state
      if (user) {
        setUser({
          ...user,
          bannerDismissCount: dismissCount + 1,
        })
      }
    }

    // Call parent dismiss handler
    onDismiss?.()
  }

  if (!user?.referralCode || !referralUrl) {
    return null
  }

  return (
    <Link 
      href="/referrals"
      className="block border-b border-border hover:bg-muted/30 transition-colors group"
    >
      <div className="max-w-[600px] mx-auto p-4">
        <div className="relative rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-4 hover:border-purple-500/40 transition-colors">
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors opacity-0 group-hover:opacity-100"
            title="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-foreground">Invite Friends</h3>
            <span className="ml-auto text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
              50% of fees
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Earn 50% of all trading fees from your referrals!
          </p>
          <div className="flex items-center justify-between">
            <button
              onClick={handleCopyReferral}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/70 text-foreground transition-colors"
            >
              {copiedReferral ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">Copy Link</span>
                </>
              )}
            </button>
            <span className="text-sm text-purple-500 group-hover:text-purple-400 flex items-center gap-1">
              View All
              <ExternalLink className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

