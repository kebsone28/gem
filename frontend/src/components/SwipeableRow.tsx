import React, { useRef, useState, useCallback } from 'react';

export interface SwipeAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** CSS background-color value, e.g. '#3b82f6' or 'var(--color-info)' */
  color: string;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  actions: SwipeAction[];
  /** Minimum px to swipe before triggering snap-open (and width of each action button) */
  threshold?: number;
}

/**
 * SwipeableRow — mobile‑friendly swipe‑to‑reveal actions.
 *
 * - Swipe left to reveal action buttons behind the content.
 * - Each action button is `threshold` px wide.
 * - Supports both touch (mobile) and mouse (desktop) interactions.
 * - Renders children as‑is when `actions` is empty.
 */
const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, actions, threshold = 80 }) => {
  const [translateX, setTranslateX] = useState(0);
  const touchStartX = useRef(0);
  const currentTranslateX = useRef(0);
  const isDragging = useRef(false);

  const maxSwipe = actions.length * threshold;

  // ── Touch handlers ──────────────────────────────────────────────────────

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (actions.length === 0) return;
      touchStartX.current = e.touches[0].clientX;
      isDragging.current = true;
    },
    [actions.length]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current || actions.length === 0) return;
      const deltaX = touchStartX.current - e.touches[0].clientX;
      const newTranslateX = Math.max(0, Math.min(deltaX, maxSwipe));
      setTranslateX(newTranslateX);
      currentTranslateX.current = newTranslateX;
    },
    [actions.length, maxSwipe]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || actions.length === 0) return;
    isDragging.current = false;
    if (currentTranslateX.current > threshold / 2) {
      setTranslateX(maxSwipe);
      currentTranslateX.current = maxSwipe;
    } else {
      setTranslateX(0);
      currentTranslateX.current = 0;
    }
  }, [actions.length, threshold, maxSwipe]);

  // ── Mouse handlers (desktop) ────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (actions.length === 0) return;
      touchStartX.current = e.clientX;
      isDragging.current = true;
    },
    [actions.length]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current || actions.length === 0) return;
      const deltaX = touchStartX.current - e.clientX;
      const newTranslateX = Math.max(0, Math.min(deltaX, maxSwipe));
      setTranslateX(newTranslateX);
      currentTranslateX.current = newTranslateX;
    },
    [actions.length, maxSwipe]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || actions.length === 0) return;
    isDragging.current = false;
    if (currentTranslateX.current > threshold / 2) {
      setTranslateX(maxSwipe);
      currentTranslateX.current = maxSwipe;
    } else {
      setTranslateX(0);
      currentTranslateX.current = 0;
    }
  }, [actions.length, threshold, maxSwipe]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      setTranslateX(0);
      currentTranslateX.current = 0;
    }
  }, []);

  // ── Action button click ─────────────────────────────────────────────────

  const handleActionClick = useCallback(
    (onClick: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick();
      // Close the row after action
      setTranslateX(0);
      currentTranslateX.current = 0;
    },
    []
  );

  // ── Render ──────────────────────────────────────────────────────────────

  if (actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <div className="swipeable-row" style={{ overflow: 'hidden', position: 'relative' }}>
      {/* Actions panel — hidden behind content until swipe reveals it */}
      <div
        className="swipeable-row-actions"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          zIndex: 0,
        }}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            type="button"
            className="swipeable-action-btn"
            onClick={handleActionClick(action.onClick)}
            style={{
              background: action.color,
              color: '#fff',
              border: 'none',
              padding: '0 1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              minWidth: `${threshold}px`,
              fontSize: '0.75rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              gap: '0.25rem',
            }}
            aria-label={action.label}
          >
            {action.icon && <span className="swipeable-action-icon">{action.icon}</span>}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Foreground content — moves left on swipe */}
      <div
        className="swipeable-row-content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `translateX(-${translateX}px)`,
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          zIndex: 1,
          background: 'inherit',
          touchAction: 'pan-y',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableRow;
