/**
 * Admin API: Resume All Agents
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(_req: NextRequest) {
  try {
    // Resume all agents with sufficient points
    const result = await prisma.user.updateMany({
      where: {
        isAgent: true,
        agentPointsBalance: { gte: 1 }, // Only resume agents with points
      },
      data: {
        autonomousTrading: true,
        autonomousPosting: true,
        autonomousCommenting: true,
        agentStatus: 'running',
      },
    });

    logger.info(`Resumed ${result.count} autonomous agents`, undefined, 'AdminAgentsAPI');

    return NextResponse.json({
      success: true,
      message: `Resumed ${result.count} agents`,
      data: {
        resumed: result.count,
      },
    });
  } catch (error) {
    logger.error('Failed to resume all agents', { error }, 'AdminAgentsAPI');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to resume all agents',
      },
      { status: 500 }
    );
  }
}



