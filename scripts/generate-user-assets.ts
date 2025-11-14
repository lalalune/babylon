/**
 * Generate User Profile Assets
 * Generates ~100 humorous profile pictures and banners for user onboarding
 * Uses fal.ai's flux schnell to generate images
 */

import { fal } from "@fal-ai/client";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { config } from "dotenv";
import { logger } from '@/lib/logger';

// Load environment variables
config();

interface FalResponse {
  data: {
    images: Array<{
      url: string;
      width: number;
      height: number;
      content_type: string;
    }>;
  };
}

const PROFILE_PICTURE_COUNT = 100;
const BANNER_COUNT = 100;

async function loadPromptFromBundle(promptPath: string): Promise<string> {
  const bundlePath = join(process.cwd(), 'src', 'prompts', 'bundled-prompts.json');
  const bundleContent = await readFile(bundlePath, 'utf-8');
  const prompts = JSON.parse(bundleContent);
  
  if (!prompts[promptPath]) {
    throw new Error(`Prompt not found in bundle: ${promptPath}`);
  }
  
  return prompts[promptPath].template;
}

async function generateProfilePicture(index: number): Promise<string> {
  logger.info(`Generating profile picture ${index + 1}/${PROFILE_PICTURE_COUNT}...`, undefined, 'CLI');

  // Load prompt template - it has enough variety built in
  const prompt = await loadPromptFromBundle('image/user-profile-picture');
  
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
    throw new Error(`Fal.ai API returned no images for profile picture ${index}. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage || !firstImage.url) {
    throw new Error(`First image missing URL for profile picture ${index}. Image data: ${JSON.stringify(firstImage)}`);
  }

  const imageUrl = firstImage.url;
  logger.info(`Generated profile picture ${index + 1}: ${imageUrl}`, undefined, 'CLI');

  return imageUrl;
}

async function generateBanner(index: number): Promise<string> {
  logger.info(`Generating banner ${index + 1}/${BANNER_COUNT}...`, undefined, 'CLI');

  // Load prompt template - it has enough variety built in
  const prompt = await loadPromptFromBundle('image/user-profile-banner');
  
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
    throw new Error(`Fal.ai API returned no images for banner ${index}. Response: ${JSON.stringify(result.data)}`);
  }

  const firstImage = result.data.images[0];
  if (!firstImage || !firstImage.url) {
    throw new Error(`First image missing URL for banner ${index}. Image data: ${JSON.stringify(firstImage)}`);
  }

  const imageUrl = firstImage.url;
  logger.info(`Generated banner ${index + 1}: ${imageUrl}`, undefined, 'CLI');

  return imageUrl;
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await writeFile(filepath, Buffer.from(buffer));
  logger.info(`Saved image to ${filepath}`, undefined, 'CLI');
}

async function main() {
  logger.info("Starting user assets generation...", undefined, 'CLI');

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

  // Create directories
  const publicDir = join(process.cwd(), "public");
  const profilePicturesDir = join(publicDir, "assets", "user-profiles");
  const bannersDir = join(publicDir, "assets", "user-banners");
  
  await mkdir(profilePicturesDir, { recursive: true });
  await mkdir(bannersDir, { recursive: true });

  let generatedCount = 0;
  const startTime = Date.now();

  // Generate profile pictures
  logger.info(`\n🎨 Generating ${PROFILE_PICTURE_COUNT} profile pictures...`, undefined, 'CLI');
  for (let i = 0; i < PROFILE_PICTURE_COUNT; i++) {
    try {
      const imageUrl = await generateProfilePicture(i);
      const imagePath = join(profilePicturesDir, `profile-${i + 1}.jpg`);
      await downloadImage(imageUrl, imagePath);
      generatedCount++;
      
      // Add a small delay to avoid rate limiting
      if (i < PROFILE_PICTURE_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Failed to generate profile picture ${i + 1}: ${errorMessage}`, { error, errorStack }, 'CLI');
      logger.warn(`Continuing with remaining images...`, undefined, 'CLI');
    }
  }

  // Generate banners
  logger.info(`\n🖼️  Generating ${BANNER_COUNT} profile banners...`, undefined, 'CLI');
  for (let i = 0; i < BANNER_COUNT; i++) {
    try {
      const imageUrl = await generateBanner(i);
      const imagePath = join(bannersDir, `banner-${i + 1}.jpg`);
      await downloadImage(imageUrl, imagePath);
      generatedCount++;
      
      // Add a small delay to avoid rate limiting
      if (i < BANNER_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Failed to generate banner ${i + 1}: ${errorMessage}`, { error, errorStack }, 'CLI');
      logger.warn(`Continuing with remaining images...`, undefined, 'CLI');
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  logger.info(`\n✅ Generation complete!`, undefined, 'CLI');
  logger.info(`   Generated ${generatedCount} images in ${elapsedTime} minutes`, undefined, 'CLI');
  logger.info(`   Profile pictures: ${profilePicturesDir}`, undefined, 'CLI');
  logger.info(`   Banners: ${bannersDir}`, undefined, 'CLI');
}

main().catch((error) => {
  logger.error("Fatal error:", error, 'CLI');
  process.exit(1);
});

