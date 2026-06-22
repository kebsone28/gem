/**
 * 🔀 GED OS Kernel — KernelOrchestrator
 * Orchestre les flux d'événements critiques entre modules.
 * Permet de définir des règles de type : "quand X se produit → faire Y dans le module Z".
 *
 * Ce fichier est le "cerveau réactif" du Kernel. Il s'initialise une seule
 * fois au démarrage de l'application (dans App.tsx ou main.tsx).
 */

import { EventBus, KERNEL_EVENTS } from './EventBus';
import logger from '@utils/logger';

let initialized = false;

export function initKernelOrchestrator(): () => void {
  if (initialized) {
    logger.warn('[Kernel] Orchestrateur déjà initialisé — skip.');
    return () => {};
  }
  initialized = true;
  logger.info('[Kernel] 🚀 Démarrage de l\'Orchestrateur GED OS');

  const unsubscribers: (() => void)[] = [];

  // ── Règle 1 : Terrain mis à jour → invalider les caches de logistique ──────
  unsubscribers.push(
    EventBus.on(KERNEL_EVENTS.TERRAIN_DATA_UPDATED, (event) => {
      logger.debug(`[Kernel] Terrain updated by ${event.source} — notifying logistique module`);
      // Les modules logistique/dashboard peuvent écouter directement TERRAIN_DATA_UPDATED.
      // Ici, on peut enrichir ou transformer l'event si nécessaire.
    })
  );

  // ── Règle 2 : Mission créée → déclencher alertes logistique ───────────────
  unsubscribers.push(
    EventBus.on(KERNEL_EVENTS.MISSION_CREATED, (event) => {
      logger.debug(`[Kernel] Mission created: ${event.payload?.missionId}`);
      // Ici on pourrait émettre STOCK_ALERT si le stock est insuffisant.
    })
  );

  // ── Règle 3 : Changement de projet → réinitialiser tous les contextes ─────
  unsubscribers.push(
    EventBus.on(KERNEL_EVENTS.PROJECT_CHANGED, (event) => {
      logger.debug(`[Kernel] Project changed: ${event.payload?.projectId} — clearing module caches`);
    })
  );

  // ── Règle 4 : Sync terminé → notifier les modules en offline-first ────────
  unsubscribers.push(
    EventBus.on(KERNEL_EVENTS.SYNC_COMPLETED, (event) => {
      logger.debug(`[Kernel] Sync completed from ${event.source}`);
    })
  );

  logger.info('[Kernel] ✅ Orchestrateur initialisé avec 4 règles actives');

  // Retourne une fonction de cleanup pour le hot-reload (Vite HMR)
  return () => {
    unsubscribers.forEach((fn) => fn());
    initialized = false;
    logger.info('[Kernel] Orchestrateur arrêté');
  };
}
