/**
 * Training Data Archiver (Vercel Blob)
 * 
 * Archives training data (exported trajectories, RULER scores) to Vercel Blob
 * for long-term storage and reproducibility.
 */

import { put, list, del } from '@vercel/blob';
import { logger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

export interface ArchivedWindow {
  windowId: string;
  trajectoryCount: number;
  blobUrls: {
    trajectories: string;
    groups?: string;
    rulerScores?: string;
    metadata: string;
  };
  archivedAt: Date;
  size: number;
}

export class TrainingDataArchiver {
  private readonly blobPrefix = 'training-data/';

  /**
   * Archive training data for a window
   */
  async archiveWindow(options: {
    windowId: string;
    trajectoriesPath: string;
    groupsPath?: string;
    rulerScoresPath?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ArchivedWindow> {
    try {
      logger.info('Archiving training data', { windowId: options.windowId });

      const prefix = `${this.blobPrefix}${options.windowId}/`;
      const urls: any = {};
      let totalSize = 0;

      // Upload trajectories
      const trajData = await fs.readFile(options.trajectoriesPath);
      const trajBlob = await put(`${prefix}trajectories.jsonl`, trajData, {
        access: 'public',
        addRandomSuffix: false
      });
      urls.trajectories = trajBlob.url;
      totalSize += (trajBlob as any).size || 0;

      // Upload groups if provided
      if (options.groupsPath) {
        const groupsData = await fs.readFile(options.groupsPath);
        const groupsBlob = await put(`${prefix}groups.jsonl`, groupsData, {
          access: 'public',
          addRandomSuffix: false
        });
        urls.groups = groupsBlob.url;
        totalSize += (groupsBlob as any).size || 0;
      }

      // Upload RULER scores if provided
      if (options.rulerScoresPath) {
        const scoresData = await fs.readFile(options.rulerScoresPath);
        const scoresBlob = await put(`${prefix}ruler_scores.json`, scoresData, {
          access: 'public',
          addRandomSuffix: false
        });
        urls.rulerScores = scoresBlob.url;
        totalSize += (scoresBlob as any).size || 0;
      }

      // Upload metadata
      const metadataBlob = await put(
        `${prefix}metadata.json`,
        JSON.stringify(options.metadata || {}, null, 2),
        { access: 'public', addRandomSuffix: false }
      );
      urls.metadata = metadataBlob.url;
      totalSize += (metadataBlob as any).size || 0;

      logger.info('Training data archived', {
        windowId: options.windowId,
        size: totalSize
      });

      return {
        windowId: options.windowId,
        trajectoryCount: (options.metadata?.trajectoryCount as number) || 0,
        blobUrls: urls,
        archivedAt: new Date(),
        size: totalSize
      };

    } catch (error) {
      logger.error('Failed to archive training data', error);
      throw error;
    }
  }

  /**
   * Retrieve archived training data
   */
  async getWindowData(windowId: string): Promise<{
    trajectories: string;
    groups?: string;
    rulerScores?: Record<string, unknown>;
    metadata: Record<string, unknown>;
  } | null> {
    try {
      const prefix = `${this.blobPrefix}${windowId}/`;
      const { blobs } = await list({ prefix });

      if (blobs.length === 0) {
        return null;
      }

      const result: any = {};

      for (const blob of blobs) {
        const response = await fetch(blob.url);
        const filename = path.basename(blob.pathname);

        if (filename === 'trajectories.jsonl') {
          result.trajectories = await response.text();
        } else if (filename === 'groups.jsonl') {
          result.groups = await response.text();
        } else if (filename === 'ruler_scores.json') {
          result.rulerScores = await response.json();
        } else if (filename === 'metadata.json') {
          result.metadata = await response.json();
        }
      }

      return result;

    } catch (error) {
      logger.error('Failed to retrieve archived data', error);
      return null;
    }
  }

  /**
   * List all archived windows
   */
  async listWindows(): Promise<string[]> {
    try {
      const { blobs } = await list({ prefix: this.blobPrefix });

      const windows = new Set<string>();
      for (const blob of blobs) {
        const parts = blob.pathname.split('/');
        if (parts[1]) {
          windows.add(parts[1]);
        }
      }

      return Array.from(windows).sort().reverse();

    } catch (error) {
      logger.error('Failed to list windows', error);
      return [];
    }
  }

  /**
   * Delete archived window
   */
  async deleteWindow(windowId: string): Promise<void> {
    try {
      const prefix = `${this.blobPrefix}${windowId}/`;
      const { blobs } = await list({ prefix });

      for (const blob of blobs) {
        await del(blob.url);
      }

      logger.info('Deleted archived window', { windowId });

    } catch (error) {
      logger.error('Failed to delete window', error);
      throw error;
    }
  }
}

// Singleton
export const trainingDataArchiver = new TrainingDataArchiver();

