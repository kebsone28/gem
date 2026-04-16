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
