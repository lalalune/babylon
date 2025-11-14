'use client'

import { PnLShareModal } from './PnLShareModal'
import type { PortfolioPnLSnapshot } from '@/hooks/usePortfolioPnL'
import type { User } from '@/stores/authStore'

interface PortfolioPnLShareModalProps {
  isOpen: boolean
  onClose: () => void
  data: PortfolioPnLSnapshot | null | undefined
  user: User | null
  lastUpdated?: Date | null | number
}

export function PortfolioPnLShareModal({
  isOpen,
  onClose,
  data,
  user,
}: PortfolioPnLShareModalProps) {
  return (
    <PnLShareModal
      isOpen={isOpen}
      onClose={onClose}
      type="portfolio"
      portfolioData={data ?? null}
      user={user}
    />
  )
}

