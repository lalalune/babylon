[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/QuestionManager](../README.md) / QuestionCreationParams

# Interface: QuestionCreationParams

Defined in: [src/engine/QuestionManager.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L80)

Parameters for question generation

 QuestionCreationParams

## Properties

### currentDate

> **currentDate**: `string`

Defined in: [src/engine/QuestionManager.ts:81](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L81)

ISO date string (YYYY-MM-DD) for the generation date

***

### scenarios

> **scenarios**: `Scenario`[]

Defined in: [src/engine/QuestionManager.ts:82](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L82)

Available game scenarios for context

***

### actors

> **actors**: `SelectedActor`[]

Defined in: [src/engine/QuestionManager.ts:83](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L83)

Available actors (filtered to main/supporting roles)

***

### organizations

> **organizations**: [`Organization`](../../FeedGenerator/interfaces/Organization.md)[]

Defined in: [src/engine/QuestionManager.ts:84](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L84)

Available organizations (companies, media, etc.)

***

### activeQuestions

> **activeQuestions**: `Question`[]

Defined in: [src/engine/QuestionManager.ts:85](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L85)

Currently active questions (to avoid duplicates)

***

### recentEvents

> **recentEvents**: `DayTimeline`[]

Defined in: [src/engine/QuestionManager.ts:86](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L86)

Recent game history for context

***

### nextQuestionId

> **nextQuestionId**: `number`

Defined in: [src/engine/QuestionManager.ts:87](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/QuestionManager.ts#L87)

Next available numeric ID for new questions
