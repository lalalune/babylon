'use client'

import { logger } from '@/lib/logger'
import React from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class PoolsErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    // Error is already captured in state via getDerivedStateFromError
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
      logger.error('Pools Error Boundary caught error:', error, 'PoolsErrorBoundary');
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold mb-2">Error Loading Pools</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || 'Something went wrong loading the pools'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

