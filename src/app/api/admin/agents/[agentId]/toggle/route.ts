/**
 * Admin API: Toggle Agent Autonomous Mode
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await context.params;
    const body = await req.json();
    const { enabled } = body;

    // Toggle all autonomous features
    await prisma.user.update({
      where: { id: agentId, isAgent: true },
      data: {
        autonomousTrading: enabled,
        autonomousPosting: enabled,
        autonomousCommenting: enabled,
        autonomousDMs: enabled,
        autonomousGroupChats: enabled,
        agentStatus: enabled ? 'running' : 'paused',
      },
    });

    logger.info(`Agent ${agentId} autonomous mode ${enabled ? 'enabled' : 'disabled'}`, undefined, 'AdminAgentsAPI');

    return NextResponse.json({
      success: true,
      message: `Agent ${enabled ? 'enabled' : 'paused'} successfully`,
    });
  } catch (error) {
    logger.error('Failed to toggle agent', { error }, 'AdminAgentsAPI');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to toggle agent',
      },
      { status: 500 }
    );
  }
}



