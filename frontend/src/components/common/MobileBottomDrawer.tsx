import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface MobileBottomDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /**
   * Snap height as a fraction of the viewport.
   * - `0.5` → half screen
   * - `0.85` → almost full screen (default)
   * - `1` → full screen
   */
  snapHeight?: number;
}

/**
 * MobileBottomDrawer — Slide-up bottom sheet for mobile.
 *
 * Replaces desktop modals on small screens. Features:
 * - Drag-to-dismiss via swipe-down gesture
 * - Backdrop tap to close
 * - Smooth spring animation
 * - Safe area aware
 * - Hidden on `md:` and above (use regular modals there)
 *
 * @example
 * ```tsx
 * <MobileBottomDrawer open={isOpen} onClose={() => setIsOpen(false)} title="Détails">
 *   <p>Contenu du drawer...</p>
 * </MobileBottomDrawer>
 * ```
 */
export default function MobileBottomDrawer({
  open,
  onClose,
  title,
  children,
  snapHeight = 0.85,
}: MobileBottomDrawerProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const [translateY, setTranslateY] = useState(0);
  const isDragging = useRef(false);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setTranslateY(0);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches[0].clientY < 40) {
      // Only start drag if touching near the top handle area
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      currentY.current = delta;
      setTranslateY(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (currentY.current > 120) {
      // Swipe enough → close
      onClose();
    } else {
      setTranslateY(0);
    }
    currentY.current = 0;
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: translateY }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 300,
              mass: 0.8,
            }}
            style={{ height: `${snapHeight * 100}vh` }}
            className="fixed bottom-0 left-0 right-0 z-[101] mx-auto flex w-full max-w-lg flex-col rounded-t-2xl border-t border-white/10 bg-[#0a1228] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] md:hidden"
          >
            {/* Drag handle */}
            <div
              className="flex shrink-0 items-center justify-center py-3"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 pb-4">
                <h2 className="text-base font-bold tracking-tight text-white">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-slate-400 transition-colors hover:text-white"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
