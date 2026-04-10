import { describe, it, expect } from 'vitest';
import { normalizeOwnerName } from '../src/workers/dataAuditWorker';

describe('dataAuditWorker normalizeOwnerName', () => {
  it('should accept owner string values', () => {
    expect(normalizeOwnerName('Dupont')).toBe('Dupont');
    expect(normalizeOwnerName('  Dupont  ')).toBe('Dupont');
  });

  it('should ignore N/A string values', () => {
    expect(normalizeOwnerName('N/A')).toBe('');
    expect(normalizeOwnerName('  N/A  ')).toBe('');
  });

  it('should accept owner object name fields', () => {
    expect(normalizeOwnerName({ name: 'Dupont' })).toBe('Dupont');
    expect(normalizeOwnerName({ nom: 'Diallo' })).toBe('Diallo');
    expect(normalizeOwnerName({ fullname: 'Moussa Cissé' })).toBe('Moussa Cissé');
  });

  it('should fallback to household name when object owner is empty', () => {
    expect(normalizeOwnerName({ name: '' }, 'Fallback')).toBe('Fallback');
  });

  it('should return empty string when no valid owner is available', () => {
    expect(normalizeOwnerName({ name: '' }, '')).toBe('');
    expect(normalizeOwnerName(undefined, undefined)).toBe('');
  });
});
