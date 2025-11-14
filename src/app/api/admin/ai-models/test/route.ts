/**
 * Test endpoint for AI model configuration
 * Verifies that wandb integration is working correctly
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { BabylonLLMClient } from '@/generator/llm/openai-client';
import { getWandbModel } from '@/lib/ai-model-config';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/ai-models/test
 * Tests the current AI model configuration with a simple completion
 */
export async function POST(_req: NextRequest) {
  try {
    // Load wandb model from config
    const wandbModel = await getWandbModel();
    
    // Initialize client
    const client = new BabylonLLMClient(undefined, wandbModel);
    const stats = client.getStats();
    
    logger.info('Testing AI model', { 
      provider: stats.provider, 
      model: stats.model 
    }, 'AIModelsTest');

    // Simple test prompt
    const testPrompt = `Generate a brief test response (max 50 chars) confirming you're working.

Return your response as XML in this exact format:
<response>
  <message>your test message here</message>
  <status>ok</status>
</response>`;

    const startTime = Date.now();
    
    // Make test call
    const rawResponse = await client.generateJSON<{ message: string; status: string } | { response: { message: string; status: string } }>(
      testPrompt,
      {
        properties: {
          message: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['message', 'status'],
      },
      {
        temperature: 0.7,
        maxTokens: 100,
      }
    );
    
    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { message: string; status: string };

    const latency = Date.now() - startTime;

    logger.info('AI model test successful', { 
      provider: stats.provider,
      model: stats.model,
      latency,
      response 
    }, 'AIModelsTest');

    return NextResponse.json({
      success: true,
      data: {
        provider: stats.provider,
        model: stats.model,
        wandbModelConfigured: wandbModel || null,
        response: response,
        latency,
        timestamp: new Date().toISOString(),
      },
      message: `Successfully tested ${stats.provider} (model: ${stats.model})`,
    });
  } catch (error) {
    logger.error('AI model test failed', { error }, 'AIModelsTest');
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}

