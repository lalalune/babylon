[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/user-rate-limiter](../README.md) / RATE\_LIMIT\_CONFIGS

# Variable: RATE\_LIMIT\_CONFIGS

> `const` **RATE\_LIMIT\_CONFIGS**: `object`

Defined in: [src/lib/rate-limiting/user-rate-limiter.ts:29](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/user-rate-limiter.ts#L29)

Predefined rate limit configurations for different actions

## Type Declaration

### CREATE\_POST

> `readonly` **CREATE\_POST**: `object`

#### CREATE\_POST.maxRequests

> `readonly` **maxRequests**: `3` = `3`

#### CREATE\_POST.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### CREATE\_POST.actionType

> `readonly` **actionType**: `"create_post"` = `'create_post'`

### CREATE\_COMMENT

> `readonly` **CREATE\_COMMENT**: `object`

#### CREATE\_COMMENT.maxRequests

> `readonly` **maxRequests**: `10` = `10`

#### CREATE\_COMMENT.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### CREATE\_COMMENT.actionType

> `readonly` **actionType**: `"create_comment"` = `'create_comment'`

### LIKE\_POST

> `readonly` **LIKE\_POST**: `object`

#### LIKE\_POST.maxRequests

> `readonly` **maxRequests**: `20` = `20`

#### LIKE\_POST.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### LIKE\_POST.actionType

> `readonly` **actionType**: `"like_post"` = `'like_post'`

### LIKE\_COMMENT

> `readonly` **LIKE\_COMMENT**: `object`

#### LIKE\_COMMENT.maxRequests

> `readonly` **maxRequests**: `20` = `20`

#### LIKE\_COMMENT.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### LIKE\_COMMENT.actionType

> `readonly` **actionType**: `"like_comment"` = `'like_comment'`

### SHARE\_POST

> `readonly` **SHARE\_POST**: `object`

#### SHARE\_POST.maxRequests

> `readonly` **maxRequests**: `5` = `5`

#### SHARE\_POST.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### SHARE\_POST.actionType

> `readonly` **actionType**: `"share_post"` = `'share_post'`

### FOLLOW\_USER

> `readonly` **FOLLOW\_USER**: `object`

#### FOLLOW\_USER.maxRequests

> `readonly` **maxRequests**: `10` = `10`

#### FOLLOW\_USER.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### FOLLOW\_USER.actionType

> `readonly` **actionType**: `"follow_user"` = `'follow_user'`

### UNFOLLOW\_USER

> `readonly` **UNFOLLOW\_USER**: `object`

#### UNFOLLOW\_USER.maxRequests

> `readonly` **maxRequests**: `10` = `10`

#### UNFOLLOW\_USER.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### UNFOLLOW\_USER.actionType

> `readonly` **actionType**: `"unfollow_user"` = `'unfollow_user'`

### SEND\_MESSAGE

> `readonly` **SEND\_MESSAGE**: `object`

#### SEND\_MESSAGE.maxRequests

> `readonly` **maxRequests**: `20` = `20`

#### SEND\_MESSAGE.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### SEND\_MESSAGE.actionType

> `readonly` **actionType**: `"send_message"` = `'send_message'`

### UPLOAD\_IMAGE

> `readonly` **UPLOAD\_IMAGE**: `object`

#### UPLOAD\_IMAGE.maxRequests

> `readonly` **maxRequests**: `5` = `5`

#### UPLOAD\_IMAGE.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### UPLOAD\_IMAGE.actionType

> `readonly` **actionType**: `"upload_image"` = `'upload_image'`

### UPDATE\_PROFILE

> `readonly` **UPDATE\_PROFILE**: `object`

#### UPDATE\_PROFILE.maxRequests

> `readonly` **maxRequests**: `5` = `5`

#### UPDATE\_PROFILE.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### UPDATE\_PROFILE.actionType

> `readonly` **actionType**: `"update_profile"` = `'update_profile'`

### OPEN\_POSITION

> `readonly` **OPEN\_POSITION**: `object`

#### OPEN\_POSITION.maxRequests

> `readonly` **maxRequests**: `10` = `10`

#### OPEN\_POSITION.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### OPEN\_POSITION.actionType

> `readonly` **actionType**: `"open_position"` = `'open_position'`

### CLOSE\_POSITION

> `readonly` **CLOSE\_POSITION**: `object`

#### CLOSE\_POSITION.maxRequests

> `readonly` **maxRequests**: `10` = `10`

#### CLOSE\_POSITION.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### CLOSE\_POSITION.actionType

> `readonly` **actionType**: `"close_position"` = `'close_position'`

### BUY\_PREDICTION

> `readonly` **BUY\_PREDICTION**: `object`

#### BUY\_PREDICTION.maxRequests

> `readonly` **maxRequests**: `10` = `10`

#### BUY\_PREDICTION.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### BUY\_PREDICTION.actionType

> `readonly` **actionType**: `"buy_prediction"` = `'buy_prediction'`

### SELL\_PREDICTION

> `readonly` **SELL\_PREDICTION**: `object`

#### SELL\_PREDICTION.maxRequests

> `readonly` **maxRequests**: `10` = `10`

#### SELL\_PREDICTION.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### SELL\_PREDICTION.actionType

> `readonly` **actionType**: `"sell_prediction"` = `'sell_prediction'`

### ADMIN\_ACTION

> `readonly` **ADMIN\_ACTION**: `object`

#### ADMIN\_ACTION.maxRequests

> `readonly` **maxRequests**: `100` = `100`

#### ADMIN\_ACTION.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### ADMIN\_ACTION.actionType

> `readonly` **actionType**: `"admin_action"` = `'admin_action'`

### DEFAULT

> `readonly` **DEFAULT**: `object`

#### DEFAULT.maxRequests

> `readonly` **maxRequests**: `30` = `30`

#### DEFAULT.windowMs

> `readonly` **windowMs**: `60000` = `60000`

#### DEFAULT.actionType

> `readonly` **actionType**: `"default"` = `'default'`
