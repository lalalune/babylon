/**
 * Admin API: AI Model Configuration
 * Manages wandb model selection and system AI settings
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import OpenAI from 'openai';

/**
 * GET /api/admin/ai-models
 * Returns current AI configuration and available models
 */
export async function GET(_req: NextRequest) {
  try {
    // Get current settings
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
    });

    // Check available providers
    const providers = {
      wandb: !!process.env.WANDB_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    };

    // Get active provider (based on priority)
    let activeProvider: 'wandb' | 'groq' | 'claude' | 'openai' = 'openai';
    if (providers.wandb && settings?.wandbEnabled) {
      activeProvider = 'wandb';
    } else if (providers.groq) {
      activeProvider = 'groq';
    } else if (providers.claude) {
      activeProvider = 'claude';
    }

    // Fetch available wandb models if wandb is available
    let wandbModels: { id: string; name: string; description?: string }[] = [];
    if (providers.wandb) {
      try {
        const wandbClient = new OpenAI({
          apiKey: process.env.WANDB_API_KEY!,
          baseURL: 'https://api.inference.wandb.ai/v1',
        });

        const modelsResponse = await wandbClient.models.list();
        wandbModels = modelsResponse.data.map((model) => ({
          id: model.id,
          name: model.id,
          description: `${model.id}`,
        }));
      } catch (error) {
        logger.error('Failed to fetch wandb models', { error }, 'AIModelsAPI');
        // Return empty array on error
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        currentSettings: {
          wandbModel: settings?.wandbModel || null,
          wandbEnabled: settings?.wandbEnabled || false,
        },
        providers,
        activeProvider,
        wandbModels,
        recommendedModels: [
          {
            id: 'moonshotai/kimi-k2-instruct-0905',
            name: 'Kimi K2 Instruct',
            description: '⭐ Best for content generation: events, articles, posts, group chats',
          },
          {
            id: 'qwen/qwen3-32b',
            name: 'Qwen 3 32B',
            description: '⚡ Best for background operations: market decisions, NPC trading',
          },
          {
            id: 'openai/gpt-oss-120b',
            name: 'GPT OSS 120B',
            description: '🚀 Best for frequent operations: comments, DMs, tags, evaluations',
          },
          {
            id: 'meta-llama/Llama-3.3-70B-Instruct',
            name: 'Llama 3.3 70B Instruct',
            description: 'Alternative: Powerful general-purpose model',
          },
        ],
      },
    });
  } catch (error) {
    logger.error('Failed to get AI models', { error }, 'AIModelsAPI');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get AI models configuration',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/ai-models
 * Updates AI model configuration
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { wandbModel, wandbEnabled } = body;

    // Validate inputs
    if (wandbEnabled && !process.env.WANDB_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot enable wandb without WANDB_API_KEY environment variable',
        },
        { status: 400 }
      );
    }

    // Update or create settings
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {
        wandbModel: wandbModel || null,
        wandbEnabled: wandbEnabled || false,
      },
      create: {
        id: 'system',
        wandbModel: wandbModel || null,
        wandbEnabled: wandbEnabled || false,
      },
    });

    logger.info('Updated AI model configuration', { 
      wandbModel, 
      wandbEnabled 
    }, 'AIModelsAPI');

    // Clear the cache so the new config is picked up
    const { clearAIModelConfigCache } = await import('@/lib/ai-model-config');
    clearAIModelConfigCache();

    // Also update the environment variable for immediate effect
    if (wandbEnabled && wandbModel) {
      process.env.WANDB_MODEL = wandbModel;
    }

    return NextResponse.json({
      success: true,
      data: {
        wandbModel: settings.wandbModel,
        wandbEnabled: settings.wandbEnabled,
      },
      message: 'AI model configuration updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update AI models', { error }, 'AIModelsAPI');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update AI model configuration',
      },
      { status: 500 }
    );
  }
}

