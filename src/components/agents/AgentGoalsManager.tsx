/**
 * Agent Goals Manager Component
 * 
 * Comprehensive UI for managing agent goals, directives, and constraints.
 * Allows users to create, edit, and track goals for their agents.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Plus, 
  Target, 
  TrendingUp, 
  Users, 
  Brain, 
  Star,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  Pause,
  Play,
  AlertTriangle
} from 'lucide-react'
import type { AgentGoal, GoalType, GoalTarget, GoalStatus } from '@/lib/agents/types/goals'
import { GOAL_TEMPLATES } from '@/lib/agents/types/goals'

interface AgentGoalsManagerProps {
  agentId: string
  agentName: string
}

interface GoalWithActions extends AgentGoal {
  recentActions?: Array<{
    id: string
    actionType: string
    impact: number
    createdAt: Date
  }>
}

export function AgentGoalsManager({ agentId, agentName }: AgentGoalsManagerProps) {
  const [goals, setGoals] = useState<GoalWithActions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalWithActions | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active')

  // Fetch goals
  useEffect(() => {
    fetchGoals()
  }, [agentId])

  const fetchGoals = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/agents/${agentId}/goals`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch goals')
      }
      
      const data = await response.json()
      setGoals(data.goals || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGoal = async (goalData: Partial<AgentGoal>) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to create goal')
      }
      
      await fetchGoals()
      setShowCreateDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal')
    }
  }

  const handleUpdateGoal = async (goalId: string, updates: Partial<AgentGoal>) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/goals/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (!response.ok) {
        throw new Error('Failed to update goal')
      }
      
      await fetchGoals()
      setEditingGoal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal')
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return
    
    try {
      const response = await fetch(`/api/agents/${agentId}/goals/${goalId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete goal')
      }
      
      await fetchGoals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal')
    }
  }

  const toggleGoalStatus = async (goal: GoalWithActions) => {
    const newStatus = goal.status === 'active' ? 'paused' : 'active'
    await handleUpdateGoal(goal.id, { status: newStatus })
  }

  // Filter goals by status
  const filteredGoals = goals.filter(goal => {
    if (activeTab === 'active') return goal.status === 'active'
    if (activeTab === 'completed') return goal.status === 'completed'
    return true
  })

  const getGoalIcon = (type: GoalType) => {
    switch (type) {
      case 'trading': return <TrendingUp className="h-5 w-5" />
      case 'social': return <Users className="h-5 w-5" />
      case 'learning': return <Brain className="h-5 w-5" />
      case 'reputation': return <Star className="h-5 w-5" />
      default: return <Target className="h-5 w-5" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500"><Circle className="h-3 w-3 mr-1 fill-current" />Active</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-blue-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
      case 'paused':
        return <Badge variant="secondary"><Pause className="h-3 w-3 mr-1" />Paused</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-500'
    if (priority >= 5) return 'text-yellow-500'
    return 'text-green-500'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Goals & Objectives</h2>
          <p className="text-muted-foreground">
            Define what {agentName} should achieve
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Goals Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="active">
            Active ({goals.filter(g => g.status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({goals.filter(g => g.status === 'completed').length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({goals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {filteredGoals.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
                  <p className="text-muted-foreground mb-4">
                    {activeTab === 'active' 
                      ? 'Create your first goal to give your agent direction'
                      : `No ${activeTab} goals`
                    }
                  </p>
                  {activeTab === 'active' && (
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Goal
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredGoals
              .sort((a, b) => b.priority - a.priority)
              .map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={setEditingGoal}
                  onDelete={handleDeleteGoal}
                  onToggleStatus={toggleGoalStatus}
                  getGoalIcon={getGoalIcon}
                  getStatusBadge={getStatusBadge}
                  getPriorityColor={getPriorityColor}
                />
              ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create Goal Dialog */}
      <CreateGoalDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateGoal}
        agentName={agentName}
      />

      {/* Edit Goal Dialog */}
      {editingGoal && (
        <EditGoalDialog
          open={!!editingGoal}
          onOpenChange={(open) => !open && setEditingGoal(null)}
          goal={editingGoal}
          onSubmit={(updates) => handleUpdateGoal(editingGoal.id, updates)}
        />
      )}
    </div>
  )
}

// Goal Card Component
function GoalCard({ 
  goal, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  getGoalIcon,
  getStatusBadge,
  getPriorityColor
}: {
  goal: GoalWithActions
  onEdit: (goal: GoalWithActions) => void
  onDelete: (goalId: string) => void
  onToggleStatus: (goal: GoalWithActions) => void
  getGoalIcon: (type: GoalType) => React.ReactElement
  getStatusBadge: (status: string) => React.ReactElement
  getPriorityColor: (priority: number) => string
}) {
  const progressPercent = Math.round(goal.progress * 100)
  const targetInfo = goal.target as GoalTarget | null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              {getGoalIcon(goal.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{goal.name}</CardTitle>
                {getStatusBadge(goal.status)}
                <Badge variant="outline" className={getPriorityColor(goal.priority)}>
                  Priority {goal.priority}/10
                </Badge>
              </div>
              <CardDescription>{goal.description}</CardDescription>
              {targetInfo && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Target: {targetInfo.metric} → {targetInfo.value}{targetInfo.unit || ''}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleStatus(goal)}
              title={goal.status === 'active' ? 'Pause goal' : 'Resume goal'}
            >
              {goal.status === 'active' ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(goal)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(goal.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          {goal.recentActions && goal.recentActions.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Recent Actions ({goal.recentActions.length})</p>
              <div className="space-y-1">
                {goal.recentActions.slice(0, 3).map(action => (
                  <div key={action.id} className="text-xs text-muted-foreground flex justify-between">
                    <span>{action.actionType}</span>
                    <span>+{(action.impact * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {goal.completedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Completed {new Date(goal.completedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Create Goal Dialog Component
function CreateGoalDialog({ 
  open, 
  onOpenChange, 
  onSubmit,
  agentName 
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Partial<AgentGoal>) => Promise<void>
  agentName: string
}) {
  const [_useTemplate, setUseTemplate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [formData, setFormData] = useState({
    type: 'trading' as GoalType,
    name: '',
    description: '',
    priority: 5,
    targetMetric: 'pnl',
    targetValue: '',
    targetUnit: '$'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const goalData: Partial<AgentGoal> = {
      type: formData.type,
      name: formData.name,
      description: formData.description,
      priority: formData.priority,
      target: formData.targetValue ? {
        metric: formData.targetMetric as 'pnl' | 'balance' | 'followers' | 'posts' | 'comments' | 'win_rate' | 'trades' | 'engagement' | 'reputation' | 'custom',
        value: parseFloat(formData.targetValue),
        unit: formData.targetUnit
      } : undefined
    }
    
    await onSubmit(goalData)
    
    // Reset form
    setFormData({
      type: 'trading',
      name: '',
      description: '',
      priority: 5,
      targetMetric: 'pnl',
      targetValue: '',
      targetUnit: '$'
    })
    setUseTemplate(false)
    setSelectedTemplate('')
  }

  const applyTemplate = (templateKey: string) => {
    const template = GOAL_TEMPLATES[templateKey]
    if (template) {
      setFormData({
        type: template.type,
        name: template.name,
        description: template.description,
        priority: template.suggestedPriority,
        targetMetric: template.defaultTarget.metric as string,
        targetValue: template.defaultTarget.value.toString(),
        targetUnit: template.defaultTarget.unit || ''
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Goal for {agentName}</DialogTitle>
          <DialogDescription>
            Define a specific objective for your agent to work toward
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Start from template (optional)</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(GOAL_TEMPLATES).map(([key, template]) => (
                <Button
                  key={key}
                  type="button"
                  variant={selectedTemplate === key ? 'default' : 'outline'}
                  className="h-auto py-3 flex-col items-start"
                  onClick={() => {
                    setSelectedTemplate(key)
                    applyTemplate(key)
                    setUseTemplate(true)
                  }}
                >
                  <span className="font-semibold text-sm">{template.name}</span>
                  <span className="text-xs text-muted-foreground line-clamp-2 text-left">
                    {template.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Goal Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Goal Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as GoalType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trading">Trading - Focus on market profits</SelectItem>
                <SelectItem value="social">Social - Build engagement & following</SelectItem>
                <SelectItem value="learning">Learning - Improve skills & knowledge</SelectItem>
                <SelectItem value="reputation">Reputation - Build credibility</SelectItem>
                <SelectItem value="custom">Custom - Define your own</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Goal Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Goal Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., 'Make $1000 profit'"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what success looks like..."
              rows={3}
              required
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority (1-10) *</Label>
            <div className="flex items-center gap-4">
              <Input
                id="priority"
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-24"
                required
              />
              <span className="text-sm text-muted-foreground">
                {formData.priority >= 8 ? 'High' : formData.priority >= 5 ? 'Medium' : 'Low'} priority
              </span>
            </div>
          </div>

          {/* Target (Optional) */}
          <div className="space-y-2">
            <Label>Target (Optional)</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={formData.targetMetric}
                onValueChange={(value) => setFormData({ ...formData, targetMetric: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pnl">Profit & Loss</SelectItem>
                  <SelectItem value="balance">Balance</SelectItem>
                  <SelectItem value="followers">Followers</SelectItem>
                  <SelectItem value="posts">Posts Count</SelectItem>
                  <SelectItem value="win_rate">Win Rate</SelectItem>
                  <SelectItem value="trades">Trades Count</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="reputation">Reputation Points</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={formData.targetValue}
                onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                placeholder="Value"
              />
              <Input
                value={formData.targetUnit}
                onChange={(e) => setFormData({ ...formData, targetUnit: e.target.value })}
                placeholder="Unit ($, %, etc)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create Goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Edit Goal Dialog Component
function EditGoalDialog({
  open,
  onOpenChange,
  goal,
  onSubmit
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: GoalWithActions
  onSubmit: (updates: Partial<AgentGoal>) => Promise<void>
}) {
  const targetInfo = goal.target as GoalTarget | null
  const [formData, setFormData] = useState({
    name: goal.name,
    description: goal.description,
    priority: goal.priority,
    status: goal.status
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
          <DialogDescription>
            Update goal details and priority
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Goal Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-priority">Priority (1-10)</Label>
            <Input
              id="edit-priority"
              type="number"
              min="1"
              max="10"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as GoalStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetInfo && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Target</p>
              <p className="text-sm text-muted-foreground">
                {targetInfo.metric} → {targetInfo.value}{targetInfo.unit || ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (Target cannot be edited after creation)
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

