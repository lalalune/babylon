[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/sse/event-broadcaster](../README.md) / broadcastToChannel

# Function: broadcastToChannel()

> **broadcastToChannel**(`channel`, `data`): `void`

Defined in: [src/lib/sse/event-broadcaster.ts:429](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/sse/event-broadcaster.ts#L429)

Broadcast a message to a channel

Note: In serverless environments, this only broadcasts to clients connected
to the current serverless function instance. This is intentional and works
because the broadcast typically happens in the same instance that received
the update (e.g., POST /api/posts → broadcast → SSE clients on same instance).

## Parameters

### channel

`string`

### data

`Record`\<`string`, `unknown`\>

## Returns

`void`
