/**
 * Content Safety Utilities
 * 
 * Basic content filtering for agent chat and generation
 * For production, consider integrating with OpenAI Moderation API or similar service
 */

import { logger } from '@/lib/logger'

// Basic profanity and abuse detection (expandable)
const BLOCKED_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|cunt|nigger|nigga|faggot|retard)\b/gi,
  /(kill yourself|kys|suicide)/gi,
  /(hack|exploit|ddos|dos attack)/gi,
]

// Prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore (previous|all|above) instructions?/gi,
  /system:?\s*you are now/gi,
  /\[system\]/gi,
  /forget (everything|all|previous)/gi,
  /<\|.*?\|>/gi, // Special tokens
]

export interface ContentCheckResult {
  safe: boolean
  reason?: string
  category?: 'profanity' | 'abuse' | 'injection' | 'spam'
}

/**
 * Check if user input is safe
 */
export function checkUserInput(content: string): ContentCheckResult {
  if (!content || content.trim().length === 0) {
    return { safe: false, reason: 'Empty content', category: 'spam' }
  }

  // Check length
  if (content.length > 2000) {
    return { safe: false, reason: 'Message too long', category: 'spam' }
  }

  // Check for excessive repetition (spam)
  const words = content.split(/\s+/)
  if (words.length > 5) {
    const uniqueWords = new Set(words)
    const repetitionRatio = words.length / uniqueWords.size
    if (repetitionRatio > 3) {
      return { safe: false, reason: 'Excessive repetition detected', category: 'spam' }
    }
  }

  // Check for profanity
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      logger.warn('Blocked profanity in user input', { preview: content.substring(0, 50) })
      return { 
        safe: false, 
        reason: 'Content contains inappropriate language', 
        category: 'profanity' 
      }
    }
  }

  // Check for prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      logger.warn('Blocked prompt injection attempt', { preview: content.substring(0, 50) })
      return { 
        safe: false, 
        reason: 'Invalid input format', 
        category: 'injection' 
      }
    }
  }

  return { safe: true }
}

/**
 * Check if agent-generated content is safe to return
 */
export function checkAgentOutput(content: string): ContentCheckResult {
  if (!content || content.trim().length === 0) {
    return { safe: false, reason: 'Empty response', category: 'spam' }
  }

  // Check for profanity in output
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      logger.warn('Agent generated inappropriate content', { preview: content.substring(0, 50) })
      return { 
        safe: false, 
        reason: 'Generated content needs review', 
        category: 'profanity' 
      }
    }
  }

  // Check if response leaked system instructions
  if (content.toLowerCase().includes('you are') && content.toLowerCase().includes('system')) {
    logger.warn('Agent may have leaked system prompt')
    return { 
      safe: false, 
      reason: 'Response format invalid', 
      category: 'injection' 
    }
  }

  return { safe: true }
}

/**
 * Sanitize content by removing or replacing problematic parts
 * Use this as a last resort - better to regenerate
 */
export function sanitizeContent(content: string): string {
  let sanitized = content

  // Remove system prompt leakage
  sanitized = sanitized.replace(/\[?system\]?:.*$/gim, '')
  
  // Remove special tokens
  sanitized = sanitized.replace(/<\|.*?\|>/g, '')
  
  return sanitized.trim()
}

