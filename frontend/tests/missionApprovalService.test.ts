import { describe, expect, it } from 'vitest';
import {
  calculateMissionApprovalProgress,
  canApproveMissionStep,
  type MissionApprovalWorkflow,
} from '../src/services/missionApprovalService';

describe('missionApprovalService DG/Admin permissions', () => {
  it('allows DG/director and admin to approve a pending director step', () => {
    const step = { role: 'DIRECTEUR' as const, status: 'EN_ATTENTE' as const };

    expect(canApproveMissionStep('DG_PROQUELEC', step, false)).toBe(true);
    expect(canApproveMissionStep('DIRECTEUR', step, false)).toBe(true);
    expect(canApproveMissionStep('ADMIN_PROQUELEC', step, true)).toBe(true);
  });

  it('blocks non validators and already processed steps', () => {
    expect(
      canApproveMissionStep(
        'CHEF_PROJET',
        { role: 'DIRECTEUR', status: 'EN_ATTENTE' },
        false
      )
    ).toBe(false);

    expect(
      canApproveMissionStep(
        'ADMIN_PROQUELEC',
        { role: 'DIRECTEUR', status: 'APPROUVE' },
        true
      )
    ).toBe(false);

    expect(
      canApproveMissionStep('DG_PROQUELEC', { role: 'DIRECTEUR', status: 'REJETE' }, false)
    ).toBe(false);
  });

  it('calculates approval progress for French and English status values', () => {
    const workflow = {
      steps: [
        { role: 'DIRECTEUR', status: 'APPROUVE' },
        { role: 'ADMIN', status: 'approved' },
        { role: 'DIRECTEUR', status: 'EN_ATTENTE' },
      ],
    } as MissionApprovalWorkflow;

    expect(calculateMissionApprovalProgress(workflow)).toBeCloseTo(66.666, 2);
  });
});
