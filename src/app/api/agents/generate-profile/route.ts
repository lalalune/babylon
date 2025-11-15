/**
 * Agent Profile Generation API
 * 
 * @route POST /api/agents/generate-profile
 * @access Authenticated
 * 
 * @description
 * Generates a complete agent profile based on a selected archetype and user context.
 * Uses AI to create name, description, system prompt, bio points, personality, and
 * trading strategy tailored to the archetype characteristics.
 * 
 * @param {object} archetype - Archetype object with id, name, emoji, description
 * @param {object} userProfile - Optional user context (name, username, bio)
 * 
 * @returns {object} Generated agent profile
 * @property {string} name - Generated agent name
 * @property {string} description - Brief agent description
 * @property {string} system - System prompt
 * @property {array} bio - Array of bio points
 * @property {string} personality - Personality description
 * @property {string} tradingStrategy - Trading strategy description
 * 
 * @throws {400} Invalid input parameters
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/server-auth'
import { logger } from '@/lib/logger'
import { callGroqDirect } from '@/lib/agents/llm/direct-groq'
import { checkRateLimitAndDuplicates, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiting'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateUser(req)
    
    // Apply rate limiting - 5 generations per minute
    const rateLimitError = checkRateLimitAndDuplicates(
      user.userId,
      null, // No duplicate detection for agent generation
      RATE_LIMIT_CONFIGS.GENERATE_AGENT_PROFILE
    )
    
    if (rateLimitError) {
      logger.warn('Agent profile generation rate limit exceeded', { userId: user.userId }, 'GenerateProfile')
      return rateLimitError
    }
    
    const body = await req.json()
    const { archetype, userProfile, existingProfile } = body

    logger.info(`Generating agent profile`, { 
      hasArchetype: !!archetype, 
      hasExistingProfile: !!existingProfile 
    }, 'GenerateProfile')

    let prompt: string

    if (existingProfile) {
      // Regenerating based on existing profile
      prompt = `You are an expert at creating AI agent personas for a prediction markets and trading platform.

Regenerate a fresh, creative agent profile while keeping the same general theme and style as this existing profile:

**Current Profile:**
- Name: ${existingProfile.name}
- Description: ${existingProfile.description || 'Not set'}
- System Prompt: ${existingProfile.system}
- Personality: ${existingProfile.personality || 'Not set'}
- Trading Strategy: ${existingProfile.tradingStrategy || 'Not set'}

${userProfile?.name ? `The user creating this agent is: ${userProfile.name} (@${userProfile.username || 'user'})${userProfile.bio ? `\nUser bio: ${userProfile.bio}` : ''}` : ''}

Generate a JSON response with the following fields:`
    } else if (archetype) {
      // Initial generation with archetype
      prompt = `You are an expert at creating AI agent personas for a prediction markets and trading platform.

Create a complete agent profile based on this archetype:
**${archetype.name}** ${archetype.emoji}
${archetype.description}

${userProfile?.name ? `The user creating this agent is: ${userProfile.name} (@${userProfile.username || 'user'})${userProfile.bio ? `\nUser bio: ${userProfile.bio}` : ''}` : ''}

Generate a JSON response with the following fields:`
    } else {
      // No archetype or existing profile
      prompt = `You are an expert at creating AI agent personas for a prediction markets and trading platform.

Create a unique agent profile for an AI trading agent.

${userProfile?.name ? `The user creating this agent is: ${userProfile.name} (@${userProfile.username || 'user'})${userProfile.bio ? `\nUser bio: ${userProfile.bio}` : ''}` : ''}

Generate a JSON response with the following fields:`
    }

    prompt += `
{
  "name": "Creative agent name (2-4 words, no emojis)",
  "description": "One sentence description (max 150 chars)",
  "system": "Detailed system prompt that defines the agent's identity, behavior, and approach (2-3 paragraphs). Include specific instructions about how they analyze markets, make decisions, and interact with users.",
  "bio": ["3-5 short bio points that highlight key traits, strengths, or approaches"],
  "personality": "Personality description (2-3 sentences describing communication style and temperament)",
  "tradingStrategy": "Detailed trading strategy (2-3 paragraphs explaining their approach to markets, risk management, and decision-making process)"
}

Make it specific to the archetype. For example:
- "Degen" should be risk-taking, YOLO-focused, meme-savvy
- "Goody Two Shoes" should be ethical, conservative, rule-following  
- "Scammer" should be manipulative, deceptive, always looking for an angle
- "Super Predictor" should be data-driven, analytical, methodical
- "InfoSec" should be security-focused, paranoid about risks, cautious

The agent should have a distinct personality that shines through in every field.

Respond ONLY with valid JSON, no markdown formatting.`

    const response = await callGroqDirect({
      prompt,
      modelSize: 'large',
      temperature: 0.9,
      maxTokens: 2000
    })

    // Parse the AI response
    let generated
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/```\s*([\s\S]*?)\s*```/)
      const cleanedResponse = jsonMatch ? jsonMatch[1] : response
      if (!cleanedResponse) {
        throw new Error('Failed to extract JSON from response')
      }
      generated = JSON.parse(cleanedResponse.trim())
    } catch (parseError) {
      logger.error('Failed to parse AI response', { error: parseError, response }, 'GenerateProfile')
      return NextResponse.json({
        success: false,
        error: 'Failed to generate valid profile'
      }, { status: 500 })
    }

    // Validate the generated profile
    if (!generated.name || !generated.system || !generated.bio || !Array.isArray(generated.bio)) {
      logger.error('Invalid generated profile structure', { generated }, 'GenerateProfile')
      return NextResponse.json({
        success: false,
        error: 'Generated profile missing required fields'
      }, { status: 500 })
    }

    logger.info(`Successfully generated profile for ${archetype.name}`, undefined, 'GenerateProfile')

    return NextResponse.json({
      success: true,
      ...generated
    })
  } catch (error) {
    logger.error('Error generating agent profile', { error }, 'GenerateProfile')
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate profile'
    }, { status: 500 })
  }
}
