'use client'

import type { ReactNode } from 'react';
import { createContext, useContext, useRef } from 'react'

interface WidgetRefreshContextType {
  registerRefresh: (name: string, refreshFn: () => void) => void
  unregisterRefresh: (name: string) => void
  refreshAll: () => void
}

const WidgetRefreshContext = createContext<WidgetRefreshContextType | null>(null)

export function WidgetRefreshProvider({ children }: { children: ReactNode }) {
  const refreshFunctions = useRef<Map<string, () => void>>(new Map())

  const registerRefresh = (name: string, refreshFn: () => void) => {
    refreshFunctions.current.set(name, refreshFn)
  }

  const unregisterRefresh = (name: string) => {
    refreshFunctions.current.delete(name)
  }

  const refreshAll = () => {
    refreshFunctions.current.forEach((refreshFn) => {
      refreshFn()
    })
  }

  return (
    <WidgetRefreshContext.Provider value={{ registerRefresh, unregisterRefresh, refreshAll }}>
      {children}
    </WidgetRefreshContext.Provider>
  )
}

export function useWidgetRefresh() {
  const context = useContext(WidgetRefreshContext)
  if (!context) {
    throw new Error('useWidgetRefresh must be used within WidgetRefreshProvider')
  }
  return context
}



