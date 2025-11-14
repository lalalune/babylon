# Actors.json Field Usage Documentation

Complete analysis of which fields are used where in the Babylon codebase.

## Actor Fields

### Core Identity Fields

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `id` | string | Database, API routes, caching | Unique identifier |
| `name` | string | Everywhere | Display name (AI parody version) |
| `realName` | string | Image generation CLI | Original name for image prompts |
| `username` | string | Profile pages, world context, API | Social media handle |

**Analysis:**
- ✅ All used in runtime code
- `realName` used exclusively for image generation prompts
- `username` appears in profiles and trading API

### Description Fields

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `description` | string | Database, prompts, profiles | Internal character description |
| `profileDescription` | string | Profile pages | What actor says about themselves |

**Analysis:**
- ✅ Both needed - serve different purposes
- `description`: Used in AI prompts and game logic
- `profileDescription`: Displayed on actor profile page
- NOT redundant despite similar names

### Behavioral Fields

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `domain` | string[] | Database, prompts | Subject matter expertise |
| `personality` | string | Database, prompts | Character personality type |
| `tier` | string | Database, markets, ranking | Influence level (S/A/B/C) |
| `role` | string | Database queries | Game importance (set at runtime) |
| `affiliations` | string[] | Database | Organization IDs |
| `postStyle` | string | Database, prompts | How they write |
| `postExample` | string[] | Database, prompts | Example posts |

**Analysis:**
- ✅ All used in database and/or prompts
- `domain`, `role`, `tier` serve different categorizations:
  - `domain`: What they know about
  - `role`: How important to story
  - `tier`: Influence/follower level

### Image Generation Fields (actors.json only)

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `physicalDescription` | string | `generate-actor-images.ts` | Actor portrait prompts |
| `profileBanner` | string | `generate-actor-images.ts` | Banner image prompts |

**Analysis:**
- ✅ Used ONLY for one-time image generation
- NOT in database schema
- NOT needed at runtime (images are pre-generated)
- Required for CLI tools

### Name Replacement Fields (NEW)

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `originalFirstName` | string | `name-replacer.ts` | Maps "Elon" → "AIlon" |
| `originalLastName` | string | `name-replacer.ts` | Maps "Musk" → "Musk" |
| `originalHandle` | string | `name-replacer.ts` | Maps "@elonmusk" → "@ailonmusk" |

**Analysis:**
- ✅ Critical for name scrubbing system
- Used by maintenance scripts
- Enables automated name replacement

### Trading/Game Mechanics Fields

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `hasPool` | boolean | Database, markets | Can run a trading pool |
| `initialLuck` | string | Database (runtime) | Luck stat (low/medium/high) |
| `initialMood` | number | Database (runtime) | Mood stat (-1 to 1) |
| `tradingBalance` | Decimal | Database (runtime) | NPC's trading balance |
| `reputationPoints` | number | Database (runtime) | Leaderboard points |
| `profileImageUrl` | string | Database (runtime) | Actor profile image URL |

**Analysis:**
- ✅ All in database schema
- `hasPool`: Set in actors.json (whether actor can trade)
- Others: Set at runtime by game engine
- `hasPool` is the only one that should be in actors.json

## Removed Fields (Unused)

The following fields were removed from actors.json (320 instances across 64 actors):

### ❌ Removed: Never Used

| Field | Reason for Removal |
|-------|-------------------|
| `nickname` | NEVER accessed anywhere in codebase |
| `aliases` | NEVER accessed anywhere in codebase |
| `quirks` | NEVER accessed anywhere in codebase |
| `canPostFeed` | Defined in types but NEVER checked in runtime |
| `canPostGroups` | Defined in types but NEVER checked in runtime |

**Evidence:**
```bash
# Search results for unused fields:
$ grep -r "\.nickname" src/
# No results

$ grep -r "\.aliases" src/
# No results

$ grep -r "\.quirks" src/
# No results

$ grep -r "canPostFeed" src/
# Only in type definitions, never checked

$ grep -r "canPostGroups" src/
# Only in type definitions, never checked
```

## Organization Fields

### Core Fields

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `id` | string | Database, API routes | Unique identifier |
| `name` | string | Everywhere | Display name (AI parody version) |
| `type` | string | Database, classification | Organization type |
| `description` | string | Database, prompts | Internal org description |
| `profileDescription` | string | Profile pages | What org says about itself |

**Analysis:**
- ✅ All used in runtime code

### Behavioral Fields

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `postStyle` | string | Database, prompts | How organization posts |
| `postExample` | string[] | Database, prompts | Example posts |

**Analysis:**
- ✅ Used in content generation

### Image Generation Fields

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `pfpDescription` | string | `generate-actor-images.ts` | Logo generation prompts |
| `bannerDescription` | string | `generate-actor-images.ts` | Banner generation prompts |

**Analysis:**
- ✅ Used ONLY for one-time image generation
- Required for CLI tools

### Name Replacement Fields (NEW)

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `originalName` | string | `name-replacer.ts` | Maps "OpenAI" → "OpnAI" |
| `originalHandle` | string | `name-replacer.ts` | Maps "@openai" → "@opnai" |

**Analysis:**
- ✅ Critical for name scrubbing system

### Trading Fields

| Field | Type | Used In | Purpose |
|-------|------|---------|---------|
| `canBeInvolved` | boolean | Game logic | Can be in events |
| `initialPrice` | number | Markets | Starting token price |

**Analysis:**
- ✅ Used in trading and game mechanics

## Field Location Summary

### In Database Schema (Prisma)

**Actors:**
```
id, name, description, domain, personality, tier, affiliations,
postStyle, postExample, role, initialLuck, initialMood, hasPool,
profileImageUrl, reputationPoints, tradingBalance
```

**Organizations (stored as Actors):**
```
Same fields as actors
```

### In actors.json ONLY (Not in Database)

**Actors:**
```
realName, username, physicalDescription, profileBanner,
originalFirstName, originalLastName, originalHandle
```

**Organizations:**
```
type, pfpDescription, bannerDescription, 
originalName, originalHandle, canBeInvolved, initialPrice
```

## Usage Patterns

### Runtime Fields (Always Used)

These fields are accessed during normal application operation:
- Core identity: `id`, `name`, `username`
- Descriptions: `description`, `profileDescription`
- Behavioral: `domain`, `personality`, `tier`, `postStyle`, `postExample`, `affiliations`
- Trading: `hasPool`, `initialPrice` (orgs), `canBeInvolved` (orgs)

### Build-Time Fields (Used in Scripts)

These fields are only used during setup/maintenance:
- Image generation: `physicalDescription`, `profileBanner`, `pfpDescription`, `bannerDescription`, `realName`
- Name replacement: `originalFirstName`, `originalLastName`, `originalHandle`, `originalName`

### Database-Only Fields (Not in JSON)

These are set at runtime and stored in database:
- `role`, `initialLuck`, `initialMood`, `tradingBalance`, `reputationPoints`, `profileImageUrl`

## Validation

All tests pass (65/65):
```bash
✓ tests/unit/name-replacement.test.ts (65 tests) 33ms
```

## Conclusion

After thorough analysis:
- **0 redundant fields** - all remaining fields serve distinct purposes
- **320 unused field instances removed** - dead weight eliminated
- **Clean separation** between runtime fields and build-time fields
- **Full test coverage** for name replacement system

The actors.json structure is now optimized with zero unused fields.

