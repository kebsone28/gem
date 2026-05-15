import { lazy } from 'react';

/**
 * 🔄 Lazy with Retry - GED OS Utility
 * Permet de charger un composant avec une logique de retry automatique en cas d'erreur réseau
 * (typique lors des mises à jour de build ou déconnexions micro-coupures).
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  cacheKey: string
) {
  return lazy(async () => {
    try {
      const module = await importer();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(cacheKey);
      }
      return module;
    } catch (error) {
      if (typeof window !== 'undefined') {
        const hasRetried = window.sessionStorage.getItem(cacheKey) === '1';
        if (!hasRetried) {
          window.sessionStorage.setItem(cacheKey) === '1';
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
}
