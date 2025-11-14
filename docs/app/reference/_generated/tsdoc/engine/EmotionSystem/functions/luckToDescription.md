[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/EmotionSystem](../README.md) / luckToDescription

# Function: luckToDescription()

> **luckToDescription**(`luck`): `string`

Defined in: [src/engine/EmotionSystem.ts:211](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/EmotionSystem.ts#L211)

Convert luck level to descriptive text

## Parameters

### luck

Luck level ('low', 'medium', or 'high')

`"medium"` | `"low"` | `"high"`

## Returns

`string`

Human-readable description of the luck state

## Description

Maps luck levels to descriptions that influence NPC behavior and outcomes.
Used in LLM prompts to add variety to NPC personalities and actions.

**Luck Descriptions:**
- `low`: things going wrong, unlucky streak
- `medium`: normal circumstances, balanced luck
- `high`: things going well, lucky streak

## Usage

Combined with mood to create complete emotional context for NPCs.

## Example

```typescript
const desc = luckToDescription('high');
// => "things going well, lucky streak"

const badDesc = luckToDescription('low');
// => "things going wrong, unlucky streak"
```
