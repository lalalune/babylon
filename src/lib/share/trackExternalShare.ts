import { logger } from '@/lib/logger'

type SharePlatform = 'twitter' | 'farcaster' | 'link' | 'native' | 'download' | 'other'

type ShareContentType = 'post' | 'profile' | 'market' | 'referral' | 'leaderboard'

interface TrackExternalShareOptions {
  platform: SharePlatform
  contentType: ShareContentType
  contentId?: string
  url: string
  userId?: string | null
}

interface TrackExternalShareResult {
  shareActionId: string | null
  pointsAwarded: number
  alreadyAwarded: boolean
}

const DEFAULT_RESULT: TrackExternalShareResult = {
  shareActionId: null,
  pointsAwarded: 0,
  alreadyAwarded: false,
}

export async function trackExternalShare(
  options: TrackExternalShareOptions,
): Promise<TrackExternalShareResult> {
  const { platform, contentType, contentId, url, userId } = options

  if (!userId) {
    logger.warn(
      'Unable to track external share without authenticated user',
      { platform, contentType },
      'trackExternalShare',
    )
    return DEFAULT_RESULT
  }

  const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
  if (!token) {
    logger.warn(
      'No access token available when attempting to track external share',
      { platform },
      'trackExternalShare',
    )
    return DEFAULT_RESULT
  }

  const response = await fetch(`/api/users/${encodeURIComponent(userId)}/share`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      platform,
      contentType,
      contentId,
      url,
    }),
  })

  if (!response.ok) {
    const errorPayload = await response.json()
    logger.warn(
      'Failed to track external share',
      { platform, status: response.status, error: errorPayload?.error },
      'trackExternalShare',
    )
    return DEFAULT_RESULT
  }

  const data = await response.json()
  const pointsAwarded = Number(data?.points?.awarded ?? 0)
  const alreadyAwarded = Boolean(data?.points?.alreadyAwarded)
  const shareActionId = data?.shareAction?.id ?? null

  if (pointsAwarded > 0) {
    logger.info(
      `Awarded ${pointsAwarded} points for ${platform} share`,
      { platform, pointsAwarded },
      'trackExternalShare',
    )
  }

  return {
    shareActionId,
    pointsAwarded,
    alreadyAwarded,
  }
}



