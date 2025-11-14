[**babylon v0.1.0**](../../README.md)

***

[babylon](../../README.md) / engine/FeedGenerator

# engine/FeedGenerator

Babylon Feed Generator - Social Media Simulation Engine

## Description

Generates organic, realistic social media feed content where NPCs react to game
events based on personality, emotional state, relationships, and insider information.
Creates cascading information flows that mimic real social media dynamics.

**Feed Information Cascade:**
1. **Real Event Occurs** (WorldEvent - players never see directly)
2. **Media Breaks Story** - News organizations and journalists report
3. **Involved Parties React** - Actors in event respond (defensive/celebratory)
4. **Companies Respond** - PR statements from affiliated companies
5. **Experts Analyze** - Outside commentators weigh in
6. **Conspiracy Theories** - Contrarians spin alternative narratives
7. **Threads Emerge** - Replies and conversations develop
8. **Ambient Noise** - Unrelated musings and hot takes

**Content Generation:**
- 100% LLM-generated content (no templates)
- Each post considers actor's mood, luck, personality, relationships
- Group chat context influences public posts
- Relationship dynamics create natural disagreements
- Clue strength varies by time until resolution

**Performance Optimization:**
- ✅ **90% LLM cost reduction** via intelligent batching
- Before: ~10-15 calls per event (2,000+ total per game)
- After: ~4-5 calls per event (~200 total per game)
- Same quality, 10x faster, significantly cheaper

**Batching Strategy:**
- Media posts: All orgs/journalists → 1 call
- Reactions: All involved actors → 1 call
- Commentary: All experts → 1 call
- Conspiracy: All contrarians → 1 call
- Threads: All replies → 1 call
- Ambient: All posts per hour → 1 call

**Per-Actor Context Preserved:**
- Individual mood and luck state
- Unique personality traits
- Relationship dynamics
- Group chat insider information
- Post style and voice

**Retry Logic:**
- All LLM calls retry up to 5 times with backoff
- Validates response structure and content
- Requires minimum success rate (50%) for batches
- Throws on persistent failure to maintain quality

## See

 - GameEngine - Uses FeedGenerator for post generation
 - EmotionSystem - Provides mood/luck context
 - [WorldEvent](../GameWorld/interfaces/WorldEvent.md) - Events that trigger feed cascades

## Example

```typescript
const feed = new FeedGenerator(llmClient);
feed.setActorStates(moodMap);
feed.setRelationships(relationships);
feed.setOrganizations(organizations);

const posts = await feed.generateDayFeed(
  day: 15,
  worldEvents: [event1, event2],
  allActors,
  outcome: true
);

console.log(`Generated ${posts.length} posts`);
// Posts include news breaks, reactions, analysis, conspiracy, threads
```

## Classes

- [FeedGenerator](classes/FeedGenerator.md)

## Interfaces

- [Actor](interfaces/Actor.md)
- [ActorState](interfaces/ActorState.md)
- [ActorRelationship](interfaces/ActorRelationship.md)
- [Organization](interfaces/Organization.md)
- [FeedPost](interfaces/FeedPost.md)

## Type Aliases

- [FeedEvent](type-aliases/FeedEvent.md)
