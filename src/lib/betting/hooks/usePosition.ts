'use client'

import { useState, useEffect } from 'react'

export interface Position {
  yesShares: bigint
  noShares: bigint
  totalSpent: bigint
  totalReceived: bigint
  hasClaimed: boolean
}

export function usePosition(sessionId: string, address: string | undefined) {
  const [position, setPosition] = useState<Position | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchPosition() {
      if (!address || !sessionId) {
        setPosition(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      
      const response = await fetch(`/api/betting/position?sessionId=${sessionId}&address=${address}`)
      
      if (!response.ok) {
        console.error('Failed to fetch position:', response.statusText)
        setPosition({
          yesShares: BigInt(0),
          noShares: BigInt(0),
          totalSpent: BigInt(0),
          totalReceived: BigInt(0),
          hasClaimed: false
        })
        setIsLoading(false)
        return
      }
      
      const data = await response.json()
      
      setPosition({
        yesShares: BigInt(data.yesShares || 0),
        noShares: BigInt(data.noShares || 0),
        totalSpent: BigInt(data.totalSpent || 0),
        totalReceived: BigInt(data.totalReceived || 0),
        hasClaimed: data.hasClaimed || false
      })
      
      setIsLoading(false)
    }

    void fetchPosition()
  }, [sessionId, address])

  return { position, isLoading }
}

