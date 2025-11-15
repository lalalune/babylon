#!/usr/bin/env bun

/**
 * Script to upload issues from CSV to GitHub
 * 
 * Usage:
 *   GITHUB_TOKEN=your_token bun run scripts/upload-github-issues.ts
 * 
 * Or set GITHUB_TOKEN in .env.local
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { config } from 'dotenv';
import { resolve } from 'path';

interface CSVRow {
  Title: string;
  Body: string;
  Labels: string;
  Assignee: string;
  Priority: string;
  Status: string;
  'Due Date': string;
  Epic: string;
}

interface GitHubIssue {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

const GITHUB_REPO = 'elizaOS/babylon';
const GITHUB_API_BASE = 'https://api.github.com';

async function createGitHubIssue(issue: GitHubIssue): Promise<number | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/issues`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Babylon-Issue-Uploader',
      },
      body: JSON.stringify(issue),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create issue "${issue.title}":`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Created issue #${data.number}: ${issue.title}`);
    return data.number;
  } catch (error) {
    console.error(`Error creating issue "${issue.title}":`, error);
    return null;
  }
}

function parseCSV(filePath: string): CSVRow[] {
  const content = readFileSync(filePath, 'utf-8');
  
  // Parse CSV with proper handling of multi-line fields
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    quote: '"',
    escape: '"',
    bom: true,
  }) as CSVRow[];

  return records;
}

function parseAssignees(assignee: string): string[] {
  if (!assignee || !assignee.trim() || assignee === 'TBD') {
    return [];
  }
  
  // Remove markdown formatting like **Luca** -> Luca
  const cleaned = assignee.replace(/\*\*/g, '');
  
  // Split by comma and clean each assignee
  return cleaned
    .split(',')
    .map(a => a.trim())
    .filter(a => a && a !== 'TBD' && a !== '');
}

function parseLabels(labels: string, epic: string): string[] {
  const labelSet = new Set<string>();
  
  // Parse comma-separated labels
  if (labels) {
    labels.split(',').forEach(label => {
      const cleaned = label.trim();
      if (cleaned) {
        labelSet.add(cleaned);
      }
    });
  }
  
  // Add epic as a label if provided
  if (epic && epic.trim()) {
    labelSet.add(epic.trim());
  }
  
  return Array.from(labelSet);
}

function formatBody(body: string, row: CSVRow): string {
  let formatted = body;
  
  // Add metadata as a footer
  const metadata: string[] = [];
  
  if (row.Priority && row.Priority.trim() && !row.Priority.includes('**')) {
    metadata.push(`**Priority:** ${row.Priority.trim()}`);
  }
  
  if (row.Status && row.Status.trim() && row.Status !== 'todo') {
    metadata.push(`**Status:** ${row.Status.trim()}`);
  }
  
  if (row['Due Date'] && row['Due Date'].trim() && !row['Due Date'].includes('**')) {
    metadata.push(`**Due Date:** ${row['Due Date'].trim()}`);
  }
  
  if (row.Epic && row.Epic.trim()) {
    metadata.push(`**Epic:** ${row.Epic.trim()}`);
  }
  
  if (metadata.length > 0) {
    formatted += '\n\n---\n\n' + metadata.join(' | ');
  }
  
  return formatted;
}

async function main() {
  // Load environment variables from .env.local if it exists
  try {
    config({ path: resolve(process.cwd(), '.env.local') });
  } catch (error) {
    // .env.local might not exist, that's okay
  }

  const csvPath = process.argv[2] || '/Users/janbrezina/Library/CloudStorage/GoogleDrive-0x.puncar@gmail.com/My Drive/github-issues-import.csv';
  
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ Error: GITHUB_TOKEN environment variable is required');
    console.log('\nUsage:');
    console.log('  GITHUB_TOKEN=your_token bun run scripts/upload-github-issues.ts [csv-path]');
    console.log('\nOr add GITHUB_TOKEN to .env.local');
    process.exit(1);
  }

  console.log(`📖 Reading CSV from: ${csvPath}`);
  const rows = parseCSV(csvPath);
  console.log(`📋 Found ${rows.length} issues to upload\n`);

  let successCount = 0;
  let failCount = 0;
  const createdIssues: Array<{ number: number; title: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row || !row.Title || !row.Title.trim()) {
      console.log(`⏭️  Skipping row ${i + 1}: No title or empty row`);
      continue;
    }

    const issue: GitHubIssue = {
      title: row.Title.trim(),
      body: formatBody(row.Body || '', row),
      labels: parseLabels(row.Labels || '', row.Epic || ''),
    };

    const assignees = parseAssignees(row.Assignee || '');
    if (assignees.length > 0) {
      issue.assignees = assignees;
    }

    console.log(`\n📝 Creating issue ${i + 1}/${rows.length}: ${issue.title}`);
    
    const issueNumber = await createGitHubIssue(issue);
    
    if (issueNumber) {
      successCount++;
      createdIssues.push({ number: issueNumber, title: issue.title });
    } else {
      failCount++;
    }

    // Rate limiting: GitHub allows 5000 requests/hour for authenticated users
    // Adding a small delay to be safe
    if (i < rows.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully created: ${successCount} issues`);
  console.log(`❌ Failed: ${failCount} issues`);
  console.log('='.repeat(60));

  if (createdIssues.length > 0) {
    console.log('\n📋 Created issues:');
    createdIssues.forEach(issue => {
      console.log(`  #${issue.number}: ${issue.title}`);
    });
  }
}

main().catch(console.error);

