import { describe, expect, it } from 'vitest';
import {
  calculateApprovalProgress,
  calculateWorkflowStatus,
  getNextPendingStep,
  type MissionApprovalStep,
} from '../src/constants/approvalConstants';

describe('approvalConstants workflow helpers', () => {
  it('handles uppercase backend statuses', () => {
    const steps: MissionApprovalStep[] = [{ role: 'DIRECTEUR', status: 'APPROUVE' }];
    expect(calculateWorkflowStatus(steps)).toBe('approved');
    expect(calculateApprovalProgress(steps)).toBe(100);
  });

  it('detects rejected and next pending steps across status formats', () => {
    expect(calculateWorkflowStatus([{ role: 'DIRECTEUR', status: 'REJETE' }])).toBe('rejected');

    const next = getNextPendingStep([
      { role: 'ADMIN', status: 'APPROUVE' },
      { role: 'DIRECTEUR', status: 'EN_ATTENTE' },
    ]);

    expect(next?.role).toBe('DIRECTEUR');
  });
});
