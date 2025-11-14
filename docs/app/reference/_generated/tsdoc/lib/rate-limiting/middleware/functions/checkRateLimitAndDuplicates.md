[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/middleware](../README.md) / checkRateLimitAndDuplicates

# Function: checkRateLimitAndDuplicates()

> **checkRateLimitAndDuplicates**(`userId`, `content`, `rateLimitConfig`, `duplicateConfig?`): `NextResponse`\<`unknown`\> \| `null`

Defined in: [src/lib/rate-limiting/middleware.ts:112](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/middleware.ts#L112)

Combined rate limiting and duplicate detection
Returns a NextResponse if either check fails, or null if both pass

Usage:
```ts
const errorResponse = await checkRateLimitAndDuplicates(
  user.userId,
  content,
  RATE_LIMIT_CONFIGS.CREATE_POST,
  DUPLICATE_DETECTION_CONFIGS.POST
);
if (errorResponse) return errorResponse;
```

## Parameters

### userId

`string`

### content

`string` | `null`

### rateLimitConfig

\{ `maxRequests`: `3`; `windowMs`: `60000`; `actionType`: `"create_post"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"create_comment"`; \} | \{ `maxRequests`: `20`; `windowMs`: `60000`; `actionType`: `"like_post"`; \} | \{ `maxRequests`: `20`; `windowMs`: `60000`; `actionType`: `"like_comment"`; \} | \{ `maxRequests`: `5`; `windowMs`: `60000`; `actionType`: `"share_post"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"follow_user"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"unfollow_user"`; \} | \{ `maxRequests`: `20`; `windowMs`: `60000`; `actionType`: `"send_message"`; \} | \{ `maxRequests`: `5`; `windowMs`: `60000`; `actionType`: `"upload_image"`; \} | \{ `maxRequests`: `5`; `windowMs`: `60000`; `actionType`: `"update_profile"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"open_position"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"close_position"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"buy_prediction"`; \} | \{ `maxRequests`: `10`; `windowMs`: `60000`; `actionType`: `"sell_prediction"`; \} | \{ `maxRequests`: `100`; `windowMs`: `60000`; `actionType`: `"admin_action"`; \} | \{ `maxRequests`: `30`; `windowMs`: `60000`; `actionType`: `"default"`; \}

### duplicateConfig?

\{ `windowMs`: `number`; `actionType`: `"post"`; \} | \{ `windowMs`: `number`; `actionType`: `"comment"`; \} | \{ `windowMs`: `number`; `actionType`: `"message"`; \}

## Returns

`NextResponse`\<`unknown`\> \| `null`
