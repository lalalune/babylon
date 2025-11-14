/**
 * Tag Generation Service
 * 
 * Generates organic tags from post content using LLM
 * Similar to X's trending topics extraction
 */

import { logger } from '@/lib/logger'
import type OpenAI from 'openai'

type OpenAIClient = OpenAI

// Try Groq first, then OpenAI (Groq is faster and often more reliable)
const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
const baseURL = process.env.GROQ_API_KEY
  ? 'https://api.groq.com/openai/v1'
  : 'https://api.openai.com/v1'

// Lazy initialization - only create client when needed and API key is available
let openaiClient: OpenAIClient | null = null
let openaiImportAttempted = false

async function getOpenAIClient(): Promise<OpenAIClient | null> {
  if (!apiKey) {
    return null // No API key configured
  }
  if (openaiClient) {
    return openaiClient
  }

  if (!openaiImportAttempted) {
    openaiImportAttempted = true
    try {
      const { default: OpenAI } = await import('openai')
      openaiClient = new OpenAI({
        apiKey,
        baseURL,
      })
    } catch (error) {
      logger.warn(
        'OpenAI SDK not available, tag generation disabled',
        { error },
        'TagGenerationService'
      )
      openaiClient = null
    }
  }

  return openaiClient
}

export interface GeneratedTag {
  name: string        // lowercase, normalized (e.g., "nfc-north")
  displayName: string // original display format (e.g., "NFC North")
  category?: string   // auto-detected category (e.g., "Sports", "Politics", "Tech")
}

/**
 * Generate 1-3 organic tags from post content
 */
export async function generateTagsFromPost(content: string): Promise<GeneratedTag[]> {
  const openai = await getOpenAIClient()
  
  // If no API key configured, return empty tags (graceful degradation)
  if (!openai) {
    logger.warn('Tag generation skipped - no GROQ_API_KEY or OPENAI_API_KEY configured', undefined, 'TagGenerationService')
    return []
  }
  
  const prompt = `Analyze this social media post and extract 1-3 organic, trending-worthy tags.

Post: "${content}"

Rules:
1. Extract natural topics, names, events, or themes that people would search for
2. Format like X/Twitter trending topics (e.g., "NFC North", "Puka", "FanDuel")
3. Prioritize proper nouns, events, organizations, or trending terms
4. Keep tags concise (1-3 words max)
5. Return 1-3 tags only (prefer quality over quantity)
6. Categorize each tag (Sports, Politics, Tech, Finance, Entertainment, etc.)

Return ONLY valid XML in this exact format:
<tags>
  <tag>
    <displayName>NFC North</displayName>
    <category>Sports</category>
  </tag>
  <tag>
    <displayName>Puka</displayName>
    <category>Sports</category>
  </tag>
</tags>

If no good tags can be extracted, return: <tags></tags>`

  // Use llama-3.1-8b-instant (130k in, 130k out - no restrictions!)
  const model = process.env.GROQ_API_KEY 
    ? 'llama-3.1-8b-instant' // 130k in/out, fast, no token limits
    : 'gpt-4o-mini'

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an XML-only assistant for tag extraction. You must respond ONLY with valid XML. No JSON, no explanations, no markdown.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 500, // Increased for XML (more verbose than JSON)
  })

  const content_text = response.choices[0]?.message?.content?.trim()
  if (!content_text) {
    logger.warn('No content in tag generation response', { content }, 'TagGenerationService')
    return []
  }

  // Parse XML instead of JSON
  const xmlContent = content_text
    .replace(/```xml\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  
  // Extract tags from XML
  const tags: Array<{ displayName: string; category?: string }> = [];
  
  try {
    // Simple XML parsing for tag structure
    const tagMatches = xmlContent.matchAll(/<tag>([\s\S]*?)<\/tag>/g);
    
    for (const tagMatch of tagMatches) {
      const tagContent = tagMatch[1];
      if (!tagContent) continue;
      
      const displayNameMatch = tagContent.match(/<displayName>(.*?)<\/displayName>/);
      const categoryMatch = tagContent.match(/<category>(.*?)<\/category>/);
      
      if (displayNameMatch && displayNameMatch[1]) {
        tags.push({
          displayName: displayNameMatch[1].trim(),
          category: categoryMatch?.[1]?.trim(),
        });
      }
    }
    
    // If no tags found, try alternative structure
    if (tags.length === 0) {
      logger.warn('No tags found in XML, trying alternative parsing', { 
        xmlPreview: xmlContent.substring(0, 200) 
      }, 'TagGenerationService');
    }
  } catch (error) {
    logger.error('Failed to parse tag generation XML', { 
      error, 
      xmlContent: xmlContent.substring(0, 200),
      contentPreview: content.substring(0, 100)
    }, 'TagGenerationService');
    // Return empty array on parse error instead of crashing
    return [];
  }

  const generatedTags: GeneratedTag[] = tags
    .filter(tag => tag.displayName && typeof tag.displayName === 'string')
    .map(tag => {
      const displayName = tag.displayName.trim()
      const name = displayName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      
      return {
        name,
        displayName,
        category: tag.category,
      }
    })
    .filter(tag => tag.name.length > 0 && tag.displayName.length <= 50)

  logger.debug('Generated tags from post', {
    content: content.slice(0, 100),
    tagsCount: generatedTags.length,
    tags: generatedTags,
  }, 'TagGenerationService')

  return generatedTags
}

/**
 * Generate tags in batch for multiple posts
 */
export async function generateTagsForPosts(
  posts: Array<{ id: string; content: string }>
): Promise<Map<string, GeneratedTag[]>> {
  const results = new Map<string, GeneratedTag[]>()

  // Process posts concurrently with a limit to avoid rate limits
  const BATCH_SIZE = 5
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE)
    const promises = batch.map(async (post) => {
      const tags = await generateTagsFromPost(post.content)
      return { postId: post.id, tags }
    })

    const batchResults = await Promise.all(promises)
    for (const { postId, tags } of batchResults) {
      results.set(postId, tags)
    }

    // Small delay between batches
    if (i + BATCH_SIZE < posts.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

