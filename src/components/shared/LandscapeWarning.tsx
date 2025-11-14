'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'

export function LandscapeWarning() {
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    // Function to check if device is in landscape mode
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        // Check if mobile device (screen width < 768px for tablets and below)
        const isMobile = window.innerWidth < 768
        // Check if landscape (width > height)
        const isLandscapeMode = window.innerWidth > window.innerHeight
        
        setIsLandscape(isMobile && isLandscapeMode)
      }
    }

    // Check on mount
    checkOrientation()

    // Listen for orientation changes
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  if (!isLandscape) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <RotateCcw className="w-16 h-16 text-white animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Rotate Your Device
        </h2>
        <p className="text-gray-300 text-lg">
          This app is best viewed in portrait mode. Please rotate your device to continue.
        </p>
      </div>
    </div>
  )
}

