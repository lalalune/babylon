'use client'

// @ts-nocheck


import { useEffect, useState, useCallback } from 'react'
import { Check, RefreshCw, Sparkles, Zap, Bot, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface WandbModel {
  id: string
  name: string
  description?: string
}

interface AIModelsData {
  currentSettings: {
    wandbModel: string | null
    wandbEnabled: boolean
  }
  providers: {
    wandb: boolean
    groq: boolean
    claude: boolean
    openai: boolean
  }
  activeProvider: 'wandb' | 'groq' | 'claude' | 'openai'
  wandbModels: WandbModel[]
  recommendedModels: WandbModel[]
}

export function AIModelsTab() {
  const [data, setData] = useState<AIModelsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [wandbEnabled, setWandbEnabled] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/ai-models', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch AI models')

      let result;
      try {
        result = await response.json()
      } catch (parseError) {
        logger.error('Failed to parse AI models response', { error: parseError }, 'AIModelsTab')
        throw new Error('Failed to parse response')
      }
      setData(result.data)
      setSelectedModel(result.data.currentSettings.wandbModel)
      setWandbEnabled(result.data.currentSettings.wandbEnabled)
      setLoading(false)
    } catch (err) {
      logger.error('Failed to load AI models', { error: err }, 'AIModelsTab')
      toast.error('Failed to load AI models')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    if (wandbEnabled && !selectedModel) {
      toast.error('Please select a model to enable Wandb')
      return
    }

    setSaving(true)
    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/ai-models', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wandbModel: selectedModel,
          wandbEnabled,
        }),
      })

      if (!response.ok) {
        let error;
        try {
          error = await response.json()
        } catch (parseError) {
          logger.error('Failed to parse save error response', { error: parseError }, 'AIModelsTab')
          throw new Error('Failed to save')
        }
        throw new Error((error as { error?: string }).error || 'Failed to save')
      }

      toast.success('AI model configuration updated successfully')
      setTestResult(null) // Clear previous test result
      await fetchData() // Refresh data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/ai-models/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      let result;
      try {
        result = await response.json()
      } catch (parseError) {
        logger.error('Failed to parse test response', { error: parseError }, 'AIModelsTab')
        throw new Error('Failed to parse test response')
      }

      if (response.ok) {
        setTestResult(result.data)
        toast.success(`Test successful! Using ${result.data.provider}`)
      } else {
        toast.error(result.error || 'Test failed')
        setTestResult({ error: result.error, details: result.details })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test failed')
      setTestResult({ error: error instanceof Error ? error.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'wandb':
        return <Sparkles className="w-4 h-4" />
      case 'groq':
        return <Zap className="w-4 h-4" />
      case 'claude':
        return <Bot className="w-4 h-4" />
      case 'openai':
        return <Bot className="w-4 h-4" />
      default:
        return <Bot className="w-4 h-4" />
    }
  }

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'wandb':
        return 'Weights & Biases'
      case 'groq':
        return 'Groq'
      case 'claude':
        return 'Claude (Anthropic)'
      case 'openai':
        return 'OpenAI'
      default:
        return provider
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Failed to load AI models configuration
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Model Configuration</h2>
          <p className="text-muted-foreground mt-1">
            Configure which AI model serverless agents use for decision making
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
        >
          <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Current Provider Status */}
      <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          {getProviderIcon(data.activeProvider)}
          Active Provider
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-medium">{getProviderName(data.activeProvider)}</span>
          </div>
          {data.activeProvider === 'wandb' && data.currentSettings.wandbModel && (
            <div className="text-sm text-muted-foreground">
              Model: <span className="font-mono text-foreground">{data.currentSettings.wandbModel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Available Providers */}
      <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <h3 className="text-lg font-semibold mb-4">Available Providers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(data.providers).map(([provider, available]) => (
            <div
              key={provider}
              className={cn(
                'p-4 rounded-lg border transition-colors',
                available
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-border bg-muted/20'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getProviderIcon(provider)}
                  <span className="font-medium">{getProviderName(provider)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {available ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-500">Available</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not configured</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wandb Configuration */}
      {data.providers.wandb && (
        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Weights & Biases Configuration
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-muted-foreground">Enable Wandb</span>
              <input
                type="checkbox"
                checked={wandbEnabled}
                onChange={(e) => setWandbEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
            </label>
          </div>

          {wandbEnabled && (
            <>
              {/* Recommended Models */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Recommended Models
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {data.recommendedModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={cn(
                        'p-4 rounded-lg border text-left transition-all',
                        selectedModel === model.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-medium mb-1">{model.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {model.description}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground mt-2">
                            {model.id}
                          </div>
                        </div>
                        {selectedModel === model.id && (
                          <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* All Available Models */}
              {data.wandbModels.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                    All Available Models ({data.wandbModels.length})
                  </h4>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    {data.wandbModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={cn(
                          'w-full p-3 text-left border-b border-border last:border-b-0 transition-colors',
                          selectedModel === model.id
                            ? 'bg-primary/10'
                            : 'hover:bg-accent'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-mono truncate flex-1">
                            {model.id}
                          </div>
                          {selectedModel === model.id && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">About Wandb Models</p>
                <p className="text-blue-200/80">
                  Weights & Biases provides access to open-source models with fast inference.
                  When enabled, all serverless agents will use the selected model for decision making.
                  Changes take effect immediately for new agent actions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Instructions for Missing Providers */}
      {!data.providers.wandb && (
        <div className="p-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-2 text-yellow-200">
                Weights & Biases Not Configured
              </p>
              <p className="text-yellow-200/80 mb-3">
                To use Wandb models, add your API key to the environment:
              </p>
              <code className="block p-3 rounded bg-black/30 text-xs font-mono text-yellow-100">
                WANDB_API_KEY=your_api_key_here
              </code>
              <p className="text-yellow-200/80 mt-3">
                Get your API key from:{' '}
                <a
                  href="https://wandb.ai/authorize"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:underline"
                >
                  https://wandb.ai/authorize
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div className={cn(
          'p-6 rounded-lg border',
          testResult.error 
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-green-500/10 border-green-500/20'
        )}>
          <h3 className="text-lg font-semibold mb-3">
            {testResult.error ? '❌ Test Failed' : '✅ Test Successful'}
          </h3>
          {!testResult.error ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Provider:</span>
                <span className="font-mono font-medium">{String(testResult.provider || 'unknown')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Model:</span>
                <span className="font-mono font-medium">{String(testResult.model || 'unknown')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Latency:</span>
                <span className="font-mono font-medium">{String(testResult.latency || 0)}ms</span>
              </div>
              {testResult.wandbModelConfigured !== undefined && testResult.wandbModelConfigured !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Configured Wandb Model:</span>
                  <span className="font-mono font-medium">{String(testResult.wandbModelConfigured)}</span>
                </div>
              )}
              <div className="mt-3 p-3 rounded bg-black/20">
                <div className="text-muted-foreground mb-1">Response:</div>
                <div className="font-mono text-sm">{JSON.stringify(testResult.response, null, 2)}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="text-red-200">{String(testResult.error || 'Unknown error')}</div>
              {testResult.details !== undefined && testResult.details !== null && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-red-200/80">Error Details</summary>
                  <pre className="mt-2 p-3 rounded bg-black/20 text-xs overflow-auto">
                    {String(testResult.details)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
        <button
          onClick={handleTest}
          disabled={testing}
          className={cn(
            'px-6 py-2 rounded-lg font-medium transition-all',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {testing ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Testing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Test Current Configuration
            </span>
          )}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || (wandbEnabled && !selectedModel)}
          className={cn(
            'px-6 py-2 rounded-lg font-medium transition-all',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Configuration'
          )}
        </button>
      </div>
    </div>
  )
}
