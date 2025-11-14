/**
 * RL Model Configuration
 * 
 * Controls when and how RL-trained models are used for inference.
 * Designed to be:
 * - Enabled by default in local development
 * - Disabled by default in production
 * - Easy to toggle via environment variables
 */

export interface RLModelConfig {
  enabled: boolean;
  wandbApiKey?: string;
  wandbEntity?: string;
  wandbProject: string;
  modelVersion?: string; // If specified, use this version. Otherwise use latest.
  fallbackToBase: boolean; // If RL model fails, fall back to base model
  baseModel: string;
}

/**
 * Get RL model configuration from environment
 */
export function getRLModelConfig(): RLModelConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocal = process.env.NODE_ENV === 'development' || !isProduction;
  
  // Explicit enable/disable flag
  const explicitFlag = process.env.USE_RL_MODEL;
  
  // Determine if enabled:
  // - If USE_RL_MODEL is explicitly set, use that value
  // - Otherwise, enabled in local, disabled in production
  const enabled = explicitFlag 
    ? explicitFlag === 'true'
    : isLocal;
  
  return {
    enabled,
    wandbApiKey: process.env.WANDB_API_KEY,
    wandbEntity: process.env.WANDB_ENTITY,
    wandbProject: process.env.WANDB_PROJECT || 'babylon-rl-training',
    modelVersion: process.env.RL_MODEL_VERSION, // Optional: pin to specific version
    fallbackToBase: process.env.RL_FALLBACK_TO_BASE !== 'false', // Default: true
    baseModel: process.env.BASE_MODEL || 'OpenPipe/Qwen3-14B-Instruct'
  };
}

/**
 * Check if RL models are available and configured
 */
export function isRLModelAvailable(): boolean {
  const config = getRLModelConfig();
  
  if (!config.enabled) {
    return false;
  }
  
  // Need W&B credentials to fetch RL models
  if (!config.wandbApiKey || !config.wandbEntity) {
    console.warn('RL models enabled but W&B credentials missing. Set WANDB_API_KEY and WANDB_ENTITY.');
    return false;
  }
  
  return true;
}

/**
 * Log configuration on startup
 */
export function logRLModelConfig(): void {
  const config = getRLModelConfig();
  const available = isRLModelAvailable();
  
  console.log('🤖 RL Model Configuration:', {
    enabled: config.enabled,
    available,
    wandbConfigured: !!(config.wandbApiKey && config.wandbEntity),
    project: config.wandbProject,
    pinnedVersion: config.modelVersion || 'latest',
    fallbackEnabled: config.fallbackToBase,
    baseModel: config.baseModel
  });
}

