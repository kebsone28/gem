import React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

/**
 * EmptyState — A reusable empty state component.
 *
 * - Shows an icon, title, and optional description.
 * - Optional primary and secondary action buttons with large touch targets.
 * - On mobile (default) buttons are full-width for easy tapping.
 * - On `md:` and above, buttons are inline.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={FolderOpen}
 *   title="Aucune mission"
 *   description="Créez votre première mission pour commencer."
 *   actionLabel="Créer une mission"
 *   onAction={() => navigate('/missions/create')}
 * />
 * ```
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex w-full flex-col items-center justify-center px-6 py-16 text-center"
    >
      {/* Icon container */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <Icon size={36} className="text-slate-500/60" strokeWidth={1.2} />
      </div>

      {/* Title */}
      <h3 className="mb-2 text-lg font-bold tracking-tight text-slate-200">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-400">
          {description}
        </p>
      )}

      {/* Action buttons — full-width on mobile, inline on desktop */}
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-500/30 active:scale-[0.98] sm:w-auto"
          >
            {actionLabel}
          </button>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-slate-300 transition-all duration-200 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] sm:w-auto"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
