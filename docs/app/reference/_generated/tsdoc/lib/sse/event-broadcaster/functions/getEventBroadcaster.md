[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/sse/event-broadcaster](../README.md) / getEventBroadcaster

# Function: getEventBroadcaster()

> **getEventBroadcaster**(): `InMemoryBroadcaster` \| `ServerlessBroadcaster`

Defined in: [src/lib/sse/event-broadcaster.ts:405](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/sse/event-broadcaster.ts#L405)

Get the event broadcaster instance (singleton)

Uses the same implementation for both dev and production.
In serverless (Vercel), each instance manages its own clients (local-only).

## Returns

`InMemoryBroadcaster` \| `ServerlessBroadcaster`
