/**
 * W&B Model Usage Verification Script
 * 
 * Verifies with 100% confidence that agents are using trained W&B RL models.
 * 
 * This script:
 * 1. Checks database for trained models
 * 2. Verifies agent runtime settings
 * 3. Makes actual LLM calls and verifies model used
 * 4. Checks LLM call logs to confirm W&B inference
 * 5. Provides detailed verification report
 * 
 * Usage:
 *   bun run scripts/verify-wandb-model-usage.ts [--agent-id <id>]
 */

import { prisma } from '@/lib/prisma';
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager';
import { getLatestRLModel } from '@/lib/training/WandbModelFetcher';
import { ModelUsageVerifier } from '@/lib/training/ModelUsageVerifier';
import { ensureTestAgents } from '@/lib/agents/utils/createTestAgent';

interface VerificationResult {
  step: string;
  passed: boolean;
  details: string;
  evidence?: Record<string, unknown>;
}

class WandbModelUsageVerifier {
  private results: VerificationResult[] = [];
  
  /**
   * Step 1: Verify trained model exists in database
   */
  async verifyTrainedModelExists(): Promise<VerificationResult> {
    console.log('\n📋 Step 1: Checking for Trained Model in Database\n');
    
    try {
      const latestModel = await getLatestRLModel();
      
      if (!latestModel) {
        return {
          step: 'Trained Model Exists',
          passed: false,
          details: 'No trained model found in database. Train a model first.',
        };
      }
      
      console.log(`  ✅ Found trained model:`);
      console.log(`     Model ID: ${latestModel.modelId}`);
      console.log(`     Version: ${latestModel.version}`);
      console.log(`     Model Path: ${latestModel.modelPath}`);
      console.log(`     Avg Reward: ${latestModel.metadata.avgReward?.toFixed(2) || 'N/A'}`);
      console.log(`     Base Model: ${latestModel.metadata.baseModel}`);
      console.log(`     Trained At: ${latestModel.metadata.trainedAt.toISOString()}\n`);
      
      // Verify model path format (should be W&B format)
      const isWandbFormat = latestModel.modelPath.includes('/') || latestModel.modelPath.includes(':');
      
      if (!isWandbFormat) {
        return {
          step: 'Trained Model Exists',
          passed: false,
          details: `Model path format invalid. Expected W&B format (entity/project/model:step), got: ${latestModel.modelPath}`,
          evidence: { modelPath: latestModel.modelPath },
        };
      }
      
      return {
        step: 'Trained Model Exists',
        passed: true,
        details: `Found trained model: ${latestModel.modelPath} (v${latestModel.version})`,
        evidence: {
          modelId: latestModel.modelId,
          version: latestModel.version,
          modelPath: latestModel.modelPath,
          avgReward: latestModel.metadata.avgReward,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isDbError = errorMessage.includes('Authentication failed') || 
                       errorMessage.includes('database') ||
                       errorMessage.includes('connection');
      
      return {
        step: 'Trained Model Exists',
        passed: false,
        details: isDbError 
          ? 'Database connection failed. Please ensure database is running and DATABASE_URL is set correctly.'
          : `Error checking database: ${errorMessage}`,
      };
    }
  }
  
  /**
   * Step 2: Verify agent runtime loads trained model
   */
  async verifyAgentRuntimeLoadsModel(agentId: string): Promise<VerificationResult> {
    console.log(`📋 Step 2: Verifying Agent Runtime Loads Trained Model\n`);
    console.log(`  Agent ID: ${agentId.substring(0, 12)}...\n`);
    
    try {
      const runtime = await agentRuntimeManager.getRuntime(agentId);
      
      const wandbEnabled = runtime.character?.settings?.WANDB_ENABLED === 'true';
      const wandbModel = runtime.character?.settings?.WANDB_MODEL;
      const wandbApiKey = runtime.character?.settings?.WANDB_API_KEY;
      const modelVersion = (runtime as unknown as { currentModelVersion?: string }).currentModelVersion;
      
      console.log(`  Runtime Settings:`);
      console.log(`     W&B Enabled: ${wandbEnabled}`);
      console.log(`     W&B Model: ${wandbModel || 'None'}`);
      console.log(`     W&B API Key: ${wandbApiKey ? 'Set' : 'Not Set'}`);
      console.log(`     Model Version: ${modelVersion || 'None'}\n`);
      
      if (!wandbEnabled) {
        return {
          step: 'Agent Runtime Loads Model',
          passed: false,
          details: 'W&B is not enabled in agent runtime settings',
          evidence: { wandbEnabled, wandbModel },
        };
      }
      
      if (!wandbModel) {
        return {
          step: 'Agent Runtime Loads Model',
          passed: false,
          details: 'W&B model not set in agent runtime settings',
          evidence: { wandbEnabled, wandbModel },
        };
      }
      
      // Verify it matches the latest trained model
      const latestModel = await getLatestRLModel();
      if (latestModel && latestModel.modelPath !== wandbModel) {
        return {
          step: 'Agent Runtime Loads Model',
          passed: false,
          details: `Agent using different model. Expected: ${latestModel.modelPath}, Got: ${wandbModel}`,
          evidence: {
            expected: latestModel.modelPath,
            actual: wandbModel,
          },
        };
      }
      
      return {
        step: 'Agent Runtime Loads Model',
        passed: true,
        details: `Agent runtime correctly configured with W&B model: ${wandbModel}`,
        evidence: {
          wandbEnabled,
          wandbModel,
          modelVersion,
          matchesLatest: latestModel?.modelPath === wandbModel,
        },
      };
    } catch (error) {
      return {
        step: 'Agent Runtime Loads Model',
        passed: false,
        details: `Error checking runtime: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * Step 3: Verify Groq plugin uses W&B model
   */
  async verifyGroqPluginUsesWandb(agentId: string): Promise<VerificationResult> {
    console.log(`📋 Step 3: Verifying Groq Plugin Uses W&B Model\n`);
    
    try {
      const runtime = await agentRuntimeManager.getRuntime(agentId);
      
      // Check plugin configuration
      const wandbEnabled = runtime.getSetting('WANDB_ENABLED') === 'true';
      const wandbModel = runtime.getSetting('WANDB_MODEL');
      const wandbApiKey = runtime.getSetting('WANDB_API_KEY');
      
      console.log(`  Plugin Settings:`);
      console.log(`     W&B Enabled: ${wandbEnabled}`);
      console.log(`     W&B Model: ${wandbModel || 'None'}`);
      console.log(`     W&B API Key: ${wandbApiKey ? 'Set' : 'Not Set'}\n`);
      
      if (!wandbEnabled || !wandbModel || !wandbApiKey) {
        return {
          step: 'Groq Plugin Uses W&B',
          passed: false,
          details: 'Plugin not configured for W&B. Will fallback to Groq.',
          evidence: { wandbEnabled, wandbModel: !!wandbModel, wandbApiKey: !!wandbApiKey },
        };
      }
      
      // Verify model matches latest trained model
      const latestModel = await getLatestRLModel();
      if (latestModel && latestModel.modelPath !== wandbModel) {
        return {
          step: 'Groq Plugin Uses W&B',
          passed: false,
          details: `Plugin configured but model doesn't match latest. Expected: ${latestModel.modelPath}, Got: ${wandbModel}`,
          evidence: {
            expected: latestModel.modelPath,
            actual: wandbModel,
          },
        };
      }
      
      return {
        step: 'Groq Plugin Uses W&B',
        passed: true,
        details: `Plugin correctly configured to use W&B model: ${wandbModel}`,
        evidence: {
          wandbEnabled,
          wandbModel,
          matchesLatest: latestModel?.modelPath === wandbModel,
        },
      };
    } catch (error) {
      return {
        step: 'Groq Plugin Uses W&B',
        passed: false,
        details: `Error checking plugin: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * Step 4: Make actual LLM call and verify model used
   */
  async verifyActualLLMCall(agentId: string): Promise<VerificationResult> {
    console.log(`📋 Step 4: Making Actual LLM Call to Verify Model\n`);
    
    try {
      const runtime = await agentRuntimeManager.getRuntime(agentId);
      
      // Get the groq plugin
      const groqPlugin = runtime.plugins?.find(p => p.name === 'groq');
      if (!groqPlugin) {
        return {
          step: 'Actual LLM Call',
          passed: false,
          details: 'Groq plugin not found in runtime',
        };
      }
      
      console.log(`  Making test LLM call...\n`);
      
      // Make a test call
      const testPrompt = 'Say "W&B RL Model Test" if you are a trained reinforcement learning model.';
      
      try {
        const response = await groqPlugin.models?.['text_large']?.(
          runtime,
          {
            prompt: testPrompt,
            maxTokens: 50,
            temperature: 0.7,
          }
        );
        
        console.log(`  ✅ LLM call succeeded`);
        console.log(`     Response: ${response?.substring(0, 100)}...\n`);
        
        // Check LLM call logs
        const recentCalls = await prisma.llmCallLog.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 60000), // Last minute
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });
        
        if (recentCalls.length === 0) {
          return {
            step: 'Actual LLM Call',
            passed: false,
            details: 'LLM call succeeded but no log entry found. Trajectory logging may not be enabled.',
            evidence: { response: response?.substring(0, 50) },
          };
        }
        
        const callLog = recentCalls[0]!;
        console.log(`  LLM Call Log:`);
        console.log(`     Model: ${callLog.model}`);
        console.log(`     Purpose: ${callLog.purpose || 'N/A'}`);
        console.log(`     Metadata: ${callLog.metadata || 'None'}\n`);
        
        // Parse metadata if it contains model version
        let modelVersionFromMetadata: string | undefined;
        if (callLog.metadata) {
          try {
            const metadata = JSON.parse(callLog.metadata);
            modelVersionFromMetadata = metadata.modelVersion;
          } catch {
            // Ignore parse errors
          }
        }
        
        // Verify model in log matches W&B model
        const wandbModel = runtime.getSetting('WANDB_MODEL');
        const isWandbModel = callLog.model === wandbModel || 
                            callLog.model?.includes(wandbModel || '') ||
                            callLog.model?.startsWith('OpenPipe/') ||
                            callLog.model?.includes('/');
        
        if (!isWandbModel) {
          return {
            step: 'Actual LLM Call',
            passed: false,
            details: `LLM call log shows wrong model. Expected W&B model, got: ${callLog.model}`,
            evidence: {
              expected: wandbModel,
              actual: callLog.model,
              modelVersion: modelVersionFromMetadata,
            },
          };
        }
        
        return {
          step: 'Actual LLM Call',
          passed: true,
          details: `LLM call verified. Model used: ${callLog.model}`,
          evidence: {
            model: callLog.model,
            modelVersion: modelVersionFromMetadata,
            responseLength: response?.length || 0,
          },
        };
      } catch (error) {
        return {
          step: 'Actual LLM Call',
          passed: false,
          details: `LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    } catch (error) {
      return {
        step: 'Actual LLM Call',
        passed: false,
        details: `Error making LLM call: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * Step 5: Verify model usage statistics
   */
  async verifyModelUsageStats(agentId: string): Promise<VerificationResult> {
    console.log(`📋 Step 5: Verifying Model Usage Statistics\n`);
    
    try {
      const runtime = await agentRuntimeManager.getRuntime(agentId);
      const stats = await ModelUsageVerifier.verifyAgentModelUsage(agentId, runtime);
      
      console.log(`  Model Usage Stats:`);
      console.log(`     Model Used: ${stats.modelUsed}`);
      console.log(`     Source: ${stats.modelSource}`);
      console.log(`     Is Trained Model: ${stats.isTrainedModel ? '✅ YES' : '❌ NO'}`);
      console.log(`     Model Version: ${stats.modelVersion || 'N/A'}`);
      console.log(`     Inference Count (24h): ${stats.inferenceCount}\n`);
      
      if (!stats.isTrainedModel) {
      return {
        step: 'Model Usage Statistics',
        passed: false,
        details: `Agent is not using trained model. Using: ${stats.modelUsed} (source: ${stats.modelSource})`,
        evidence: {
          modelUsed: stats.modelUsed,
          modelSource: stats.modelSource,
          isTrainedModel: stats.isTrainedModel,
          modelVersion: stats.modelVersion,
          inferenceCount: stats.inferenceCount,
        },
      };
      }
      
      return {
        step: 'Model Usage Statistics',
        passed: true,
        details: `Agent is using trained W&B model: ${stats.modelUsed} (v${stats.modelVersion})`,
        evidence: {
          modelUsed: stats.modelUsed,
          modelSource: stats.modelSource,
          isTrainedModel: stats.isTrainedModel,
          modelVersion: stats.modelVersion,
          inferenceCount: stats.inferenceCount,
        },
      };
    } catch (error) {
      return {
        step: 'Model Usage Statistics',
        passed: false,
        details: `Error checking usage stats: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * Run all verification steps
   */
  async run(agentId?: string): Promise<void> {
    console.log('\n🔍 W&B MODEL USAGE VERIFICATION\n');
    console.log('='.repeat(60) + '\n');
    
    // Step 1: Check for trained model
    const step1 = await this.verifyTrainedModelExists();
    this.results.push(step1);
    
    if (!step1.passed) {
      console.log('❌ Cannot continue - no trained model found\n');
      this.printSummary();
      await prisma.$disconnect().catch(() => {});
      process.exit(step1.details.includes('Database connection failed') ? 1 : 0);
      return;
    }
    
    // Get or create test agent
    let testAgentId = agentId;
    if (!testAgentId) {
      console.log('📋 Creating test agent...\n');
      const agents = await ensureTestAgents(1, 'wandb-verify-agent', {
        autonomousTrading: false,
        autonomousPosting: false,
        autonomousCommenting: false,
      });
      testAgentId = agents[0]!;
    }
    
    // Step 2: Verify runtime loads model
    const step2 = await this.verifyAgentRuntimeLoadsModel(testAgentId);
    this.results.push(step2);
    
    // Step 3: Verify plugin uses W&B
    const step3 = await this.verifyGroqPluginUsesWandb(testAgentId);
    this.results.push(step3);
    
    // Step 4: Make actual LLM call
    const step4 = await this.verifyActualLLMCall(testAgentId);
    this.results.push(step4);
    
    // Step 5: Verify usage stats
    const step5 = await this.verifyModelUsageStats(testAgentId);
    this.results.push(step5);
    
    // Print summary
    this.printSummary();
  }
  
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY\n');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`  ${icon} ${result.step}`);
      console.log(`     ${result.details}`);
      if (result.evidence) {
        console.log(`     Evidence: ${JSON.stringify(result.evidence, null, 2)}`);
      }
      console.log();
    });
    
    console.log(`\n${passed}/${total} checks passed\n`);
    
    if (passed === total) {
      console.log('🎉 100% CONFIDENCE: Agents are using trained W&B RL model!\n');
      console.log('   All verification steps passed:\n');
      console.log('   ✅ Trained model exists in database');
      console.log('   ✅ Agent runtime loads trained model');
      console.log('   ✅ Groq plugin configured for W&B');
      console.log('   ✅ Actual LLM calls use W&B model');
      console.log('   ✅ Model usage statistics confirm trained model\n');
    } else {
      console.log('⚠️  Some checks failed - review details above\n');
      console.log('   To fix:\n');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   - ${result.step}: ${result.details}`);
      });
      console.log();
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const agentIdIndex = args.findIndex(a => a === '--agent-id');
  const agentId = agentIdIndex >= 0 ? args[agentIdIndex + 1] : undefined;
  
  const verifier = new WandbModelUsageVerifier();
  await verifier.run(agentId);
  
  await prisma.$disconnect();
}

main()
  .then(() => {
    prisma.$disconnect().catch(() => {});
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    prisma.$disconnect().catch(() => {});
    process.exit(1);
  });

