/**
 * Trending Summary Service
 * 
 * Generates real LLM-powered summaries for trending tags (not templates)
 */

import { logger } from '@/lib/logger'
import OpenAI from 'openai'

// Prioritize Groq (faster and more reliable for this use case)
const useGroq = !!process.env.GROQ_API_KEY
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: useGroq
    ? 'https://api.groq.com/openai/v1'
    : 'https://api.openai.com/v1',
})

/**
 * Generate a one-sentence summary for a trending tag based on recent posts
 */
export async function generateTrendingSummary(
  tagDisplayName: string,
  category: string | null,
  recentPosts: string[]
): Promise<string> {
  // Combine recent posts for context
  const context = recentPosts.slice(0, 3).join(' | ')
  
  const prompt = `Generate a ONE SENTENCE summary for the trending topic "${tagDisplayName}" (Category: ${category || 'General'}).

Recent posts about this topic:
${context}

Requirements:
- Exactly ONE sentence, no more than 12 words
- Describe what people are discussing/why it's trending
- Natural, engaging tone like X/Twitter
- No hashtags, no emojis
- Don't start with "People are..." or "Users are..."

Examples:
- "Latest developments in SpaceX launch schedule"
- "Market reactions to new AI regulation"
- "Breaking news on election results"

One sentence summary:`

  const response = await openai.chat.completions.create({
    model: useGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a trending topics summarization expert. Generate concise, engaging one-sentence summaries.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 50,
  })

  const summary = response.choices[0]?.message?.content?.trim()
  
  if (!summary) {
    throw new Error('Empty summary from LLM');
  }

  // Clean up the summary
  let cleanSummary = summary
    .replace(/^["']|["']$/g, '') // Remove quotes
    .replace(/\.$/, '') // Remove trailing period (we'll add it back)
    .trim()
  
  // Ensure it ends with a period
  if (!cleanSummary.endsWith('.') && !cleanSummary.endsWith('!') && !cleanSummary.endsWith('?')) {
    cleanSummary += '.'
  }

  // Validate length (should be concise)
  const wordCount = cleanSummary.split(' ').length
  if (wordCount > 20) {
    throw new Error('Summary too long');
  }

  logger.debug('Generated trending summary', {
    tag: tagDisplayName,
    summary: cleanSummary,
    wordCount,
  }, 'TrendingSummaryService')

  return cleanSummary
}

/**
 * Generate summaries for multiple trending tags
 */
export async function generateTrendingSummaries(
  tags: Array<{
    displayName: string
    category: string | null
    recentPosts: string[]
  }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  // Process in small batches to avoid rate limits
  for (const tag of tags) {
    const summary = await generateTrendingSummary(
      tag.displayName,
      tag.category,
      tag.recentPosts
    )
    results.set(tag.displayName, summary)
    
    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}
