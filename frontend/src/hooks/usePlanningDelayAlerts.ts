import { useEffect, useRef } from 'react';
import alertsAPI from '../services/alertsAPI';
import type { PlanningTask } from '../services/planningDomain';
import logger from '../utils/logger';

function getAlertDedupKey(projectId: string, task: PlanningTask) {
  return `${projectId}:${task.id}:${task.delayDays}`;
}

export function usePlanningDelayAlerts(projectId: string | null, tasks: PlanningTask[]) {
  const submittedAlertsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    submittedAlertsRef.current.clear();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const syncAlerts = async () => {
      const criticalDelays = tasks.filter(
        (task) =>
          task.isDelayed &&
          task.phase !== 'TERMINE' &&
          task.delayDays > 3 &&
          !task.existingAlerts?.some((alert) => alert.type === 'PVRET')
      );

      if (criticalDelays.length === 0) return;

      const activeKeys = new Set(criticalDelays.map((task) => getAlertDedupKey(projectId, task)));

      for (const key of Array.from(submittedAlertsRef.current)) {
        if (!activeKeys.has(key)) {
          submittedAlertsRef.current.delete(key);
        }
      }

      for (const task of criticalDelays) {
        const dedupKey = getAlertDedupKey(projectId, task);
        if (submittedAlertsRef.current.has(dedupKey)) {
          continue;
        }

        try {
          submittedAlertsRef.current.add(dedupKey);
          await alertsAPI.createAlert({
            projectId,
            householdId: task.id,
            type: 'PVRET',
            severity: 'HIGH',
            title: `Retard critique : ${task.householdName}`,
            description: `Le ménage est bloqué en phase ${task.phase} depuis ${task.delayDays} jours.`,
          });
        } catch (error) {
          submittedAlertsRef.current.delete(dedupKey);
          logger.warn('[PlanningDelayAlerts] Delay alert sync failed', error);
        }
      }
    };

    void syncAlerts();
  }, [projectId, tasks]);
}
