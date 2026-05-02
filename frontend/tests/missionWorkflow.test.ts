import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveStep,
  clearWorkflow,
  getApprovalProgress,
  getWorkflow,
  initializeWorkflow,
  rejectStep,
  saveWorkflow,
  submitForApproval,
} from '../src/services/missionWorkflow';

describe('missionWorkflow legacy client adapter', () => {
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

  it('does not persist or advance local workflows because the server owns OM approvals', () => {
    const missionId = 'om-001';

    const draft = initializeWorkflow(missionId);
    expect(draft.status).toBe('draft');
    expect(draft.steps).toHaveLength(1);
    expect(getWorkflow(missionId)).toBeNull();

    const submitted = submitForApproval(missionId, 'Agent Terrain', 'Prêt pour validation');
    expect(submitted).toBeNull();

    const approved = approveStep(missionId, 'directeur', 'DG Proquelec', 'Validation finale');
    expect(approved).toBeNull();

    const progress = getApprovalProgress(getWorkflow(missionId));
    expect(progress.progress).toBe(0);
    expect(progress.isApproved).toBe(false);
  });

  it('ignores local rejection and save attempts', () => {
    const missionId = 'om-002';
    const draft = initializeWorkflow(missionId);
    saveWorkflow(draft);

    const rejected = rejectStep(missionId, 'directeur', 'DG Proquelec', 'Budget incohérent');
    expect(rejected).toBeNull();
    expect(getWorkflow(missionId)).toBeNull();
  });

  it('clearWorkflow remains safe for legacy localStorage cleanup', () => {
    storage.set('mission_approval_om-003', JSON.stringify({ stale: true }));
    initializeWorkflow('om-003');
    expect(storage.has('mission_approval_om-003')).toBe(false);
    clearWorkflow('om-003');
    expect(getWorkflow('om-003')).toBeNull();
  });
});
