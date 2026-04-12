import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logger from '../utils/logger';

export default function PWAPrompt() {
  // avoid caching source files during development — ServiceWorker only for production builds
  if (import.meta.env.DEV) {
    logger.log('💎 [PWA] Skipping SW registration in dev mode');
    return null;
  }

  const sw: any = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      logger.log('💎 [PWA] SW Registered: ', r);
    },
    onRegisterError(error: any) {
      logger.error('❌ [PWA] SW registration error', error);
    },
  });

  // Garde-fou ultime
  if (!sw) return null;

  // Déstructuration progressive pour éviter le crash "Symbol(Symbol.iterator) of undefined"
  const offlineReadyState = sw.offlineReady || [false, () => {}];
  const needUpdateState = sw.needUpdate || [false, () => {}];

  const [offlineReady, setOfflineReady] = Array.isArray(offlineReadyState)
    ? offlineReadyState
    : [false, () => {}];
  const [needUpdate, setNeedUpdate] = Array.isArray(needUpdateState)
    ? needUpdateState
    : [false, () => {}];
  const updateServiceWorker = sw.updateServiceWorker;

  const close = () => {
    if (typeof setOfflineReady === 'function') setOfflineReady(false);
    if (typeof setNeedUpdate === 'function') setNeedUpdate(false);
  };

  return (
    <AnimatePresence>
      {(offlineReady || needUpdate) && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:w-96 z-[9999] bg-dark-surface p-5 rounded-[var(--radius-xl)] border border-primary/30 shadow-elevated backdrop-blur-xl"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg gradient-primary-soft text-primary">
                {needUpdate ? (
                  <RefreshCw size={20} className="animate-spin-slow" />
                ) : (
                  <Download size={20} />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-dark-text">
                  {needUpdate ? 'Mise à jour disponible' : 'Application prête hors-ligne'}
                </h3>
                <p className="text-xs text-dark-text-muted mt-0.5">
                  {needUpdate
                    ? 'Une nouvelle version est prête pour amélioration.'
                    : "L'application est maintenant utilisable sans connexion."}
                </p>
              </div>
            </div>
            <button
              onClick={close}
              aria-label="Fermer la notification"
              className="p-1 text-dark-text-muted hover:text-dark-text-secondary"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex gap-3">
            {needUpdate && (
              <button
                onClick={() => updateServiceWorker(true)}
                className="flex-1 btn-primary py-2 text-xs font-bold"
              >
                Recharger
              </button>
            )}
            <button
              onClick={close}
              className="flex-1 px-4 py-2 border border-dark-border rounded-[var(--radius-md)] text-xs text-dark-text-secondary hover:bg-white dark:bg-slate-900/5 font-medium transition-all"
            >
              {needUpdate ? 'Plus tard' : 'Fermer'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
