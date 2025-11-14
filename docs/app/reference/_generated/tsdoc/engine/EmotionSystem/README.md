[**babylon v0.1.0**](../../README.md)

***

[babylon](../../README.md) / engine/EmotionSystem

# engine/EmotionSystem

Emotion System for Babylon

## Description

Translates numeric mood values and luck levels into rich emotional descriptions
for LLM prompts. Creates context strings that influence how NPCs react to events
and generate social media posts.

**Key Features:**
- Mood-to-emotion mapping with intensity levels
- Luck descriptions affecting NPC behavior
- Relationship modifiers for inter-NPC interactions
- Context generation for LLM prompts

**Used By:**
- FeedGenerator: Adds emotional context to post generation
- GameEngine: Updates mood based on events and trading outcomes
- MarketDecisionEngine: Influences NPC trading decisions

## Example

```typescript
import { moodToEmotion, generateActorContext } from './EmotionSystem';

const state = moodToEmotion(0.8); // Very positive
// => { emotion: 'euphoric', intensity: 'extremely', description: 'overjoyed, excited, optimistic' }

const context = generateActorContext(0.8, 'high', 'actor-2', relationships, 'actor-1');
// => "Current mood: extremely euphoric (overjoyed, excited, optimistic)\n..."
```

## Functions

- [moodToEmotion](functions/moodToEmotion.md)
- [getRelationshipModifier](functions/getRelationshipModifier.md)
- [luckToDescription](functions/luckToDescription.md)
- [generateActorContext](functions/generateActorContext.md)

## Interfaces

- [EmotionalState](interfaces/EmotionalState.md)
