/**
 * Training System Initialization
 * 
 * Call this on server startup to log configuration and verify setup
 */

import { logRLModelConfig, isRLModelAvailable } from './RLModelConfig';
import { getLatestRLModel } from './WandbModelFetcher';

export async function initializeTrainingSystem(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Initializing Training System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Log RL configuration
  logRLModelConfig();
  
  // Check if RL models are available
  const available = isRLModelAvailable();
  
  if (available) {
    try {
      const model = await getLatestRLModel();
      if (model) {
        console.log('\n✅ Latest RL Model:', {
          version: model.version,
          avgReward: model.metadata.avgReward,
          benchmarkScore: model.metadata.benchmarkScore,
          trainedAt: model.metadata.trainedAt.toISOString()
        });
      } else {
        console.log('\n⚠️  No trained models found in database');
        console.log('   Run training to create models: POST /api/admin/training/trigger');
      }
    } catch (error) {
      console.error('\n❌ Failed to check for RL models:', error);
    }
  } else {
    console.log('\nℹ️  RL models not available - using base model');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

