import { useState, useCallback } from 'react';
import * as missionApprovalService from '../../../services/missionApprovalService';
import type { MissionApprovalWorkflow } from '../../../services/missionApprovalService';
import logger from '../../../utils/logger';

export const useMissionWorkflow = (currentMissionId: string | null) => {
  const [workflow, setWorkflow] = useState<MissionApprovalWorkflow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWorkflow = useCallback(async () => {
    if (currentMissionId && !currentMissionId.startsWith('temp')) {
      try {
        const wf = await missionApprovalService.getMissionApprovalHistory(currentMissionId);
        setWorkflow(wf as any);
      } catch (err) {
        logger.error('Error fetching workflow:', err);
      }
    } else {
      setWorkflow(null);
    }
  }, [currentMissionId]);

  const approveStep = useCallback(async (role: string, comment: string) => {
    if (!currentMissionId) return null;
    setIsSubmitting(true);
    try {
      const updated = await missionApprovalService.approveMissionStep(
        currentMissionId,
        role as any,
        comment
      );
      setWorkflow(updated as any);
      return updated;
    } catch (err) {
      logger.error('Error approving step:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [currentMissionId]);

  return {
    workflow,
    isSubmitting,
    fetchWorkflow,
    approveStep,
    setWorkflow
  };
};
