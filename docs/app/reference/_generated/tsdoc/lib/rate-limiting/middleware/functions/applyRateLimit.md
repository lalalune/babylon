[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/middleware](../README.md) / applyRateLimit

# Function: applyRateLimit()

> **applyRateLimit**(`userId`, `config`): `object`

Defined in: [src/lib/rate-limiting/middleware.ts:67](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/middleware.ts#L67)

Apply rate limiting to an API route handler

Usage:
```ts
export async function POST(request: NextRequest) {
  const user = await authenticate(request);
  
  const rateLimitResult = await applyRateLimit(user.userId, RATE_LIMIT_CONFIGS.CREATE_POST);
  if (!rateLimitResult.allowed) {
    return rateLimitError(rateLimitResult.retryAfter);
  }
  
  // ... rest of handler
}
```

## Parameters

### userId

`string`

### config

\{ `maxRequests`: `3`; `windowMs`: `60000`; `actionType`: `"create_post"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"create_comment"`; \} | \{ `maxRequests`: `20`; `windowMs`: `60000`; `actionType`: `"like_post"`; \} | \{ `maxRequests`: `20`; `windowMs`: `60000`; `actionType`: `"like_comment"`; \} | \{ `maxRequests`: `5`; `windowMs`: `60000`; `actionType`: `"share_post"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"follow_user"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"unfollow_user"`; \} | \{ `maxRequests`: `20`; `windowMs`: `60000`; `actionType`: `"send_message"`; \} | \{ `maxRequests`: `5`; `windowMs`: `60000`; `actionType`: `"upload_image"`; \} | \{ `maxRequests`: `5`; `windowMs`: `60000`; `actionType`: `"update_profile"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"open_position"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"close_position"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"buy_prediction"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"sell_prediction"`; \} | \{ `maxRequests`: `100`; `windowMs`: `60000`; `actionType`: `"admin_action"`; \} | \{ `maxRequests`: `30`; `windowMs`: `60000`; `actionType`: `"default"`; \}

## Returns

`object`

### allowed

> **allowed**: `boolean`

### retryAfter?

> `optional` **retryAfter**: `number`

### remaining?

> `optional` **remaining**: `number`
