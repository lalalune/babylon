[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/GameWorld](../README.md) / WorldEvent

# Interface: WorldEvent

Defined in: [src/engine/GameWorld.ts:127](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L127)

World Event - Actual story events that occur in the game

 WorldEvent

## Description

Canonical representation of events that happen in the game world. These are the
"actual events" that actors observe and react to via the social feed. Each event
can point toward a question outcome and has varying levels of visibility.

**This is THE WorldEvent:**
- Used throughout entire engine (GameWorld, FeedGenerator, GameEngine)
- Represents what "actually happened" (not just posts/reactions)
- Feed posts are reactions TO these events

## Properties

### id

> **id**: `string`

Defined in: [src/engine/GameWorld.ts:128](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L128)

Unique event identifier

***

### day

> **day**: `number`

Defined in: [src/engine/GameWorld.ts:129](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L129)

Game day number (1-30) when event occurred

***

### type

> **type**: `"development"` \| `"announcement"` \| `"meeting"` \| `"leak"` \| `"scandal"` \| `"rumor"` \| `"deal"` \| `"conflict"` \| `"revelation"` \| `"development:occurred"` \| `"news:published"`

Defined in: [src/engine/GameWorld.ts:130](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L130)

Event category (determines impact and reactions)

***

### description

> **description**: `string`

Defined in: [src/engine/GameWorld.ts:142](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L142)

Event description (max 150 chars, dramatic and specific)

***

### actors

> **actors**: `string`[]

Defined in: [src/engine/GameWorld.ts:143](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L143)

Actor IDs involved in this event

***

### visibility

> **visibility**: `"public"` \| `"leaked"` \| `"secret"` \| `"private"` \| `"group"`

Defined in: [src/engine/GameWorld.ts:144](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L144)

Who can see this event

***

### pointsToward?

> `optional` **pointsToward**: `"YES"` \| `"NO"` \| `null`

Defined in: [src/engine/GameWorld.ts:145](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L145)

Optional hint toward question outcome

***

### relatedQuestion?

> `optional` **relatedQuestion**: `number` \| `null`

Defined in: [src/engine/GameWorld.ts:146](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L146)

Optional prediction market question ID

**Event Types:**
- `announcement`: Official public statements
- `meeting`: Private meetings (may leak)
- `leak`: Information leaked to media
- `development`: Progress updates
- `scandal`: Negative revelations
- `rumor`: Unconfirmed reports
- `deal`: Business transactions
- `conflict`: Disputes or conflicts
- `revelation`: Major discoveries
- `development:occurred`: Internal development marker
- `news:published`: News article published marker

**Visibility Levels:**
- `public`: Everyone sees it
- `leaked`: Media has it, public soon
- `secret`: Only involved actors know
- `private`: Small group knows
- `group`: Group chat only
