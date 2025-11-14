/**
 * Generate Actor Profile Images
 * Uses fal.ai's flux schnell to generate profile pictures for actors
 */

import { fal } from "@fal-ai/client";
import { readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import { config } from "dotenv";
import { renderPrompt, actorPortrait, actorBanner, organizationLogo, organizationBanner } from "@/prompts";
import { logger } from '@/lib/logger';

// Load environment variables
config();

interface Actor {
  id: string;
  name: string;
  realName?: string;
  description: string;
  domain?: string[];
  personality?: string;
  physicalDescription?: string;
  profileBanner?: string;
}

interface Organization {
  id: string;
  name: string;
  description: string;
  type: string;
  pfpDescription?: string;
  bannerDescription?: string;
}

interface ActorsDatabase {
  version: string;
  description: string;
  actors: Actor[];
  organizations: Organization[];
}

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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Map satirical organization names to their original company names
 * for logo parody generation
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

async function generateActorImage(actor: Actor): Promise<string> {
  logger.info(`Generating profile picture for ${actor.name}...`, undefined, 'CLI');

  if (!actor.physicalDescription) {
    throw new Error(`Actor ${actor.name} is missing physicalDescription field`);
  }

  // Extract key satirical elements from description
  const descriptionParts = actor.description.split('.').slice(0, 3).join('. ');

  // Render prompt template with variables
  const prompt = renderPrompt(actorPortrait, {
    actorName: actor.name,
    realName: actor.realName || actor.name,
    physicalDescription: actor.physicalDescription,
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

  // Validate response has images array with at least one image
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(`Fal.ai API returned no images for ${actor.name}. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage || !firstImage.url) {
    throw new Error(`First image missing URL for ${actor.name}. Image data: ${JSON.stringify(firstImage)}`);
  }

  const imageUrl = firstImage.url;
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

  // Validate response has images array with at least one image
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(`Fal.ai API returned no images for ${actor.name} banner. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage || !firstImage.url) {
    throw new Error(`First image missing URL for ${actor.name} banner. Image data: ${JSON.stringify(firstImage)}`);
  }

  const imageUrl = firstImage.url;
  logger.info(`Generated banner for ${actor.name}: ${imageUrl}`, undefined, 'CLI');

  return imageUrl;
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

  // Validate response has images array with at least one image
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(`Fal.ai API returned no images for ${org.name}. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage || !firstImage.url) {
    throw new Error(`First image missing URL for ${org.name}. Image data: ${JSON.stringify(firstImage)}`);
  }

  const imageUrl = firstImage.url;
  logger.info(`Generated logo for ${org.name}: ${imageUrl}`, undefined, 'CLI');

  return imageUrl;
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

  // Validate response has images array with at least one image
  if (!result.data.images || result.data.images.length === 0) {
    throw new Error(`Fal.ai API returned no images for ${org.name} banner. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage || !firstImage.url) {
    throw new Error(`First image missing URL for ${org.name} banner. Image data: ${JSON.stringify(firstImage)}`);
  }

  const imageUrl = firstImage.url;
  logger.info(`Generated banner for ${org.name}: ${imageUrl}`, undefined, 'CLI');

  return imageUrl;
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

async function processQueue(jobs: ImageJob[], maxConcurrent: number = 10): Promise<{ generated: number; failed: number }> {
  let generated = 0;
  let failed = 0;
  const activeJobs = new Set<Promise<void>>();

  for (const job of jobs) {
    // Wait if we're at max concurrency
    if (activeJobs.size >= maxConcurrent) {
      await Promise.race(activeJobs);
    }

    // Create and track the job
    const jobPromise = (async () => {
      try {
        logger.info(`Generating ${job.type} for ${job.name}...`, undefined, 'CLI');
        const imageUrl = await job.generator();
        await downloadImage(imageUrl, job.outputPath);
        generated++;
        logger.info(`✅ Generated ${job.type} for ${job.name}`, undefined, 'CLI');
      } catch (error) {
        failed++;
        logger.error(`❌ Failed to generate ${job.type} for ${job.name}:`, error, 'CLI');
      }
    })();

    activeJobs.add(jobPromise);
    
    // Remove from active set when complete
    jobPromise.finally(() => activeJobs.delete(jobPromise));
  }

  // Wait for all remaining jobs to complete
  await Promise.all(activeJobs);

  return { generated, failed };
}

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
  const actorsDb: ActorsDatabase = JSON.parse(actorsData);

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

main().catch(error => {
  logger.error('Error:', error, 'CLI');
  process.exit(1);
});


