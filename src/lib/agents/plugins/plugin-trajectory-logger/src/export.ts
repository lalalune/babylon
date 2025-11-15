/**
 * Export Trajectories to Hugging Face Datasets
 * 
 * Prepares trajectory data for RLAIF training pipelines.
 * Exports to HuggingFace Hub for easy access in training scripts.
 * 
 * NOTE: Requires trajectory schema that's not yet in main Prisma
 */

import type { Prisma } from '@prisma/client';
import type { Trajectory } from './types';

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
    
    // Build query using proper Prisma type
    const where = buildWhereClause(options);

    interface TrajectoryRecord {
      trajectoryId: string;
      agentId: string;
      episodeId: string | null;
      scenarioId: string | null;
      startTime: Date;
      durationMs: number;
      stepsJson: string;
      metricsJson: string;
      metadataJson: string;
      totalReward: number;
      finalStatus: string;
      finalPnL: number | null;
      aiJudgeReward: number | null;
      aiJudgeReasoning: string | null;
    }

    // Fetch trajectories using Prisma directly
    const trajectories = await prisma.trajectory.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: options.maxTrajectories || 10000,
      select: {
        trajectoryId: true,
        agentId: true,
        episodeId: true,
        scenarioId: true,
        startTime: true,
        durationMs: true,
        stepsJson: true,
        metricsJson: true,
        metadataJson: true,
        totalReward: true,
        finalStatus: true,
        finalPnL: true,
        aiJudgeReward: true,
        aiJudgeReasoning: true,
      }
    }) as TrajectoryRecord[];

    console.log(`Exporting ${trajectories.length} trajectories...`);

    // Transform to training format
    const dataset = trajectories.map((traj: TrajectoryRecord) => transformForTraining(traj));

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
interface TrajectoryRecord {
  trajectoryId: string;
  agentId: string;
  episodeId: string | null;
  scenarioId: string | null;
  startTime: Date;
  durationMs: number;
  stepsJson: string;
  metricsJson: string;
  metadataJson: string;
  totalReward: number;
  finalStatus: string;
  finalPnL: number | null;
  aiJudgeReward: number | null;
  aiJudgeReasoning: string | null;
}

interface TrajectoryStep {
  stepNumber: number;
  timestamp: number;
  environmentState: Record<string, unknown>;
  observation: Record<string, unknown>;
  llmCalls: Array<{
    model: string;
    systemPrompt: string;
    userPrompt: string;
    response: string;
    reasoning?: string;
    temperature: number;
    purpose: string;
  }>;
  action: {
    actionType: string;
    parameters: Record<string, unknown>;
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
  };
  reward: number;
  reasoning?: string;
}

interface TrainingTrajectory extends Record<string, unknown> {
  trajectory_id: string;
  agent_id: string;
  episode_id: string | null;
  scenario_id: string | null;
  start_time: string;
  duration_ms: number;
  steps: Array<{
    step_number: number;
    timestamp: number;
    environment_state: Record<string, unknown>;
    observation: Record<string, unknown>;
    llm_calls: Array<{
      model: string;
      system_prompt: string;
      user_prompt: string;
      response: string;
      reasoning?: string;
      temperature: number;
      purpose: string;
    }>;
    action: {
      type: string;
      parameters: Record<string, unknown>;
      success: boolean;
      result?: Record<string, unknown>;
      error?: string;
    };
    reward: number;
    reasoning?: string;
  }>;
  total_reward: number;
  final_status: string;
  final_pnl: number | null;
  ai_judge_reward: number | null;
  ai_judge_reasoning: string | null;
  metrics: {
    episode_length: number;
    trades_executed?: number;
    posts_created?: number;
    messages_handled?: number;
    error_count?: number;
  };
  metadata: Record<string, unknown>;
}

function transformForTraining(traj: TrajectoryRecord): TrainingTrajectory {
  const steps = JSON.parse(traj.stepsJson) as TrajectoryStep[];
  const metrics = JSON.parse(traj.metricsJson) as Record<string, unknown>;
  const metadata = JSON.parse(traj.metadataJson) as Record<string, unknown>;
  
  return {
    // Identifiers
    trajectory_id: traj.trajectoryId,
    agent_id: traj.agentId,
    episode_id: traj.episodeId,
    scenario_id: traj.scenarioId,
    
    // Timing
    start_time: traj.startTime.toISOString(),
    duration_ms: traj.durationMs,
    
    // Steps (full trajectory)
    steps: steps.map((step: TrajectoryStep) => ({
      step_number: step.stepNumber,
      timestamp: step.timestamp,
      
      // Environment
      environment_state: step.environmentState,
      observation: step.observation,
      
      // Agent cognition
      llm_calls: step.llmCalls.map((call) => ({
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
      episode_length: (metrics.episodeLength as number) || 0,
      trades_executed: metrics.tradesExecuted as number | undefined,
      posts_created: metrics.postsCreated as number | undefined,
      messages_handled: metrics.messagesHandled as number | undefined,
      error_count: metrics.errorCount as number | undefined
    },
    
    // Metadata
    metadata
  };
}

/**
 * Split dataset into train/val/test
 */
function splitDataset<T>(
  data: T[],
  ratio?: { train: number; validation: number; test: number }
): { train: T[]; validation: T[]; test: T[] } {
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
async function exportToJSONL<T extends Record<string, unknown>>(
  splits: { train: T[]; validation: T[]; test: T[] },
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
      const lines = data.map((item: T) => JSON.stringify(item)).join('\n');
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
async function exportToParquet<T extends Record<string, unknown>>(
  splits: { train: T[]; validation: T[]; test: T[] },
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
    if (!options.huggingFaceToken) {
      throw new Error('HuggingFace token is required for upload');
    }

    // Try using child_process to call huggingface-cli (most reliable method)
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      
      // Set token as environment variable for huggingface-cli
      process.env.HUGGINGFACE_HUB_TOKEN = options.huggingFaceToken;
      
      console.log('Uploading to Hugging Face Hub...');
      console.log(`Dataset: ${options.datasetName}`);
      
      await execAsync(`huggingface-cli upload ${options.datasetName} ${exportDir} --repo-type dataset`);
      console.log('✅ Successfully uploaded via huggingface-cli');
    } catch (cliError) {
      // Fallback: Try @huggingface/hub npm package if available
      try {
        const hubModule = await import('@huggingface/hub');
        // Handle different export styles
        const HfApi = (hubModule as { HfApi?: new (args: { token: string }) => { uploadFile: (args: { repoId: string; path: string; fileContent: string; repoType: string }) => Promise<void> } }).HfApi;
        
        if (!HfApi) {
          throw new Error('HfApi not found in @huggingface/hub');
        }
        
        const api = new HfApi({ token: options.huggingFaceToken });
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const files = await fs.readdir(exportDir);

        for (const file of files) {
          const filePath = path.join(exportDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            await api.uploadFile({
              repoId: options.datasetName,
              path: file,
              fileContent: fileContent,
              repoType: 'dataset',
            });
            console.log(`Uploaded ${file}`);
          }
        }

        console.log('✅ Successfully uploaded to Hugging Face Hub');
      } catch (importError) {
        // If both methods fail, provide instructions
        console.warn('Neither huggingface-cli nor @huggingface/hub available.');
        console.log('\n📦 To upload to Hugging Face Hub:');
        console.log('1. Install: pip install huggingface_hub');
        console.log('2. Login: huggingface-cli login');
        console.log(`3. Upload: huggingface-cli upload ${options.datasetName} ${exportDir} --repo-type dataset`);
        throw new Error('HuggingFace upload failed: neither huggingface-cli nor @huggingface/hub available');
      }
    }
  } catch (error) {
    console.error('Failed to upload to Hugging Face Hub:', error);
    throw error;
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
    const scenarios = await prisma.trajectory.findMany({
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
      const trajectories = await prisma.trajectory.findMany({
        where: {
          scenarioId,
          ...buildWhereClause(options)
        },
        orderBy: { startTime: 'asc' }
      });

      if (trajectories.length < 2) continue; // Need at least 2 for comparison

      const transformed = trajectories.map((traj) => transformForTraining(traj));
      
      const filePath = path.join(exportDir, `scenario-${scenarioId}.jsonl`);
      const lines = transformed.map((item) => JSON.stringify(item)).join('\n');
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
    
    const trajectories = await prisma.trajectory.findMany({
      where: buildWhereClause(options),
      take: options.maxTrajectories,
      orderBy: { startTime: 'asc' }
    });

    const artFormat = trajectories.map((traj: typeof trajectories[0]) => {
      const steps = JSON.parse(traj.stepsJson);
      const metrics = JSON.parse(traj.metricsJson);
      const metadata = JSON.parse(traj.metadataJson);
      
      const trajectory = {
        trajectoryId: traj.trajectoryId,
        agentId: traj.agentId as `${string}-${string}-${string}-${string}-${string}`,
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
      
      return toARTTrajectory(trajectory as Trajectory);
    });

    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const exportDir = path.resolve(process.cwd(), 'exports', 'openpipe-art');
    await fs.mkdir(exportDir, { recursive: true });
    
    const filePath = path.join(exportDir, 'trajectories.jsonl');
    const lines = artFormat.map((item) => JSON.stringify(item)).join('\n');
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
    const scenarios = await prisma.trajectory.groupBy({
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
      
      const trajectories = await prisma.trajectory.findMany({
        where: {
          scenarioId,
          ...buildWhereClause(options)
        },
        orderBy: { startTime: 'asc' }
      });

      // Convert to trajectory objects
      const trajObjects = trajectories.map((traj) => ({
        trajectoryId: traj.trajectoryId,
        agentId: traj.agentId as `${string}-${string}-${string}-${string}-${string}`,
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

      const groups = groupTrajectories(trajObjects as Trajectory[]);
      
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
function buildWhereClause(options: ExportOptions): Prisma.TrajectoryWhereInput {
  const where: Prisma.TrajectoryWhereInput = {
    isTrainingData: true
  };
  
  if (options.startDate || options.endDate) {
    where.startTime = {};
    if (options.startDate) {
      where.startTime.gte = options.startDate;
    }
    if (options.endDate) {
      where.startTime.lte = options.endDate;
    }
  }
  if (options.agentIds) {
    where.agentId = { in: options.agentIds };
  }
  if (options.scenarioIds) {
    where.scenarioId = { in: options.scenarioIds };
  }
  if (options.minReward !== undefined || options.maxReward !== undefined) {
    where.totalReward = {};
    if (options.minReward !== undefined) {
      where.totalReward.gte = options.minReward;
    }
    if (options.maxReward !== undefined) {
      where.totalReward.lte = options.maxReward;
    }
  }
  if (options.includeJudged) {
    where.aiJudgeReward = { not: null };
  }
  
  return where;
}

