/**
 * Admin API: Emergency Pause All Agents
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(_req: NextRequest) {
  try {
    // Pause ALL autonomous agents immediately
    const result = await prisma.user.updateMany({
      where: {
        isAgent: true,
      },
      data: {
        autonomousTrading: false,
        autonomousPosting: false,
        autonomousCommenting: false,
        autonomousDMs: false,
        autonomousGroupChats: false,
        agentStatus: 'paused',
      },
    });

    logger.warn(`EMERGENCY: Paused ${result.count} autonomous agents`, undefined, 'AdminAgentsAPI');

    return NextResponse.json({
      success: true,
      message: `Paused ${result.count} agents`,
      data: {
        paused: result.count,
      },
    });
  } catch (error) {
    logger.error('Failed to pause all agents', { error }, 'AdminAgentsAPI');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to pause all agents',
      },
      { status: 500 }
    );
  }
}



