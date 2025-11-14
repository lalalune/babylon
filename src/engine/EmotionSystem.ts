/**
 * Emotion System for Babylon
 * Translates numeric mood values to emotional states (madlibs style)
 */

import type { ActorRelationship, ActorConnection } from '@/shared/types';

export interface EmotionalState {
  emotion: string;
  intensity: string;
  description: string;
}

/**
 * Convert mood value (-1 to 1) to emotional state
 */
export function moodToEmotion(mood: number): EmotionalState {
  // Clamp mood to valid range
  const clampedMood = Math.max(-1, Math.min(1, mood));
  
  // Determine intensity based on absolute value
  const absValue = Math.abs(clampedMood);
  let intensity: string;
  if (absValue < 0.3) intensity = 'slightly';
  else if (absValue < 0.6) intensity = 'moderately';
  else intensity = 'extremely';
  
  // Determine emotion based on value and sign
  let emotion: string;
  let description: string;
  
  if (clampedMood >= 0.7) {
    emotion = 'euphoric';
    description = 'overjoyed, excited, optimistic';
  } else if (clampedMood >= 0.4) {
    emotion = 'happy';
    description = 'pleased, content, positive';
  } else if (clampedMood >= 0.1) {
    emotion = 'content';
    description = 'satisfied, calm, neutral-positive';
  } else if (clampedMood >= -0.1) {
    emotion = 'neutral';
    description = 'balanced, indifferent, stable';
  } else if (clampedMood >= -0.4) {
    emotion = 'annoyed';
    description = 'irritated, bothered, slightly negative';
  } else if (clampedMood >= -0.7) {
    emotion = 'upset';
    description = 'frustrated, disappointed, negative';
  } else {
    emotion = 'furious';
    description = 'enraged, deeply negative, volatile';
  }
  
  return {
    emotion,
    intensity,
    description,
  };
}

/**
 * Get relationship modifier for responses
 * Returns: { modifier: string, sentiment: number }
 */
export function getRelationshipModifier(relationship: string): {
  modifier: string;
  sentimentBonus: number;
} {
  const relationshipMap: Record<string, { modifier: string; sentimentBonus: number }> = {
    'ally': { modifier: 'supportive and positive', sentimentBonus: 0.3 },
    'friend': { modifier: 'friendly and warm', sentimentBonus: 0.4 },
    'advisor': { modifier: 'helpful and constructive', sentimentBonus: 0.2 },
    'source': { modifier: 'informative but cautious', sentimentBonus: 0.1 },
    'neutral': { modifier: 'balanced and objective', sentimentBonus: 0 },
    'critic': { modifier: 'skeptical and questioning', sentimentBonus: -0.2 },
    'rival': { modifier: 'competitive and challenging', sentimentBonus: -0.3 },
    'enemy': { modifier: 'hostile and antagonistic', sentimentBonus: -0.5 },
    'hates': { modifier: 'deeply negative and dismissive', sentimentBonus: -0.6 },
  };
  
  return relationshipMap[relationship.toLowerCase()] || relationshipMap['neutral']!;
}

/**
 * Convert luck level to description
 */
export function luckToDescription(luck: 'low' | 'medium' | 'high'): string {
  const luckMap = {
    'low': 'things going wrong, unlucky streak',
    'medium': 'normal circumstances, balanced luck',
    'high': 'things going well, lucky streak',
  };
  
  return luckMap[luck];
}

/**
 * Generate context string for LLM prompts including mood, luck, and relationships
 * Supports both ActorRelationship (new) and ActorConnection (legacy) formats
 */
export function generateActorContext(
  mood: number,
  luck: 'low' | 'medium' | 'high',
  targetActorId?: string,
  relationships?: ActorRelationship[] | ActorConnection[],
  actorId?: string
): string {
  const emotional = moodToEmotion(mood);
  const luckDesc = luckToDescription(luck);
  
  let context = `Current mood: ${emotional.intensity} ${emotional.emotion} (${emotional.description})
Current luck: ${luckDesc}`;
  
  // Add relationship context if responding to specific actor
  if (targetActorId && actorId && relationships && relationships.length > 0) {
    // Check if it's the new ActorRelationship format or legacy ActorConnection format
    const firstItem = relationships[0];
    if (!firstItem) {
      return context;
    }
    
    const isNewFormat = 'actor1Id' in firstItem;
    
    if (isNewFormat) {
      // New format: ActorRelationship
      const relationship = (relationships as ActorRelationship[]).find(
        r => (r.actor1Id === actorId && r.actor2Id === targetActorId) ||
             (r.actor2Id === actorId && r.actor1Id === targetActorId)
      );
      
      if (relationship) {
        const relMod = getRelationshipModifier(relationship.relationshipType);
        context += `
Relationship with ${targetActorId}: ${relationship.relationshipType} - be ${relMod.modifier}
Context: ${relationship.history || 'No additional context'}`;
      }
    } else {
      // Legacy format: ActorConnection
      const relationship = (relationships as ActorConnection[]).find(
        r => (r.actor1 === actorId && r.actor2 === targetActorId) ||
             (r.actor2 === actorId && r.actor1 === targetActorId)
      );
      
      if (relationship) {
        const relMod = getRelationshipModifier(relationship.relationship);
        context += `
Relationship with ${targetActorId}: ${relationship.relationship} - be ${relMod.modifier}
Context: ${relationship.context}`;
      }
    }
  }
  
  return context;
}

