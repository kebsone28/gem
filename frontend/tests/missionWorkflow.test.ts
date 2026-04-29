import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveStep,
  clearWorkflow,
  getApprovalProgress,
  getWorkflow,
  initializeWorkflow,
  rejectStep,
  submitForApproval,
} from '../src/services/missionWorkflow';

describe('missionWorkflow local OM lifecycle', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
  });

  it('initializes, submits and approves an OM through direction/admin validation', () => {
    const missionId = 'om-001';

    const draft = initializeWorkflow(missionId);
    expect(draft.status).toBe('draft');
    expect(draft.steps).toHaveLength(1);

    const submitted = submitForApproval(missionId, 'Agent Terrain', 'Prêt pour validation');
    expect(submitted?.status).toBe('in_review');
    expect(submitted?.currentStep).toBe(1);

    const approved = approveStep(missionId, 'directeur', 'DG Proquelec', 'Validation finale');
    expect(approved?.status).toBe('approved');
    expect(approved?.steps[0].status).toBe('approved');
    expect(approved?.finalizedAt).toBeDefined();

    const progress = getApprovalProgress(getWorkflow(missionId));
    expect(progress.progress).toBe(100);
    expect(progress.isApproved).toBe(true);
  });

  it('rejects an OM and returns it to draft for correction', () => {
    const missionId = 'om-002';
    initializeWorkflow(missionId);
    submitForApproval(missionId, 'Chef Projet');

    const rejected = rejectStep(missionId, 'directeur', 'DG Proquelec', 'Budget incohérent');
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.currentStep).toBe(0);
    expect(rejected?.steps[0].reasonIfRejected).toBe('Budget incohérent');
  });

  it('can clear a workflow', () => {
    initializeWorkflow('om-003');
    expect(getWorkflow('om-003')).not.toBeNull();
    clearWorkflow('om-003');
    expect(getWorkflow('om-003')).toBeNull();
  });
});
