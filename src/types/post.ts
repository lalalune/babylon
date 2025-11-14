/**
 * Post Types
 * 
 * Types for handling posts that can be authored by either Users or Actors
 */

import type { User, Actor } from '@prisma/client'

/**
 * Post author union type - can be either User or Actor
 */
export type PostAuthor = (User & { isActor: true }) | (Actor & { isActor: false })

/**
 * Post with author (can be User or Actor)
 */
export interface PostWithAuthor {
  id: string
  content: string
  authorId: string
  gameId: string | null
  dayNumber: number | null
  // originalPostId: string | null  // Temporarily removed due to DB mismatch
  timestamp: Date
  createdAt: Date
  author?: User | null
  authorActor?: Actor | null
}

/**
 * Type guard to check if author is an Actor
 */
export function isActorAuthor(author: User | Actor | null | undefined): author is Actor {
  if (!author) return false
  // Actor has 'name' field, User has 'username' or 'displayName'
  return 'name' in author && !('username' in author)
}

/**
 * Type guard to check if author is a User
 */
export function isUserAuthor(author: User | Actor | null | undefined): author is User {
  if (!author) return false
  // User has 'username' or 'displayName', Actor has 'name'
  return 'username' in author || 'displayName' in author
}

/**
 * Get author display name (works for both User and Actor)
 */
export function getAuthorDisplayName(author: User | Actor | null | undefined): string {
  if (!author) return 'Unknown'
  
  if (isActorAuthor(author)) {
    return author.name
  }
  
  if (isUserAuthor(author)) {
    return author.displayName || author.username || author.id
  }
  
  return 'Unknown'
}

/**
 * Check if author is an actor (for filtering)
 */
export function authorIsActor(author: User | Actor | null | undefined): boolean {
  return isActorAuthor(author)
}

