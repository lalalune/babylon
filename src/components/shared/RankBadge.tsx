/**
 * RankBadge Component
 * 
 * Displays a badge for top-ranked users on the leaderboard
 * - Top 1: Gold badge
 * - Top 2-3: Silver badge
 * - Top 4-10: Bronze badge
 */

import { Award, Medal, Trophy } from 'lucide-react'

interface RankBadgeProps {
  rank: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function RankBadge({ rank, size = 'md', showLabel = true, className = '' }: RankBadgeProps) {
  // Only show badge for top 10
  if (rank > 10) {
    return null
  }

  // Determine badge type and color
  let BadgeIcon: typeof Trophy | typeof Medal | typeof Award
  let badgeColor: string
  let badgeLabel: string
  let glowColor: string

  if (rank === 1) {
    BadgeIcon = Trophy
    badgeColor = 'text-yellow-500'
    glowColor = 'shadow-yellow-500/50'
    badgeLabel = '1st Place'
  } else if (rank <= 3) {
    BadgeIcon = Medal
    badgeColor = 'text-gray-400'
    glowColor = 'shadow-gray-400/50'
    badgeLabel = `${rank}${rank === 2 ? 'nd' : 'rd'} Place`
  } else {
    BadgeIcon = Award
    badgeColor = 'text-amber-700'
    glowColor = 'shadow-amber-700/50'
    badgeLabel = `Top ${rank}`
  }

  // Size classes
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative ${sizeClasses[size]}`}>
        <BadgeIcon
          className={`${sizeClasses[size]} ${badgeColor} drop-shadow-lg ${glowColor}`}
          fill="currentColor"
          strokeWidth={1.5}
        />
        {rank === 1 && (
          <div className="absolute inset-0 animate-pulse">
            <BadgeIcon
              className={`${sizeClasses[size]} ${badgeColor} opacity-50`}
              fill="currentColor"
            />
          </div>
        )}
      </div>
      {showLabel && (
        <span className={`font-semibold ${badgeColor} ${textSizeClasses[size]}`}>
          {badgeLabel}
        </span>
      )}
    </div>
  )
}

/**
 * RankNumber Component
 * 
 * Displays the rank number with special styling for top ranks
 */
interface RankNumberProps {
  rank: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RankNumber({ rank, size = 'md', className = '' }: RankNumberProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }

  let bgColor = 'bg-gray-700'
  let textColor = 'text-gray-300'

  if (rank === 1) {
    bgColor = 'bg-gradient-to-br from-yellow-500 to-yellow-600'
    textColor = 'text-primary-foreground'
  } else if (rank <= 3) {
    bgColor = 'bg-gradient-to-br from-gray-400 to-gray-500'
    textColor = 'text-primary-foreground'
  } else if (rank <= 10) {
    bgColor = 'bg-gradient-to-br from-amber-700 to-amber-800'
    textColor = 'text-primary-foreground'
  }

  return (
    <div
      className={`${sizeClasses[size]} ${bgColor} ${textColor} rounded-full flex items-center justify-center font-bold ${className}`}
    >
      {rank}
    </div>
  )
}

