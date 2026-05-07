import { beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  checkPinRateLimit,
  clearPinFailures,
  registerPinFailure,
  reserveIdempotencyKey,
  verifyConfiguredApprovalPin,
} from '../mission.controller.js';

describe('mission approval security helpers', () => {
  beforeEach(() => {
    delete process.env.MISSION_APPROVAL_PIN;
    delete process.env.MISSION_APPROVAL_PIN_HASH;
  });

  it('rejects invalid pin when raw pin is configured', async () => {
    process.env.MISSION_APPROVAL_PIN = '1234';
    const result = await verifyConfiguredApprovalPin('0000');
    expect(result.required).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('accepts valid pin when hash is configured', async () => {
    process.env.MISSION_APPROVAL_PIN_HASH = await bcrypt.hash('4321', 4);
    const result = await verifyConfiguredApprovalPin('4321');
    expect(result.required).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('enforces local rate limiting after repeated failures', () => {
    const attemptKey = `test-user:${Date.now()}`;
    clearPinFailures(attemptKey);

    for (let i = 0; i < 5; i += 1) {
      registerPinFailure(attemptKey);
    }
    const state = checkPinRateLimit(attemptKey);
    expect(state.limited).toBe(true);
  });

  it('detects duplicate idempotency key for same user/mission', () => {
    const first = reserveIdempotencyKey('u1', 'm1', 'idem-1');
    const second = reserveIdempotencyKey('u1', 'm1', 'idem-1');
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });
});
