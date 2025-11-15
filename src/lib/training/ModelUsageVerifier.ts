/**
 * Model Usage Verifier
 * 
 * Verifies that agents are using trained W&B models instead of base models.
 * Provides assertions and logging for model usage verification.
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getLatestRLModel } from './WandbModelFetcher';
import type { IAgentRuntime } from '@elizaos/core';

export interface ModelUsageStats {
  agentId: string;
  modelUsed: string;
  modelSource: 'wandb' | 'groq' | 'unknown';
  modelVersion?: string;
  isTrainedModel: boolean;
  inferenceCount: number;
}

export interface VerificationResult {
  success: boolean;
  agentsChecked: number;
  agentsUsingTrainedModel: number;
  agentsUsingBaseModel: number;
  details: ModelUsageStats[];
  errors: string[];
}

export class ModelUsageVerifier {
  /**
   * Verify that an agent runtime is using trained model
   */
  static async verifyAgentModelUsage(
    agentUserId: string,
    runtime: IAgentRuntime
  ): Promise<ModelUsageStats> {
    const wandbEnabled = (runtime.character?.settings?.WANDB_ENABLED === 'true');
    const wandbModel = String(runtime.character?.settings?.WANDB_MODEL || '');
    const groqModel = String(runtime.character?.settings?.LARGE_GROQ_MODEL || runtime.character?.settings?.SMALL_GROQ_MODEL || '');
    
    let modelUsed: string;
    let modelSource: 'wandb' | 'groq' | 'unknown';
    let modelVersion: string | undefined;
    let isTrainedModel = false;
    
    if (wandbEnabled && wandbModel) {
      modelUsed = wandbModel;
      modelSource = 'wandb';
      
      // Check if this is a trained model (not base)
      const latestModel = await getLatestRLModel();
      if (latestModel && latestModel.modelPath === wandbModel) {
        isTrainedModel = true;
        modelVersion = latestModel.version;
      } else {
        // Using W&B but not the trained model (could be base W&B model)
        isTrainedModel = false;
      }
    } else if (groqModel) {
      modelUsed = groqModel;
      modelSource = 'groq';
      isTrainedModel = false; // Groq models are base models
    } else {
      modelUsed = 'unknown';
      modelSource = 'unknown';
      isTrainedModel = false;
    }
    
    // Count inferences from logs (using trajectoryId or other fields)
    // Note: LLMCallLog may not have agentId field directly
    const inferenceCount = await prisma.llmCallLog.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        },
        // Filter by trajectory which has agentId
        trajectoryId: {
          in: await prisma.trajectory.findMany({
            where: { agentId: agentUserId },
            select: { trajectoryId: true },
          }).then(trajs => trajs.map(t => t.trajectoryId)),
        },
      },
    }).catch(() => 0); // Return 0 if query fails
    
    return {
      agentId: agentUserId,
      modelUsed,
      modelSource,
      modelVersion,
      isTrainedModel,
      inferenceCount,
    };
  }
  
  /**
   * Verify multiple agents
   */
  static async verifyMultipleAgents(
    agentUserIds: string[],
    runtimes: Map<string, IAgentRuntime>
  ): Promise<VerificationResult> {
    const details: ModelUsageStats[] = [];
    const errors: string[] = [];
    
    for (const agentId of agentUserIds) {
      try {
        const runtime = runtimes.get(agentId);
        if (!runtime) {
          errors.push(`Runtime not found for agent ${agentId}`);
          continue;
        }
        
        const stats = await this.verifyAgentModelUsage(agentId, runtime);
        details.push(stats);
      } catch (error) {
        errors.push(`Failed to verify agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const agentsUsingTrainedModel = details.filter(d => d.isTrainedModel).length;
    const agentsUsingBaseModel = details.filter(d => !d.isTrainedModel).length;
    
    return {
      success: agentsUsingTrainedModel > 0,
      agentsChecked: details.length,
      agentsUsingTrainedModel,
      agentsUsingBaseModel,
      details,
      errors,
    };
  }
  
  /**
   * Assert that agents are using trained model
   */
  static async assertTrainedModelUsage(
    agentUserId: string,
    runtime: IAgentRuntime
  ): Promise<void> {
    const stats = await this.verifyAgentModelUsage(agentUserId, runtime);
    
    if (!stats.isTrainedModel) {
      throw new Error(
        `Agent ${agentUserId} is not using trained model. ` +
        `Using: ${stats.modelUsed} (source: ${stats.modelSource})`
      );
    }
    
    logger.info('Model usage assertion passed', {
      agentId: agentUserId,
      model: stats.modelUsed,
      version: stats.modelVersion,
    }, 'ModelUsageVerifier');
  }
  
  /**
   * Get model usage summary
   */
  static async getModelUsageSummary(): Promise<{
    totalAgents: number;
    usingTrainedModel: number;
    usingBaseModel: number;
    latestModelVersion?: string;
  }> {
    const agents = await prisma.user.findMany({
      where: { isAgent: true },
      select: { id: true },
    });
    
    const latestModel = await getLatestRLModel();
    
    // Count agents using trained model (simplified check)
    // In production, you'd check each agent's runtime settings
    // For now, return summary
    return {
      totalAgents: agents.length,
      usingTrainedModel: 0, // Would need to check each agent's runtime
      usingBaseModel: agents.length,
      latestModelVersion: latestModel?.version,
    };
  }
}

