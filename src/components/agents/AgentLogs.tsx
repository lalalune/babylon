'use client'

import { useState, useEffect } from 'react'
import { FileText, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/lib/logger'

interface Log {
  id: string
  type: string
  level: string
  message: string
  prompt?: string
  completion?: string
  thinking?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

interface AgentLogsProps {
  agentId: string
}

export function AgentLogs({ agentId }: AgentLogsProps) {
  const { getAccessToken } = useAuth()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchLogs()
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [agentId, typeFilter, levelFilter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setLoading(false)
        return
      }
      
      let url = `/api/agents/${agentId}/logs?limit=100`
      if (typeFilter !== 'all') url += `&type=${typeFilter}`
      if (levelFilter !== 'all') url += `&level=${levelFilter}`

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.ok) {
        const data = await res.json() as { success: boolean; logs: Log[] }
        if (data.success && data.logs) {
          setLogs(data.logs)
        }
      } else {
        logger.error('Failed to fetch logs', undefined, 'AgentLogs')
      }
    } catch (error) {
      logger.error('Error fetching logs', { error }, 'AgentLogs')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpanded(newExpanded)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600'
      case 'warn': return 'text-yellow-600'
      case 'debug': return 'text-muted-foreground'
      default: return 'text-blue-600'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-500/10 border-red-500/20'
      case 'trade': return 'bg-green-500/10 border-green-500/20'
      case 'chat': return 'bg-blue-500/10 border-blue-500/20'
      case 'tick': return 'bg-purple-500/10 border-purple-500/20'
      default: return 'bg-muted/30 border-border/50'
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="p-4 rounded-lg bg-card/50 backdrop-blur border border-border">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-muted rounded-lg border border-border text-foreground"
          >
            <option value="all">All Types</option>
            <option value="chat">Chat</option>
            <option value="tick">Tick</option>
            <option value="trade">Trade</option>
            <option value="error">Error</option>
            <option value="system">System</option>
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 bg-muted rounded-lg border border-border text-foreground"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="p-4 rounded-lg bg-card/50 backdrop-blur border border-border">
        {logs.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No logs found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={cn('p-3 rounded-lg border', getTypeColor(log.type))}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-xs font-mono uppercase font-semibold', getLevelColor(log.level))}>
                        {log.level}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs uppercase text-muted-foreground">{log.type}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm">{log.message}</div>
                    
                    {(log.prompt || log.completion || log.thinking || log.metadata) && (
                      <button
                        onClick={() => toggleExpanded(log.id)}
                        className="mt-2 px-3 py-1 rounded text-xs bg-muted hover:bg-muted/80 transition-all"
                      >
                        {expanded.has(log.id) ? 'Hide Details' : 'Show Details'}
                      </button>
                    )}

                    {expanded.has(log.id) && (
                      <div className="mt-3 space-y-2 text-xs">
                        {log.prompt && (
                          <div>
                            <div className="font-medium text-muted-foreground mb-1">Prompt:</div>
                            <pre className="bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                              {log.prompt}
                            </pre>
                          </div>
                        )}
                        {log.completion && (
                          <div>
                            <div className="font-medium text-muted-foreground mb-1">Completion:</div>
                            <pre className="bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                              {log.completion}
                            </pre>
                          </div>
                        )}
                        {log.thinking && (
                          <div>
                            <div className="font-medium text-muted-foreground mb-1">Thinking:</div>
                            <pre className="bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                              {log.thinking}
                            </pre>
                          </div>
                        )}
                        {log.metadata && (
                          <div>
                            <div className="font-medium text-muted-foreground mb-1">Metadata:</div>
                            <pre className="bg-black/30 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
