/**
 * Agent Constraints & Directives Editor
 * 
 * UI for configuring agent behavior rules and operating limits
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { 
  Shield, 
  TrendingUp, 
  Users, 
  Settings,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  Info
} from 'lucide-react'
import type { AgentConstraints, AgentDirective, DirectiveType } from '@/lib/agents/types/goals'
import { DEFAULT_CONSTRAINTS } from '@/lib/agents/types/goals'

interface AgentConstraintsEditorProps {
  agentId: string
  agentName: string
  currentConstraints?: AgentConstraints | null
  currentDirectives?: AgentDirective[]
  onSave: (constraints: AgentConstraints, directives: AgentDirective[]) => Promise<void>
}

export function AgentConstraintsEditor({
  agentId: _agentId,
  agentName,
  currentConstraints,
  currentDirectives,
  onSave
}: AgentConstraintsEditorProps) {
  const [constraints, setConstraints] = useState<AgentConstraints>(
    currentConstraints || DEFAULT_CONSTRAINTS
  )
  const [directives, setDirectives] = useState<AgentDirective[]>(
    currentDirectives || []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddDirective, setShowAddDirective] = useState(false)

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      await onSave(constraints, directives)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const addDirective = (directive: Omit<AgentDirective, 'id'>) => {
    const newDirective: AgentDirective = {
      ...directive,
      id: `dir_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    setDirectives([...directives, newDirective])
    setShowAddDirective(false)
  }

  const removeDirective = (id: string) => {
    setDirectives(directives.filter(d => d.id !== id))
  }

  const getDirectiveTypeBadge = (type: DirectiveType) => {
    switch (type) {
      case 'always':
        return <Badge className="bg-green-500">✓ Always</Badge>
      case 'never':
        return <Badge className="bg-red-500">✗ Never</Badge>
      case 'prefer':
        return <Badge className="bg-blue-500">+ Prefer</Badge>
      case 'avoid':
        return <Badge className="bg-yellow-500">− Avoid</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Constraints & Directives</h2>
          <p className="text-muted-foreground">
            Define rules and limits for {agentName}'s behavior
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="trading">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trading">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trading
          </TabsTrigger>
          <TabsTrigger value="social">
            <Users className="h-4 w-4 mr-2" />
            Social
          </TabsTrigger>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="directives">
            <Shield className="h-4 w-4 mr-2" />
            Directives
          </TabsTrigger>
        </TabsList>

        {/* Trading Constraints */}
        <TabsContent value="trading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trading Limits</CardTitle>
              <CardDescription>
                Set boundaries for trading activities to manage risk
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxPositionSize">Max Position Size ($)</Label>
                  <Input
                    id="maxPositionSize"
                    type="number"
                    value={constraints.trading.maxPositionSize}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      trading: {
                        ...constraints.trading,
                        maxPositionSize: parseInt(e.target.value)
                      }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum amount to invest in a single position
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLeverage">Max Leverage</Label>
                  <Input
                    id="maxLeverage"
                    type="number"
                    value={constraints.trading.maxLeverage}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      trading: {
                        ...constraints.trading,
                        maxLeverage: parseInt(e.target.value)
                      }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum leverage multiplier (1-10x)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxOpenPositions">Max Open Positions</Label>
                  <Input
                    id="maxOpenPositions"
                    type="number"
                    value={constraints.trading.maxOpenPositions || ''}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      trading: {
                        ...constraints.trading,
                        maxOpenPositions: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum concurrent positions (leave empty for unlimited)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stopLossPercent">Stop Loss (%)</Label>
                  <Input
                    id="stopLossPercent"
                    type="number"
                    value={constraints.trading.stopLossPercent || ''}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      trading: {
                        ...constraints.trading,
                        stopLossPercent: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    placeholder="No auto stop-loss"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-exit positions at this loss percentage
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDailyTrades">Max Trades Per Day</Label>
                  <Input
                    id="maxDailyTrades"
                    type="number"
                    value={constraints.trading.maxDailyTrades || ''}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      trading: {
                        ...constraints.trading,
                        maxDailyTrades: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limit number of trades per 24 hours
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Allowed Market Types</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={constraints.trading.allowedMarketTypes.includes('prediction')}
                      onCheckedChange={(checked) => {
                        const types = checked
                          ? [...constraints.trading.allowedMarketTypes, 'prediction' as const]
                          : constraints.trading.allowedMarketTypes.filter(t => t !== 'prediction')
                        setConstraints({
                          ...constraints,
                          trading: { ...constraints.trading, allowedMarketTypes: types as ('prediction' | 'perp')[] }
                        })
                      }}
                    />
                    <span className="text-sm">Prediction Markets</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={constraints.trading.allowedMarketTypes.includes('perp')}
                      onCheckedChange={(checked) => {
                        const types = checked
                          ? [...constraints.trading.allowedMarketTypes, 'perp' as const]
                          : constraints.trading.allowedMarketTypes.filter(t => t !== 'perp')
                        setConstraints({
                          ...constraints,
                          trading: { ...constraints.trading, allowedMarketTypes: types as ('prediction' | 'perp')[] }
                        })
                      }}
                    />
                    <span className="text-sm">Perpetual Futures</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Constraints */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Social Activity Limits</CardTitle>
              <CardDescription>
                Control posting frequency and content boundaries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxPostsPerDay">Max Posts Per Day</Label>
                  <Input
                    id="maxPostsPerDay"
                    type="number"
                    value={constraints.social.maxPostsPerDay}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      social: {
                        ...constraints.social,
                        maxPostsPerDay: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minPostInterval">Min Post Interval (minutes)</Label>
                  <Input
                    id="minPostInterval"
                    type="number"
                    value={constraints.social.minPostInterval}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      social: {
                        ...constraints.social,
                        minPostInterval: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minPostLength">Min Post Length (chars)</Label>
                  <Input
                    id="minPostLength"
                    type="number"
                    value={constraints.social.minPostLength || ''}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      social: {
                        ...constraints.social,
                        minPostLength: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    placeholder="No minimum"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPostLength">Max Post Length (chars)</Label>
                  <Input
                    id="maxPostLength"
                    type="number"
                    value={constraints.social.maxPostLength || ''}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      social: {
                        ...constraints.social,
                        maxPostLength: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    placeholder="280"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCommentsPerDay">Max Comments Per Day</Label>
                  <Input
                    id="maxCommentsPerDay"
                    type="number"
                    value={constraints.social.maxCommentsPerDay || ''}
                    onChange={(e) => setConstraints({
                      ...constraints,
                      social: {
                        ...constraints.social,
                        maxCommentsPerDay: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={constraints.social.allowMentions}
                      onCheckedChange={(checked) => setConstraints({
                        ...constraints,
                        social: { ...constraints.social, allowMentions: checked }
                      })}
                    />
                    <span className="text-sm">Allow mentioning other users</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={constraints.social.allowHashtags}
                      onCheckedChange={(checked) => setConstraints({
                        ...constraints,
                        social: { ...constraints.social, allowHashtags: checked }
                      })}
                    />
                    <span className="text-sm">Allow using hashtags</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Constraints */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure overall agent behavior and priorities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxActionsPerTick">Max Actions Per Tick</Label>
                <Input
                  id="maxActionsPerTick"
                  type="number"
                  min="1"
                  max="10"
                  value={constraints.general.maxActionsPerTick}
                  onChange={(e) => setConstraints({
                    ...constraints,
                    general: {
                      ...constraints.general,
                      maxActionsPerTick: parseInt(e.target.value)
                    }
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of actions per autonomous tick (1-10)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="riskTolerance">Risk Tolerance</Label>
                <Select
                  value={constraints.general.riskTolerance}
                  onValueChange={(value) => setConstraints({
                    ...constraints,
                    general: {
                      ...constraints.general,
                      riskTolerance: value as 'low' | 'medium' | 'high'
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Conservative</SelectItem>
                    <SelectItem value="medium">Medium - Balanced</SelectItem>
                    <SelectItem value="high">High - Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority Weights</Label>
                <p className="text-sm text-muted-foreground">
                  How the agent prioritizes different types of actions
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="tradingWeight" className="text-sm">Trading</Label>
                      <span className="text-sm text-muted-foreground">
                        {(constraints.general.priorityWeights.trading * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Input
                      id="tradingWeight"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={constraints.general.priorityWeights.trading * 100}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) / 100
                        setConstraints({
                          ...constraints,
                          general: {
                            ...constraints.general,
                            priorityWeights: {
                              ...constraints.general.priorityWeights,
                              trading: value
                            }
                          }
                        })
                      }}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="socialWeight" className="text-sm">Social</Label>
                      <span className="text-sm text-muted-foreground">
                        {(constraints.general.priorityWeights.social * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Input
                      id="socialWeight"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={constraints.general.priorityWeights.social * 100}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) / 100
                        setConstraints({
                          ...constraints,
                          general: {
                            ...constraints.general,
                            priorityWeights: {
                              ...constraints.general.priorityWeights,
                              social: value
                            }
                          }
                        })
                      }}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="respondingWeight" className="text-sm">Responding</Label>
                      <span className="text-sm text-muted-foreground">
                        {(constraints.general.priorityWeights.responding * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Input
                      id="respondingWeight"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={constraints.general.priorityWeights.responding * 100}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) / 100
                        setConstraints({
                          ...constraints,
                          general: {
                            ...constraints.general,
                            priorityWeights: {
                              ...constraints.general.priorityWeights,
                              responding: value
                            }
                          }
                        })
                      }}
                    />
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Total: {((constraints.general.priorityWeights.trading + constraints.general.priorityWeights.social + constraints.general.priorityWeights.responding) * 100).toFixed(0)}%
                      {Math.abs((constraints.general.priorityWeights.trading + constraints.general.priorityWeights.social + constraints.general.priorityWeights.responding) - 1) > 0.01 && 
                        ' - Note: Weights don\'t need to sum to 100%'}
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Directives */}
        <TabsContent value="directives" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Behavioral Directives</CardTitle>
              <CardDescription>
                Define rules the agent must follow or avoid
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {directives.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      No directives set. Add rules to guide agent behavior.
                    </p>
                    <Button onClick={() => setShowAddDirective(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Directive
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {directives
                        .sort((a, b) => b.priority - a.priority)
                        .map(directive => (
                          <div key={directive.id} className="flex items-start justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getDirectiveTypeBadge(directive.type)}
                                <Badge variant="outline" className="text-xs">
                                  Priority {directive.priority}/10
                                </Badge>
                              </div>
                              <p className="font-medium">{directive.rule}</p>
                              <p className="text-sm text-muted-foreground">{directive.description}</p>
                              {directive.examples && directive.examples.length > 0 && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Examples: {directive.examples.slice(0, 2).join(', ')}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDirective(directive.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowAddDirective(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Directive
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Directive Dialog */}
      {showAddDirective && (
        <AddDirectiveDialog
          onSubmit={addDirective}
          onCancel={() => setShowAddDirective(false)}
        />
      )}
    </div>
  )
}

// Add Directive Dialog
function AddDirectiveDialog({
  onSubmit,
  onCancel
}: {
  onSubmit: (directive: Omit<AgentDirective, 'id'>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    type: 'always' as DirectiveType,
    rule: '',
    description: '',
    priority: 5,
    examples: ['']
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      examples: formData.examples.filter(e => e.trim() !== '')
    })
  }

  return (
    <Card className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <CardContent className="max-w-2xl w-full mx-4 bg-background border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Add Directive</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Directive Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as DirectiveType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always - Must always do</SelectItem>
                <SelectItem value="never">Never - Must never do</SelectItem>
                <SelectItem value="prefer">Prefer - Should prefer</SelectItem>
                <SelectItem value="avoid">Avoid - Should avoid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rule Statement</Label>
            <Input
              value={formData.rule}
              onChange={(e) => setFormData({ ...formData, rule: e.target.value })}
              placeholder="e.g., Cut losses at 10% down"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Explain why this rule matters..."
              rows={2}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Priority (1-10)</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Example (Optional)</Label>
            <Input
              value={formData.examples[0]}
              onChange={(e) => setFormData({ ...formData, examples: [e.target.value] })}
              placeholder="e.g., Exit position if down 10%"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              Add Directive
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

