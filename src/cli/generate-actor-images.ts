/**
 * @fileoverview Actor and Organization Image Generation CLI
 * 
 * Generates profile pictures and banner images for all actors and organizations
 * using fal.ai's Flux AI image generation models. Supports concurrent generation
 * with automatic skip for existing images.
 * 
 * **Generated Images:**
 * - Actor profile pictures (square, portrait style)
 * - Actor banner images (16:9 landscape)
 * - Organization logos (square, satirical parodies)
 * - Organization banners (16:9 landscape)
 * 
 * **Features:**
 * - Concurrent generation (max 10 at a time for rate limiting)
 * - Automatic skip for existing images
 * - Satirical logo generation using company name mappings
 * - Template-based prompt rendering
 * - Progress tracking and error reporting
 * - Automatic directory creation
 * 
 * **Requirements:**
 * - `FAL_KEY` environment variable must be set
 * - `public/data/actors.json` must exist and be valid
 * - Output directories must be writable:
 *   - `public/images/actors/`
 *   - `public/images/actor-banners/`
 *   - `public/images/organizations/`
 *   - `public/images/org-banners/`
 * 
 * **Image Specifications:**
 * - Actor PFP: Square (1024x1024), high quality portrait
 * - Actor Banner: Landscape 16:9, thematic background
 * - Org Logo: Square (1024x1024), satirical parody
 * - Org Banner: Landscape 16:9, branded background
 * 
 * @module cli/generate-actor-images
 * @category CLI - Content Generation
 * 
 * @example
 * ```bash
 * # Set API key
 * export FAL_KEY=your_fal_key_here
 * 
 * # Generate all missing images
 * bun run src/cli/generate-actor-images.ts
 * 
 * # Output:
 * # Checking actor and organization images...
 * # Checking 50 actor profile pictures...
 * # Checking 50 actor banners...
 * # Checking 25 organization logos...
 * # Checking 25 organization banners...
 * # Found 30 images to generate (120 already exist)
 * # Starting concurrent generation (max 10 at a time)...
 * # ✅ Generated actor-pfp for Actor1
 * # ✅ Generated org-logo for OpenLie
 * # Complete!
 * # { generated: 30, failed: 0, skipped: 120 }
 * ```
 * 
 * @see {@link @fal-ai/client} for fal.ai SDK
 * @see {@link ../prompts} for image generation prompts
 * @since v0.1.0
 * 
 * **Environment Variables:**
 * @env {string} FAL_KEY - Required fal.ai API key for image generation
 */

import { fal } from "@fal-ai/client";
import { readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import { config } from "dotenv";
import { renderPrompt, actorPortrait, actorBanner, organizationLogo, organizationBanner } from "@/prompts";
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Load environment variables
config();

const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  realName: z.string().optional(),
  description: z.string(),
  domain: z.array(z.string()).optional(),
  personality: z.string().optional(),
  physicalDescription: z.string().optional(),
  profileBanner: z.string().optional(),
});
type Actor = z.infer<typeof ActorSchema>;

const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.string(),
  pfpDescription: z.string().optional(),
  bannerDescription: z.string().optional(),
});
type Organization = z.infer<typeof OrganizationSchema>;

const ActorsDatabaseSchema = z.object({
  version: z.string(),
  description: z.string(),
  actors: z.array(ActorSchema),
  organizations: z.array(OrganizationSchema),
});

interface FalImageResult {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

interface FalResponse {
  data: {
    images: FalImageResult[];
    seed?: number;
    has_nsfw_concepts?: boolean[];
  };
}

/**
 * Checks if a file exists at the given path
 * 
 * @param {string} path - File path to check
 * @returns {Promise<boolean>} true if file exists, false otherwise
 * @example
 * ```typescript
 * const exists = await fileExists('./image.jpg');
 * if (!exists) {
 *   // Generate image
 * }
 * ```
 */
async function fileExists(path: string): Promise<boolean> {
  return access(path).then(() => true).catch(() => false);
}

/**
 * Maps satirical organization IDs to their real-world company names
 * 
 * Used to generate logo parodies that reference the original company's branding
 * while maintaining the satirical nature of the game.
 * 
 * **Example Mappings:**
 * - `openlie` → OpenAI
 * - `anthropimp` → Anthropic
 * - `xitter` → Twitter/X
 * - `goolag` → Google
 * 
 * @param {string} satiricalName - The satirical name (currently unused)
 * @param {string} orgId - Organization ID to map
 * @returns {string} Original company name, or satirical name if no mapping
 * @example
 * ```typescript
 * const realName = getOriginalCompanyName('OpenLie', 'openlie');
 * // Returns: 'OpenAI'
 * ```
 */
function getOriginalCompanyName(satiricalName: string, orgId: string): string {
  const mappings: Record<string, string> = {
    'openlie': 'OpenAI',
    'anthropimp': 'Anthropic',
    'anthoprick': 'Anthropic',
    'deepmined': 'DeepMind',
    'facehook': 'Facebook/Meta',
    'palantyrant': 'Palantir',
    'anduritalin': 'Anduril',
    'xitter': 'Twitter/X',
    'huskla': 'Tesla',
    'spacehusk': 'SpaceX',
    'neuraljank': 'Neuralink',
    'macrohard': 'Microsoft',
    'goolag': 'Google',
    'scamazon': 'Amazon',
    'crapple': 'Apple',
    'faux-news': 'Fox News',
    'msdnc': 'MSNBC',
    'cnn': 'CNN',
    'washout-post': 'Washington Post',
    'the-new-york-crimes': 'New York Times',
    'the-daily-liar': 'The Daily Wire',
    'microtreasury': 'MicroStrategy',
    'conbase': 'Coinbase',
    'ai16z': 'Andreessen Horowitz (a16z)',
    'taxifornia': 'California',
    'loot-social': 'Truth Social',
    'grift-social': 'Truth Social',
    'dump-organization': 'Trump Organization',
    'sucker-carlton-tonight': 'Tucker Carlson Tonight',
    'infobores': 'InfoWars',
    'america-worst': 'America First',
    'cnbs': 'CNBC',
    'the-fud': 'Federal Reserve',
    'nvidiot': 'NVIDIA',
    'blackcrook': 'BlackRock',
    'boomerberg': 'Bloomberg',
    'wall-street-urinal': 'Wall Street Journal',
    'politicon': 'Politico',
    'financial-crimes': 'Financial Times',
    'ethereal-foundation': 'Ethereum Foundation',
    'angelgrift': 'AngelList',
    'angelfist': 'AngelList',
    'founders-fraud': 'Founders Fund',
    'ark-ingest': 'ARK Invest',
    'larp-invest': 'ARK Invest',
    'vulture-capital': 'Social Capital',
    'department-of-war': 'Department of Defense',
    'cia-inc': 'CIA',
    'effective-authoritarianism': 'Effective Altruism',
    'goober': 'Uber',
    'uber-but-worse': 'Uber',
    'cloud-kitchens': 'CloudKitchens',
    'all-in-podcast': 'All-In Podcast',
    'craft-vultures': 'Craft Ventures',
    'pirate-liars': 'Pirate Wires',
    'network-grift-state': 'The Network State',
    'entropic': 'Extropic',
    'dont-try-protocol': 'Blueprint/Don\'t Die'
  };

  return mappings[orgId] || satiricalName;
}

/**
 * Generates a profile picture for an actor using fal.ai's Flux Krea model
 * 
 * Creates a high-quality square portrait based on the actor's physical description
 * and personality traits. Uses template-based prompts for consistent results.
 * 
 * **Generation Settings:**
 * - Model: fal-ai/flux/krea (high quality)
 * - Size: Square (1024x1024)
 * - Images: 1
 * - Quality: Best for portraits
 * 
 * @param {Actor} actor - Actor object with physicalDescription field
 * @returns {Promise<string>} URL of generated image
 * @throws {Error} If actor missing physicalDescription or API fails
 * @example
 * ```typescript
 * const actor = {
 *   id: 'actor1',
 *   name: 'John Doe',
 *   physicalDescription: 'Middle-aged man with glasses',
 *   personality: 'analytical'
 * };
 * const imageUrl = await generateActorImage(actor);
 * // Returns: 'https://fal.media/files/...'
 * ```
 */
async function generateActorImage(actor: Actor): Promise<string> {
  logger.info(`Generating profile picture for ${actor.name}...`, undefined, 'CLI');

  const descriptionParts = actor.description.split('.').slice(0, 3).join('. ');

  const prompt = renderPrompt(actorPortrait, {
    actorName: actor.name,
    realName: actor.realName || actor.name,
    physicalDescription: actor.physicalDescription!,
    descriptionParts,
    personality: actor.personality || 'satirical'
  });
  
  const result = await fal.subscribe("fal-ai/flux/krea", {
    input: {
      prompt,
      image_size: "square",
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(msg => logger.debug(msg, undefined, 'CLI'));
      }
    },
  }) as FalResponse;

  const imageUrl = result.data.images[0]!.url;
  logger.info(`Generated profile picture for ${actor.name}: ${imageUrl}`, undefined, 'CLI');

  return imageUrl;
}

async function generateActorBanner(actor: Actor): Promise<string> {
  logger.info(`Generating banner for ${actor.name}...`, undefined, 'CLI');

  if (!actor.profileBanner) {
    throw new Error(`Actor ${actor.name} is missing profileBanner field`);
  }

  // Render prompt template with variables
  const prompt = renderPrompt(actorBanner, {
    actorName: actor.name,
    realName: actor.realName || actor.name,
    profileBanner: actor.profileBanner
  });
  
  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_inference_steps: 4,
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(msg => logger.debug(msg, undefined, 'CLI'));
      }
    },
  }) as FalResponse;

  // Validate response
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(`Fal.ai API returned no images for ${actor.name} banner. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage?.url) {
    throw new Error(`First image missing URL for ${actor.name} banner. Image data: ${JSON.stringify(firstImage)}`);
  }

  logger.info(`Generated banner for ${actor.name}: ${firstImage.url}`, undefined, 'CLI');

  return firstImage.url;
}

async function generateOrganizationImage(org: Organization): Promise<string> {
  logger.info(`Generating logo for ${org.name}...`, undefined, 'CLI');

  if (!org.pfpDescription) {
    throw new Error(`Organization ${org.name} is missing pfpDescription field`);
  }

  // Get the original company name for logo parody
  const originalCompany = getOriginalCompanyName(org.name, org.id);

  // Render prompt template with variables
  const prompt = renderPrompt(organizationLogo, {
    organizationName: org.name,
    originalCompany,
    pfpDescription: org.pfpDescription,
    organizationType: org.type,
    organizationDescription: org.description
  });
  
  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt,
      image_size: "square",
      num_inference_steps: 4,
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(msg => logger.debug(msg, undefined, 'CLI'));
      }
    },
  }) as FalResponse;

  // Validate response
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(`Fal.ai API returned no images for ${org.name}. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage?.url) {
    throw new Error(`First image missing URL for ${org.name}. Image data: ${JSON.stringify(firstImage)}`);
  }

  logger.info(`Generated logo for ${org.name}: ${firstImage.url}`, undefined, 'CLI');

  return firstImage.url;
}

async function generateOrganizationBanner(org: Organization): Promise<string> {
  logger.info(`Generating banner for ${org.name}...`, undefined, 'CLI');

  if (!org.bannerDescription) {
    throw new Error(`Organization ${org.name} is missing bannerDescription field`);
  }

  // Get the original company name for logo parody
  const originalCompany = getOriginalCompanyName(org.name, org.id);

  // Render prompt template with variables
  const prompt = renderPrompt(organizationBanner, {
    organizationName: org.name,
    originalCompany,
    bannerDescription: org.bannerDescription
  });
  
  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_inference_steps: 4,
      num_images: 1,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(msg => logger.debug(msg, undefined, 'CLI'));
      }
    },
  }) as FalResponse;

  // Validate response
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(`Fal.ai API returned no images for ${org.name} banner. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage?.url) {
    throw new Error(`First image missing URL for ${org.name} banner. Image data: ${JSON.stringify(firstImage)}`);
  }

  logger.info(`Generated banner for ${org.name}: ${firstImage.url}`, undefined, 'CLI');

  return firstImage.url;
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(filepath, buffer);
  logger.info(`Saved image to ${filepath}`, undefined, 'CLI');
}

interface ImageJob {
  type: 'actor-pfp' | 'actor-banner' | 'org-pfp' | 'org-banner';
  id: string;
  name: string;
  outputPath: string;
  generator: () => Promise<string>;
}

/**
 * Processes image generation jobs with concurrency control
 * 
 * Manages a queue of image generation jobs with a maximum concurrent limit
 * to respect API rate limits. Tracks success/failure statistics.
 * 
 * **Concurrency Control:**
 * - Default: 10 concurrent jobs
 * - Prevents API rate limiting
 * - Removes completed jobs from active set
 * - Waits for next slot when at max
 * 
 * **Error Handling:**
 * - Jobs that fail are logged but don't stop the queue
 * - All jobs complete before function returns
 * - Final statistics include success and failure counts
 * 
 * @param {ImageJob[]} jobs - Array of image generation jobs to process
 * @param {number} [maxConcurrent=10] - Maximum concurrent jobs (default: 10)
 * @returns {Promise<{generated: number, failed: number}>} Generation statistics
 * @example
 * ```typescript
 * const jobs = [
 *   { type: 'actor-pfp', id: '1', name: 'Actor1', outputPath: '...', generator: () => {...} },
 *   { type: 'org-logo', id: '2', name: 'Org1', outputPath: '...', generator: () => {...} }
 * ];
 * const result = await processQueue(jobs, 5);
 * // { generated: 2, failed: 0 }
 * ```
 */
async function processQueue(jobs: ImageJob[], maxConcurrent: number = 10): Promise<{ generated: number; failed: number }> {
  let generated = 0;
  let failed = 0;
  const activeJobs = new Set<Promise<void>>();

  for (const job of jobs) {
    if (activeJobs.size >= maxConcurrent) {
      await Promise.race(activeJobs);
    }

    const jobPromise = (async () => {
      logger.info(`Generating ${job.type} for ${job.name}...`, undefined, 'CLI');
      await job.generator()
        .then(async (imageUrl) => {
          await downloadImage(imageUrl, job.outputPath);
          generated++;
          logger.info(`✅ Generated ${job.type} for ${job.name}`, undefined, 'CLI');
        })
        .catch((error: Error) => {
          failed++;
          logger.error(`❌ Failed ${job.type} for ${job.name}`, error, 'CLI');
        });
    })();

    activeJobs.add(jobPromise);
    jobPromise.finally(() => activeJobs.delete(jobPromise));
  }

  await Promise.all(activeJobs);

  return { generated, failed };
}

/**
 * Main execution function for image generation CLI
 * 
 * Orchestrates the complete image generation workflow:
 * 1. Validates FAL_KEY environment variable
 * 2. Loads actors database
 * 3. Checks for existing images (skips if present)
 * 4. Builds generation job queue
 * 5. Processes jobs concurrently (max 10)
 * 6. Reports statistics
 * 
 * **Image Types Generated:**
 * - Actor profile pictures (portrait style)
 * - Actor banners (landscape backgrounds)
 * - Organization logos (satirical parodies)
 * - Organization banners (branded backgrounds)
 * 
 * **Performance:**
 * - Concurrent generation for speed
 * - Automatic skip for existing images
 * - Progress logging for each image
 * - Final statistics summary
 * 
 * @throws {Error} Exits with code 1 if FAL_KEY missing or generation fails
 * @returns {Promise<void>} Exits with code 0 on success
 * @example
 * ```bash
 * export FAL_KEY=your_key
 * bun run src/cli/generate-actor-images.ts
 * # Generates all missing images with concurrent processing
 * ```
 */
async function main() {
  logger.info("Checking actor and organization images...", undefined, 'CLI');

  // Check for FAL_KEY
  if (!process.env.FAL_KEY) {
    logger.error("Error: FAL_KEY not found in environment variables", undefined, 'CLI');
    logger.error("Please add FAL_KEY to your .env file", undefined, 'CLI');
    process.exit(1);
  }

  // Configure fal.ai client
  fal.config({
    credentials: process.env.FAL_KEY,
  });

  // Load actors database
  const actorsPath = join(process.cwd(), "public", "data", "actors.json");
  const actorsData = await readFile(actorsPath, "utf-8");
  const actorsDb = ActorsDatabaseSchema.parse(JSON.parse(actorsData));

  const actorsImagesDir = join(process.cwd(), "public", "images", "actors");
  const actorsBannersDir = join(process.cwd(), "public", "images", "actor-banners");
  const orgsImagesDir = join(process.cwd(), "public", "images", "organizations");
  const orgsBannersDir = join(process.cwd(), "public", "images", "org-banners");
  
  let skippedCount = 0;
  const jobs: ImageJob[] = [];

  // Build job queue for actor profile pictures
  logger.info(`Checking ${actorsDb.actors.length} actor profile pictures...`, undefined, 'CLI');
  for (const actor of actorsDb.actors) {
    const imagePath = join(actorsImagesDir, `${actor.id}.jpg`);
    
    if (await fileExists(imagePath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'actor-pfp',
        id: actor.id,
        name: actor.name,
        outputPath: imagePath,
        generator: () => generateActorImage(actor)
      });
    }
  }

  // Build job queue for actor banners
  logger.info(`Checking ${actorsDb.actors.length} actor banners...`, undefined, 'CLI');
  for (const actor of actorsDb.actors) {
    const bannerPath = join(actorsBannersDir, `${actor.id}.jpg`);
    
    if (await fileExists(bannerPath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'actor-banner',
        id: actor.id,
        name: actor.name,
        outputPath: bannerPath,
        generator: () => generateActorBanner(actor)
      });
    }
  }

  // Build job queue for organization logos
  logger.info(`Checking ${actorsDb.organizations.length} organization logos...`, undefined, 'CLI');
  for (const org of actorsDb.organizations) {
    const imagePath = join(orgsImagesDir, `${org.id}.jpg`);
    
    if (await fileExists(imagePath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'org-pfp',
        id: org.id,
        name: org.name,
        outputPath: imagePath,
        generator: () => generateOrganizationImage(org)
      });
    }
  }

  // Build job queue for organization banners
  logger.info(`Checking ${actorsDb.organizations.length} organization banners...`, undefined, 'CLI');
  for (const org of actorsDb.organizations) {
    const bannerPath = join(orgsBannersDir, `${org.id}.jpg`);
    
    if (await fileExists(bannerPath)) {
      skippedCount++;
    } else {
      jobs.push({
        type: 'org-banner',
        id: org.id,
        name: org.name,
        outputPath: bannerPath,
        generator: () => generateOrganizationBanner(org)
      });
    }
  }

  logger.info(`Found ${jobs.length} images to generate (${skippedCount} already exist)`, undefined, 'CLI');

  if (jobs.length === 0) {
    logger.info('All images already exist!', undefined, 'CLI');
    return;
  }

  // Process jobs with up to 10 concurrent operations
  logger.info(`Starting concurrent generation (max 10 at a time)...`, undefined, 'CLI');
  const result = await processQueue(jobs, 10);

  logger.info('Complete!', {
    generated: result.generated,
    failed: result.failed,
    skipped: skippedCount,
    totalActors: actorsDb.actors.length,
    totalOrganizations: actorsDb.organizations.length,
    totalPossibleImages: actorsDb.actors.length * 2 + actorsDb.organizations.length * 2
  }, 'CLI');
}

main();


