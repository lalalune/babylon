#!/usr/bin/env bun
/**
 * Generate Relationships for Actors
 * 
 * Creates realistic relationships between all actors based on:
 * - Shared affiliations (same organizations)
 * - Tier compatibility (similar tiers more likely to interact)
 * - Domain overlap (same industry sectors)
 * - Personality compatibility
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadActorsData } from '../src/lib/data/actors-loader';
import type { ActorData } from '../src/shared/types';

interface Relationship {
  actor1Id: string;
  actor2Id: string;
  relationshipType: string;
  strength: number; // 0.0 to 1.0
  sentiment: number; // -1.0 to 1.0
  history: string;
  actor1FollowsActor2: boolean;
  actor2FollowsActor1: boolean;
}

const RELATIONSHIP_TYPES = {
  // Hierarchical
  MENTOR_STUDENT: 'mentor-student',
  INDUSTRY_LEADER_FOLLOWER: 'industry-leader-follower',
  INFLUENCER_FAN: 'influencer-fan',
  // Collaborative
  ALLIES: 'allies',
  COLLABORATORS: 'collaborators',
  CO_FOUNDERS: 'co-founders',
  BUSINESS_PARTNERS: 'business-partners',
  // Competitive
  RIVALS: 'rivals',
  COMPETITORS: 'competitors',
  FRENEMIES: 'frenemies',
  // Critical
  CRITIC_SUBJECT: 'critic-subject',
  WATCHDOG_TARGET: 'watchdog-target',
  REGULATOR_REGULATED: 'regulator-regulated',
  // Social
  FRIENDS: 'friends',
  ACQUAINTANCES: 'acquaintances',
  FORMER_COLLEAGUES: 'former-colleagues',
} as const;

/**
 * Calculate compatibility score between two actors
 */
function calculateCompatibility(actor1: ActorData, actor2: ActorData): number {
  let score = 0;
  
  // Shared affiliations increase compatibility
  const sharedOrgs = actor1.affiliations?.filter(org => 
    actor2.affiliations?.includes(org)
  ) || [];
  score += sharedOrgs.length * 0.3;
  
  // Shared domains increase compatibility
  const sharedDomains = actor1.domain?.filter(d => 
    actor2.domain?.includes(d)
  ) || [];
  score += sharedDomains.length * 0.2;
  
  // Similar tiers more likely to interact
  const tier1 = actor1.tier || 'C_TIER';
  const tier2 = actor2.tier || 'C_TIER';
  const tierMap: Record<string, number> = { 'S_TIER': 5, 'A_TIER': 4, 'B_TIER': 3, 'C_TIER': 2, 'D_TIER': 1 };
  const tierDiff = Math.abs((tierMap[tier1] || 2) - (tierMap[tier2] || 2));
  score += Math.max(0, 0.3 - tierDiff * 0.1);
  
  return Math.min(1.0, score);
}

/**
 * Determine relationship type based on context
 */
function determineRelationshipType(actor1: ActorData, actor2: ActorData, compatibility: number): string {
  const tier1 = actor1.tier || 'C_TIER';
  const tier2 = actor2.tier || 'C_TIER';
  const tierMap: Record<string, number> = { 'S_TIER': 5, 'A_TIER': 4, 'B_TIER': 3, 'C_TIER': 2, 'D_TIER': 1 };
  const tier1Num = tierMap[tier1] || 2;
  const tier2Num = tierMap[tier2] || 2;
  
  // Shared affiliations suggest collaboration
  const sharedOrgs = actor1.affiliations?.filter(org => 
    actor2.affiliations?.includes(org)
  )?.length || 0;
  
  // Tier difference suggests hierarchy
  const tierDiff = tier1Num - tier2Num;
  
  if (tierDiff >= 2) {
    return RELATIONSHIP_TYPES.INDUSTRY_LEADER_FOLLOWER;
  } else if (tierDiff <= -2) {
    return RELATIONSHIP_TYPES.INFLUENCER_FAN;
  } else if (sharedOrgs > 0) {
    if (compatibility > 0.7) return RELATIONSHIP_TYPES.ALLIES;
    if (compatibility > 0.5) return RELATIONSHIP_TYPES.BUSINESS_PARTNERS;
    return RELATIONSHIP_TYPES.ACQUAINTANCES;
  } else if (compatibility > 0.6) {
    return Math.random() > 0.5 ? RELATIONSHIP_TYPES.FRIENDS : RELATIONSHIP_TYPES.ALLIES;
  } else if (compatibility < 0.3) {
    return Math.random() > 0.5 ? RELATIONSHIP_TYPES.RIVALS : RELATIONSHIP_TYPES.COMPETITORS;
  } else {
    return RELATIONSHIP_TYPES.ACQUAINTANCES;
  }
}

/**
 * Generate relationship history
 */
function generateHistory(actor1: ActorData, actor2: ActorData, relType: string): string {
  const domain1 = actor1.domain?.[0] || 'industry';
  const domain2 = actor2.domain?.[0] || 'industry';
  
  const sharedOrgs = actor1.affiliations?.filter(org => 
    actor2.affiliations?.includes(org)
  ) || [];
  
  if (sharedOrgs.length > 0) {
    return `Both involved with ${sharedOrgs[0]} in ${domain1}`;
  }
  
  switch (relType) {
    case RELATIONSHIP_TYPES.RIVALS:
    case RELATIONSHIP_TYPES.COMPETITORS:
      return `Competing in ${domain1} and ${domain2}`;
    case RELATIONSHIP_TYPES.ALLIES:
    case RELATIONSHIP_TYPES.COLLABORATORS:
      return `Collaborating across ${domain1} and ${domain2}`;
    case RELATIONSHIP_TYPES.INDUSTRY_LEADER_FOLLOWER:
      return `${actor1.name} is established leader, ${actor2.name} follows their work`;
    default:
      return `Professional relationship in ${domain1}`;
  }
}

/**
 * Create relationship file name (alphabetical order)
 */
function createRelationshipFileName(id1: string, id2: string): string {
  const ids = [id1, id2].sort();
  return `${ids[0]}_${ids[1]}.json`;
}

async function main() {
  console.log('Generating actor relationships...\n');
  
  // Load actors data
  const actorsData = loadActorsData();
  const actors = actorsData.actors;
  
  console.log(`Loaded ${actors.length} actors`);
  
  // Create relationships directory
  const relationshipsDir = join(process.cwd(), 'public', 'data', 'relationships');
  if (!existsSync(relationshipsDir)) {
    mkdirSync(relationshipsDir, { recursive: true });
  }
  
  const relationships: Relationship[] = [];
  const relationshipReferences: Array<{ id: string; file: string }> = [];
  
  // Generate relationships between actors
  let totalGenerated = 0;
  
  for (let i = 0; i < actors.length; i++) {
    const actor1 = actors[i]!;
    
    // Each actor gets 3-8 relationships
    const numRelationships = 3 + Math.floor(Math.random() * 6);
    const potentialPartners = actors.filter((_a, idx) => idx !== i);
    
    // Shuffle and take top candidates by compatibility
    const shuffled = potentialPartners.sort(() => Math.random() - 0.5);
    const candidates = shuffled.slice(0, numRelationships * 2);
    
    // Calculate compatibility and select best matches
    const scored = candidates.map(actor2 => ({
      actor2,
      compatibility: calculateCompatibility(actor1, actor2)
    })).sort((a, b) => b.compatibility - a.compatibility);
    
    const partners = scored.slice(0, numRelationships).map(s => s.actor2);
    
    for (const actor2 of partners) {
      // Skip if relationship already exists (bidirectional)
      if (relationships.find(r => 
        (r.actor1Id === actor1.id && r.actor2Id === actor2.id) ||
        (r.actor1Id === actor2.id && r.actor2Id === actor1.id)
      )) {
        continue;
      }
      
      const compatibility = calculateCompatibility(actor1, actor2);
      const relType = determineRelationshipType(actor1, actor2, compatibility);
      
      // Determine sentiment based on relationship type
      let sentiment = compatibility - 0.5; // -0.5 to 0.5
      if (relType.includes('rival') || relType.includes('competitor')) {
        sentiment = -0.3 - Math.random() * 0.4; // -0.3 to -0.7
      } else if (relType.includes('friend') || relType.includes('ally')) {
        sentiment = 0.3 + Math.random() * 0.5; // 0.3 to 0.8
      }
      
      // Determine follow direction based on relationship type
      let actor1FollowsActor2 = false;
      let actor2FollowsActor1 = false;
      
      if (relType === RELATIONSHIP_TYPES.MENTOR_STUDENT) {
        actor2FollowsActor1 = true; // Student follows mentor
      } else if (relType === RELATIONSHIP_TYPES.INDUSTRY_LEADER_FOLLOWER || relType === RELATIONSHIP_TYPES.INFLUENCER_FAN) {
        actor2FollowsActor1 = true; // Follower/fan follows leader
      } else if (relType === RELATIONSHIP_TYPES.ALLIES || relType === RELATIONSHIP_TYPES.FRIENDS || relType === RELATIONSHIP_TYPES.COLLABORATORS) {
        actor1FollowsActor2 = true;
        actor2FollowsActor1 = true; // Mutual follow
      } else if (relType === RELATIONSHIP_TYPES.RIVALS || relType === RELATIONSHIP_TYPES.COMPETITORS) {
        // Rivals follow each other to keep tabs
        const shouldFollow = Math.random() > 0.3;
        actor1FollowsActor2 = shouldFollow;
        actor2FollowsActor1 = shouldFollow;
      } else {
        // Default: follow if positive sentiment
        const shouldFollow = sentiment > 0.3;
        actor1FollowsActor2 = shouldFollow;
        actor2FollowsActor1 = shouldFollow;
      }
      
      // Sort IDs alphabetically for consistent ordering
      const ids = [actor1.id, actor2.id].sort();
      const sortedActor1Id = ids[0]!;
      const sortedActor2Id = ids[1]!;
      
      // Determine which original actor is which in the sorted order
      const isActor1First = actor1.id === sortedActor1Id;
      
      const relationship: Relationship = {
        actor1Id: sortedActor1Id,
        actor2Id: sortedActor2Id,
        relationshipType: relType,
        strength: compatibility,
        sentiment,
        history: generateHistory(actor1, actor2, relType),
        // Swap follow flags if actors were swapped
        actor1FollowsActor2: isActor1First ? actor1FollowsActor2 : actor2FollowsActor1,
        actor2FollowsActor1: isActor1First ? actor2FollowsActor1 : actor1FollowsActor2,
      };
      
      relationships.push(relationship);
      
      // Create file name (alphabetical order)
      const fileName = createRelationshipFileName(sortedActor1Id, sortedActor2Id);
      const filePath = join(relationshipsDir, fileName);
      
      // Write individual relationship file
      writeFileSync(filePath, JSON.stringify(relationship, null, 2));
      
      // Add reference
      const relId = fileName.replace('.json', '');
      relationshipReferences.push({
        id: relId,
        file: `./relationships/${fileName}`
      });
      
      totalGenerated++;
    }
  }
  
  console.log(`\n✓ Generated ${totalGenerated} relationships`);
  console.log(`✓ Created ${totalGenerated} relationship files`);
  
  // Update actors.json to include relationships
  const indexPath = join(process.cwd(), 'public', 'data', 'actors.json');
  const index = JSON.parse(require('fs').readFileSync(indexPath, 'utf-8'));
  
  index.relationships = relationshipReferences;
  
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`✓ Updated actors.json with relationships section`);
  
  console.log('\nRelationship statistics:');
  console.log(`  Total relationships: ${relationships.length}`);
  console.log(`  Avg per actor: ${(relationships.length * 2 / actors.length).toFixed(1)}`);
  
  const byType: Record<string, number> = {};
  relationships.forEach(r => {
    byType[r.relationshipType] = (byType[r.relationshipType] || 0) + 1;
  });
  
  console.log('\nBy type:');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\nDone! Rebuild actors-full.json with:');
  console.log('  bun run scripts/build-actors-json.ts');
}

main().catch(console.error);

