[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/ArticleGenerator](../README.md) / ArticleGenerator

# Class: ArticleGenerator

Defined in: [src/engine/ArticleGenerator.ts:146](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L146)

Article Generator

 ArticleGenerator

## Description

Generates biased long-form news articles using LLM. Each organization produces
articles with different angles based on their relationships with actors involved.

**Generation Process:**
1. Identify news organizations to cover event (50-80% coverage)
2. For each organization:
   - Determine bias based on actor affiliations
   - Build context with bias instructions
   - Generate article via LLM (800-1500 words)
   - Add metadata (category, tags, sentiment)

**Bias Calculation:**
- If event involves aligned actors → protective bias
- If event involves opposing actors → critical bias
- Otherwise → neutral coverage

## Usage

Instantiated by GameEngine for mixed content generation alongside short posts.

## Constructors

### Constructor

> **new ArticleGenerator**(`llm`): `ArticleGenerator`

Defined in: [src/engine/ArticleGenerator.ts:154](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L154)

Create a new ArticleGenerator

#### Parameters

##### llm

`BabylonLLMClient`

Babylon LLM client for article generation

#### Returns

`ArticleGenerator`

## Methods

### generateArticlesForEvent()

> **generateArticlesForEvent**(`event`, `newsOrganizations`, `actors`, `recentEvents`): `Promise`\<[`Article`](../interfaces/Article.md)[]\>

Defined in: [src/engine/ArticleGenerator.ts:197](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L197)

Generate multiple articles about an event from different news organizations

#### Parameters

##### event

`WorldEvent`

World event to cover

##### newsOrganizations

[`Organization`](../../FeedGenerator/interfaces/Organization.md)[]

Available news organizations

##### actors

[`Actor`](../../FeedGenerator/interfaces/Actor.md)[]

All game actors

##### recentEvents

`WorldEvent`[] = `[]`

Recent events for context

#### Returns

`Promise`\<[`Article`](../interfaces/Article.md)[]\>

Array of articles with different perspectives

#### Description

Each organization produces an article with unique bias and angle based on their
relationships with actors involved in the event. Creates natural disagreement
and multiple perspectives in news coverage.

**Coverage Selection:**
- Random 50-80% of news organizations cover each event
- Major events get more coverage
- Each outlet provides unique perspective

**Bias Determination:**
- Scans event.actors for affiliations
- Protective bias if organization employs involved actors
- Critical bias if organization opposes involved actors
- Neutral if no strong relationships

#### Example

```typescript
const articles = await generator.generateArticlesForEvent(
  { id: 'evt-1', description: 'CEO resigns', actors: ['ceo-1'], ... },
  [cnn, fox, nyt],
  allActors,
  recentEvents
);

// CNN (employs CEO): "Visionary Leader Steps Down to Pursue New Ventures"
// Fox (opposes CEO): "Embattled Executive Forced Out Amid Controversy"
// NYT (neutral): "Tech CEO Announces Resignation After Tumultuous Quarter"
```
