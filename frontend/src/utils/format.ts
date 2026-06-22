 
/**
 * ASCII-safe number formatter for GED OS.
 * Uses plain spaces ( ) as thousands separator — no Unicode thin-spaces.
 * Works in both the browser and jsPDF.
 */
export function fmtNum(n: number): string {
  const isNegative = n < 0;
  const s = Math.round(Math.abs(n)).toString();
  const parts: string[] = [];
  for (let i = s.length; i > 0; i -= 3) parts.unshift(s.slice(Math.max(0, i - 3), i));
  return (isNegative ? '-' : '') + parts.join(' ');
}

/** fmtNum + " FCFA" suffix */
export function fmtFCFA(n: number): string {
  return fmtNum(n) + ' FCFA';
}

/** Percentage with 1 decimal */
export function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

/**
 * Safely extracts error message string from Axios error or backend payload.
 * Prevents React rendering crashes when rendering backend error objects.
 */
export function extractApiError(err: any, fallback: string = 'Une erreur est survenue'): string {
  if (!err) return fallback;
  const errorObj = err?.response?.data?.error;
  if (errorObj) {
    if (typeof errorObj === 'string') return errorObj;
    if (typeof errorObj === 'object') {
      if (errorObj.message) return errorObj.message;
      if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
        return errorObj.errors.join(', ');
      }
    }
  }
  return err.message || fallback;
}

