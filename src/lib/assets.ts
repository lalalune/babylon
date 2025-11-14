/**
 * Asset URL utilities for static files
 * Handles URLs for both local development and Vercel deployment with CDN storage
 */

/**
 * Check if a URL is already absolute (CDN URL, external URL, or data URL)
 */
function isAbsoluteUrl(url: string): boolean {
  return /^(https?:|data:|blob:)/i.test(url)
}

/**
 * Get the base URL for static assets
 * In Next.js, files in /public are served from the root path /
 * This function supports both:
 * - Legacy public folder assets (during migration)
 * - CDN assets (Vercel Blob in production, MinIO in dev)
 */
export function getStaticAssetUrl(path: string): string {
  // If already an absolute URL (CDN, external, or data), return as-is
  if (isAbsoluteUrl(path)) {
    return path
  }
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  
  // In production with CDN configured, use CDN URL
  if (process.env.NEXT_PUBLIC_STATIC_ASSETS_URL) {
    return `${process.env.NEXT_PUBLIC_STATIC_ASSETS_URL}${normalizedPath}`
  }
  
  // For local development with MinIO, CDN assets will already be absolute URLs
  // from the storage client, so this mainly handles public folder fallbacks
  return normalizedPath
}

/**
 * Get deterministic fallback profile image based on ID
 * Returns a random-looking but deterministic profile image from the user-profiles set
 */
export function getFallbackProfileImageUrl(id: string): string {
  // Hash the id to get a number between 1-100
  const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const profileNum = (hash % 100) + 1
  return getStaticAssetUrl(`/assets/user-profiles/profile-${profileNum}.jpg`)
}

/**
 * Get actor/user profile image URL
 * Tries multiple sources in order:
 * 1. Uploaded profile image URL (from CDN storage - Vercel Blob or MinIO)
 * 2. Static actor image from CDN or public/images/actors/
 * 3. Returns null if not found (Avatar component will handle fallback on error)
 */
export function getProfileImageUrl(
  profileImageUrl: string | null | undefined,
  userId: string | null | undefined,
  isActor: boolean = true
): string | null {
  // If profile image URL is provided (uploaded image from CDN), use it
  if (profileImageUrl) {
    // If it's already a CDN URL, return as-is
    if (isAbsoluteUrl(profileImageUrl)) {
      return profileImageUrl
    }
    // Otherwise, normalize it through getStaticAssetUrl
    return getStaticAssetUrl(profileImageUrl)
  }
  
  // For actors, try to use static image
  // This could be from CDN (after migration) or public folder (legacy)
  if (userId && isActor) {
    return getStaticAssetUrl(`/images/actors/${userId}.jpg`)
  }
  
  // No image available - Avatar component will handle fallback
  return null
}

/**
 * Get organization image URL
 * Handles both CDN URLs and legacy public folder paths
 */
export function getOrganizationImageUrl(
  imageUrl: string | null | undefined,
  orgId: string | null | undefined
): string | null {
  // If image URL is provided, use it
  if (imageUrl) {
    // If it's already a CDN URL, return as-is
    if (isAbsoluteUrl(imageUrl)) {
      return imageUrl
    }
    // Otherwise, normalize it
    return getStaticAssetUrl(imageUrl)
  }
  
  // For organizations, try to use static image
  if (orgId) {
    return getStaticAssetUrl(`/images/organizations/${orgId}.jpg`)
  }
  
  return null
}

/**
 * Get banner image URL (for actors, organizations, or users)
 * Handles both CDN URLs and legacy public folder paths
 */
export function getBannerImageUrl(
  bannerUrl: string | null | undefined,
  entityId: string | null | undefined,
  entityType: 'actor' | 'organization' | 'user' = 'actor'
): string | null {
  // If banner URL is provided, use it
  if (bannerUrl) {
    // If it's already a CDN URL, return as-is
    if (isAbsoluteUrl(bannerUrl)) {
      return bannerUrl
    }
    // Otherwise, normalize it
    return getStaticAssetUrl(bannerUrl)
  }
  
  // For actors/organizations, try to use static banner image
  if (entityId) {
    if (entityType === 'actor') {
      return getStaticAssetUrl(`/images/actor-banners/${entityId}.jpg`)
    } else if (entityType === 'organization') {
      return getStaticAssetUrl(`/images/org-banners/${entityId}.jpg`)
    }
  }
  
  return null
}
