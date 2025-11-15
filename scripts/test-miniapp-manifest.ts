#!/usr/bin/env bun

/**
 * Mini App Manifest Verification Script
 * Tests that the manifest is properly configured and accessible
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

interface MiniAppManifest {
  miniapp: {
    version: string;
    name: string;
    iconUrl: string;
    splashImageUrl: string;
    splashBackgroundColor: string;
    homeUrl: string;
    subtitle: string;
    description: string;
    screenshotUrls: string[];
    primaryCategory: string;
    tags: string[];
    heroImageUrl: string;
    tagline: string;
    ogTitle: string;
    ogDescription: string;
    ogImageUrl: string;
  };
  accountAssociation?: {
    header: string;
    payload: string;
    signature: string;
  };
}

async function validateManifest(): Promise<void> {
  console.log('🔍 Validating Farcaster Mini App Manifest...\n');

  try {
    // Read manifest file
    const manifestPath = join(process.cwd(), 'public', 'farcaster.json');
    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest: MiniAppManifest = JSON.parse(manifestContent);

    console.log('✅ Manifest file found and parsed\n');

    // Validate required fields
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check miniapp object exists
    if (!manifest.miniapp) {
      errors.push('Missing "miniapp" object');
      console.error('❌ Fatal: Missing miniapp object\n');
      process.exit(1);
    }

    // Check version
    if (manifest.miniapp.version !== '1') {
      errors.push(`Invalid version: ${manifest.miniapp.version} (should be "1")`);
    }

    // Check required fields
    const requiredFields = [
      'name',
      'iconUrl',
      'splashImageUrl',
      'splashBackgroundColor',
      'homeUrl',
    ];

    for (const field of requiredFields) {
      if (!manifest.miniapp[field as keyof typeof manifest.miniapp]) {
        errors.push(`Missing required field: miniapp.${field}`);
      }
    }

    // Check URLs are valid
    const urlFields = [
      'iconUrl',
      'splashImageUrl',
      'homeUrl',
      'heroImageUrl',
      'ogImageUrl',
    ];

    for (const field of urlFields) {
      const url = manifest.miniapp[field as keyof typeof manifest.miniapp];
      if (url && typeof url === 'string') {
        try {
          new URL(url);
          console.log(`✅ ${field}: ${url}`);
        } catch {
          errors.push(`Invalid URL for ${field}: ${url}`);
        }
      }
    }

    // Check screenshot URLs
    if (manifest.miniapp.screenshotUrls && manifest.miniapp.screenshotUrls.length > 0) {
      console.log(`\n📸 Screenshots (${manifest.miniapp.screenshotUrls.length}):`);
      manifest.miniapp.screenshotUrls.forEach((url, i) => {
        try {
          new URL(url);
          console.log(`   ${i + 1}. ${url}`);
        } catch {
          errors.push(`Invalid screenshot URL ${i + 1}: ${url}`);
        }
      });
    } else {
      warnings.push('No screenshot URLs provided (recommended: 3-5 screenshots)');
    }

    // Check account association
    console.log('\n🔐 Account Association:');
    if (manifest.accountAssociation) {
      if (
        manifest.accountAssociation.header &&
        manifest.accountAssociation.payload &&
        manifest.accountAssociation.signature
      ) {
        console.log('   ✅ Present (eligible for developer rewards)');
      } else {
        warnings.push('Account association incomplete');
      }
    } else {
      console.log('   ⚠️  Not present (not eligible for developer rewards yet)');
      console.log('   💡 Add via: https://farcaster.xyz/~/developers/mini-apps/manifest');
    }

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Validation Results:\n');

    if (errors.length === 0) {
      console.log('✅ All required fields present');
      console.log('✅ All URLs valid');
      console.log('✅ Manifest structure correct');
    } else {
      console.log('❌ Errors found:');
      errors.forEach((error) => console.log(`   - ${error}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach((warning) => console.log(`   - ${warning}`));
    }

    console.log('\n' + '='.repeat(60));

    // Print next steps
    console.log('\n📋 Next Steps:\n');

    if (errors.length === 0) {
      console.log('1. ✅ Deploy your app');
      console.log('2. ✅ Test manifest at: https://YOUR-DOMAIN/.well-known/farcaster.json');
      console.log('3. 💰 Add account association for rewards:');
      console.log('   https://farcaster.xyz/~/developers/mini-apps/manifest');
      console.log('4. 🧪 Test in Warpcast mobile app');
      console.log('\n🎉 Your manifest is ready for deployment!');
    } else {
      console.log('❌ Fix the errors above before deploying\n');
      process.exit(1);
    }

    // Test local server if running
    console.log('\n' + '='.repeat(60));
    console.log('\n🌐 Testing Local Server...\n');

    try {
      const response = await fetch('http://localhost:3000/.well-known/farcaster.json');
      if (response.ok) {
        await response.json();
        console.log('✅ Manifest accessible at /.well-known/farcaster.json');
        console.log('✅ Rewrite working correctly');
      } else {
        console.log('⚠️  Local server returned:', response.status);
        console.log('💡 Make sure dev server is running: bun run dev');
      }
    } catch (error) {
      console.log('ℹ️  Local server not running (this is OK for production)');
      console.log('💡 To test locally: bun run dev');
    }

    console.log('\n' + '='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run validation
validateManifest().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

