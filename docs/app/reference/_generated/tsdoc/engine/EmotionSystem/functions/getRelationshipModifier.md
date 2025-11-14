[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/EmotionSystem](../README.md) / getRelationshipModifier

# Function: getRelationshipModifier()

> **getRelationshipModifier**(`relationship`): `object`

Defined in: [src/engine/EmotionSystem.ts:165](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/EmotionSystem.ts#L165)

Get relationship modifier for NPC responses

## Parameters

### relationship

`string`

Relationship type (e.g., 'ally', 'rival', 'enemy')

## Returns

`object`

Object containing behavior modifier string and sentiment bonus value

### modifier

> **modifier**: `string`

### sentimentBonus

> **sentimentBonus**: `number`

## Description

Maps relationship types to response modifiers and sentiment adjustments for LLM prompts.
Used when NPCs interact with or reference other NPCs in posts and group chats.

**Relationship Modifiers:**
- `friend`: friendly and warm (+0.4 sentiment)
- `ally`: supportive and positive (+0.3 sentiment)
- `advisor`: helpful and constructive (+0.2 sentiment)
- `source`: informative but cautious (+0.1 sentiment)
- `neutral`: balanced and objective (0 sentiment)
- `critic`: skeptical and questioning (-0.2 sentiment)
- `rival`: competitive and challenging (-0.3 sentiment)
- `enemy`: hostile and antagonistic (-0.5 sentiment)
- `hates`: deeply negative and dismissive (-0.6 sentiment)

## Usage

Used by FeedGenerator to adjust NPC tone when posting about related actors.

## Example

```typescript
const rivalMod = getRelationshipModifier('rival');
// => { modifier: 'competitive and challenging', sentimentBonus: -0.3 }

const allyMod = getRelationshipModifier('ally');
// => { modifier: 'supportive and positive', sentimentBonus: 0.3 }
```
