/**
 * Trending Topics Provider
 * Provides current trending tags and topics
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * Provider: Trending Topics
 * Gets current trending tags and topics with post counts
 */
export const trendingTopicsProvider: Provider = {
  name: 'BABYLON_TRENDING_TOPICS',
  description: 'Get currently trending topics and tags on Babylon',
  
  get: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    try {
      // Get trending tags from the last calculation
      const trending = await prisma.trendingTag.findMany({
        where: {
          // Get latest trending calculation
          calculatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        include: {
          Tag: {
            select: {
              id: true,
              name: true,
              displayName: true,
              category: true
            }
          }
        },
        orderBy: {
          rank: 'asc'
        },
        take: 10
      })
      
      if (trending.length === 0) {
        // Fallback: Get most used tags in last 24h
        const recentTags = await prisma.post.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          },
          select: {
            PostTag: {
              include: {
                Tag: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    category: true
                  }
                }
              }
            }
          },
          take: 100
        })
        
        // Count tag usage
        const tagCounts = new Map<string, { tag: any; count: number }>()
        
        for (const post of recentTags) {
          for (const postTag of post.PostTag) {
            const tagId = postTag.Tag.id
            const existing = tagCounts.get(tagId)
            if (existing) {
              existing.count++
            } else {
              tagCounts.set(tagId, { tag: postTag.Tag, count: 1 })
            }
          }
        }
        
        const topTags = Array.from(tagCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
        
        if (topTags.length === 0) {
          return { text: 'No trending topics available.' }
        }
        
        const topicsText = topTags
          .map((t, i) => `${i + 1}. #${t.tag.name} (${t.tag.displayName || t.tag.name})
   Category: ${t.tag.category || 'General'}
   ${t.count} posts`)
          .join('\n\n')
        
        return { 
          text: `🔥 Trending Topics:

${topicsText}`,
          data: {
            topics: topTags.map(t => ({
              id: t.tag.id,
              name: t.tag.name,
              displayName: t.tag.displayName,
              category: t.tag.category,
              postCount: t.count,
              score: t.count
            }))
          }
        }
      }
      
      const topicsText = trending
        .map((t, i) => `${i + 1}. #${t.Tag.name} (${t.Tag.displayName || t.Tag.name})
   Category: ${t.Tag.category || 'General'}
   ${t.postCount} posts | Score: ${t.score.toFixed(1)}${t.relatedContext ? `\n   ${t.relatedContext}` : ''}`)
        .join('\n\n')
      
      return { 
        text: `🔥 Trending Topics:

${topicsText}`,
        data: {
          topics: trending.map(t => ({
            id: t.Tag.id,
            name: t.Tag.name,
            displayName: t.Tag.displayName,
            category: t.Tag.category,
            postCount: t.postCount,
            rank: t.rank,
            score: t.score,
            relatedContext: t.relatedContext
          }))
        }
      }
    } catch (error) {
      logger.error('Failed to fetch trending topics', error, 'TrendingTopicsProvider')
      return { text: 'Unable to fetch trending topics at this time.' }
    }
  }
}

