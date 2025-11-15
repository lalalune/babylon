/**
 * Debug: Manual Training Trigger
 * 
 * Manually trigger GitHub Actions training workflow for testing.
 * 
 * Security: Only available in development or with admin authentication
 * 
 * Usage:
 *   GET /api/debug/trigger-training
 *   GET /api/debug/trigger-training?force=true (skip readiness check)
 *   GET /api/debug/trigger-training?window=2025-11-15T10:00
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { automationPipeline } from '@/lib/training/AutomationPipeline';
import { logger } from '@/lib/logger';
import { authenticateUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Security: Require authentication in production
    if (process.env.NODE_ENV === 'production') {
      await authenticateUser(request);
      // Note: Admin check can be added here if needed
      // For now, any authenticated user can trigger training in production
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const windowId = searchParams.get('window') || null;
    const batchId = searchParams.get('batch') || `debug-batch-${Date.now()}`;

    logger.info('Debug: Manual training trigger', { force, windowId, batchId }, 'DebugTrainingTrigger');

    // 1. Check readiness (unless forced)
    if (!force) {
      const readiness = await automationPipeline.checkTrainingReadiness();
      
      if (!readiness.ready) {
        return NextResponse.json({
          success: false,
          triggered: false,
          reason: readiness.reason,
          stats: readiness.stats,
          suggestion: 'Add ?force=true to skip readiness check (for testing)'
        }, { status: 400 });
      }
    }

    // 2. Get GitHub credentials
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO; // format: "owner/repo"

    if (!githubToken || !githubRepo) {
      return NextResponse.json({
        success: false,
        error: 'GitHub Actions not configured',
        required: {
          GITHUB_TOKEN: !!githubToken,
          GITHUB_REPO: !!githubRepo
        },
        help: 'Set GITHUB_TOKEN and GITHUB_REPO environment variables'
      }, { status: 500 });
    }

    // 3. Trigger GitHub Actions workflow
    logger.info('Dispatching GitHub Actions workflow', { 
      repo: githubRepo,
      force,
      windowId,
      batchId 
    }, 'DebugTrainingTrigger');

    const dispatchResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Babylon-Training-Trigger'
        },
        body: JSON.stringify({
          event_type: 'trigger-training',
          client_payload: {
            batch_id: batchId,
            window_id: windowId,
            force,
            source: 'debug_endpoint',
            triggered_at: new Date().toISOString()
          }
        })
      }
    );

    if (!dispatchResponse.ok) {
      const errorText = await dispatchResponse.text();
      logger.error('GitHub Actions dispatch failed', {
        status: dispatchResponse.status,
        error: errorText
      }, 'DebugTrainingTrigger');

      return NextResponse.json({
        success: false,
        error: `GitHub API returned ${dispatchResponse.status}`,
        details: errorText,
        help: 'Verify GITHUB_TOKEN has workflow permissions'
      }, { status: 500 });
    }

    logger.info('GitHub Actions workflow dispatched successfully', {
      batchId,
      windowId,
      force
    }, 'DebugTrainingTrigger');

    // Note: GitHub dispatches return 204 No Content on success
    return NextResponse.json({
      success: true,
      triggered: true,
      method: 'github_actions_dispatch',
      batchId,
      windowId: windowId || 'auto-detected',
      force,
      message: 'Training workflow dispatched. Check GitHub Actions tab to monitor progress.',
      links: {
        githubActions: `https://github.com/${githubRepo}/actions/workflows/rl-training.yml`,
        wandbProject: `https://wandb.ai/${process.env.WANDB_ENTITY || 'your-entity'}/${process.env.WANDB_PROJECT || 'babylon-rl'}`
      }
    });

  } catch (error) {
    logger.error('Debug training trigger failed', error, 'DebugTrainingTrigger');
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

