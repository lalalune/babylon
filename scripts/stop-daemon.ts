#!/usr/bin/env bun
/**
 * Stop the realtime daemon gracefully
 * 
 * Uses pkill to stop all tsx processes running realtime-daemon.ts
 */

import { execSync } from 'child_process';
import { logger } from '@/lib/logger';

function getDaemonPids(): number[] {
  try {
    // Use same pattern as daemon startup check - specific to avoid matching this script
    const result = execSync('pgrep -f "tsx.*src/cli/realtime-daemon"', { encoding: 'utf-8' }).trim();
    if (result) {
      const pids = result.split('\n')
        .map(line => parseInt(line.trim(), 10))
        .filter(pid => !isNaN(pid));
      
      // Filter out this script's PID and parent
      return pids.filter(pid => 
        pid !== process.pid && 
        pid !== process.ppid
      );
    }
  } catch {
    // No processes found
  }
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');

  logger.info('Searching for daemon processes...', undefined, 'stop-daemon');
  
  const pids = getDaemonPids();
  
  if (pids.length === 0) {
    logger.info('No daemon processes found', undefined, 'stop-daemon');
    process.exit(0);
  }

  logger.info(`Found ${pids.length} daemon process(es): ${pids.join(', ')}`, undefined, 'stop-daemon');

  try {
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    logger.info(`Sending ${signal} to daemon processes...`, undefined, 'stop-daemon');
    
    // Kill each PID individually to avoid killing ourselves
    for (const pid of pids) {
      try {
        process.kill(pid, signal);
      } catch (err) {
        logger.warn(`Could not kill PID ${pid}:`, err, 'stop-daemon');
      }
    }
    
    logger.info('Kill signal sent', undefined, 'stop-daemon');
  } catch (error: any) {
    logger.error('Failed to send kill signal:', error, 'stop-daemon');
    process.exit(1);
  }

  // Wait for processes to stop
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify all stopped
  const remainingPids = getDaemonPids();
  const remainingCount = remainingPids.length;
  if (remainingCount > 0) {
    logger.warn(`${remainingCount} process(es) still running`, undefined, 'stop-daemon');
    if (!force) {
      logger.warn('Try running with --force flag: bun run daemon:stop --force', undefined, 'stop-daemon');
    } else {
      logger.error('Failed to stop processes even with --force', undefined, 'stop-daemon');
      logger.info('You may need to manually kill them with: pkill -9 -f "realtime-daemon"', undefined, 'stop-daemon');
    }
    process.exit(1);
  } else {
    logger.info('✅ All daemon processes stopped successfully', undefined, 'stop-daemon');
    process.exit(0);
  }
}

if (import.meta.main) {
  main();
}

