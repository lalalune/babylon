/**
 * Export Trajectories to Hugging Face Datasets
 * 
 * Prepares trajectory data for RLAIF training pipelines.
 * Exports to HuggingFace Hub for easy access in training scripts.
 * 
 * NOTE: Requires trajectory schema that's not yet in main Prisma
 */

import type { Trajectory as _Trajectory } from './types';

export interface ExportOptions {
  // Dataset configuration
  datasetName: string; // e.g., 'elizaos/babylon-agent-trajectories'
  huggingFaceToken?: string;
  
  // Data filtering
  startDate?: Date;
  endDate?: Date;
  agentIds?: string[];
  scenarioIds?: string[];
  minReward?: number;
  maxReward?: number;
  includeJudged?: boolean; // Only include trajectories with AI judge scores
  
  // Limits
  maxTrajectories?: number;
  
  // Format
  format?: 'jsonl' | 'parquet' | 'arrow';
  splitRatio?: { train: number; validation: number; test: number };
}

export interface ExportResult {
  success: boolean;
  trajectoriesExported: number;
  datasetUrl?: string;
  error?: string;
}

/**
 * Export trajectories to Hugging Face Dataset
 */
export async function exportToHuggingFace(
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    // Build query
    const where: any = {
      isTrainingData: true
    };
    
    if (options.startDate) {
      where.startTime = { ...where.startTime, gte: options.startDate };
    }
    if (options.endDate) {
      where.startTime = { ...where.startTime, lte: options.endDate };
    }
    if (options.agentIds) {
      where.agentId = { in: options.agentIds };
    }
    if (options.scenarioIds) {
      where.scenarioId = { in: options.scenarioIds };
    }
    if (options.minReward !== undefined) {
      where.totalReward = { ...where.totalReward, gte: options.minReward };
    }
    if (options.maxReward !== undefined) {
      where.totalReward = { ...where.totalReward, lte: options.maxReward };
    }
    if (options.includeJudged) {
      where.aiJudgeReward = { not: null };
    }

    // Fetch trajectories
    const trajectories = await (prisma as any).trajectories.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: options.maxTrajectories || 10000
    });

    console.log(`Exporting ${trajectories.length} trajectories...`);

    // Transform to training format
    const dataset = trajectories.map((traj: any) => transformForTraining(traj));

    // Split into train/validation/test
    const splits = splitDataset(dataset, options.splitRatio);

    // Export based on format
    if (options.format === 'parquet' || options.format === 'arrow') {
      return await exportToParquet(splits, options);
    } else {
      return await exportToJSONL(splits, options);
    }
  } catch (error) {
    return {
      success: false,
      trajectoriesExported: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Transform trajectory to training format
 */
function transformForTraining(traj: any): any {
  const steps = JSON.parse(traj.stepsJson);
  const metrics = JSON.parse(traj.metricsJson);
  const metadata = JSON.parse(traj.metadataJson);
  
  return {
    // Identifiers
    trajectory_id: traj.trajectoriesId,
    agent_id: traj.agentId,
    episode_id: traj.episodeId,
    scenario_id: traj.scenarioId,
    
    // Timing
    start_time: traj.startTime.toISOString(),
    duration_ms: traj.durationMs,
    
    // Steps (full trajectory)
    steps: steps.map((step: any) => ({
      step_number: step.stepNumber,
      timestamp: step.timestamp,
      
      // Environment
      environment_state: step.environmentState,
      observation: step.observation,
      
      // Agent cognition
      llm_calls: step.llmCalls.map((call: any) => ({
        model: call.model,
        system_prompt: call.systemPrompt,
        user_prompt: call.userPrompt,
        response: call.response,
        reasoning: call.reasoning,
        temperature: call.temperature,
        purpose: call.purpose
      })),
      
      // Action
      action: {
        type: step.action.actionType,
        parameters: step.action.parameters,
        success: step.action.success,
        result: step.action.result,
        error: step.action.error
      },
      
      // Feedback
      reward: step.reward,
      reasoning: step.reasoning
    })),
    
    // Outcomes
    total_reward: traj.totalReward,
    final_status: traj.finalStatus,
    final_pnl: traj.finalPnL,
    
    // AI Judge scores
    ai_judge_reward: traj.aiJudgeReward,
    ai_judge_reasoning: traj.aiJudgeReasoning,
    
    // Metrics
    metrics: {
      episode_length: metrics.episodeLength,
      trades_executed: metrics.tradesExecuted,
      posts_created: metrics.postsCreated,
      messages_handled: metrics.messagesHandled,
      error_count: metrics.errorCount
    },
    
    // Metadata
    metadata
  };
}

/**
 * Split dataset into train/val/test
 */
function splitDataset(
  data: any[],
  ratio?: { train: number; validation: number; test: number }
): { train: any[]; validation: any[]; test: any[] } {
  const defaultRatio = { train: 0.8, validation: 0.1, test: 0.1 };
  const { train, validation, test: testRatio } = ratio || defaultRatio;
  
  // Shuffle data
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  
  const trainSize = Math.floor(shuffled.length * train);
  const valSize = Math.floor(shuffled.length * validation);
  
  return {
    train: shuffled.slice(0, trainSize),
    validation: shuffled.slice(trainSize, trainSize + valSize),
    test: shuffled.slice(trainSize + valSize)
  };
  
  // Suppress unused variable warning
  void testRatio;
}

/**
 * Export to JSONL format
 */
async function exportToJSONL(
  splits: { train: any[]; validation: any[]; test: any[] },
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    
    // Create export directory
    const exportDir = path.resolve(process.cwd(), 'exports', 'trajectories');
    await fs.mkdir(exportDir, { recursive: true });
    
    // Write splits
    for (const [splitName, data] of Object.entries(splits)) {
      if (data.length === 0) continue;
      
      const filePath = path.join(exportDir, `${splitName}.jsonl`);
      const lines = data.map((item: any) => JSON.stringify(item)).join('\n');
      await fs.writeFile(filePath, lines, 'utf-8');
      
      console.log(`Exported ${data.length} trajectories to ${filePath}`);
    }
    
    // If HuggingFace token provided, upload
    if (options.huggingFaceToken) {
      await uploadToHuggingFaceHub(exportDir, options);
    }
    
    return {
      success: true,
      trajectoriesExported: splits.train.length + splits.validation.length + splits.test.length,
      datasetUrl: options.huggingFaceToken 
        ? `https://huggingface.co/datasets/${options.datasetName}`
        : undefined
    };
  } catch (error) {
    throw new Error(`JSONL export failed: ${error}`);
  }
}

/**
 * Export to Parquet format (more efficient for large datasets)
 */
async function exportToParquet(
  splits: { train: any[]; validation: any[]; test: any[] },
  options: ExportOptions
): Promise<ExportResult> {
  // This would require Apache Arrow/Parquet libraries
  // For now, fallback to JSONL
  console.warn('Parquet export not yet implemented, falling back to JSONL');
  return exportToJSONL(splits, options);
}

/**
 * Upload to Hugging Face Hub
 */
async function uploadToHuggingFaceHub(
  exportDir: string,
  options: ExportOptions
): Promise<void> {
  try {
    // This uses the Hugging Face Hub API
    // You would need @huggingface/hub package
    
    console.log('Uploading to Hugging Face Hub...');
    console.log(`Dataset: ${options.datasetName}`);
    
    // TODO: Implement actual upload
    // For now, print instructions
    console.log('\n📦 To upload to Hugging Face Hub manually:');
    console.log('1. Install: pip install huggingface_hub');
    console.log('2. Login: huggingface-cli login');
    console.log(`3. Upload: huggingface-cli upload ${options.datasetName} ${exportDir}`);
    
  } catch (error) {
    console.error('Failed to upload to Hugging Face Hub:', error);
  }
}

/**
 * Export trajectories grouped by scenario (for GRPO training)
 */
export async function exportGroupedByScenario(
  options: Omit<ExportOptions, 'format'>
): Promise<ExportResult> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    // Get all scenarios
    const scenarios = await (prisma as any).trajectories.findMany({
      where: {
        scenarioId: { not: null },
        ...buildWhereClause(options)
      },
      select: {
        scenarioId: true
      },
      distinct: ['scenarioId']
    });

    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const exportDir = path.resolve(process.cwd(), 'exports', 'scenarios');
    await fs.mkdir(exportDir, { recursive: true });

    let totalExported = 0;

    for (const { scenarioId } of scenarios) {
      if (!scenarioId) continue;
      
      // Get all trajectories for this scenario
      const trajectories = await (prisma as any).trajectories.findMany({
        where: {
          scenarioId,
          ...buildWhereClause(options)
        },
        orderBy: { startTime: 'asc' }
      });

      if (trajectories.length < 2) continue; // Need at least 2 for comparison

      const transformed = trajectories.map((traj: any) => transformForTraining(traj));
      
      const filePath = path.join(exportDir, `scenario-${scenarioId}.jsonl`);
      const lines = transformed.map((item: any) => JSON.stringify(item)).join('\n');
      await fs.writeFile(filePath, lines, 'utf-8');
      
      console.log(`Exported ${trajectories.length} trajectories for scenario ${scenarioId}`);
      totalExported += trajectories.length;
    }

    return {
      success: true,
      trajectoriesExported: totalExported
    };
  } catch (error) {
    return {
      success: false,
      trajectoriesExported: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Export to OpenPipe ART format
 * Matches the format expected by ART/GRPO training
 */
export async function exportForOpenPipeART(
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const { toARTTrajectory } = await import('./art-format');
    
    const trajectories = await (prisma as any).trajectories.findMany({
      where: buildWhereClause(options),
      take: options.maxTrajectories,
      orderBy: { startTime: 'asc' }
    });

    const artFormat = trajectories.map((traj: any) => {
      const steps = JSON.parse(traj.stepsJson);
      const metrics = JSON.parse(traj.metricsJson);
      const metadata = JSON.parse(traj.metadataJson);
      
      const trajectory = {
        trajectoryId: traj.trajectoriesId,
        agentId: traj.agentId,
        scenarioId: traj.scenarioId,
        groupIndex: traj.batchId ? parseInt(traj.batchId.split('-').pop() || '0') : undefined,
        startTime: traj.startTime.getTime(),
        endTime: traj.endTime.getTime(),
        durationMs: traj.durationMs,
        steps,
        totalReward: traj.totalReward,
        rewardComponents: JSON.parse(traj.rewardComponentsJson),
        metrics,
        metadata
      };
      
      return toARTTrajectory(trajectory as any);
    });

    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const exportDir = path.resolve(process.cwd(), 'exports', 'openpipe-art');
    await fs.mkdir(exportDir, { recursive: true });
    
    const filePath = path.join(exportDir, 'trajectories.jsonl');
    const lines = artFormat.map((item: any) => JSON.stringify(item)).join('\n');
    await fs.writeFile(filePath, lines, 'utf-8');
    
    console.log(`Exported ${artFormat.length} trajectories in OpenPipe ART format`);

    return {
      success: true,
      trajectoriesExported: artFormat.length
    };
  } catch (error) {
    return {
      success: false,
      trajectoriesExported: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Export trajectories grouped by scenario for GRPO
 * This creates the structure RULER needs for comparative ranking
 */
export async function exportGroupedForGRPO(
  options: ExportOptions
): Promise<ExportResult> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const { groupTrajectories, toARTTrajectory } = await import('./art-format');
    
    // Get all scenarios
    const scenarios = await (prisma as any).trajectories.groupBy({
      by: ['scenarioId'],
      where: buildWhereClause(options),
      _count: true
    });

    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const exportDir = path.resolve(process.cwd(), 'exports', 'grpo-groups');
    await fs.mkdir(exportDir, { recursive: true });

    let totalExported = 0;

    for (const { scenarioId, _count } of scenarios) {
      if (!scenarioId || _count < 2) continue; // Need at least 2 for comparison
      
      const trajectories = await (prisma as any).trajectories.findMany({
        where: {
          scenarioId,
          ...buildWhereClause(options)
        },
        orderBy: { startTime: 'asc' }
      });

      // Convert to trajectory objects
      const trajObjects = trajectories.map((traj: any) => ({
        trajectoryId: traj.trajectoriesId,
        agentId: traj.agentId,
        scenarioId: traj.scenarioId,
        groupIndex: trajectories.indexOf(traj),
        startTime: traj.startTime.getTime(),
        endTime: traj.endTime.getTime(),
        durationMs: traj.durationMs,
        steps: JSON.parse(traj.stepsJson),
        totalReward: traj.totalReward,
        rewardComponents: JSON.parse(traj.rewardComponentsJson),
        metrics: JSON.parse(traj.metricsJson),
        metadata: JSON.parse(traj.metadataJson)
      }));

      const groups = groupTrajectories(trajObjects as any);
      
      for (const group of groups) {
        const artFormat = {
          groupId: group.groupId,
          scenarioId: group.scenarioId,
          sharedPrefix: group.sharedPrefix || [],
          trajectories: group.trajectories.map(t => toARTTrajectory(t)),
          createdAt: group.createdAt
        };
        
        const filePath = path.join(exportDir, `group-${scenarioId}.jsonl`);
        await fs.writeFile(filePath, JSON.stringify(artFormat) + '\n', 'utf-8');
        
        totalExported += group.trajectories.length;
      }
    }

    console.log(`Exported ${totalExported} trajectories in ${scenarios.length} GRPO groups`);

    return {
      success: true,
      trajectoriesExported: totalExported
    };
  } catch (error) {
    return {
      success: false,
      trajectoriesExported: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper to build Prisma where clause
 */
function buildWhereClause(options: ExportOptions): any {
  const where: any = {
    isTrainingData: true
  };
  
  if (options.startDate) {
    where.startTime = { ...where.startTime, gte: options.startDate };
  }
  if (options.endDate) {
    where.startTime = { ...where.startTime, lte: options.endDate };
  }
  if (options.agentIds) {
    where.agentId = { in: options.agentIds };
  }
  if (options.scenarioIds) {
    where.scenarioId = { in: options.scenarioIds };
  }
  if (options.includeJudged) {
    where.aiJudgeReward = { not: null };
  }
  
  return where;
}

