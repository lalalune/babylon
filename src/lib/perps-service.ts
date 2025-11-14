/**
 * Perpetuals Service - Singleton wrapper for PerpetualsEngine
 * 
 * Provides server-side access to perpetuals trading functionality
 */

import { PerpetualsEngine } from '@/engine/PerpetualsEngine';
import { db } from './database-service';
import type { Organization } from '@/shared/types';
import { logger } from './logger';

let perpsEngineInstance: PerpetualsEngine | null = null;

export function getPerpsEngine(): PerpetualsEngine {
  // Only instantiate on server side
  if (typeof window !== 'undefined') {
    throw new Error('PerpetualsEngine can only be instantiated on the server side');
  }
  
  if (!perpsEngineInstance) {
    perpsEngineInstance = new PerpetualsEngine();
    
    // Initialize with organizations from database
    initializePerpsEngine().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize PerpetualsEngine', { error: errorMessage }, 'PerpsService');
    });
  }
  
  return perpsEngineInstance;
}

async function initializePerpsEngine() {
  if (!perpsEngineInstance) return;
  
  const organizations = await db.getAllOrganizations() as Organization[];
  perpsEngineInstance.initializeMarkets(organizations);
}

// NOTE: Singleton export removed to prevent initialization during Next.js build
// Use getPerpsEngine() function instead to lazily initialize when needed

