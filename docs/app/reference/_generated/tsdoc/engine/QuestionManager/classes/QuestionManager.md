[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/QuestionManager](../README.md) / QuestionManager

# Class: QuestionManager

Defined in: [src/engine/QuestionManager.ts:109](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L109)

Question Manager - Handles question lifecycle

 QuestionManager

## Description

Central manager for all prediction market questions. Uses LLM to generate
contextually relevant questions and manages their lifecycle from creation
through resolution.

**Key Methods:**
- `generateDailyQuestions()` - Create 1-3 new questions per day
- `getQuestionsToResolve()` - Find questions ready to resolve
- `resolveQuestion()` - Mark question as resolved with final outcome
- `generateResolutionEvent()` - Create definitive proof of outcome

## Usage

Instantiated once by GameEngine and used throughout the game lifecycle.

## Constructors

### Constructor

> **new QuestionManager**(`llm`): `QuestionManager`

Defined in: [src/engine/QuestionManager.ts:117](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L117)

Create a new QuestionManager instance

#### Parameters

##### llm

`BabylonLLMClient`

Babylon LLM client for question generation

#### Returns

`QuestionManager`

## Methods

### generateDailyQuestions()

> **generateDailyQuestions**(`params`): `Promise`\<`Question`[]\>

Defined in: [src/engine/QuestionManager.ts:172](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L172)

Generate new questions for the current day

#### Parameters

##### params

[`QuestionCreationParams`](../interfaces/QuestionCreationParams.md)

Question creation parameters including context and IDs

#### Returns

`Promise`\<`Question`[]\>

Array of newly generated questions (1-3 questions, empty if at capacity)

#### Description

Uses LLM to generate contextually relevant prediction market questions based on
recent events, active scenarios, and available actors. Questions are designed
to drive interesting events and player engagement.

**Generation Logic:**
- Generates 1-3 questions per call (random)
- Respects 20 question maximum (returns empty array if at capacity)
- Uses recent events for contextual continuity
- Avoids duplicating active questions
- Shuffles actors/orgs for variety

**Resolution Timing:**
- LLM determines `daysUntilResolution` (1-7 days)
- Resolution date calculated from currentDate
- Clamped to valid range (1-7 days)

**Question Properties:**
- `id`: Numeric ID starting from `nextQuestionId`
- `text`: LLM-generated question text
- `scenario`: Scenario ID this question relates to
- `outcome`: Predetermined outcome (true = YES, false = NO)
- `status`: Always 'active' for new questions
- `createdDate`: Current date
- `resolutionDate`: 1-7 days in the future

#### Throws

Never throws - returns empty array on error

#### Example

```typescript
const questions = await qm.generateDailyQuestions({
  currentDate: '2025-10-15',
  scenarios: gameScenarios,
  actors: mainActors,
  organizations: companies,
  activeQuestions: [...existingQuestions],
  recentEvents: [...recentDays],
  nextQuestionId: 42
});
// => [
//   { id: 42, text: "Will TechCorp announce...", outcome: true, ... },
//   { id: 43, text: "Will the scandal force...", outcome: false, ... }
// ]
```

***

### getQuestionsToResolve()

> **getQuestionsToResolve**(`activeQuestions`, `currentDate`): `Question`[]

Defined in: [src/engine/QuestionManager.ts:348](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L348)

Get questions that should be resolved today

#### Parameters

##### activeQuestions

`Question`[]

Array of currently active questions

##### currentDate

`string`

Current date as ISO string (YYYY-MM-DD)

#### Returns

`Question`[]

Array of questions ready for resolution

#### Description

Filters active questions to find those whose resolution date has been reached.
These questions should be resolved in the current game tick.

**Resolution Criteria:**
- Question must have a `resolutionDate` set
- Resolution date must be <= current date
- Only checks active questions (not already resolved)

**Typical Flow:**
1. GameEngine calls this during tick
2. For each returned question:
   - Generate resolution event
   - Call `resolveQuestion()`
   - Settle all positions
   - Update reputation

#### Usage

Called by GameEngine every tick to check for questions ready to resolve.

#### Example

```typescript
const toResolve = qm.getQuestionsToResolve(activeQuestions, '2025-10-20');
// => [Question { id: 5, resolutionDate: '2025-10-19', ... }]

for (const question of toResolve) {
  // Generate resolution event
  // Resolve question
  // Settle positions
}
```

***

### resolveQuestion()

> **resolveQuestion**(`question`, `outcome`): `Question`

Defined in: [src/engine/QuestionManager.ts:390](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L390)

Resolve a question with final outcome

#### Parameters

##### question

`Question`

Question to resolve

##### outcome

`boolean`

Final outcome (true = YES, false = NO)

#### Returns

`Question`

Resolved question with updated status and outcome

#### Description

Marks a question as resolved and records the final outcome. This is a pure
function that returns a new question object - it does not mutate the input.

**What This Does:**
- Sets `status` to 'resolved'
- Sets `resolvedOutcome` to the provided outcome
- Preserves all other question properties

**What This Does NOT Do:**
- Does not settle positions (handled by GameEngine)
- Does not update reputation (handled by ReputationService)
- Does not persist to database (handled by GameEngine)
- Does not generate events (handled by GameEngine)

#### Usage

Called by GameEngine after generating a resolution event.

#### Example

```typescript
const question = { id: 5, text: "Will...", outcome: true, status: 'active', ... };
const resolved = qm.resolveQuestion(question, true);
// => { ...question, status: 'resolved', resolvedOutcome: true }
```

***

### generateResolutionEvent()

> **generateResolutionEvent**(`question`, `_actors`, `_organizations`, `recentEvents`): `Promise`\<`string`\>

Defined in: [src/engine/QuestionManager.ts:438](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L438)

Generate a resolution event that proves the question outcome

#### Parameters

##### question

`Question`

Question being resolved

##### \_actors

`SelectedActor`[]

Available actors (currently unused, kept for interface compatibility)

##### \_organizations

[`Organization`](../../FeedGenerator/interfaces/Organization.md)[]

Available organizations (currently unused, kept for interface compatibility)

##### recentEvents

`DayTimeline`[]

Recent game timeline for context

#### Returns

`Promise`\<`string`\>

Event description string that definitively proves the outcome

#### Description

Uses LLM to generate a dramatic, definitive event that proves whether the
question outcome is YES or NO. This event provides closure to the narrative
and justifies position settlements.

**Event Requirements:**
- Must be concrete and observable
- Must DEFINITIVELY prove the outcome
- Should reference recent related events for continuity
- Should be dramatic and satisfying for players

**LLM Prompting:**
- Uses recent related events as context
- Instructs LLM to prove specific outcome (YES/NO)
- Temperature 0.7 for consistent but varied events
- Falls back to template if LLM fails

#### Usage

Called by GameEngine when resolving questions.

#### Example

```typescript
const event = await qm.generateResolutionEvent(
  question,
  actors,
  organizations,
  recentTimeline
);
// => "TechCorp officially announces merger completion, signing ceremony held today"
```

***

### getActiveQuestions()

> **getActiveQuestions**(`questions`): `Question`[]

Defined in: [src/engine/QuestionManager.ts:495](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L495)

Get all active questions from a question array

#### Parameters

##### questions

`Question`[]

Array of questions to filter

#### Returns

`Question`[]

Array of questions with status='active'

#### Description

Simple filter utility to extract active questions. Active questions are
those that are currently tradable and generating events.

#### Usage

Used by GameEngine to get questions for event generation.

#### Example

```typescript
const active = qm.getActiveQuestions(allQuestions);
// => [Question { status: 'active', ... }, Question { status: 'active', ... }]
```

***

### getResolvedQuestions()

> **getResolvedQuestions**(`questions`): `Question`[]

Defined in: [src/engine/QuestionManager.ts:518](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L518)

Get all resolved questions from a question array

#### Parameters

##### questions

`Question`[]

Array of questions to filter

#### Returns

`Question`[]

Array of questions with status='resolved'

#### Description

Simple filter utility to extract resolved questions. Useful for analytics,
displaying history, and calculating statistics.

#### Usage

Used for displaying question history and analytics.

#### Example

```typescript
const resolved = qm.getResolvedQuestions(allQuestions);
// => [Question { status: 'resolved', resolvedOutcome: true, ... }]
```

***

### getDaysUntilResolution()

> **getDaysUntilResolution**(`question`, `currentDate`): `number`

Defined in: [src/engine/QuestionManager.ts:556](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L556)

Calculate days remaining until question resolves

#### Parameters

##### question

`Question`

Question to check

##### currentDate

`string`

Current date as ISO string (YYYY-MM-DD)

#### Returns

`number`

Number of days until resolution (0 if today/past, 999 if no resolution date)

#### Description

Calculates the number of days from currentDate until the question's
resolutionDate. Used for urgency calculations and UI display.

**Return Values:**
- `0`: Resolves today or already past
- `1-7`: Days remaining (normal range)
- `999`: No resolution date set (shouldn't happen)

**Rounding:**
- Uses `Math.ceil()` to round up partial days
- Uses `Math.max(0)` to prevent negative values

#### Usage

Used by FeedGenerator to adjust clue strength (closer = stronger clues).

#### Example

```typescript
const days = qm.getDaysUntilResolution(question, '2025-10-15');
// If resolutionDate is '2025-10-18':
// => 3

const days = qm.getDaysUntilResolution(question, '2025-10-18');
// If resolutionDate is '2025-10-18':
// => 0 (resolves today)
```
