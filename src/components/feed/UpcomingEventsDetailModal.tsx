'use client'

import { useEffect } from 'react'
import { X, Calendar, Clock } from 'lucide-react'
import Image from 'next/image'

interface UpcomingEventDetailModalProps {
  isOpen: boolean
  onClose: () => void
  event: {
    id: string
    title: string
    date: string
    time?: string
    isLive?: boolean
    hint?: string
    fullDescription?: string
    source?: string
    relatedQuestion?: number
    imageUrl?: string
    relatedActorId?: string
    relatedOrganizationId?: string
  } | null
}

export function UpcomingEventsDetailModal({ isOpen, onClose, event }: UpcomingEventDetailModalProps) {
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

  if (!isOpen || !event) return null

  const formatFullDate = (date: string, time?: string) => {
    // Try to parse if it's a full date string
    const dateObj = new Date(date)
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }
    
    return time ? `${date}, ${time}` : date
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
              <div className="text-[#0066FF] mt-1 flex-shrink-0">
                <Calendar className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
                  {event.title}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{formatFullDate(event.date, event.time)}</span>
                  </div>
                  {event.isLive && (
                    <span className="text-sm font-semibold text-[#0066FF] bg-[#0066FF]/10 px-3 py-1 rounded flex-shrink-0">
                      LIVE
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 -mt-2 -mr-2"
            >
              <X size={24} />
            </button>
          </div>

          {/* Image */}
          {event.imageUrl && (
            <div className="mb-6 rounded-lg overflow-hidden">
              <Image
                src={event.imageUrl}
                alt={event.title}
                width={800}
                height={400}
                className="w-full h-auto object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-4">
            {event.fullDescription && (
              <div className="p-4 bg-[#2d2d2d] rounded-lg border border-white/5">
                <p className="text-base sm:text-lg text-white leading-relaxed whitespace-pre-wrap">
                  {event.fullDescription}
                </p>
              </div>
            )}

            {event.hint && (
              <div className="p-4 bg-[#2d2d2d] rounded-lg border border-white/5">
                <p className="text-sm font-semibold text-gray-400 mb-2">Hint</p>
                <p className="text-base text-gray-300 leading-relaxed italic">
                  {event.hint}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              {event.relatedQuestion && (
                <div>
                  <p className="text-sm text-white">
                    <span className="font-semibold text-gray-400">Related Question:</span> #{event.relatedQuestion}
                  </p>
                </div>
              )}

              {event.source && (
                <div>
                  <p className="text-sm text-white">
                    <span className="font-semibold text-gray-400">Source:</span> {event.source}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500">
                  Event ID: {event.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

