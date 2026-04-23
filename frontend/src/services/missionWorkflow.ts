 
export interface ApprovalStep {
  id: string;
  role: 'chef_projet' | 'admin' | 'directeur';
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
  currentStep: number; // 0 = draft, 1 = chef_projet, 2 = admin, 3 = directeur
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

export const initializeWorkflow = (missionId: string): MissionApprovalWorkflow => {
  const workflow: MissionApprovalWorkflow = {
    missionId,
    currentStep: 0,
    updatedAt: Date.now(),
    history: [],
    steps: [
      {
        id: 'chef_projet',
        role: 'chef_projet',
        roleName: 'Chef de Projet',
        status: 'pending',
      },
      {
        id: 'admin',
        role: 'admin',
        roleName: 'Administrateur',
        status: 'pending',
      },
      {
        id: 'directeur',
        role: 'directeur',
        roleName: 'Directeur Général',
        status: 'pending',
      },
    ],
    status: 'draft',
  };

  saveWorkflow(workflow);
  return workflow;
};

export const saveWorkflow = (workflow: MissionApprovalWorkflow): void => {
  try {
    workflow.updatedAt = Date.now();
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${workflow.missionId}`, JSON.stringify(workflow));
  } catch (e) {
    console.warn('Failed to save workflow:', e);
  }
};

export const getWorkflow = (missionId: string): MissionApprovalWorkflow | null => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${missionId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load workflow:', e);
    return null;
  }
};

export const submitForApproval = (
  missionId: string,
  submittedBy: string,
  comment?: string
): MissionApprovalWorkflow | null => {
  let workflow = getWorkflow(missionId);
  if (!workflow) {
    workflow = initializeWorkflow(missionId);
  }

  workflow.status = 'in_review';
  workflow.currentStep = 1;
  workflow.submittedAt = Date.now();

  // Premier step (soumission) considéré comme auto-approuvé par le créateur
  const step = workflow.steps[0];
  step.status = 'approved';
  step.approvedBy = submittedBy;
  step.approvedAt = Date.now();
  step.comment = comment || 'Soumis pour approbation officielle';
  step.updatedAt = Date.now();

  workflow.history.push({
    status: 'Soumission',
    timestamp: Date.now(),
    user: submittedBy,
    comment: step.comment,
  });

  saveWorkflow(workflow);
  return workflow;
};

export const approveStep = (
  missionId: string,
  stepRole: ApprovalStep['role'],
  approverName: string,
  comment?: string
): MissionApprovalWorkflow | null => {
  const workflow = getWorkflow(missionId);
  if (!workflow) return null;

  const stepIndex = workflow.steps.findIndex((s) => s.role === stepRole);
  if (stepIndex === -1) return null;

  const step = workflow.steps[stepIndex];
  if (step.status === 'approved') return workflow; // Déjà fait

  step.status = 'approved';
  step.approvedBy = approverName;
  step.approvedAt = Date.now();
  step.updatedAt = Date.now();
  if (comment) step.comment = comment;

  workflow.history.push({
    status: `Approbation ${step.roleName}`,
    timestamp: Date.now(),
    user: approverName,
    comment,
  });

  // Avancer au prochain step
  workflow.currentStep = stepIndex + 1;

  // Vérifier si tous les steps sont approuvés
  if (workflow.steps.every((s) => s.status === 'approved')) {
    workflow.status = 'approved';
    workflow.finalizedAt = Date.now();
    workflow.history.push({
      status: 'MISSION DÉFINITIVEMENT APPROUVÉE',
      timestamp: Date.now(),
      user: 'Système',
    });
  }

  saveWorkflow(workflow);
  return workflow;
};

export const rejectStep = (
  missionId: string,
  stepRole: ApprovalStep['role'],
  rejectedBy: string,
  reason: string
): MissionApprovalWorkflow | null => {
  const workflow = getWorkflow(missionId);
  if (!workflow) return null;

  const step = workflow.steps.find((s) => s.role === stepRole);
  if (!step) return null;

  step.status = 'rejected';
  step.reasonIfRejected = reason;
  step.updatedAt = Date.now();

  workflow.status = 'rejected';
  workflow.currentStep = 0; // Retourner à draft pour corrections

  workflow.history.push({
    status: `REJET par ${step.roleName}`,
    timestamp: Date.now(),
    user: rejectedBy,
    comment: reason,
  });

  saveWorkflow(workflow);
  return workflow;
};

export const addComment = (
  missionId: string,
  stepRole: ApprovalStep['role'],
  comment: string
): MissionApprovalWorkflow | null => {
  const workflow = getWorkflow(missionId);
  if (!workflow) return null;

  const step = workflow.steps.find((s) => s.role === stepRole);
  if (!step) return null;

  step.comment = comment;
  step.status = 'commented';

  saveWorkflow(workflow);
  return workflow;
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

  const approvedCount = workflow.steps.filter((s) => s.status === 'approved').length;
  const progress = (approvedCount / workflow.steps.length) * 100;

  let nextApprover: string | null = null;
  const pendingStep = workflow.steps.find((s) => s.status === 'pending');
  if (pendingStep) {
    nextApprover = pendingStep.roleName;
  }

  return {
    progress,
    nextApprover,
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
}[] => {
  return workflow.steps.map((step) => ({
    role: step.roleName,
    status: step.status,
    approvedBy: step.approvedBy,
    approvedAt: step.approvedAt ? formatTimestamp(step.approvedAt) : undefined,
    comment: step.comment,
  }));
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('fr-FR');
};

export const clearWorkflow = (missionId: string): void => {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${missionId}`);
  } catch (e) {
    console.warn('Failed to clear workflow:', e);
  }
};
