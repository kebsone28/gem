/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useEffect } from 'react';

export function useAutoRefresh(callback: () => void, intervalMs: number = 30000) {
  useEffect(() => {
    // Initial call is not made here to avoid double-fetching if the hook that uses this also fetches on mount
    
    const interval = setInterval(() => {
      callback();
    }, intervalMs);

    window.addEventListener('focus', callback);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', callback);
    };
  }, [callback, intervalMs]);
}
