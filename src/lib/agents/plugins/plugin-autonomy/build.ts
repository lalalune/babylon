#!/usr/bin/env bun

/**
 * Build script using bun build
 * Replaces tsup with native bun build functionality
 */

import { $ } from 'bun';
async function build() {
  console.log('🏗️  Building package...');

  // Clean only library files, preserve frontend files
  // Use || true to prevent failure if files don't exist
  await $`rm -rf dist/*.js dist/*.d.ts dist/*.map dist/__tests__ dist/actions dist/providers dist/scenarios || true`;
  await $`mkdir -p dist`;

  // Build with bun
  const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    format: 'esm',
    sourcemap: 'external',
    external: ['@elizaos/core', '@elizaos/plugin-bootstrap', 'express', 'cors', 'vite'],
    target: 'node',
  });

  if (!result.success) {
    console.error('❌ Build failed:');
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  console.log(`✅ Built ${result.outputs.length} files`);

  // Generate TypeScript declarations
  console.log('📝 Generating TypeScript declarations...');
  try {
    await $`tsc --project tsconfig.build.json`;
    console.log('✅ TypeScript declarations generated');
  } catch {
    console.warn('⚠️ TypeScript declaration generation had issues, but continuing...');
  }

  console.log('✅ Build complete!');
}

build().catch(console.error);
