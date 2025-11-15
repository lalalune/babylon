# Feed Prompt World Context System

This system auto-populates feed prompts with actor names, markets, predictions, and recent trades to ensure consistent use of parody names and provide rich context.

## Overview

All feed prompts now include a "WORLD CONTEXT" section with:
- **worldActors**: Auto-populated list of all actors with their parody names
- **currentMarkets**: Active prediction markets
- **activePredictions**: Current prediction questions
- **recentTrades**: Recent trading activity

## Key Rules

**CRITICAL**: All prompts explicitly instruct the AI to:
1. **NEVER use real names** (Elon Musk, Sam Altman, Mark Zuckerberg, etc.)
2. **ALWAYS use ONLY parody names** (AIlon Musk, Sam AIltman, Mark Zuckerborg, etc.)
3. **Use @usernames or parody names/nicknames/aliases ONLY**
4. **Keep posts SHORT** (140-280 characters depending on type)
5. **NO hashtags or emojis**
6. Reference markets/predictions naturally when relevant

Real names are **NEVER** mentioned in prompts to avoid any confusion.

## Usage

### Basic Usage

```typescript
import { generateWorldContext } from '@/lib/prompts/world-context';
import { renderPrompt, ambientPosts } from '@/prompts';

// Generate context from actors.json and database (async!)
const worldContext = await generateWorldContext();

// Use in your prompt
const prompt = renderPrompt(ambientPosts, {
  day: 5,
  actorCount: 3,
  actorsList: "...",
  ...worldContext, // Spreads all context variables
});
```

### Advanced Options

```typescript
const worldContext = await generateWorldContext({
  maxActors: 30,           // Limit actors to manage tokens
  includeActors: true,     // Include actor names from actors.json
  includeMarkets: true,    // Include market data from database
  includePredictions: true, // Include predictions from database
  includeTrades: true,     // Include recent trades from database
});
```

### Actor Name Validation

```typescript
import { getParodyActorNames, getForbiddenRealNames } from '@/lib/prompts/world-context';

// Get list of valid parody names
const parodyNames = getParodyActorNames();
// ["AIlon Musk", "Sam AIltman", "Mark Zuckerborg", ...]

// Get list of forbidden real names (for validation only)
const forbiddenNames = getForbiddenRealNames();
// ["Elon Musk", "Sam Altman", "Mark Zuckerberg", ...]

// Validate generated text doesn't contain real names
function validateNoRealNames(text: string): string[] {
  const violations: string[] = [];
  forbiddenNames.forEach(realName => {
    if (text.includes(realName)) {
      violations.push(`FORBIDDEN: Found real name "${realName}"`);
    }
  });
  return violations;
}
```

## Actor Names Reference

The system automatically loads **ONLY PARODY NAMES** from the actors data structure:
- Individual actor files in `public/data/actors/`
- Individual organization files in `public/data/organizations/`
- Loaded via `loadActorsData()` utility

**Valid Names (Use These)**:
- AIlon Musk (@ailonmusk)
- Sam AIltman (@ailtman)
- Mark Zuckerborg (@markzuckerborg)
- Vitalik ButerAIn (@vitailik)
- Jerome Power (@jeromepower)
- Trump Terminal (@trumpterminal)
- ... and 80+ more

**Real names are NEVER included in prompts** to prevent confusion.

## Prompt Template Variables

All feed prompts now accept these variables:

```typescript
{
  // Existing variables
  actorCount: number;
  actorsList: string;
  day?: number;
  eventDescription?: string;
  // ... other prompt-specific variables

  // New world context variables (auto-populated)
  worldActors: string;        // "World Actors (USE THESE NAMES ONLY): AIlon Musk (@ailonmusk), Sam AIltman (@ailtman), ..."
  currentMarkets: string;     // "Active Markets: Tesla FSD Launch (70% Yes), ..."
  activePredictions: string;  // "Questions: Will Tesla achieve Level 5 by EOY?, ..."
  recentTrades: string;       // "Recent Activity: @ailonmusk bought 1000 shares YES, ..."
}
```

## Database Integration

### ✅ Fully Integrated with Game Engine

The world context system is **fully integrated** with your existing game database:

1. **generateCurrentMarkets()**: ✅ Queries `Market` and `Organization` tables
   - Top 5 prediction markets from `Market` table (unresolved, sorted by activity)
   - Top 5 perpetual markets from `Organization` table (companies with prices)
   - Format: `Predictions: Question (70% Yes) | ... / Stocks: TeslAI $245.00 | ...`
   
2. **generateActivePredictions()**: ✅ Queries `Question` table
   - Active questions with `status='active'` and future resolution dates
   - Calculates days until resolution
   - Format: `Active Questions: Will X happen? (resolves in 5d) | ...`
   
3. **generateRecentTrades()**: ✅ Queries `NPCTrade` and `AgentTrade` tables
   - Combines NPC trades and agent trades
   - Top 20 most recent trades sorted by execution time
   - Format: `Recent Trades: AIlon Musk buy yes prediction | ...`

**Performance**: All queries run in parallel using `Promise.all()` for optimal speed.

## Updated Prompts

All feed prompts have been updated with world context:

### Batch Generation Prompts
- `ambient-posts.ts`
- `reactions.ts`
- `news-posts.ts`
- `journalist-posts.ts`
- `company-posts.ts`
- `government-posts.ts`
- `conspiracy.ts`
- `commentary.ts`
- `replies.ts`

### Individual Post Prompts
- `ambient-post.ts`
- `reply.ts`
- `direct-reaction.ts`
- `journalist-post.ts`
- `conspiracy-post.ts`
- `media-post.ts`
- `expert-commentary.ts`
- `company-post.ts`
- `government-post.ts`
- `analyst-reaction.ts`
- `stock-ticker.ts`
- `minute-ambient.ts`

## Examples

See `feed-example.ts` for complete working examples of:
- Generating ambient posts with context
- Generating reactions with context
- Validating actor name usage
- Generating news posts with full context

## Character Limits

Different post types have different character limits:

- **Ambient/Journalist/Company/Government posts**: 280 characters
- **Replies/Reactions/Commentary/Media posts**: 140 characters
- **Minute ambient posts**: 200 characters
- **Stock ticker posts**: 150 characters
- **Analyst reactions**: 250 characters

All prompts enforce these limits and prohibit hashtags/emojis.

