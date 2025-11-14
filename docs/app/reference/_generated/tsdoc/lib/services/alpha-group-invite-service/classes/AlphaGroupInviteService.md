[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/alpha-group-invite-service](../README.md) / AlphaGroupInviteService

# Class: AlphaGroupInviteService

Defined in: [src/lib/services/alpha-group-invite-service.ts:28](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/alpha-group-invite-service.ts#L28)

## Constructors

### Constructor

> **new AlphaGroupInviteService**(): `AlphaGroupInviteService`

#### Returns

`AlphaGroupInviteService`

## Methods

### processTickInvites()

> `static` **processTickInvites**(): `Promise`\<[`AlphaInviteResult`](../interfaces/AlphaInviteResult.md)[]\>

Defined in: [src/lib/services/alpha-group-invite-service.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/alpha-group-invite-service.ts#L42)

Process alpha group invites for one tick
Checks all NPCs and their top engaged users

#### Returns

`Promise`\<[`AlphaInviteResult`](../interfaces/AlphaInviteResult.md)[]\>

***

### getInviteStats()

> `static` **getInviteStats**(): `Promise`\<\{ `totalInvites`: `number`; `activeGroups`: `number`; `invitesLast24h`: `number`; \}\>

Defined in: [src/lib/services/alpha-group-invite-service.ts:171](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/alpha-group-invite-service.ts#L171)

Get invite statistics for debugging

#### Returns

`Promise`\<\{ `totalInvites`: `number`; `activeGroups`: `number`; `invitesLast24h`: `number`; \}\>
