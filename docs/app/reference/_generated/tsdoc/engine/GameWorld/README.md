[**babylon v0.1.0**](../../README.md)

***

[babylon](../../README.md) / engine/GameWorld

# engine/GameWorld

Babylon Game World Generator

## Description

Generates complete narrative worlds with NPCs, events, and predetermined outcomes
that agents observe and bet on. This is the "reality" of the game - agents don't
participate in or influence this world, they only observe and predict outcomes.

**What This Generates:**
- 30 days of narrative events and developments
- NPC conversations and private discussions
- Clues and information reveals (public and leaked)
- News reports, rumors, and expert analysis
- Social media feed posts and reactions
- Final outcome revelation

**World vs Betting:**
- GameWorld = what actually happens (predetermined narrative)
- Agents = observers who bet on outcomes (don't affect world)
- Feed = how agents learn about the world (filtered, biased)
- Markets = where agents bet on predictions

**Generation Phases:**
- **Early (Days 1-10)**: Rumors, leaks, initial reports
- **Mid (Days 11-20)**: Meetings, analysis, developments
- **Late (Days 21-30)**: Revelations, whistleblowers, final events

**LLM Integration:**
- Optional LLM for rich content generation
- Falls back to templates if LLM unavailable
- Uses prompts from @/prompts for consistency

**Event Types:**
- announcement, meeting, leak, development
- scandal, rumor, deal, conflict, revelation

## See

 - GameEngine - Production system (not used in GameEngine)
 - GameSimulator - Uses similar patterns for autonomous simulation
 - [FeedGenerator](../FeedGenerator/classes/FeedGenerator.md) - Converts events to social media posts

## Example

```typescript
const world = new GameWorld({ outcome: true }, llmClient);

world.on('feed:post', (post) => {
  console.log(`${post.authorName}: ${post.content}`);
});

const finalWorld = await world.generate();
console.log(`Question: ${finalWorld.question}`);
console.log(`Outcome: ${finalWorld.outcome ? 'YES' : 'NO'}`);
console.log(`Events: ${finalWorld.events.length}`);
console.log(`Timeline: ${finalWorld.timeline.length} days`);
```

## Classes

- [GameWorld](classes/GameWorld.md)

## Interfaces

- [WorldConfig](interfaces/WorldConfig.md)
- [WorldEvent](interfaces/WorldEvent.md)
- [NPC](interfaces/NPC.md)
- [WorldState](interfaces/WorldState.md)
- [GroupMessage](interfaces/GroupMessage.md)
- [DayEvent](interfaces/DayEvent.md)
