/**
 * Complete Integration Example - EXAMPLE/DOCUMENTATION ONLY
 * 
 * ⚠️  This file is for DEMONSTRATION purposes only. It shows how to integrate
 * the prompt system but uses mock AI responses.
 * 
 * For production use, see:
 * - src/generator/GameGenerator.ts (actual LLM integration)
 * - src/engine/FeedGenerator.ts (production feed generation)
 * 
 * This demonstrates the full workflow:
 * 1. Generate world context from actors.json
 * 2. Render prompt with context
 * 3. Generate content (MOCK - replace with real AI in production)
 * 4. Validate output
 * 5. Handle failures and regeneration
 */

import {
  generateWorldContext,
  validateFeedPost,
  validatePostBatch,
  CHARACTER_LIMITS,
  type ValidationResult,
} from './index';
import { renderPrompt } from '@/prompts/loader';
import { ambientPosts, reactions, newsPosts, replies } from '@/prompts';

// ============================================================================
// Example 1: Generate a Single Ambient Post
// ============================================================================

export async function generateAmbientPost() {
  console.log('🚀 Generating ambient post...\n');

  // Step 1: Generate world context from database
  const worldContext = await generateWorldContext({
    maxActors: 30, // Limit to manage token usage
  });

  console.log('✅ World context generated');
  console.log('   Actors loaded:', worldContext.worldActors.split(',').length);

  // Step 2: Prepare prompt data
  const promptData = {
    day: 5,
    progressContext: 'Midway through the month',
    atmosphereContext: 'Markets are volatile',
    previousPostsContext: '',
    actorCount: 3,
    actorsList: `
1. AIlon Musk (@ailonmusk): Tech CEO, SpAIceX and TeslAI
2. Sam AIltman (@ailtman): CEO of OpnAI
3. Mark Zuckerborg (@markzuckerborg): CEO of MetAI
    `.trim(),
    ...worldContext,
  };

  // Step 3: Render the prompt
  const prompt = renderPrompt(ambientPosts, promptData);
  console.log('✅ Prompt rendered\n');

  // Step 4: Generate content (replace with your AI call)
  const generatedPosts = await mockAIGeneration(prompt);
  console.log('✅ Content generated');
  console.log('   Posts received:', generatedPosts.length);

  // Step 5: Validate each post
  const results = generatedPosts.map(post => ({
    post,
    validation: validateFeedPost(post, {
      maxLength: CHARACTER_LIMITS.AMBIENT,
      postType: 'AMBIENT',
    }),
  }));

  // Step 6: Handle results
  const valid = results.filter(r => r.validation.isValid);
  const invalid = results.filter(r => !r.validation.isValid);

  console.log(`\n✅ Valid posts: ${valid.length}`);
  console.log(`❌ Invalid posts: ${invalid.length}\n`);

  if (invalid.length > 0) {
    console.log('Invalid posts:');
    invalid.forEach(({ post, validation }, i) => {
      console.log(`\n${i + 1}. "${post}"`);
      console.log('   Violations:', validation.violations);
    });
  }

  return valid.map(r => r.post);
}

// ============================================================================
// Example 2: Generate Reactions with Retry Logic
// ============================================================================

export async function generateReactionsWithRetry(
  eventDescription: string,
  maxAttempts = 3
) {
  console.log('🚀 Generating reactions with retry logic...\n');

  const worldContext = await generateWorldContext();

  const promptData = {
    eventDescription,
    eventContext: 'Major tech news',
    phaseContext: '',
    relationshipContext: '',
    previousPostsContext: '',
    actorCount: 2,
    actorsList: `
1. Peter ThAIl (@peterthail): Founder of PalAIntir
2. Bill AIckman (@billaickman): Hedge fund activist
    `.trim(),
    ...worldContext,
  };

  let attempts = 0;
  let validPosts: string[] = [];

  while (attempts < maxAttempts && validPosts.length === 0) {
    attempts++;
    console.log(`Attempt ${attempts}/${maxAttempts}...`);

    const prompt = renderPrompt(reactions, promptData);
    const posts = await mockAIGeneration(prompt);

    const { allValid, results } = validatePostBatch(
      posts.map(post => ({ post, type: 'REACTION' as const }))
    );

    if (allValid) {
      validPosts = posts;
      console.log('✅ All posts valid!\n');
    } else {
      console.log('❌ Some posts invalid, retrying...');
      results.forEach(r => {
        if (!r.isValid) {
          console.log(`   - "${r.post}"`);
          console.log(`     ${r.violations.join(', ')}`);
        }
      });
    }
  }

  if (validPosts.length === 0) {
    throw new Error(`Failed to generate valid posts after ${maxAttempts} attempts`);
  }

  return validPosts;
}

// ============================================================================
// Example 3: Generate Multiple Post Types in Batch
// ============================================================================

export async function generateMixedFeedContent() {
  console.log('🚀 Generating mixed feed content...\n');

  const worldContext = await generateWorldContext({ maxActors: 50 });

  // Generate different types of posts
  const tasks = [
    {
      name: 'Ambient Posts',
      prompt: renderPrompt(ambientPosts, {
        day: 10,
        actorCount: 2,
        actorsList: '1. AIlon Musk\n2. Sam AIltman',
        ...worldContext,
      }),
      type: 'AMBIENT' as const,
    },
    {
      name: 'News Posts',
      prompt: renderPrompt(newsPosts, {
        eventDescription: 'OpnAI announces GPT-5',
        eventType: 'AI_BREAKTHROUGH',
        mediaCount: 2,
        mediaList: '1. The New York TAImes\n2. BloombAIrg',
        ...worldContext,
      }),
      type: 'JOURNALIST' as const,
    },
    {
      name: 'Replies',
      prompt: renderPrompt(replies, {
        originalAuthorName: 'AIlon',
        originalContent: 'Just bought more BTC for TeslAI balance sheet',
        replierCount: 2,
        repliersList: '1. Michael SAIlor\n2. Peter ThAIl',
        ...worldContext,
      }),
      type: 'REPLY' as const,
    },
  ];

  const allResults: Array<{
    name: string;
    posts: string[];
    validation: ValidationResult & { post: string };
  }> = [];

  for (const task of tasks) {
    console.log(`\n📝 Generating ${task.name}...`);
    const posts = await mockAIGeneration(task.prompt);

    const validation = validatePostBatch(
      posts.map(post => ({ post, type: task.type }))
    );

    console.log(
      `   ${validation.allValid ? '✅' : '❌'} Valid: ${
        validation.results.filter(r => r.isValid).length
      }/${posts.length}`
    );

    // Only push if we have at least one result
    const firstResult = validation.results[0]
    if (firstResult) {
      allResults.push({
        name: task.name,
        posts,
        validation: firstResult, // First result as example
      });
    }
  }

  return allResults;
}

// ============================================================================
// Example 4: Monitoring and Logging
// ============================================================================

export function setupValidationMonitoring() {
  // This would integrate with your logging/monitoring system
  return {
    logViolation: (post: string, violations: string[]) => {
      console.error('🚨 VALIDATION VIOLATION', {
        timestamp: new Date().toISOString(),
        post,
        violations,
      });

      // Send to your monitoring service
      // e.g., Sentry, DataDog, etc.
    },

    logSuccess: (post: string, type: string) => {
      console.log('✅ Valid post generated', {
        timestamp: new Date().toISOString(),
        type,
        length: post.length,
      });
    },

    getStats: () => ({
      // Would track over time
      totalGenerated: 0,
      totalValid: 0,
      totalInvalid: 0,
      commonViolations: {},
    }),
  };
}

// ============================================================================
// Helper: Mock AI Generation - EXAMPLE ONLY
// ============================================================================

/**
 * ⚠️  MOCK FUNCTION - FOR DEMONSTRATION ONLY
 * 
 * This is NOT production code. For actual AI generation, use:
 * - BabylonLLMClient (src/generator/llm/openai-client.ts) for Groq/OpenAI
 * - GameGenerator methods for structured game content
 * - FeedGenerator methods for feed posts
 * 
 * @param _prompt - The prompt to send (unused in mock)
 * @returns Mock post content for demonstration
 */
async function mockAIGeneration(_prompt: string): Promise<string[]> {
  console.log('   ⚠️  [MOCK] This is example code - not calling real AI');
  console.log('   For production, use BabylonLLMClient or GameGenerator');

  // Simulate API delay for realistic example
  await new Promise(resolve => setTimeout(resolve, 100));

  // Return mock posts for demonstration purposes
  return [
    'AIlon just tweeted about Mars again. The man never stops.',
    'Sam AIltman talking about AGI timelines. Again.',
    'Mark Zuckerborg trying to explain the metaverse. Still failing.',
  ];

  // Production implementation example:
  // import { BabylonLLMClient } from '@/generator/llm/openai-client';
  // const llm = new BabylonLLMClient();
  // const response = await llm.generateText({ prompt, maxTokens: 500 });
  // return JSON.parse(response).posts;
}

// ============================================================================
// Run Examples (for testing)
// ============================================================================

export async function runAllExamples() {
  console.log('=' .repeat(80));
  console.log('FEED PROMPT SYSTEM - COMPLETE EXAMPLES');
  console.log('=' .repeat(80));

  try {
    // Example 1
    console.log('\n📌 Example 1: Single Ambient Post\n');
    await generateAmbientPost();

    // Example 2
    console.log('\n' + '='.repeat(80));
    console.log('\n📌 Example 2: Reactions with Retry\n');
    await generateReactionsWithRetry('TeslAI announces Dogecoin acceptance');

    // Example 3
    console.log('\n' + '='.repeat(80));
    console.log('\n📌 Example 3: Mixed Feed Content\n');
    await generateMixedFeedContent();

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  }
}

// Uncomment to run:
// runAllExamples();

