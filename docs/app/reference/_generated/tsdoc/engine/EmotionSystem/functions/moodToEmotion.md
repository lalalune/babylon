[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/EmotionSystem](../README.md) / moodToEmotion

# Function: moodToEmotion()

> **moodToEmotion**(`mood`): [`EmotionalState`](../interfaces/EmotionalState.md)

Defined in: [src/engine/EmotionSystem.ts:87](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/EmotionSystem.ts#L87)

Convert mood value to emotional state description

## Parameters

### mood

`number`

Numeric mood value from -1 (worst) to 1 (best)

## Returns

[`EmotionalState`](../interfaces/EmotionalState.md)

Structured emotional state with emotion, intensity, and description

## Description

Maps numeric mood values to rich emotional states that can be used in LLM prompts.
The emotion is determined by mood value ranges, and intensity is based on absolute value.

**Mood Scale:**
- `0.7 to 1.0`: euphoric (overjoyed, excited, optimistic)
- `0.4 to 0.7`: happy (pleased, content, positive)
- `0.1 to 0.4`: content (satisfied, calm, neutral-positive)
- `-0.1 to 0.1`: neutral (balanced, indifferent, stable)
- `-0.4 to -0.1`: annoyed (irritated, bothered, slightly negative)
- `-0.7 to -0.4`: upset (frustrated, disappointed, negative)
- `-1.0 to -0.7`: furious (enraged, deeply negative, volatile)

**Intensity Levels:**
- `abs(mood) < 0.3`: slightly
- `abs(mood) < 0.6`: moderately
- `abs(mood) >= 0.6`: extremely

## Usage

Used by FeedGenerator and GameEngine to create emotional context for NPCs.

## Example

```typescript
const state = moodToEmotion(0.8);
// => { emotion: 'euphoric', intensity: 'extremely', description: 'overjoyed, excited, optimistic' }

const sadState = moodToEmotion(-0.5);
// => { emotion: 'upset', intensity: 'moderately', description: 'frustrated, disappointed, negative' }
```
