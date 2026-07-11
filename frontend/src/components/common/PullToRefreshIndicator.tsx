import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowDown } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  /** Pull progress from 0 to 1 */
  progress: number;
  /** Whether a refresh is currently happening */
  refreshing: boolean;
  /** Pull distance threshold at which refresh triggers (as fraction of max) */
  threshold?: number;
}

/**
 * PullToRefreshIndicator — Visual indicator for pull-to-refresh.
 *
 * Pairs with the `usePullToRefresh` hook. Shows:
 * - An arrow that rotates as you pull down
 * - A spinner during refresh
 * - Hint text in French
 *
 * @example
 * ```tsx
 * const { pullProgress, isRefreshing, containerProps } = usePullToRefresh({ onRefresh });
 *
 * return (
 *   <div className="relative" {...containerProps}>
 *     <PullToRefreshIndicator progress={pullProgress} refreshing={isRefreshing} />
 *     <div className="pt-12">
 *       {items.map(...)}
 *     </div>
 *   </div>
 * );
 * ```
 */
export default function PullToRefreshIndicator({
  progress,
  refreshing,
  threshold = 0.7,
}: PullToRefreshIndicatorProps) {
  const show = progress > 0 || refreshing;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: refreshing ? 56 : Math.min(progress * 80, 80),
            opacity: 1,
          }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="flex w-full items-center justify-center overflow-hidden"
        >
          <div className="flex items-center gap-3">
            {refreshing ? (
              <>
                <Loader2 size={18} className="animate-spin text-blue-400" />
                <span className="text-sm font-bold text-blue-300">
                  Synchronisation...
                </span>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ rotate: progress >= threshold ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <ArrowDown
                    size={18}
                    className={
                      progress >= threshold
                        ? 'text-blue-400'
                        : 'text-slate-400'
                    }
                  />
                </motion.div>
                <span className="text-sm font-medium text-slate-400">
                  {progress >= threshold
                    ? 'Relâchez pour actualiser'
                    : 'Tirez pour actualiser'}
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
