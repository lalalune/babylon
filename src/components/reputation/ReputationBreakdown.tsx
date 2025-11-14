/**
 * ReputationBreakdown Component
 *
 * Displays detailed breakdown of reputation score components
 * Shows how PNL, Feedback, and Activity contribute to overall score
 *
 * Pattern based on: ProfileWidget.tsx
 */

'use client'

import { useEffect, useState } from 'react'
import { DollarSign, MessageSquare, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreakdownData {
  userId: string
  reputationScore: number
  trustLevel: string
  confidenceScore: number
  breakdown: {
    pnlComponent: number
    feedbackComponent: number
    activityComponent: number
  }
  metrics: {
    normalizedPnL: number
    averageFeedbackScore: number
    gamesPlayed: number
    totalFeedbackCount: number
    winRate: number
  }
  weights: {
    pnl: number
    feedback: number
    activity: number
  }
}

interface ReputationBreakdownProps {
  userId: string
  className?: string
}

export function ReputationBreakdown({
  userId,
  className = '',
}: ReputationBreakdownProps) {
  const [breakdown, setBreakdown] = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBreakdown = async () => {
      setLoading(true)
      const response = await fetch(
        `/api/reputation/breakdown/${encodeURIComponent(userId)}`
      )
      const data = await response.json()

      if (data.success) {
        setBreakdown(data)
      }
      setLoading(false)
    }

    fetchBreakdown()
  }, [userId])

  if (loading) {
    return (
      <div className={cn('bg-sidebar rounded-lg p-4', className)}>
        <div className="text-sm text-muted-foreground">Loading breakdown...</div>
      </div>
    )
  }

  if (!breakdown) {
    return (
      <div className={cn('bg-sidebar rounded-lg p-4', className)}>
        <div className="text-sm text-muted-foreground">Breakdown data unavailable</div>
      </div>
    )
  }

  const components = [
    {
      name: 'PNL Performance',
      value: breakdown.breakdown.pnlComponent,
      weight: breakdown.weights.pnl * 100,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      metric: `${breakdown.metrics.normalizedPnL.toFixed(2)} normalized PNL`,
    },
    {
      name: 'Feedback Score',
      value: breakdown.breakdown.feedbackComponent,
      weight: breakdown.weights.feedback * 100,
      icon: MessageSquare,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      metric: `${breakdown.metrics.averageFeedbackScore.toFixed(0)}/100 avg (${breakdown.metrics.totalFeedbackCount} reviews)`,
    },
    {
      name: 'Activity Level',
      value: breakdown.breakdown.activityComponent,
      weight: breakdown.weights.activity * 100,
      icon: Activity,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      metric: `${breakdown.metrics.gamesPlayed} games played`,
    },
  ]

  return (
    <div className={cn('bg-sidebar rounded-lg p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Reputation Breakdown</h3>
        <div className="text-sm text-muted-foreground">
          Confidence: {(breakdown.confidenceScore * 100).toFixed(0)}%
        </div>
      </div>

      {/* Total Score */}
      <div className="bg-muted/30 rounded-lg p-4 text-center">
        <div className="text-xs text-muted-foreground mb-1">Total Reputation</div>
        <div className="text-3xl font-bold text-foreground">
          {Math.round(breakdown.reputationScore)}
        </div>
        <div className="text-xs text-muted-foreground mt-1 capitalize">
          {breakdown.trustLevel}
        </div>
      </div>

      {/* Components Breakdown */}
      <div className="space-y-3">
        {components.map((component) => {
          const Icon = component.icon
          return (
            <div key={component.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded', component.bgColor)}>
                    <Icon className={cn('w-4 h-4', component.color)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {component.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{component.metric}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-foreground">
                    {component.value.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {component.weight}% weight
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted/30 rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full', component.bgColor)}
                  style={{ width: `${Math.min(100, component.value)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Calculation Note */}
      <div className="text-xs text-muted-foreground italic border-t border-border pt-3">
        Reputation = (PNL × 40%) + (Feedback × 40%) + (Activity × 20%)
      </div>
    </div>
  )
}
