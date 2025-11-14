'use client'

import { useEffect } from 'react'
import { X, TrendingUp, Calendar, DollarSign, Activity } from 'lucide-react'
import Image from 'next/image'

type BreakingNewsItem = {
  id: string
  title: string
  description: string
  icon: 'chart' | 'calendar' | 'dollar' | 'trending'
  timestamp: string
  trending?: boolean
  source?: string
  fullDescription?: string
  imageUrl?: string
  relatedQuestion?: number
  relatedActorId?: string
  relatedOrganizationId?: string
}

interface BreakingNewsDetailModalProps {
  isOpen: boolean
  onClose: () => void
  item: BreakingNewsItem | null
}

export function BreakingNewsDetailModal({ isOpen, onClose, item }: BreakingNewsDetailModalProps) {
  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      // Ensure body overflow is reset when modal is closed
      document.body.style.overflow = ''
      return
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Cleanup on unmount (for HMR)
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!isOpen || !item) return null

  const getIcon = (icon: BreakingNewsItem['icon']) => {
    switch (icon) {
      case 'chart':
        return <TrendingUp className="w-8 h-8" />
      case 'calendar':
        return <Calendar className="w-8 h-8" />
      case 'dollar':
        return <DollarSign className="w-8 h-8" />
      default:
        return <Activity className="w-8 h-8" />
    }
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl">
        <div className="bg-[#1e1e1e] border border-white/10 rounded-lg shadow-2xl p-6 m-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="text-[#0066FF] mt-1 shrink-0">
                {getIcon(item.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 leading-tight">
                  {item.title}
                </h2>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span>{formatDate(item.timestamp)}</span>
                  {item.trending && (
                    <span className="text-[#0066FF] font-semibold">• Trending</span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-foreground transition-colors p-2 -mt-2 -mr-2"
            >
              <X size={24} />
            </button>
          </div>

          {/* Image */}
          {item.imageUrl && (
            <div className="mb-6 rounded-lg overflow-hidden">
              <Image
                src={item.imageUrl}
                alt={item.title}
                width={800}
                height={400}
                className="w-full h-auto object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-4">
            <div className="p-4 bg-[#2d2d2d] rounded-lg border border-white/5">
              <p className="text-base sm:text-lg text-foreground leading-relaxed whitespace-pre-wrap">
                {item.fullDescription || item.description}
              </p>
            </div>

            {/* Metadata */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              {item.relatedQuestion && (
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-semibold text-gray-400">Related Question:</span> #{item.relatedQuestion}
                  </p>
                </div>
              )}

              {item.source && (
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-semibold text-gray-400">Source:</span> {item.source}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500">
                  News ID: {item.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

