[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/duplicate-detector](../README.md) / DUPLICATE\_DETECTION\_CONFIGS

# Variable: DUPLICATE\_DETECTION\_CONFIGS

> `const` **DUPLICATE\_DETECTION\_CONFIGS**: `object`

Defined in: [src/lib/rate-limiting/duplicate-detector.ts:23](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/duplicate-detector.ts#L23)

Duplicate detection configurations

## Type Declaration

### POST

> `readonly` **POST**: `object`

#### POST.windowMs

> `readonly` **windowMs**: `number`

#### POST.actionType

> `readonly` **actionType**: `"post"` = `'post'`

### COMMENT

> `readonly` **COMMENT**: `object`

#### COMMENT.windowMs

> `readonly` **windowMs**: `number`

#### COMMENT.actionType

> `readonly` **actionType**: `"comment"` = `'comment'`

### MESSAGE

> `readonly` **MESSAGE**: `object`

#### MESSAGE.windowMs

> `readonly` **windowMs**: `number`

#### MESSAGE.actionType

> `readonly` **actionType**: `"message"` = `'message'`
