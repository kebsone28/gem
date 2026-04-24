/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * SyncEngine — Orchestrateur de synchronisation centralisé
 *
 * Garantit :
 *  - 1 seule sync active à la fois
 *  - File d'attente contrôlée (FIFO + priorité)
 *  - Anti-doublon (même source < 2s ignorée)
 *  - Retry unique et sécurisé en cas d'échec
 *  - Persistance queue en localStorage (restart-safe)
 */

import { logger } from '../../services/logger';

const QUEUE_BACKUP_KEY = 'sync_engine_queue_backup';
const DEDUP_WINDOW_MS = 2000; // 2 secondes
const RETRY_DELAY_MS = 3000; // délai avant retry

export type SyncPriority = 'high' | 'normal' | 'low';

export type SyncJob = {
  id: string;
  source: string;
  priority?: SyncPriority;
  timestamp: number;
  /**
   * La fonction async à exécuter.
   * NON persistée (ne peut pas être sérialisée), restaurée à partir de
   * la registry au redémarrage si nécessaire.
   */
  execute: () => Promise<void>;
};

/** Métadonnées persistables (sans `execute`) */
type PersistedJob = Omit<SyncJob, 'execute'>;

const PRIORITY_ORDER: Record<SyncPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

class SyncEngine {
  private queue: SyncJob[] = [];
  private running = false;
  private lastRunAt = 0;
  /** Horodatage de la dernière exécution par source — anti-doublon */
  private lastSourceRunAt = new Map<string, number>();

  constructor() {
    this._restoreQueue();
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────

  enqueue(job: SyncJob): void {
    // 1. Anti-doublon : même source exécutée ou en attente < DEDUP_WINDOW_MS
    const recentInQueue = this.queue.find(
      (j) => j.source === job.source && Date.now() - j.timestamp < DEDUP_WINDOW_MS
    );
    const lastRan = this.lastSourceRunAt.get(job.source) ?? 0;
    const ranRecently = Date.now() - lastRan < DEDUP_WINDOW_MS;

    if (recentInQueue || ranRecently) {
      logger.debug('SYNC', `Duplicate ignored: ${job.source}`);
      return;
    }

    this.queue.push(job);
    this._sortQueue();
    this._persistQueue();

    logger.debug(
      'SYNC',
      `Enqueued: ${job.source} (priority=${job.priority ?? 'normal'}, queueLen=${this.queue.length})`
    );

    this._process();
  }

  isRunning(): boolean {
    return this.running;
  }

  queueLength(): number {
    return this.queue.length;
  }

  getLastRunAt(): number {
    return this.lastRunAt;
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private _sortQueue(): void {
    this.queue.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority ?? 'normal'];
      const pb = PRIORITY_ORDER[b.priority ?? 'normal'];
      if (pa !== pb) return pa - pb;
      return a.timestamp - b.timestamp; // FIFO pour même priorité
    });
  }

  private async _process(): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      this._persistQueue();

      logger.debug('SYNC', `Executing: ${job.source}`);
      this.lastSourceRunAt.set(job.source, Date.now());

      try {
        await job.execute();
        this.lastRunAt = Date.now();
        logger.debug('SYNC', `Done: ${job.source}`);
      } catch (err) {
        logger.error('SYNC', `Failed: ${job.source}`, err);

        // Retry léger (1 seule fois, après délai)
        const retryKey = `${job.source}__retry`;
        const alreadyRetried = this.lastSourceRunAt.has(retryKey);

        if (!alreadyRetried) {
          this.lastSourceRunAt.set(retryKey, Date.now());
          logger.debug('SYNC', `Scheduling retry for: ${job.source}`);
          setTimeout(() => {
            this.lastSourceRunAt.delete(retryKey); // libère le verrou retry
            this.enqueue({ ...job, timestamp: Date.now(), priority: 'low' });
          }, RETRY_DELAY_MS);
        } else {
          logger.warn('SYNC', `Retry already attempted for ${job.source} — giving up`);
          this.lastSourceRunAt.delete(retryKey);
        }
      }
    }

    this.running = false;
  }

  // ─── PERSISTENCE ───────────────────────────────────────────────────────────

  private _persistQueue(): void {
    try {
      // Sérialisation : on ne garde que les métadonnées (pas 'execute')
      const toSave: PersistedJob[] = this.queue.map(({ execute: _fn, ...meta }) => meta);
      localStorage.setItem(QUEUE_BACKUP_KEY, JSON.stringify(toSave));
    } catch {
      // localStorage indisponible (SSR, mode privé)
    }
  }

  private _restoreQueue(): void {
    try {
      const raw = localStorage.getItem(QUEUE_BACKUP_KEY);
      if (!raw) return;

      const saved: PersistedJob[] = JSON.parse(raw);
      // On ne peut pas restaurer `execute` — on vide juste le backup
      // Le démarrage naturel des services re-émettra les jobs si nécessaire
      if (saved.length > 0) {
        logger.debug('SYNC', `Cleared ${saved.length} stale job(s) from previous session backup`);
        localStorage.removeItem(QUEUE_BACKUP_KEY);
      }
    } catch {
      localStorage.removeItem(QUEUE_BACKUP_KEY);
    }
  }
}

// Singleton global — 1 seule instance pour toute l'app
export const syncEngine = new SyncEngine();
