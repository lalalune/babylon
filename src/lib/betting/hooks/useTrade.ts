'use client'

import { useState } from 'react'

export function useTrade(sessionId: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buyShares = async (isYes: boolean, amount: number) => {
    setIsLoading(true)
    setError(null)
    
    const response = await fetch('/api/betting/trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        outcome: isYes ? 'YES' : 'NO',
        amount,
      }),
    })
    
    setIsLoading(false)
    
    if (!response.ok) {
      const errorData = await response.json()
      const errorMessage = errorData.error || 'Trade failed'
      setError(errorMessage)
      console.error('Trade failed:', errorMessage)
      throw new Error(errorMessage)
    }
    
    const result = await response.json()
    console.log('Trade successful:', result)
    
    return result
  }

  return { buyShares, isLoading, error }
}

