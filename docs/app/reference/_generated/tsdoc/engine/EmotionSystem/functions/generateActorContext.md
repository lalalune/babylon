[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/EmotionSystem](../README.md) / generateActorContext

# Function: generateActorContext()

> **generateActorContext**(`mood`, `luck`, `targetActorId?`, `relationships?`, `actorId?`): `string`

Defined in: [src/engine/EmotionSystem.ts:268](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/EmotionSystem.ts#L268)

Generate complete emotional context string for LLM prompts

## Parameters

### mood

`number`

Numeric mood value from -1 to 1

### luck

Luck level ('low', 'medium', or 'high')

`"medium"` | `"low"` | `"high"`

### targetActorId?

`string`

Optional ID of actor being responded to or referenced

### relationships?

Optional array of actor relationships (supports both formats)

[`ActorRelationship`](../../FeedGenerator/interfaces/ActorRelationship.md)[] | `ActorConnection`[]

### actorId?

`string`

ID of the actor generating content (required if targetActorId provided)

## Returns

`string`

Formatted context string for LLM prompt injection

## Description

Creates a rich context string combining mood, luck, and relationship information
for use in LLM prompts. This context influences how NPCs generate posts, chat
messages, and react to events.

**Features:**
- Converts numeric mood to descriptive emotional state
- Adds luck description
- Includes relationship context when interacting with specific actors
- Supports both ActorRelationship (new) and ActorConnection (legacy) formats

**Generated Context Format:**
```
Current mood: [intensity] [emotion] ([description])
Current luck: [luck description]
Relationship with [targetId]: [type] - be [modifier]
Context: [relationship history]
```

## Usage

- FeedGenerator: Adds to post generation prompts
- GameEngine: Creates context for event reactions
- GroupChat: Influences chat message tone

## Example

```typescript
// Simple context without relationships
const ctx = generateActorContext(0.6, 'high');
// => "Current mood: moderately happy (pleased, content, positive)\nCurrent luck: things going well, lucky streak"

// Full context with relationship
const ctx = generateActorContext(
  0.3, 'medium', 'actor-2', relationships, 'actor-1'
);
// => "Current mood: slightly content (...)\nCurrent luck: ...\nRelationship with actor-2: rival - be competitive..."
```
