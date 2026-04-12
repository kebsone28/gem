import { useEffect, useRef, useState, useCallback } from 'react';
import { getMemoryInfo } from '../utils/debugHelper';

/**
 * MemoryDiagnostic — DEV ONLY
 * Throttled memory polling (no brutal setInterval on every 2s).
 * Renders nothing in production.
 */
export function MemoryDiagnostic() {
  // Guard: render nothing in production
  if (!import.meta.env.DEV) return null;

  return <MemoryDiagnosticInner />;
}

function MemoryDiagnosticInner() {
  const [memInfo, setMemInfo] = useState(() => getMemoryInfo());
  const [showDiag, setShowDiag] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const THROTTLE_MS = 5000; // poll every 5s via rAF, not setInterval

  const tick = useCallback(() => {
    const now = performance.now();
    if (now - lastTickRef.current >= THROTTLE_MS) {
      lastTickRef.current = now;
      setMemInfo(getMemoryInfo());
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  if (!memInfo) return null;

  const isHigh = memInfo.isHighMemory;
  const bgColor = isHigh ? 'bg-red-900/80' : 'bg-green-900/80';

  return (
    <>
      <button
        onClick={() => setShowDiag((v) => !v)}
        className={`fixed bottom-4 right-4 z-[9999] p-2 rounded-full text-xs font-bold text-white ${bgColor} hover:opacity-100 opacity-50 transition-opacity`}
        aria-label="Toggle Memory Diagnostic"
        title="Memory Diagnostic (dev only)"
      >
        {isHigh ? '⚠️' : '💾'}
      </button>

      {showDiag && (
        <div className="fixed bottom-16 right-4 z-[9999] bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white font-mono shadow-lg min-w-[200px]">
          <div className="font-bold mb-2 flex items-center gap-1">
            <span>Memory Diagnostic</span>
            <span className="text-slate-500 ml-auto">(dev)</span>
          </div>
          <div className="space-y-1">
            <div>
              🎯 Used:{' '}
              <span className={isHigh ? 'text-red-400' : 'text-green-400'}>{memInfo.used}</span>
            </div>
            <div>📊 Limit: {memInfo.limit}</div>
            <div>📈 Total: {memInfo.total}</div>
            <div>
              % Usage:{' '}
              <span className={isHigh ? 'text-red-400' : 'text-green-400'}>
                {memInfo.percentUsed}
              </span>
            </div>
          </div>
          {isHigh && (
            <div className="mt-2 pt-2 border-t border-slate-700 text-yellow-400">
              ⚡ Refresh page if memory stays high
            </div>
          )}
        </div>
      )}
    </>
  );
}
