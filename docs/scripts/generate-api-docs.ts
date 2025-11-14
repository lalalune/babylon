#!/usr/bin/env tsx
/**
 * Generate API documentation from TypeScript route files
 * Scans src/app/api directory and creates OpenAPI/Swagger documentation
 */

import { promises as fs } from 'fs';
import path from 'path';

interface ApiParameter {
  name: string;
  type: string;
  description?: string;
}

interface ApiResponse {
  status: string;
  description: string;
}

interface ApiRoute {
  path: string;
  methods: string[];
  description: string;
  parameters?: ApiParameter[];
  responses?: Record<string, ApiResponse>;
  tags?: string[];
}

async function* walkDirectory(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDirectory(fullPath);
    } else if (entry.isFile() && entry.name === 'route.ts') {
      yield fullPath;
    }
  }
}

async function extractApiInfo(filePath: string): Promise<ApiRoute | null> {
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Extract API path from file path
  const relativePath = path.relative(
    path.join(process.cwd(), '../src/app/api'),
    path.dirname(filePath)
  );
  const apiPath = '/api/' + relativePath.replace(/\\/g, '/');
  
  // Extract HTTP methods
  const methods: string[] = [];
  if (content.includes('export const GET')) methods.push('GET');
  if (content.includes('export const POST')) methods.push('POST');
  if (content.includes('export const PUT')) methods.push('PUT');
  if (content.includes('export const PATCH')) methods.push('PATCH');
  if (content.includes('export const DELETE')) methods.push('DELETE');
  
  if (methods.length === 0) return null;
  
  // Extract JSDoc comments
  const jsdocMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
  let description = '';
  if (jsdocMatch) {
    description = jsdocMatch[1]
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, '').trim())
      .filter(line => line.length > 0)
      .join(' ');
  }
  
  // Determine tags based on path
  const tags: string[] = [];
  if (apiPath.includes('/markets')) tags.push('Markets');
  else if (apiPath.includes('/users')) tags.push('Users');
  else if (apiPath.includes('/agents')) tags.push('Agents');
  else if (apiPath.includes('/auth')) tags.push('Authentication');
  else if (apiPath.includes('/a2a')) tags.push('A2A Protocol');
  else if (apiPath.includes('/posts')) tags.push('Social');
  else if (apiPath.includes('/pools')) tags.push('Pools');
  else tags.push('General');
  
  return {
    path: apiPath,
    methods,
    description,
    tags,
  };
}

interface OpenAPIPath {
  [method: string]: {
    summary: string;
    tags: string[];
    responses: Record<string, unknown>;
  };
}

async function generateOpenAPISpec(routes: ApiRoute[]) {
  const paths: Record<string, OpenAPIPath> = {};
  
  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }
    
    for (const method of route.methods) {
      paths[route.path][method.toLowerCase()] = {
        summary: route.description || `${method} ${route.path}`,
        tags: route.tags || ['General'],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
          },
          '401': {
            description: 'Unauthorized',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      };
    }
  }
  
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Babylon API',
      version: '1.0.0',
      description: 'Complete API documentation for Babylon social conspiracy game',
      contact: {
        name: 'Babylon Team',
        url: 'https://babylon.market',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://babylon.market',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Markets', description: 'Prediction market and perpetual futures endpoints' },
      { name: 'Users', description: 'User profile and account management' },
      { name: 'Agents', description: 'Agent registration and management' },
      { name: 'A2A Protocol', description: 'Agent-to-agent communication' },
      { name: 'Social', description: 'Posts, comments, and social features' },
      { name: 'Pools', description: 'Trading pool management' },
      { name: 'General', description: 'Miscellaneous endpoints' },
    ],
    paths,
    components: {
      securitySchemes: {
        PrivyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Privy authentication token',
        },
      },
    },
  };
  
  return openApiSpec;
}

async function generateMarkdownDocs(routes: ApiRoute[]) {
  const groupedRoutes = routes.reduce((acc, route) => {
    const tag = route.tags?.[0] || 'General';
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(route);
    return acc;
  }, {} as Record<string, ApiRoute[]>);
  
  let markdown = `# API Reference\n\n`;
  markdown += `Complete REST API documentation for Babylon.\n\n`;
  markdown += `## Base URL\n\n`;
  markdown += `\`\`\`\nhttps://babylon.market\n\`\`\`\n\n`;
  markdown += `## Authentication\n\n`;
  markdown += `Most endpoints require authentication via Privy. Include the JWT token in the Authorization header:\n\n`;
  markdown += `\`\`\`\nAuthorization: Bearer YOUR_TOKEN\n\`\`\`\n\n`;
  
  for (const [tag, tagRoutes] of Object.entries(groupedRoutes)) {
    markdown += `## ${tag}\n\n`;
    
    for (const route of tagRoutes.sort((a, b) => a.path.localeCompare(b.path))) {
      markdown += `### ${route.methods.join(', ')} ${route.path}\n\n`;
      if (route.description) {
        // Escape curly braces to prevent MDX interpretation
        const escapedDescription = route.description.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
        markdown += `${escapedDescription}\n\n`;
      }
      markdown += `**Methods:** ${route.methods.join(', ')}\n\n`;
      markdown += `---\n\n`;
    }
  }
  
  return markdown;
}

async function main() {
  console.log('🔍 Scanning API routes...');
  
  const apiDir = path.join(process.cwd(), '../src/app/api');
  const routes: ApiRoute[] = [];
  
  for await (const filePath of walkDirectory(apiDir)) {
    const route = await extractApiInfo(filePath);
    if (route) {
      routes.push(route);
      console.log(`  ✓ Found: ${route.methods.join(',')} ${route.path}`);
    }
  }
  
  console.log(`\n📝 Found ${routes.length} API routes\n`);
  
  // Generate OpenAPI spec
  console.log('📄 Generating OpenAPI spec...');
  const openApiSpec = await generateOpenAPISpec(routes);
  const specPath = path.join(process.cwd(), 'public/openapi.json');
  await fs.mkdir(path.dirname(specPath), { recursive: true });
  await fs.writeFile(specPath, JSON.stringify(openApiSpec, null, 2));
  console.log(`  ✓ Saved to public/openapi.json\n`);
  
  // Generate Markdown docs
  console.log('📝 Generating Markdown documentation...');
  const markdown = await generateMarkdownDocs(routes);
  const mdPath = path.join(process.cwd(), 'app/api-reference/_generated/endpoints.mdx');
  await fs.mkdir(path.dirname(mdPath), { recursive: true });
  await fs.writeFile(mdPath, markdown);
  console.log(`  ✓ Saved to app/api-reference/_generated/endpoints.mdx\n`);
  
  console.log('✅ API documentation generated successfully!');
}

main().catch(console.error);

