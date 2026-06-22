import { useState, useCallback, useEffect } from 'react';
import type { CahierTask, TaskLibrary } from '@utils/types';
import { sanitizeTaskForCahier } from '../utils/cahierUtils';
import { DEFAULT_TASK_LIBRARY } from '@/data/cahierTaskLibrary';

export function useCahierForm(
  initialTask: CahierTask,
  customLibrary: TaskLibrary,
  automatedRate: number | null,
  isEditing: boolean
) {
  const [editData, setEditData] = useState({
    introduction: initialTask.introduction || '',
    missions: initialTask.missions.join('\n'),
    materials: initialTask.materials.join('\n'),
    hse: initialTask.hse.join('\n'),
    subcontracting: initialTask.subcontracting?.join('\n') || '',
    finances: initialTask.finances?.join('\n') || '',
    pricing: {
      dailyRate: initialTask.pricing?.dailyRate || 0,
      personnelCount: initialTask.pricing?.personnelCount || 0,
      durationDays: initialTask.pricing?.durationDays || 0,
      penalties: initialTask.pricing?.penalties || '',
    },
  });

  // Sync editData when currentTask changes (e.g. role change)
  useEffect(() => {
    setEditData({
      introduction: initialTask.introduction || '',
      missions: initialTask.missions.join('\n'),
      materials: initialTask.materials.join('\n'),
      hse: initialTask.hse.join('\n'),
      subcontracting: initialTask.subcontracting?.join('\n') || '',
      finances: initialTask.finances?.join('\n') || '',
      pricing: {
        dailyRate: initialTask.pricing?.dailyRate || 0,
        personnelCount: initialTask.pricing?.personnelCount || 0,
        durationDays: initialTask.pricing?.durationDays || 0,
        penalties: initialTask.pricing?.penalties || '',
      },
    });
  }, [initialTask]);

  // Automated rate sync
  useEffect(() => {
    if (automatedRate && isEditing && editData.pricing.dailyRate === 0) {
      setEditData((prev) => ({
        ...prev,
        pricing: { ...prev.pricing, dailyRate: automatedRate },
      }));
    }
  }, [automatedRate, isEditing]);

  return {
    editData,
    setEditData,
  };
}
