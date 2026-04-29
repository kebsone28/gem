import { describe, expect, it } from 'vitest';
import { classifyError, ERROR_MESSAGES } from '../src/services/ai/missionSageErrors';

describe('missionSageErrors classifyError', () => {
  it('classifies known remote AI failures', () => {
    expect(classifyError(new Error('credit balance too low'))).toBe('credit_balance');
    expect(classifyError(new Error('API key rejected'))).toBe('api_key');
    expect(classifyError(new Error('request timeout'))).toBe('timeout');
    expect(classifyError(new Error('network fetch failed'))).toBe('network');
  });

  it('falls back to default for unknown errors', () => {
    expect(classifyError(new Error('unexpected'))).toBe('default');
    expect(ERROR_MESSAGES.default).toContain('mode local');
  });
});
