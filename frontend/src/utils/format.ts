/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * ASCII-safe number formatter for GEM SaaS.
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
