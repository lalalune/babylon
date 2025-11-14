/**
 * Autonomous Planning Coordinator
 * 
 * Orchestrates multi-action planning and execution for autonomous agents.
 * Considers goals, constraints, and opportunities to generate comprehensive action plans.
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import type { IAgentRuntime } from '@elizaos/core'
import { callGroqDirect } from '../llm/direct-groq'
import type { AgentGoal, AgentConstraints, AgentDirective } from '../types/goals'
import { autonomousTradingService } from './AutonomousTradingService'
import { autonomousPostingService } from './AutonomousPostingService'
import { autonomousBatchResponseService } from './AutonomousBatchResponseService'
import { generateSnowflakeId } from '@/lib/snowflake'

/**
 * Agent interface for planning
 */
interface PlanningAgent {
  agentSystem?: string;
  displayName: string;
  agentDirectives?: unknown;
  agentConstraints?: unknown;
  agentMaxActionsPerTick?: number;
  agentRiskTolerance?: string;
  autonomousTrading?: boolean;
  autonomousPosting?: boolean;
  autonomousCommenting?: boolean;
  autonomousDMs?: boolean;
}

/**
 * Planned action definition
 */
export interface PlannedAction {
  type: 'trade' | 'post' | 'comment' | 'message' | 'respond'
  priority: number  // 1-10
  reasoning: string
  goalId?: string  // Which goal does this serve?
  estimatedImpact: number  // Expected progress toward goal (0-1)
  params: Record<string, unknown>
  constraints?: string[]  // Which constraints apply
}

/**
 * Complete action plan
 */
export interface ActionPlan {
  actions: PlannedAction[]
  totalActions: number
  reasoning: string
  goalsAddressed: string[]
  estimatedCost: number  // Expected points cost
}

/**
 * Planning context (all info needed for decision making)
 */
export interface PlanningContext {
  goals: {
    active: AgentGoal[]
    completed: AgentGoal[]
  }
  directives: {
    always: AgentDirective[]
    never: AgentDirective[]
    prefer: AgentDirective[]
    avoid: AgentDirective[]
  }
  constraints: AgentConstraints | null
  portfolio: {
    balance: number
    pnl: number
    positions: number
  }
  pending: Array<{
    type: string
    content: string
    author: string
  }>
  opportunities: {
    trading: Array<{
      market: string
      description: string
      confidence: number
      expectedValue: number
    }>
    social: Array<{
      type: string
      description: string
      engagementScore: number
    }>
  }
  recentActions: Array<{
    type: string
    timestamp: Date
    success: boolean
  }>
}

/**
 * Execution result
 */
export interface ExecutionResult {
  planned: number
  executed: number
  successful: number
  failed: number
  results: Array<{
    action: PlannedAction
    success: boolean
    result?: unknown
    error?: string
  }>
  goalsUpdated: string[]
}

export class AutonomousPlanningCoordinator {
  /**
   * Generate a comprehensive action plan for this tick
   */
  async generateActionPlan(
    agentUserId: string,
    _runtime: IAgentRuntime
  ): Promise<ActionPlan> {
    logger.info(`Generating action plan for agent ${agentUserId}`, undefined, 'PlanningCoordinator')
    
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: {
        id: true,
        displayName: true,
        agentSystem: true,
        agentTradingStrategy: true,
        agentModelTier: true,
        agentMaxActionsPerTick: true,
        agentRiskTolerance: true,
        agentPlanningHorizon: true,
        autonomousTrading: true,
        autonomousPosting: true,
        autonomousCommenting: true,
        autonomousDMs: true
      }
    })
    
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    // Gather full planning context
    const context = await this.getPlanningContext(agentUserId)
    
    // Convert agent to PlanningAgent (null -> undefined for optional fields)
    const planningAgent: PlanningAgent = {
      displayName: agent.displayName ?? 'Agent',
      agentSystem: agent.agentSystem ?? undefined,
      agentMaxActionsPerTick: agent.agentMaxActionsPerTick ?? undefined,
      agentRiskTolerance: agent.agentRiskTolerance ?? undefined,
      autonomousTrading: agent.autonomousTrading ?? undefined,
      autonomousPosting: agent.autonomousPosting ?? undefined,
      autonomousCommenting: agent.autonomousCommenting ?? undefined,
      autonomousDMs: agent.autonomousDMs ?? undefined
    }
    
    // If no goals configured, use simplified planning
    if (context.goals.active.length === 0) {
      logger.info('No goals configured, using legacy single-action mode', undefined, 'PlanningCoordinator')
      return this.generateSimplePlan(planningAgent, context)
    }
    
    // Build enhanced planning prompt
    const prompt = this.buildPlanningPrompt(planningAgent, context)
    
    // Use LARGE model for complex multi-action planning
    const planResponse = await callGroqDirect({
      prompt,
      system: agent.agentSystem || undefined,
      modelSize: 'large',  // Complex reasoning requires large model
      temperature: 0.7,
      maxTokens: 1500  // Allow detailed planning
    })
    
    // Parse action plan
    const plan = this.parseActionPlan(planResponse, context)
    
    // Validate against constraints
    const validatedPlan = this.validatePlan(plan, planningAgent, context.constraints)
    
    logger.info(`Generated plan with ${validatedPlan.totalActions} actions`, {
      agentId: agentUserId,
      actions: validatedPlan.actions.map(a => a.type),
      goalsAddressed: validatedPlan.goalsAddressed
    }, 'PlanningCoordinator')
    
    return validatedPlan
  }
  
  /**
   * Gather all context needed for planning
   */
  private async getPlanningContext(agentUserId: string): Promise<PlanningContext> {
    // Get goals
    const goals = await prisma.agentGoal.findMany({
      where: { agentUserId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
    })
    
    const activeGoals = goals.filter(g => g.status === 'active').map(g => ({
      ...g,
      target: g.target ? JSON.parse(JSON.stringify(g.target)) : undefined
    })) as AgentGoal[]
    
    const completedGoals = goals.filter(g => g.status === 'completed').map(g => ({
      ...g,
      target: g.target ? JSON.parse(JSON.stringify(g.target)) : undefined
    })) as AgentGoal[]
    
    // Get directives
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: {
        agentDirectives: true,
        agentConstraints: true,
        virtualBalance: true,
        lifetimePnL: true,
        agentMaxActionsPerTick: true,
        agentRiskTolerance: true
      }
    })
    
    const directives = agent?.agentDirectives 
      ? JSON.parse(JSON.stringify(agent.agentDirectives)) as AgentDirective[]
      : []
    
    const constraints = agent?.agentConstraints
      ? JSON.parse(JSON.stringify(agent.agentConstraints)) as AgentConstraints
      : null
    
    // If constraints exist, merge with agent settings
    if (constraints && agent) {
      constraints.general.maxActionsPerTick = agent.agentMaxActionsPerTick
      constraints.general.riskTolerance = agent.agentRiskTolerance as 'low' | 'medium' | 'high'
    }
    
    // Get portfolio info
    const positions = await prisma.position.count({
      where: { userId: agentUserId, status: 'active' }
    })
    
    const perpPositions = await prisma.perpPosition.count({
      where: { userId: agentUserId, closedAt: null }
    })
    
    // Get pending interactions
    const pendingInteractions = await autonomousBatchResponseService.gatherPendingInteractions(agentUserId)
    
    // Get recent actions (last 10)
    const recentLogs = await prisma.agentLog.findMany({
      where: {
        agentUserId,
        type: { in: ['trade', 'post', 'comment', 'dm'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    return {
      goals: {
        active: activeGoals,
        completed: completedGoals
      },
      directives: {
        always: directives.filter(d => d.type === 'always'),
        never: directives.filter(d => d.type === 'never'),
        prefer: directives.filter(d => d.type === 'prefer'),
        avoid: directives.filter(d => d.type === 'avoid')
      },
      constraints,
      portfolio: {
        balance: Number(agent?.virtualBalance || 0),
        pnl: Number(agent?.lifetimePnL || 0),
        positions: positions + perpPositions
      },
      pending: pendingInteractions.slice(0, 10).map(p => ({
        type: p.type,
        content: p.content,
        author: p.author
      })),
      opportunities: {
        trading: [],  // TODO: Implement opportunity detection
        social: []
      },
      recentActions: recentLogs.map(log => ({
        type: log.type,
        timestamp: log.createdAt,
        success: log.level !== 'error'
      }))
    }
  }
  
  /**
   * Build comprehensive planning prompt
   */
  private buildPlanningPrompt(agent: PlanningAgent, context: PlanningContext): string {
    const goalsText = context.goals.active.length > 0
      ? context.goals.active.map((g, i) => {
          const targetInfo = g.target
            ? `Target: ${g.target.metric} = ${g.target.value}${g.target.unit || ''}`
            : ''
          return `${i + 1}. ${g.name} (Priority: ${g.priority}/10) - ${(g.progress * 100).toFixed(0)}% complete
   ${g.description}
   ${targetInfo}`
        }).join('\n\n')
      : 'No goals configured'
    
    const directivesText = [
      ...context.directives.always.map(d => `✓ ALWAYS: ${d.rule}`),
      ...context.directives.never.map(d => `✗ NEVER: ${d.rule}`),
      ...context.directives.prefer.map(d => `+ PREFER: ${d.rule}`)
    ].join('\n') || 'No directives'
    
    const constraintsText = context.constraints
      ? `- Max actions this tick: ${context.constraints.general.maxActionsPerTick}
- Max position: $${context.constraints.trading.maxPositionSize}
- Max leverage: ${context.constraints.trading.maxLeverage}x
- Risk tolerance: ${context.constraints.general.riskTolerance}`
      : 'No specific constraints'
    
    const pendingText = context.pending.length > 0
      ? context.pending.slice(0, 5).map(p => `- ${p.type}: "${p.content.substring(0, 60)}..." by ${p.author}`).join('\n')
      : 'None'
    
    return `${agent.agentSystem}

You are ${agent.displayName}, planning your actions for this autonomous tick.

=== YOUR GOALS (in priority order) ===
${goalsText}

=== YOUR DIRECTIVES (rules you must follow) ===
${directivesText}

=== YOUR CONSTRAINTS ===
${constraintsText}

=== CURRENT SITUATION ===
Portfolio:
- Balance: $${context.portfolio.balance.toFixed(2)}
- Lifetime P&L: ${context.portfolio.pnl >= 0 ? '+' : ''}$${context.portfolio.pnl.toFixed(2)}
- Open positions: ${context.portfolio.positions}

Capabilities enabled:
${agent.autonomousTrading ? '✓ Trading' : '✗ Trading'}
${agent.autonomousPosting ? '✓ Posting' : '✗ Posting'}
${agent.autonomousCommenting ? '✓ Commenting' : '✗ Commenting'}
${agent.autonomousDMs ? '✓ Direct messages' : '✗ Direct messages'}

Pending interactions (${context.pending.length}):
${pendingText}

Recent actions (last 10):
${context.recentActions.slice(0, 10).map(a => `- ${a.type}: ${a.success ? 'success' : 'failed'}`).join('\n')}

=== YOUR TASK ===
Plan ${context.constraints?.general.maxActionsPerTick || 3} or fewer actions for this tick to make maximum progress toward your goals.

Consider:
1. Which goals have highest priority?
2. What actions will have most impact?
3. Are there urgent responses needed?
4. Am I within my constraints?
5. Am I following my directives?

IMPORTANT:
- Every action should advance a goal
- Respect all constraints and directives
- Prioritize high-impact actions
- Balance different goal types
- Consider opportunity cost

Respond in JSON format:
{
  "reasoning": "Overall strategy for this tick and how it serves your goals",
  "actions": [
    {
      "type": "trade" | "post" | "comment" | "respond",
      "priority": 1-10,
      "goalId": "goal_id or null if general",
      "reasoning": "How this advances your goals",
      "estimatedImpact": 0.0-1.0,
      "params": {
        // Action-specific parameters will be determined by execution layer
      }
    }
  ]
}

Your action plan (JSON only):`
  }
  
  /**
   * Parse action plan from LLM response
   */
  private parseActionPlan(response: string, _context: PlanningContext): ActionPlan {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger.warn('No JSON found in planning response, using empty plan', undefined, 'PlanningCoordinator')
        return {
          actions: [],
          totalActions: 0,
          reasoning: 'No valid plan generated',
          goalsAddressed: [],
          estimatedCost: 0
        }
      }
      
      const parsed = JSON.parse(jsonMatch[0]) as {
        reasoning: string
        actions: Array<{
          type: string
          priority: number
          goalId?: string
          reasoning: string
          estimatedImpact: number
          params?: Record<string, unknown>
        }>
      }
      
      const actions: PlannedAction[] = parsed.actions.map(a => ({
        type: a.type as PlannedAction['type'],
        priority: a.priority,
        goalId: a.goalId,
        reasoning: a.reasoning,
        estimatedImpact: a.estimatedImpact,
        params: a.params || {}
      }))
      
      const goalsAddressed = [...new Set(actions.map(a => a.goalId).filter(Boolean))] as string[]
      
      return {
        actions,
        totalActions: actions.length,
        reasoning: parsed.reasoning,
        goalsAddressed,
        estimatedCost: actions.length  // Simple: 1 point per action
      }
    } catch (error) {
      logger.error('Failed to parse action plan', error, 'PlanningCoordinator')
      return {
        actions: [],
        totalActions: 0,
        reasoning: 'Parse error',
        goalsAddressed: [],
        estimatedCost: 0
      }
    }
  }
  
  /**
   * Validate plan against constraints
   */
  private validatePlan(
    plan: ActionPlan,
    agent: PlanningAgent,
    constraints: AgentConstraints | null
  ): ActionPlan {
    let validActions = [...plan.actions]
    
    // Enforce max actions per tick
    const maxActions = constraints?.general.maxActionsPerTick || agent.agentMaxActionsPerTick || 3
    if (validActions.length > maxActions) {
      logger.warn(`Plan has ${validActions.length} actions, limiting to ${maxActions}`, undefined, 'PlanningCoordinator')
      validActions = validActions.sort((a, b) => b.priority - a.priority).slice(0, maxActions)
    }
    
    // Filter by enabled capabilities
    validActions = validActions.filter(action => {
      switch (action.type) {
        case 'trade':
          return agent.autonomousTrading
        case 'post':
          return agent.autonomousPosting
        case 'comment':
        case 'respond':
          return agent.autonomousCommenting
        case 'message':
          return agent.autonomousDMs
        default:
          return true
      }
    })
    
    return {
      ...plan,
      actions: validActions,
      totalActions: validActions.length
    }
  }
  
  /**
   * Generate simple plan for agents without goals (legacy mode)
   */
  private generateSimplePlan(agent: PlanningAgent, context: PlanningContext): ActionPlan {
    const actions: PlannedAction[] = []
    
    // Respond to pending interactions (priority 1)
    if (context.pending.length > 0 && agent.autonomousCommenting) {
      actions.push({
        type: 'respond',
        priority: 9,
        reasoning: 'Respond to pending interactions',
        estimatedImpact: 0.3,
        params: {}
      })
    }
    
    // Trading (priority 2)
    if (agent.autonomousTrading) {
      actions.push({
        type: 'trade',
        priority: 7,
        reasoning: 'Evaluate trading opportunities',
        estimatedImpact: 0.5,
        params: {}
      })
    }
    
    // Posting (priority 3)
    if (agent.autonomousPosting) {
      actions.push({
        type: 'post',
        priority: 5,
        reasoning: 'Create social content',
        estimatedImpact: 0.2,
        params: {}
      })
    }
    
    return {
      actions: actions.slice(0, agent.agentMaxActionsPerTick || 3),
      totalActions: actions.length,
      reasoning: 'Legacy mode: executing enabled capabilities',
      goalsAddressed: [],
      estimatedCost: actions.length
    }
  }
  
  /**
   * Execute the planned actions in priority order
   */
  async executePlan(
    agentUserId: string,
    runtime: IAgentRuntime,
    plan: ActionPlan
  ): Promise<ExecutionResult> {
    const results: ExecutionResult['results'] = []
    const goalsUpdated: Set<string> = new Set()
    
    logger.info(`Executing plan with ${plan.totalActions} actions`, {
      agentId: agentUserId,
      actions: plan.actions.map(a => a.type)
    }, 'PlanningCoordinator')
    
    // Sort by priority
    const sortedActions = [...plan.actions].sort((a, b) => b.priority - a.priority)
    
    for (const action of sortedActions) {
      try {
        const result = await this.executeAction(agentUserId, runtime, action)
        results.push({
          action,
          success: result.success,
          result: result.data,
          error: result.error
        })
        
        // Track progress toward goal
        if (action.goalId && result.success) {
          await this.updateGoalProgress(action.goalId, agentUserId, action)
          goalsUpdated.add(action.goalId)
        }
        
        // Small delay between actions
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        logger.error(`Failed to execute action: ${action.type}`, error, 'PlanningCoordinator')
        results.push({
          action,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    
    logger.info(`Plan execution complete`, {
      agentId: agentUserId,
      planned: plan.totalActions,
      executed: results.length,
      successful,
      failed
    }, 'PlanningCoordinator')
    
    return {
      planned: plan.totalActions,
      executed: results.length,
      successful,
      failed,
      results,
      goalsUpdated: Array.from(goalsUpdated)
    }
  }
  
  /**
   * Execute a single action
   */
  private async executeAction(
    agentUserId: string,
    runtime: IAgentRuntime,
    action: PlannedAction
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    logger.info(`Executing ${action.type} action`, { agentId: agentUserId, priority: action.priority }, 'PlanningCoordinator')
    
    try {
      switch (action.type) {
        case 'trade':
          const trades = await autonomousTradingService.executeTrades(agentUserId, runtime)
          return { success: trades > 0, data: { trades } }
        
        case 'post':
          const postId = await autonomousPostingService.createAgentPost(agentUserId, runtime)
          return { success: !!postId, data: { postId } }
        
        case 'respond':
          const responses = await autonomousBatchResponseService.processBatch(agentUserId, runtime)
          return { success: responses > 0, data: { responses } }
        
        case 'comment':
        case 'message':
          // These would be implemented similar to above
          return { success: false, error: 'Not implemented yet' }
        
        default:
          return { success: false, error: `Unknown action type: ${action.type}` }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      }
    }
  }
  
  /**
   * Update goal progress based on action execution
   */
  private async updateGoalProgress(
    goalId: string,
    agentUserId: string,
    action: PlannedAction
  ): Promise<void> {
    try {
      const goal = await prisma.agentGoal.findUnique({
        where: { id: goalId }
      })
      
      if (!goal) return
      
      // Update progress (simplified - could be more sophisticated)
      const newProgress = Math.min(1.0, goal.progress + action.estimatedImpact)
      
      await prisma.agentGoal.update({
        where: { id: goalId },
        data: {
          progress: newProgress,
          updatedAt: new Date(),
          ...(newProgress >= 1.0 ? {
            status: 'completed',
            completedAt: new Date()
          } : {})
        }
      })
      
      // Record goal action
      await prisma.agentGoalAction.create({
        data: {
          id: await generateSnowflakeId(),
          goalId,
          agentUserId,
          actionType: action.type,
          impact: action.estimatedImpact,
          metadata: action.params as Prisma.InputJsonValue
        }
      })
      
      logger.info(`Updated goal progress`, {
        goalId,
        oldProgress: goal.progress,
        newProgress,
        completed: newProgress >= 1.0
      }, 'PlanningCoordinator')
    } catch (error) {
      logger.error('Failed to update goal progress', error, 'PlanningCoordinator')
    }
  }
}

export const autonomousPlanningCoordinator = new AutonomousPlanningCoordinator()

