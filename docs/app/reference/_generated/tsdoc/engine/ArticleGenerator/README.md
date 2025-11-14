[**babylon v0.1.0**](../../README.md)

***

[babylon](../../README.md) / engine/ArticleGenerator

# engine/ArticleGenerator

Article Generator - Long-Form News Content with Organizational Bias

## Description

Generates realistic long-form news articles from media organizations with
editorial bias based on organizational relationships and affiliations. Creates
multi-perspective coverage of game events with different spins.

**Key Features:**
- Long-form investigative articles (800-1500 words)
- Organizational bias based on actor affiliations
- Insider information and anonymous sources
- Editorial slant/spin based on relationships
- Multiple outlets covering same events differently
- Realistic journalist bylines

**Bias System:**
- **Protective Bias (+0.6)**: Downplays negative news about aligned actors
- **Critical Bias (-0.6)**: Emphasizes negative news about opposing actors
- **Neutral (0)**: Balanced coverage when no relationships

**Article Structure:**
- Compelling headline that hints at angle
- 2-3 sentence summary for listings
- Full body with insider details, quotes, analysis
- Category and tags for organization
- Sentiment and slant metadata

**Coverage Strategy:**
- 50-80% of news organizations cover each major event
- Each outlet provides unique perspective
- Bias creates natural disagreement in coverage
- Insider quotes from affiliated journalists

## See

 - FeedGenerator - Also generates short-form posts
 - GameEngine - Uses ArticleGenerator for mixed content

## Example

```typescript
const generator = new ArticleGenerator(llmClient);

const articles = await generator.generateArticlesForEvent(
  worldEvent,
  newsOrganizations,
  actors,
  recentEvents
);

// Each org has different take
articles.forEach(article => {
  console.log(`${article.authorOrgName}: ${article.title}`);
  console.log(`Slant: ${article.slant}`);
  console.log(`Bias: ${article.biasScore}`);
});
```

## Classes

- [ArticleGenerator](classes/ArticleGenerator.md)

## Interfaces

- [Article](interfaces/Article.md)
