import { describe, expect, it, vi } from 'vitest';
import {
  getMissionStartInDays,
  isMissionUrgent,
  summarizeDeleteSettlements,
} from '../src/pages/approbationUtils';

describe('approbationUtils', () => {
  it('marks urgent when mission starts within 3 days', () => {
    vi.useFakeTimers();
    const now = new Date('2026-05-07T00:00:00.000Z');
    vi.setSystemTime(now);
    expect(isMissionUrgent('2026-05-09T00:00:00.000Z')).toBe(true);
    expect(isMissionUrgent('2026-05-12T00:00:00.000Z')).toBe(false);
    vi.useRealTimers();
  });

  it('returns fallback days for missing date', () => {
    expect(getMissionStartInDays(undefined)).toBe(99);
  });

  it('summarizes delete results with failed mission ids', () => {
    const summary = summarizeDeleteSettlements(
      ['m1', 'm2', 'm3'],
      [
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason: new Error('403') },
        { status: 'rejected', reason: new Error('500') },
      ]
    );

    expect(summary.successCount).toBe(1);
    expect(summary.failedIds).toEqual(['m2', 'm3']);
  });
});
