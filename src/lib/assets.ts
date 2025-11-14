/**
 * Asset URL utilities for static files
 * Handles URLs for both local development and Vercel deployment
 */

/**
 * Get the base URL for static assets
 * In Next.js, files in /public are served from the root path /
 * Works the same locally and on Vercel
 */
export function getStaticAssetUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  
  // In production (Vercel), you might want to use a CDN
  // For now, we'll use the default Next.js behavior
  if (process.env.NEXT_PUBLIC_STATIC_ASSETS_URL) {
    return `${process.env.NEXT_PUBLIC_STATIC_ASSETS_URL}${normalizedPath}`
  }
  
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
 * 1. Uploaded profile image URL (from S3/Blob storage)
 * 2. Static actor image from /public/images/actors/
 * 3. Returns null if not found (Avatar component will handle fallback on error)
 */
export function getProfileImageUrl(
  profileImageUrl: string | null | undefined,
  userId: string | null | undefined,
  isActor: boolean = true
): string | null {
  // If profile image URL is provided (uploaded image), use it
  if (profileImageUrl) {
    return profileImageUrl
  }
  
  // For actors, try to use static image from public/images/actors/
  if (userId && isActor) {
    return getStaticAssetUrl(`/images/actors/${userId}.jpg`)
  }
  
  // No image available - Avatar component will handle fallback
  return null
}

/**
 * Get organization image URL
 */
export function getOrganizationImageUrl(
  imageUrl: string | null | undefined,
  orgId: string | null | undefined
): string | null {
  if (imageUrl) {
    return imageUrl
  }
  
  if (orgId) {
    return getStaticAssetUrl(`/images/organizations/${orgId}.jpg`)
  }
  
  return null
}

