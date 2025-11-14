/**
 * AI Model Configuration Helper
 * Loads system-wide AI model settings from database
 */

import { prisma } from './prisma';
import { logger } from './logger';

interface AIModelConfig {
  wandbModel: string | null;
  wandbEnabled: boolean;
}

let cachedConfig: AIModelConfig | null = null;
let lastFetch: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get the current AI model configuration
 * Uses in-memory cache to avoid excessive database queries
 */
export async function getAIModelConfig(): Promise<AIModelConfig> {
  const now = Date.now();
  
  // Return cached config if still valid
  if (cachedConfig && (now - lastFetch) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: {
        wandbModel: true,
        wandbEnabled: true,
      },
    });

    cachedConfig = {
      wandbModel: settings?.wandbModel || null,
      wandbEnabled: settings?.wandbEnabled || false,
    };
    lastFetch = now;

    return cachedConfig;
  } catch (error) {
    logger.error('Failed to load AI model config', { error }, 'AIModelConfig');
    
    // Return safe defaults on error
    return {
      wandbModel: null,
      wandbEnabled: false,
    };
  }
}

/**
 * Clear the configuration cache
 * Call this after updating the configuration
 */
export function clearAIModelConfigCache(): void {
  cachedConfig = null;
  lastFetch = 0;
}

/**
 * Get the wandb model to use (from config or environment)
 */
export async function getWandbModel(): Promise<string | undefined> {
  const config = await getAIModelConfig();
  
  if (config.wandbEnabled && config.wandbModel) {
    return config.wandbModel;
  }
  
  // Fallback to environment variable
  return process.env.WANDB_MODEL || undefined;
}

