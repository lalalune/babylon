#!/usr/bin/env tsx
/**
 * Test Swagger Auto-Generation
 * 
 * Verifies that swagger-jsdoc successfully generates OpenAPI spec
 * from @openapi tags in route files.
 */

import { generateAutoSpec } from '../src/lib/swagger/auto-generator';
import { generateOpenApiSpec } from '../src/lib/swagger/generator';

async function main() {
console.log('🔍 Testing Swagger Auto-Generation...\n');

// Test auto-generation
console.log('1. Testing auto-generator (swagger-jsdoc)...');
const autoSpec = await generateAutoSpec() as any;
console.log(`   ✅ Auto-generated spec successfully`);
console.log(`   📊 Paths found: ${Object.keys(autoSpec.paths || {}).length}`);
console.log(`   🏷️  Tags: ${(autoSpec.tags || []).map((t: { name: string }) => t.name).join(', ')}`);

// List all paths
const paths = Object.keys(autoSpec.paths || {});
if (paths.length > 0) {
  console.log('\n   📍 Documented endpoints:');
  paths.forEach((path: string) => {
    const methods = Object.keys(autoSpec.paths[path]);
    console.log(`      ${methods.join(', ').toUpperCase()} ${path}`);
  });
}

// Test manual generation (fallback)
console.log('\n2. Testing manual generator (fallback)...');
const manualSpec = generateOpenApiSpec();
console.log(`   ✅ Manual spec generated successfully`);
console.log(`   📊 Paths found: ${Object.keys(manualSpec.paths || {}).length}`);

// Compare
console.log('\n3. Comparison:');
const autoCount = Object.keys(autoSpec.paths || {}).length;
const manualCount = Object.keys(manualSpec.paths || {}).length;

console.log(`   Auto-generated: ${autoCount} endpoints`);
console.log(`   Manual:         ${manualCount} endpoints`);

if (autoCount > 0) {
  console.log('\n✅ SUCCESS: Auto-generation is working!');
  console.log('\n💡 Next steps:');
  console.log('   1. Convert more routes to @openapi format');
  console.log('   2. Remove manual entries as routes are converted');
  console.log('   3. Test at http://localhost:3000/api/docs');
} else {
  console.log('\n⚠️  WARNING: Auto-generation found 0 endpoints');
  console.log('   This means no routes have @openapi tags yet');
  console.log('   The system will fall back to manual spec');
}

// Show sample endpoint
if (autoSpec.paths['/api/health']) {
  console.log('\n📝 Sample auto-generated endpoint (/api/health):');
  console.log(JSON.stringify(autoSpec.paths['/api/health'], null, 2));
}

console.log('\n✨ Test complete!');
}

main();
