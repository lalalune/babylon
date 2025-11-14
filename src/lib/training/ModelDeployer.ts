/**
 * Model Deployer Service
 * 
 * Automatically deploys trained models from Vercel Blob to agents.
 * Handles gradual rollout and rollback if needed.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface DeploymentOptions {
  modelVersion: string;
  strategy: 'immediate' | 'gradual' | 'test';
  rolloutPercentage?: number; // For gradual deployment (default: 10%)
  testAgentIds?: string[]; // For test deployment
}

export interface DeploymentResult {
  success: boolean;
  agentsUpdated: number;
  deploymentId: string;
  error?: string;
}

export class ModelDeployer {
  /**
   * Deploy model to agents
   */
  async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    try {
      logger.info('Starting model deployment', {
        version: options.modelVersion,
        strategy: options.strategy
      });

      const prismaExt = prisma as any;

      // Get model
      const model = await prismaExt.trainedModel.findFirst({
        where: { version: options.modelVersion }
      });

      if (!model) {
        throw new Error(`Model ${options.modelVersion} not found`);
      }

      // Get target agents
      const targetAgents = await this.getTargetAgents(options);

      logger.info(`Deploying to ${targetAgents.length} agents`);

      // Create deployment records
      const deploymentId = `deploy-${Date.now()}`;
      
      for (const agent of targetAgents) {
        await prismaExt.modelDeployment.create({
          data: {
            id: `deployment-${agent.id}-${Date.now()}`,
            modelId: model.modelId,
            agentId: agent.id,
            deployedAt: new Date(),
            isActive: true,
            performanceMetrics: {}
          }
        });
      }

      // Update model status
      await prismaExt.trainedModel.update({
        where: { modelId: model.modelId },
        data: {
          status: 'deployed',
          deployedAt: new Date(),
          agentsUsing: targetAgents.length
        }
      });

      logger.info('Model deployed successfully', {
        version: options.modelVersion,
        agentsUpdated: targetAgents.length,
        deploymentId
      });

      return {
        success: true,
        agentsUpdated: targetAgents.length,
        deploymentId
      };

    } catch (error) {
      logger.error('Model deployment failed', error);
      return {
        success: false,
        agentsUpdated: 0,
        deploymentId: '',
        error: error instanceof Error ? error.message : 'Deployment failed'
      };
    }
  }

  /**
   * Get target agents based on deployment strategy
   */
  private async getTargetAgents(options: DeploymentOptions) {
    const agents = await prisma.user.findMany({
      where: { isAgent: true },
      select: { id: true, displayName: true }
    });

    switch (options.strategy) {
      case 'immediate':
        return agents;

      case 'gradual':
        const percentage = options.rolloutPercentage || 10;
        const count = Math.ceil(agents.length * (percentage / 100));
        return agents.slice(0, count);

      case 'test':
        if (options.testAgentIds) {
          return agents.filter(a => options.testAgentIds!.includes(a.id));
        }
        return agents.slice(0, 1); // Just first agent

      default:
        return agents;
    }
  }

  /**
   * Rollback to previous model version
   */
  async rollback(currentVersion: string, targetVersion: string): Promise<DeploymentResult> {
    try {
      logger.info('Rolling back model', {
        from: currentVersion,
        to: targetVersion
      });

      const prismaExt = prisma as any;

      // Get all agents using current version
      const deployments = await prismaExt.modelDeployment.findMany({
        where: {
          model: {
            version: currentVersion
          },
          isActive: true
        }
      });

      // Deactivate current deployments
      for (const deployment of deployments) {
        await prismaExt.modelDeployment.update({
          where: { id: deployment.id },
          data: {
            isActive: false,
            undeployedAt: new Date()
          }
        });
      }

      // Deploy target version
      return await this.deploy({
        modelVersion: targetVersion,
        strategy: 'immediate'
      });

    } catch (error) {
      logger.error('Rollback failed', error);
      return {
        success: false,
        agentsUpdated: 0,
        deploymentId: '',
        error: error instanceof Error ? error.message : 'Rollback failed'
      };
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<{
    status: string;
    agentsUpdated: number;
    agentsFailed: number;
    performance: Record<string, number>;
  } | null> {
    const prismaExt = prisma as any;

    const deployments = await prismaExt.modelDeployment.findMany({
      where: {
        id: {
          contains: deploymentId.split('-')[1] // Match timestamp
        }
      }
    });

    if (deployments.length === 0) {
      return null;
    }

    return {
      status: 'deployed',
      agentsUpdated: deployments.length,
      agentsFailed: 0,
      performance: {}
    };
  }
}

// Singleton
export const modelDeployer = new ModelDeployer();

