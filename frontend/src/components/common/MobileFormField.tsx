import React from 'react';
import { AlertCircle } from 'lucide-react';

interface MobileFormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

/**
 * MobileFormField — Wraps form inputs with mobile-optimized layout.
 *
 * Features:
 * - Larger label and touch targets for mobile
 * - Inline error message with icon
 * - Optional hint text
 * - Reduced visual noise on small screens
 * - Works inside any form layout
 *
 * @example
 * ```tsx
 * <MobileFormField label="Nom complet" required error={errors.name}>
 *   <input className="..." value={name} onChange={...} />
 * </MobileFormField>
 * ```
 */
export default function MobileFormField({
  label,
  error,
  required,
  hint,
  children,
}: MobileFormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Label — larger tap target */}
      <label className="flex items-center gap-1 text-sm font-bold tracking-tight text-slate-300">
        {label}
        {required && (
          <span className="text-rose-400" aria-label="required">
            *
          </span>
        )}
      </label>

      {/* Input area */}
      {children}

      {/* Hint text */}
      {hint && !error && (
        <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      )}

      {/* Error message with icon */}
      {error && (
        <div className="flex items-start gap-1.5 text-xs font-medium text-rose-400">
          <AlertCircle size={12} className="mt-[2px] shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/**
 * TouchInputClasses — Standard CSS classes for touch-optimized inputs.
 *
 * Use these `className` values on `<input>`, `<select>`, and `<textarea>`
 * elements inside `MobileFormField` for consistent sizing.
 *
 * ```tsx
 * <MobileFormField label="Email">
 *   <input className={TouchInputClasses} placeholder="Saisissez votre email" />
 * </MobileFormField>
 * ```
 */
export const TouchInputClasses =
  'min-h-[48px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder-slate-500 outline-none transition-all duration-150 focus:border-blue-500/50 focus:bg-blue-500/[0.04] focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)]';

export const TouchSelectClasses =
  'min-h-[48px] w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-4 pr-10 text-sm text-white outline-none transition-all duration-150 focus:border-blue-500/50 focus:bg-blue-500/[0.04] focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)]';

export const TouchTextareaClasses =
  'min-h-[100px] w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-150 focus:border-blue-500/50 focus:bg-blue-500/[0.04] focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)]';
