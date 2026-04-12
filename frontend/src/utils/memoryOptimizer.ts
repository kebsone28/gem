/**
 * Memory Optimizer
 * Helps reduce memory usage by clearing unused data and optimizing storage
 */

import { db } from '../store/db';
import logger from './logger';

// Augment Performance interface for memory property (Chrome/Chromium)
declare global {
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}

const MAX_HOUSEHOLDS_IN_MEMORY = 10000; // Max households to keep in memory
// TARGET_MEMORY_MB: 100 - Rough estimate of target max memory usage (not enforced)

export async function optimizeMemory(activeProjectId?: string) {
  try {
    const memBefore = performance.memory?.usedJSHeapSize || 0;

    // 1. Clear households from other projects if we have active project
    if (activeProjectId) {
      const outsideProject = await (db as any).households
        .where('projectId')
        .notEqual(activeProjectId)
        .toArray();

      if (outsideProject.length > 0) {
        logger.log(`🧹 [MEMORY] Clearing ${outsideProject.length} households from other projects`);
        await (db as any).households.where('projectId').notEqual(activeProjectId).delete();
      }
    }

    // 2. If we still have too many households, keep only most recent
    const totalHouseholds = await (db as any).households.count();
    if (totalHouseholds > MAX_HOUSEHOLDS_IN_MEMORY) {
      logger.warn(`⚠️ [MEMORY] Too many households (${totalHouseholds}), trimming to most recent`);
      const toDelete = totalHouseholds - MAX_HOUSEHOLDS_IN_MEMORY;
      const oldest = await (db as any).households.orderBy('updatedAt').limit(toDelete).toArray();

      for (const h of oldest) {
        await (db as any).households.delete(h.id);
      }
    }

    // 3. Compact IndexedDB (no direct API, but removing deleted docs helps)
    logger.log('✅ [MEMORY] Optimization complete');

    const memAfter = performance.memory?.usedJSHeapSize || 0;
    const freed = (memBefore - memAfter) / (1024 * 1024);
    if (freed > 0) {
      logger.log(`💾 Freed ~${freed.toFixed(2)}MB`);
    }
  } catch (error) {
    logger.error('Memory optimization failed:', error);
  }
}

export function estimateMemoryUsage(dataSize: number): string {
  if (dataSize < 1024) return `${dataSize}B`;
  if (dataSize < 1024 * 1024) return `${(dataSize / 1024).toFixed(2)}KB`;
  return `${(dataSize / (1024 * 1024)).toFixed(2)}MB`;
}

export function getMemoryStats() {
  if (!performance.memory) return null;
  const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
  const percent = (usedJSHeapSize / jsHeapSizeLimit) * 100;
  return {
    used: estimateMemoryUsage(usedJSHeapSize),
    limit: estimateMemoryUsage(jsHeapSizeLimit),
    percent: percent.toFixed(1),
  };
}
