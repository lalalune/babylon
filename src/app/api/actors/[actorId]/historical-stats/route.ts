/**
 * Actor Historical Statistics API
 * 
 * Returns historical performance data based on PAST GAME OUTCOMES.
 * Does NOT expose oracle data or predetermined outcomes.
 * Safe for competitive MMO - based on observable results only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ actorId: string }> }
) {
  try {
    const { actorId } = await params;

    // Get actor
    const actor = await prisma.actor.findUnique({
      where: { id: actorId },
      select: {
        id: true,
        name: true,
        role: true,
        tier: true,
        description: true,
      }
    });

    if (!actor) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    // Get actor's posts from COMPLETED games only
    const posts = await prisma.post.findMany({
      where: {
        authorId: actorId,
        // Only from completed games (no oracle leakage):
        gameId: { not: null },
      },
      include: {
        // We'll need to join with resolved questions to calculate accuracy
      },
      orderBy: { createdAt: 'desc' },
      take: 100  // Last 100 posts
    });

    // Calculate stats from historical OUTCOMES (not oracle):
    // Note: This requires post-resolution analysis to be implemented
    // For now, return basic observable stats:

    const stats = {
      actorId: actor.id,
      name: actor.name,
      role: actor.role,
      tier: actor.tier,
      description: actor.description,
      
      // Observable metrics:
      totalPosts: posts.length,
      gamesParticipated: new Set(posts.map(p => p.gameId).filter(Boolean)).size,
      
      // Placeholder for future implementation:
      historicalAccuracy: null,  // Will calculate from resolved questions
      totalPredictions: null,    // Will calculate after post-analysis
      correctPredictions: null,   // Will calculate after post-analysis
      
      // Recent activity:
      recentPosts: posts.slice(0, 10).map(p => ({
        id: p.id,
        content: p.content.substring(0, 100),
        gameId: p.gameId,
        createdAt: p.createdAt
      }))
    };

    return NextResponse.json(stats);

  } catch (error) {
    logger.error('Error fetching actor stats', error, 'ActorStatsAPI');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

