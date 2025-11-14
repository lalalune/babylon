[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/ArticleGenerator](../README.md) / Article

# Interface: Article

Defined in: [src/engine/ArticleGenerator.ts:89](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L89)

Long-form news article with metadata

 Article

## Properties

### id

> **id**: `string`

Defined in: [src/engine/ArticleGenerator.ts:90](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L90)

Unique snowflake ID

***

### title

> **title**: `string`

Defined in: [src/engine/ArticleGenerator.ts:91](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L91)

Article headline

***

### summary

> **summary**: `string`

Defined in: [src/engine/ArticleGenerator.ts:92](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L92)

2-3 sentence summary for listings

***

### content

> **content**: `string`

Defined in: [src/engine/ArticleGenerator.ts:93](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L93)

Full article body (800-1500 words)

***

### authorOrgId

> **authorOrgId**: `string`

Defined in: [src/engine/ArticleGenerator.ts:94](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L94)

Publishing organization ID

***

### authorOrgName

> **authorOrgName**: `string`

Defined in: [src/engine/ArticleGenerator.ts:95](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L95)

Publishing organization name

***

### byline?

> `optional` **byline**: `string`

Defined in: [src/engine/ArticleGenerator.ts:96](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L96)

Optional journalist byline

***

### bylineActorId?

> `optional` **bylineActorId**: `string`

Defined in: [src/engine/ArticleGenerator.ts:97](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L97)

Optional journalist actor ID

***

### biasScore?

> `optional` **biasScore**: `number`

Defined in: [src/engine/ArticleGenerator.ts:98](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L98)

Bias direction (-1 critical, 0 neutral, +1 protective)

***

### sentiment?

> `optional` **sentiment**: `"positive"` \| `"negative"` \| `"neutral"`

Defined in: [src/engine/ArticleGenerator.ts:99](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L99)

Overall article sentiment

***

### slant?

> `optional` **slant**: `string`

Defined in: [src/engine/ArticleGenerator.ts:100](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L100)

Description of editorial angle

***

### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/engine/ArticleGenerator.ts:101](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L101)

Optional hero image

***

### relatedEventId?

> `optional` **relatedEventId**: `string`

Defined in: [src/engine/ArticleGenerator.ts:102](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L102)

Event this article covers

***

### relatedQuestion?

> `optional` **relatedQuestion**: `number`

Defined in: [src/engine/ArticleGenerator.ts:103](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L103)

Optional prediction market question ID

***

### relatedActorIds

> **relatedActorIds**: `string`[]

Defined in: [src/engine/ArticleGenerator.ts:104](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L104)

Actors mentioned in article

***

### relatedOrgIds

> **relatedOrgIds**: `string`[]

Defined in: [src/engine/ArticleGenerator.ts:105](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L105)

Organizations mentioned in article

***

### category?

> `optional` **category**: `string`

Defined in: [src/engine/ArticleGenerator.ts:106](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L106)

Article category (e.g., 'tech', 'scandal', 'finance')

***

### tags

> **tags**: `string`[]

Defined in: [src/engine/ArticleGenerator.ts:107](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L107)

SEO/filtering tags

***

### publishedAt

> **publishedAt**: `Date`

Defined in: [src/engine/ArticleGenerator.ts:108](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/ArticleGenerator.ts#L108)

Publication timestamp
