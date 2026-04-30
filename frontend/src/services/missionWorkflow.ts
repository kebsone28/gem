import logger from '../utils/logger';

export interface ApprovalStep {
  id: string;
  role: 'directeur';
  roleName: string;
  status: 'pending' | 'approved' | 'rejected' | 'commented';
  approvedBy?: string;
  approvedAt?: number;
  comment?: string;
  reasonIfRejected?: string;
  updatedAt?: number;
}

export interface MissionApprovalWorkflow {
  missionId: string;
  currentStep: number;
  steps: ApprovalStep[];
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'executed' | 'cancelled';
  submittedAt?: number;
  finalizedAt?: number;
  updatedAt: number;
  history: {
    status: string;
    timestamp: number;
    user: string;
    comment?: string;
  }[];
}

const STORAGE_KEY_PREFIX = 'mission_approval_';

const createDraftWorkflow = (missionId: string): MissionApprovalWorkflow => ({
  missionId,
  currentStep: 0,
  updatedAt: Date.now(),
  history: [],
  steps: [
    {
      id: 'directeur',
      role: 'directeur',
      roleName: 'Direction / Administration',
      status: 'pending',
    },
  ],
  status: 'draft',
});

const warnServerOnly = (action: string) => {
  logger.warn(
    `[missionWorkflow] ${action} ignoré: le workflow mission officiel est désormais géré par le serveur.`
  );
};

export const initializeWorkflow = (missionId: string): MissionApprovalWorkflow => {
  warnServerOnly('initializeWorkflow');
  clearWorkflow(missionId);
  return createDraftWorkflow(missionId);
};

export const saveWorkflow = (workflow: MissionApprovalWorkflow): void => {
  warnServerOnly(`saveWorkflow(${workflow.missionId})`);
  clearWorkflow(workflow.missionId);
};

export const getWorkflow = (missionId: string): MissionApprovalWorkflow | null => {
  clearWorkflow(missionId);
  return null;
};

export const submitForApproval = (
  missionId?: string,
  submittedBy?: string,
  comment?: string
): MissionApprovalWorkflow | null => {
  void missionId;
  void submittedBy;
  void comment;
  warnServerOnly('submitForApproval');
  return null;
};

export const approveStep = (
  missionId?: string,
  stepRole?: ApprovalStep['role'],
  approverName?: string,
  comment?: string
): MissionApprovalWorkflow | null => {
  void missionId;
  void stepRole;
  void approverName;
  void comment;
  warnServerOnly('approveStep');
  return null;
};

export const rejectStep = (
  missionId?: string,
  stepRole?: ApprovalStep['role'],
  rejectedBy?: string,
  reason?: string
): MissionApprovalWorkflow | null => {
  void missionId;
  void stepRole;
  void rejectedBy;
  void reason;
  warnServerOnly('rejectStep');
  return null;
};

export const addComment = (
  missionId?: string,
  stepRole?: ApprovalStep['role'],
  comment?: string
): MissionApprovalWorkflow | null => {
  void missionId;
  void stepRole;
  void comment;
  warnServerOnly('addComment');
  return null;
};

export const getApprovalProgress = (
  workflow: MissionApprovalWorkflow | null
): {
  progress: number;
  nextApprover: string | null;
  isApproved: boolean;
} => {
  if (!workflow) {
    return { progress: 0, nextApprover: null, isApproved: false };
  }

  const approvedCount = workflow.steps.filter((step) => step.status === 'approved').length;
  return {
    progress: workflow.steps.length > 0 ? (approvedCount / workflow.steps.length) * 100 : 0,
    nextApprover: workflow.steps.find((step) => step.status === 'pending')?.roleName || null,
    isApproved: workflow.status === 'approved',
  };
};

export const getApprovalTimeline = (
  workflow: MissionApprovalWorkflow
): {
  role: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  comment?: string;
}[] =>
  workflow.steps.map((step) => ({
    role: step.roleName,
    status: step.status,
    approvedBy: step.approvedBy,
    approvedAt: step.approvedAt ? new Date(step.approvedAt).toLocaleString('fr-FR') : undefined,
    comment: step.comment,
  }));

export const clearWorkflow = (missionId: string): void => {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${missionId}`);
  } catch (e) {
    logger.warn('[missionWorkflow] Failed to clear legacy workflow', e);
  }
};
