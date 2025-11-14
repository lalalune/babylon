/**
 * API Route: /api/onboarding/generate-profile
 * Methods: GET (generate AI profile data for new users)
 */

import { BabylonLLMClient } from '@/generator/llm/openai-client';
import { successResponse } from '@/lib/api/auth-middleware';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';
import { 
  uniqueNamesGenerator, 
  adjectives, 
  animals, 
  colors,
  countries,
  names,
  starWars
} from 'unique-names-generator';

interface ProfileData {
  name: string;
  username: string;
  bio: string;
}


/**
 * GET /api/onboarding/generate-profile
 * Generate AI profile data for onboarding
 */
export async function GET(_request: NextRequest) {
  const llmClient = new BabylonLLMClient();
  
  // Generate random words for entropy/inspiration
  const randomAnimal = uniqueNamesGenerator({ dictionaries: [animals], length: 1 });
  const randomColor = uniqueNamesGenerator({ dictionaries: [colors], length: 1 });
  const randomAdjective = uniqueNamesGenerator({ dictionaries: [adjectives], length: 1 });
  const randomCountry = uniqueNamesGenerator({ dictionaries: [countries], length: 1 });
  const randomName = uniqueNamesGenerator({ dictionaries: [names], length: 1 });
  const randomStarWars = uniqueNamesGenerator({ dictionaries: [starWars], length: 1 });
  
  const prompt = `Generate a fun, memetic profile for a new social media user in the style of crypto/tech Twitter.

Requirements:
- name: A display name (2-3 words, creative, internet culture inspired)
- username: A handle without @ (alphanumeric and underscores only, 8-15 chars)
- bio: A short, funny bio (10-50 chars, meme-worthy, relatable to internet/crypto culture)

Examples:
{
  "name": "Cyber Chad",
  "username": "cyber_chad_69",
  "bio": "WAGMI 🚀"
}

{
  "name": "Degen Wizard",
  "username": "degen_wizard",
  "bio": "Professional meme investor 📈"
}

Generate a UNIQUE profile (don't copy examples). Keep it fun and shareable!

Here are some random words for inspiration (feel free to use or ignore):
- Animal: ${randomAnimal}
- Color: ${randomColor}
- Adjective: ${randomAdjective}
- Place: ${randomCountry}
- Name: ${randomName}
- Pop Culture: ${randomStarWars}

Return your response as XML in this exact format:
<response>
  <name>display name here</name>
  <username>handle_here</username>
  <bio>bio here</bio>
</response>`;

  const rawProfileData = await llmClient.generateJSON<ProfileData | { response: ProfileData }>(
    prompt,
    {
      required: ['name', 'username', 'bio'],
      properties: {
        name: { type: 'string' },
        username: { type: 'string' },
        bio: { type: 'string' },
      },
    },
    {
      temperature: 1.0,
      maxTokens: 200,
    }
  );

  // Handle XML structure
  const profileData = 'response' in rawProfileData && rawProfileData.response
    ? rawProfileData.response
    : rawProfileData as ProfileData;

  profileData.username = profileData.username
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
    .slice(0, 20);

  logger.info('Generated AI profile', profileData, 'GET /api/onboarding/generate-profile');

  return successResponse(profileData);
}

