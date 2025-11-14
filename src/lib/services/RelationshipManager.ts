/**
 * Relationship Manager Service
 * 
 * Handles all actor relationship logic including:
 * - Relationship queries and lookups
 * - Follow relationship management
 * - Relationship context for LLM prompts
 * - Related actor selection for events and content
 */

import { prisma } from '@/lib/database-service';
import type { Actor, ActorRelationship, ActorTier, RELATIONSHIP_TYPES } from '@/shared/types';
import type { Prisma } from '@prisma/client';

/**
 * Relationship context for LLM prompts
 */
export interface RelationshipContext {
  actorId: string;
  relationships: Array<{
    otherActorId: string;
    otherActorName: string;
    type: string;
    strength: number;
    sentiment: number;
    history?: string;
  }>;
  contextString: string;
}

/**
 * Relationship statistics for an actor
 */
export interface RelationshipStats {
  actorId: string;
  followerCount: number;
  followingCount: number;
  mutualFollowCount: number;
  relationshipCount: number;
  relationshipsByType: Record<string, number>;
}

export class RelationshipManager {
  /**
   * Get all relationships for an actor
   */
  static async getActorRelationships(actorId: string): Promise<ActorRelationship[]> {
    const relationships = await prisma.actorRelationship.findMany({
      where: {
        OR: [
          { actor1Id: actorId },
          { actor2Id: actorId },
        ],
      },
      include: {
        actor1: {
          select: {
            id: true,
            name: true,
            tier: true,
            domain: true,
          },
        },
        actor2: {
          select: {
            id: true,
            name: true,
            tier: true,
            domain: true,
          },
        },
      },
    });

    return relationships.map(rel => ({
      id: rel.id,
      actor1Id: rel.actor1Id,
      actor2Id: rel.actor2Id,
      relationshipType: rel.relationshipType as typeof RELATIONSHIP_TYPES[keyof typeof RELATIONSHIP_TYPES],
      strength: rel.strength,
      sentiment: rel.sentiment,
      isPublic: rel.isPublic,
      history: rel.history || undefined,
      affects: rel.affects as Record<string, number> | undefined,
      createdAt: rel.createdAt,
      updatedAt: rel.updatedAt,
    }));
  }

  /**
   * Get specific relationship between two actors
   */
  static async getRelationship(
    actor1Id: string,
    actor2Id: string
  ): Promise<ActorRelationship | null> {
    const relationship = await prisma.actorRelationship.findFirst({
      where: {
        OR: [
          { actor1Id, actor2Id },
          { actor1Id: actor2Id, actor2Id: actor1Id },
        ],
      },
    });

    if (!relationship) return null;

    return {
      id: relationship.id,
      actor1Id: relationship.actor1Id,
      actor2Id: relationship.actor2Id,
      relationshipType: relationship.relationshipType as typeof RELATIONSHIP_TYPES[keyof typeof RELATIONSHIP_TYPES],
      strength: relationship.strength,
      sentiment: relationship.sentiment,
      isPublic: relationship.isPublic,
      history: relationship.history || undefined,
      affects: relationship.affects as Record<string, number> | undefined,
      createdAt: relationship.createdAt,
      updatedAt: relationship.updatedAt,
    };
  }

  /**
   * Get actors that this actor follows
   */
  static async getFollowing(actorId: string): Promise<Array<Actor & { followedAt: Date }>> {
    const follows = await prisma.actorFollow.findMany({
      where: {
        followerId: actorId,
      },
      include: {
        following: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return follows.map(f => ({
      ...this.mapActorFromPrisma(f.following),
      followedAt: f.createdAt,
    }));
  }

  /**
   * Get actors that follow this actor
   */
  static async getFollowers(actorId: string): Promise<Array<Actor & { followedAt: Date }>> {
    const follows = await prisma.actorFollow.findMany({
      where: {
        followingId: actorId,
      },
      include: {
        follower: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return follows.map(f => ({
      ...this.mapActorFromPrisma(f.follower),
      followedAt: f.createdAt,
    }));
  }

  /**
   * Check if actor1 follows actor2
   */
  static async isFollowing(actor1Id: string, actor2Id: string): Promise<boolean> {
    const follow = await prisma.actorFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: actor1Id,
          followingId: actor2Id,
        },
      },
    });

    return follow !== null;
  }

  /**
   * Get relationship context for LLM prompts
   */
  static async getRelationshipContext(
    actorId: string,
    relevantActorIds: string[]
  ): Promise<RelationshipContext> {
    if (relevantActorIds.length === 0) {
      return {
        actorId,
        relationships: [],
        contextString: '',
      };
    }

    const relationships = await prisma.actorRelationship.findMany({
      where: {
        OR: [
          {
            actor1Id: actorId,
            actor2Id: { in: relevantActorIds },
          },
          {
            actor1Id: { in: relevantActorIds },
            actor2Id: actorId,
          },
        ],
      },
      include: {
        actor1: {
          select: {
            id: true,
            name: true,
          },
        },
        actor2: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const relationshipData = relationships.map(rel => {
      const isActor1 = rel.actor1Id === actorId;
      const otherActor = isActor1 ? rel.actor2 : rel.actor1;

      return {
        otherActorId: otherActor.id,
        otherActorName: otherActor.name,
        type: rel.relationshipType,
        strength: rel.strength,
        sentiment: rel.sentiment,
        history: rel.history || undefined,
      };
    });

    const contextString = this.formatRelationshipContext(relationshipData);

    return {
      actorId,
      relationships: relationshipData,
      contextString,
    };
  }

  /**
   * Format relationship context for LLM prompts
   */
  private static formatRelationshipContext(
    relationships: Array<{
      otherActorName: string;
      type: string;
      strength: number;
      sentiment: number;
      history?: string;
    }>
  ): string {
    if (relationships.length === 0) return '';

    const lines = relationships.map(rel => {
      const sentimentDesc =
        rel.sentiment > 0.5
          ? 'respect them'
          : rel.sentiment < -0.5
          ? 'have beef with them'
          : 'neutral toward them';

      const strengthDesc =
        rel.strength > 0.7 ? 'strong' : rel.strength > 0.4 ? 'moderate' : 'weak';

      let line = `- ${strengthDesc} ${rel.type} with ${rel.otherActorName} (you ${sentimentDesc})`;

      if (rel.history) {
        line += `: ${rel.history}`;
      }

      return line;
    });

    return lines.join('\n');
  }

  /**
   * Get related actors for events and content generation
   */
  static async getRelatedActors(
    actorId: string,
    count: number,
    relationshipTypes?: string[]
  ): Promise<Actor[]> {
    const whereClause: Prisma.ActorRelationshipWhereInput = {
      OR: [{ actor1Id: actorId }, { actor2Id: actorId }],
    };

    if (relationshipTypes && relationshipTypes.length > 0) {
      whereClause.relationshipType = { in: relationshipTypes };
    }

    const query: Prisma.ActorRelationshipFindManyArgs = {
      where: whereClause,
      include: {
        actor1: true,
        actor2: true,
      },
      orderBy: [
        { strength: 'desc' },
        { sentiment: 'desc' },
      ],
      take: count * 2,
    };

    const relationships = await prisma.actorRelationship.findMany(query);

    const relatedActorIds = relationships.map(rel => 
      rel.actor1Id === actorId ? rel.actor2Id : rel.actor1Id
    );
    
    // Fetch full actor details
    const relatedActors = await prisma.actor.findMany({
      where: { id: { in: relatedActorIds } },
    });

    // Remove duplicates and limit to count
    const uniqueActors = Array.from(new Set(relatedActors.map(a => a.id)))
      .map(id => relatedActors.find(a => a.id === id)!)
      .slice(0, count);

    return uniqueActors.map(a => this.mapActorFromPrisma(a));
  }

  /**
   * Get relationship statistics for an actor
   */
  static async getRelationshipStats(actorId: string): Promise<RelationshipStats> {
    const [
      followerCount,
      followingCount,
      mutualFollowCount,
      relationships,
    ] = await Promise.all([
      prisma.actorFollow.count({
        where: { followingId: actorId },
      }),
      prisma.actorFollow.count({
        where: { followerId: actorId },
      }),
      prisma.actorFollow.count({
        where: { followingId: actorId, isMutual: true },
      }),
      prisma.actorRelationship.findMany({
        where: {
          OR: [{ actor1Id: actorId }, { actor2Id: actorId }],
        },
        select: {
          relationshipType: true,
        },
      }),
    ]);

    const relationshipsByType: Record<string, number> = {};
    relationships.forEach(rel => {
      relationshipsByType[rel.relationshipType] =
        (relationshipsByType[rel.relationshipType] || 0) + 1;
    });

    return {
      actorId,
      followerCount,
      followingCount,
      mutualFollowCount,
      relationshipCount: relationships.length,
      relationshipsByType,
    };
  }

  /**
   * Get actors with no followers (for verification/fixing)
   */
  static async getActorsWithNoFollowers(): Promise<Actor[]> {
    const actors = await prisma.actor.findMany({
      include: {
        followedBy: true,
      },
    });

    const actorsWithNoFollowers = actors.filter(a => a.followedBy.length === 0);

    return actorsWithNoFollowers.map(a => this.mapActorFromPrisma(a));
  }

  /**
   * Get relationship behavioral modifiers
   */
  static getRelationshipModifiers(relationship: ActorRelationship): {
    mentionLikelihood: number;
    postFrequency: number;
    supportLikelihood: number;
    attackLikelihood: number;
  } {
    const affects = relationship.affects || {};

    // Default modifiers based on relationship type and sentiment
    const baseModifiers = {
      mentionLikelihood: Math.abs(relationship.sentiment) * relationship.strength,
      postFrequency: relationship.strength * 0.5,
      supportLikelihood: Math.max(0, relationship.sentiment) * relationship.strength,
      attackLikelihood: Math.max(0, -relationship.sentiment) * relationship.strength,
    };

    // Apply custom modifiers from relationship
    return {
      mentionLikelihood: affects.mentionLikelihood ?? baseModifiers.mentionLikelihood,
      postFrequency: affects.postFrequency ?? baseModifiers.postFrequency,
      supportLikelihood: affects.supportLikelihood ?? baseModifiers.supportLikelihood,
      attackLikelihood: affects.attackLikelihood ?? baseModifiers.attackLikelihood,
    };
  }

  /**
   * Map Prisma actor to shared Actor type
   */
  private static mapActorFromPrisma(prismaActor: {
    id: string;
    name: string;
    description?: string | null;
    domain: string[];
    personality?: string | null;
    role?: string | null;
    affiliations: string[];
    postStyle?: string | null;
    postExample: string[];
    tier?: string | null;
    initialLuck?: string;
    initialMood?: number;
    hasPool?: boolean;
    tradingBalance?: unknown;
    reputationPoints?: number;
    profileImageUrl?: string | null;
  }): Actor {
    return {
      id: prismaActor.id,
      name: prismaActor.name,
      description: prismaActor.description || undefined,
      domain: prismaActor.domain || [],
      personality: prismaActor.personality || undefined,
      role: prismaActor.role || undefined,
      affiliations: prismaActor.affiliations || [],
      postStyle: prismaActor.postStyle || undefined,
      postExample: prismaActor.postExample || [],
      tier: (prismaActor.tier as ActorTier | null) || undefined,
      initialLuck: (prismaActor.initialLuck as 'low' | 'medium' | 'high' | null) || undefined,
      initialMood: prismaActor.initialMood ?? undefined,
      hasPool: prismaActor.hasPool || undefined,
      tradingBalance: prismaActor.tradingBalance
        ? Number(prismaActor.tradingBalance)
        : undefined,
      reputationPoints: prismaActor.reputationPoints || undefined,
      profileImageUrl: prismaActor.profileImageUrl || undefined,
    };
  }
}

