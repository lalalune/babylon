'use client'

import { useEffect, useState, useCallback } from 'react'
import { Globe, RefreshCw, Newspaper, Edit, Save, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Skeleton'
import { logger } from '@/lib/logger'

interface WorldFact {
  id: string
  category: string
  key: string
  label: string
  value: string
  source?: string
  priority: number
  isActive: boolean
  lastUpdated: string
}

interface WorldFactsData {
  facts: WorldFact[]
  recentParodies: Array<{
    id: string
    parodyTitle: string
    originalTitle: string
    generatedAt: string
  }>
  context: {
    crypto: string
    politics: string
    economy: string
    technology: string
    general: string
    headlines?: string
  }
}

export function WorldFactsSection() {
  const [data, setData] = useState<WorldFactsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [editingFact, setEditingFact] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ value: string }>({ value: '' })

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/world-facts')
      if (!response.ok) throw new Error('Failed to fetch world facts')
      let result;
      try {
        result = await response.json()
      } catch (parseError) {
        logger.error('Failed to parse world facts response', { error: parseError }, 'WorldFactsSection')
        throw new Error('Failed to parse response')
      }
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAction = async (action: string, actionData?: Record<string, unknown>) => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/world-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: actionData }),
      })

      if (!response.ok) throw new Error(`Failed to ${action}`)

      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`)
    } finally {
      setActionLoading(false)
    }
  }

  const startEditing = (fact: WorldFact) => {
    setEditingFact(fact.id)
    setEditValues({ value: fact.value })
  }

  const saveEdit = async (fact: WorldFact) => {
    await handleAction('update_fact', {
      category: fact.category,
      key: fact.key,
      label: fact.label,
      value: editValues.value,
      source: fact.source,
      priority: fact.priority,
    })
    setEditingFact(null)
  }

  const cancelEdit = () => {
    setEditingFact(null)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center text-red-500 p-8">
        {error || 'Failed to load world facts'}
      </div>
    )
  }

  // Group facts by category
  const factsByCategory = data.facts.reduce((acc, fact) => {
    if (!acc[fact.category]) acc[fact.category] = []
    acc[fact.category]!.push(fact)
    return acc
  }, {} as Record<string, WorldFact[]>)

  const categoryColors = {
    crypto: 'orange',
    politics: 'blue',
    economy: 'green',
    technology: 'purple',
    general: 'gray',
  } as const

  const getCategoryColor = (category: string) => {
    return categoryColors[category as keyof typeof categoryColors] || 'gray'
  }

  return (
    <div className="space-y-6">
      {/* World Facts Header */}
      <div className="bg-gradient-to-br from-card to-accent/20 border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Globe className="w-6 h-6 text-blue-500" />
              World Facts & Context
            </h3>
            <p className="text-sm text-muted-foreground">
              Manage general world state, RSS feeds, and parody headlines for game context
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData()}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', actionLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => handleAction('fetch_rss')}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
          >
            <Newspaper className="w-5 h-5" />
            Fetch RSS Feeds
          </button>

          <button
            onClick={() => handleAction('generate_parodies')}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-purple-500/20 text-purple-500 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
          >
            <Zap className="w-5 h-5" />
            Generate Parodies
          </button>

          <button
            onClick={() => handleAction('refresh_mappings')}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh Mappings
          </button>
        </div>
      </div>

      {/* World Facts by Category */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide">
          Current World Facts
        </h4>

        {Object.entries(factsByCategory).map(([category, facts]) => {
          const color = getCategoryColor(category)
          return (
            <div key={category} className="bg-card border border-border rounded-lg p-4">
              <h5 className={cn(
                'text-sm font-semibold uppercase tracking-wide mb-3',
                `text-${color}-500`
              )}>
                {category}
              </h5>

              <div className="space-y-2">
                {facts.map(fact => (
                  <div
                    key={fact.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">{fact.label}</div>
                      {editingFact === fact.id ? (
                        <textarea
                          value={editValues.value}
                          onChange={(e) => setEditValues({ value: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                          rows={3}
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground">{fact.value}</div>
                      )}
                      {fact.source && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Source: {fact.source} • Last updated: {new Date(fact.lastUpdated).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {editingFact === fact.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(fact)}
                            disabled={actionLoading}
                            className="p-2 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(fact)}
                          className="p-2 rounded-lg bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Parody Headlines */}
      {data.recentParodies.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Recent Parody Headlines
          </h4>

          <div className="space-y-2">
            {data.recentParodies.map(parody => (
              <div key={parody.id} className="p-3 rounded-lg bg-accent/30">
                <div className="font-medium text-sm mb-1">{parody.parodyTitle}</div>
                <div className="text-xs text-muted-foreground">
                  Original: {parody.originalTitle}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Generated: {new Date(parody.generatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


