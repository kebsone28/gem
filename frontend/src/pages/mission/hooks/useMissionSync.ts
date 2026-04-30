/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useCallback } from 'react';
import { db } from '../../../store/db';
import * as missionService from '../../../services/missionService';
import { useAuth } from '../../../contexts/AuthContext';
import { getMissionValidationMessages, validateMission } from '../core/missionValidation';
import { calculateMissionTotals } from '../../../utils/missionBudget';
import { syncEventBus, SYNC_EVENTS } from '../../../utils/syncEventBus';
import logger from '../../../utils/logger';
import toast from 'react-hot-toast';
import type { MissionState, AuditEntry } from '../core/missionTypes';
import { generateIntegrityHash } from '../../../utils/crypto';
import type { Mission } from '../../../services/missionService';

const HIDDEN_MISSION_IDS_KEY = 'gem_hidden_mission_ids';

function readHiddenMissionIds(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_MISSION_IDS_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function isEmptyDraftMission(mission: Mission): boolean {
  const data = (mission.data || {}) as Record<string, any>;
  const status = mission.status || data.status || 'draft';
  if (status !== 'draft') return false;

  const hasMeaningfulContent = Boolean(
    data.purpose ||
      data.region ||
      data.destination ||
      data.startDate ||
      data.endDate ||
      data.itineraryAller ||
      (Array.isArray(data.members) && data.members.length > 0)
  );

  return !hasMeaningfulContent;
}

/**
 * HOOK : Synchronisation Mission Industrielle (Version Robuste)
 */
export const useMissionSync = (
  state: MissionState,
  actions: {
    setStatus: (status: MissionState['status']) => void;
    loadMission: (
      id: string | null,
      data: MissionState['formData'],
      members: MissionState['members'],
      version?: number,
      updatedAt?: string,
      auditTrail?: AuditEntry[]
    ) => void;
    clearDirty: (field?: keyof MissionState['dirty']) => void;
    setSyncStatus: (status: MissionState['syncStatus']) => void;
    addAuditEntry: (action: string, author: string, details?: string) => void;
  },
  activeProjectId: string | null
) => {
  const { user } = useAuth();
  const {
    formData,
    members,
    currentMissionId,
    isCertified,
    isSubmitted,
    version,
    auditTrail
  } = state;

  const normalizeServerMission = useCallback(
    (mission: Mission, fallbackId: string, fallbackUpdatedAt: string) => {
      const missionData = (mission.data || {}) as Record<string, any>;
      return {
        id: mission.id || fallbackId,
        projectId: mission.projectId || activeProjectId,
        ...missionData,
        status: mission.status || missionData.status,
        orderNumber: mission.orderNumber || missionData.orderNumber,
        approvalWorkflow: (mission as any).approvalWorkflow || missionData.approvalWorkflow,
        version: mission.version || missionData.version || 1,
        updatedAt: mission.updatedAt || fallbackUpdatedAt,
      };
    },
    [activeProjectId]
  );

  /**
   * UTIL: Date sécurisée
   */
  const safeISODate = (d?: string) => {
    if (!d || !d.includes('/')) return null;
    const [day, month, year] = d.split('/');
    if (!day || !month || !year) return null;
    const date = new Date(`${year}-${month}-${day}`);
    return isNaN(date.getTime()) ? null : date.toISOString();
  };

  /**
   * SAVE + SYNC (ULTRA ROBUSTE)
   */
  const handleSaveMission = useCallback(
    async (overrideFlags?: { isSubmitted?: boolean; isCertified?: boolean }) => {
      const isNewMission = !currentMissionId || currentMissionId.startsWith('temp');
      const tempId = `temp-${crypto.randomUUID()}`;
      const finalId = currentMissionId || tempId;
      const now = new Date().toISOString();

      const finalIsSubmitted = isNewMission
        ? (overrideFlags?.isSubmitted ?? false)
        : (overrideFlags?.isSubmitted ?? isSubmitted);

      const finalIsCertified = isNewMission
        ? (overrideFlags?.isCertified ?? false)
        : (overrideFlags?.isCertified ?? isCertified);

      const localVersion = state.version || 1;

      const strictWorkflowAction =
        overrideFlags?.isSubmitted === true || overrideFlags?.isCertified === true;

      const missionData = {
        id: finalId,
        projectId: activeProjectId,
        ...formData,
        members,
        version: localVersion,
        updatedAt: now,
        auditTrail,
        isCertified: finalIsCertified,
        isSubmitted: finalIsSubmitted,
        createdBy: formData.createdBy || user?.id || '', 
      };

      const rollbackWorkflowSubmission = async () => {
        if (!strictWorkflowAction) return;

        const rollbackData = {
          ...missionData,
          isCertified,
          isSubmitted,
          status: isCertified ? 'approuvee' : isSubmitted ? 'soumise' : 'draft',
        };

        actions.loadMission(
          finalId,
          rollbackData as any,
          members,
          localVersion,
          now,
          auditTrail
        );
      };

      try {
        actions.setStatus('saving');

        if (!navigator.onLine) {
          actions.setStatus('error');
          actions.setSyncStatus('failed');
          toast.error('Connexion requise : les missions officielles sont enregistrées uniquement sur le serveur.');
          return { assignedId: finalId, serverSuccess: false };
        }

        if (strictWorkflowAction) {
          const validation = validateMission({ formData, members, version: localVersion });

          if (!validation.isValid) {
            const validationMessages = getMissionValidationMessages(validation.errors);
            actions.setStatus('error');
            logger.warn('Validation échouée', validation.errors);
            toast.error(
              validationMessages[0] || 'Données incomplètes pour la soumission.'
            );
            return null;
          }
        }

        let assignedId = finalId;
        let serverSuccess: boolean | null = null;

          actions.setSyncStatus('pending');

          const totals = calculateMissionTotals(members);

          let integrityHash = formData.integrityHash;
          if (finalIsCertified && !integrityHash) {
             integrityHash = await generateIntegrityHash({
               formData,
               members,
               version: localVersion
             });
          }

          let serverStatus = 'draft';
          if (finalIsCertified) serverStatus = 'approuvee';
          else if (finalIsSubmitted) serverStatus = 'soumise';

          const serverPayload = {
            projectId: activeProjectId,
            title: formData.purpose || 'Sans titre',
            description: formData.itineraryAller || '',
            startDate: safeISODate(formData.startDate),
            endDate: safeISODate(formData.endDate),
            budget: totals.totalFrais || 0,
            status: serverStatus,
            version: localVersion,
            data: {
              ...formData,
              members,
              isCertified: finalIsCertified,
              isSubmitted: finalIsSubmitted,
              integrityHash,
            },
          };

          try {
            /**
             * UPDATE OU CREATE
             */
            if (!isNewMission) {
              const result = await missionService.updateMission(finalId, serverPayload as any);

              if (result && !('error' in result)) {
                serverSuccess = true;
                actions.setSyncStatus('synced');
                const normalizedServerMission = normalizeServerMission(result, finalId, now);
                await db.missions.put(normalizedServerMission as any);

                const officialOrderNumber =
                  (result as any).orderNumber || (result as any).data?.orderNumber;
                if (officialOrderNumber) {
                  (missionData as any).orderNumber = officialOrderNumber;
                  if ((missionData as any).data) {
                    (missionData as any).data.orderNumber = officialOrderNumber;
                  }
                }
                actions.loadMission(
                  normalizedServerMission.id,
                  {
                    ...(normalizedServerMission as any),
                    orderNumber: officialOrderNumber as string | undefined,
                  },
                  members,
                  normalizedServerMission.version,
                  normalizedServerMission.updatedAt,
                  auditTrail
                );
              } else if (result && typeof result === 'object' && 'error' in result && result.error === 409) {
                /**
                 * 🔥 CONFLIT VERSION
                 */
                logger.warn('Conflit version détecté → récupération serveur');

                const serverMission = await missionService.getMission(finalId);

                if (serverMission) {
                  const normalizedServerMission = normalizeServerMission(serverMission, finalId, now);
                  await db.missions.put(normalizedServerMission as any);
                  actions.addAuditEntry(
                    'Conflit résolu (serveur prioritaire)',
                    'System'
                  );
                }

                serverSuccess = false;
              } else if (result && typeof result === 'object' && 'error' in result && result.error === 404) {
                /**
                 * 🔥 MISSION PERDUE SERVEUR
                 */
                const created = await missionService.createMission(serverPayload as any);
                if (created) {
                  assignedId = (created as any).id;
                  serverSuccess = true;
                  const normalizedServerMission = normalizeServerMission(created, assignedId, now);
                  await db.missions.put(normalizedServerMission as any);
                } else {
                  serverSuccess = false;
                }
              } else {
                serverSuccess = false;
              }
            } else {
              const created = await missionService.createMission(serverPayload as any);
              if (created) {
                assignedId = (created as any).id;
                serverSuccess = true;
                const normalizedServerMission = normalizeServerMission(created, assignedId, now);
                await db.missions.put(normalizedServerMission as any);

                const officialNum = (created as any).orderNumber || (created as any).data?.orderNumber;
                actions.loadMission(
                  normalizedServerMission.id,
                  {
                    ...(normalizedServerMission as any),
                    orderNumber: officialNum as string | undefined,
                  },
                  members,
                  normalizedServerMission.version,
                  normalizedServerMission.updatedAt,
                  auditTrail
                );
              } else {
                serverSuccess = false;
              }
            }
          } catch (serverError) {
            logger.error('Erreur serveur', serverError);
            serverSuccess = false;
          }

          /**
           * ALIGNEMENT ID (temp → réel)
           */
          if (assignedId !== finalId) {
            await db.missions.delete(finalId);
            const persistedMission = await db.missions.get(assignedId);

            const missionForUi = persistedMission || { ...missionData, id: assignedId, updatedAt: now };
            actions.loadMission(
              assignedId,
              missionForUi as any,
              members,
              (missionForUi as any).version || localVersion,
              (missionForUi as any).updatedAt || now,
              auditTrail
            );
          }

          /**
           * AUDIT + EVENTS
           */
          if (serverSuccess) {
            actions.addAuditEntry('Synchronisation réussie', 'System');

            syncEventBus.emit(SYNC_EVENTS.MISSION_SAVED, {
              id: assignedId,
              version: localVersion,
            });

            if (finalIsSubmitted) {
              syncEventBus.emit(SYNC_EVENTS.MISSION_SUBMITTED, {
                id: assignedId,
                version: localVersion,
              });
            }

            if (finalIsCertified) {
              syncEventBus.emit(SYNC_EVENTS.MISSION_CERTIFIED, {
                id: assignedId,
              });
            }
          } else {
            actions.setSyncStatus('failed');
            await rollbackWorkflowSubmission();
            toast.error(
              finalIsSubmitted
                ? "La soumission n'a pas été enregistrée sur le serveur."
                : "La mission n'a pas été enregistrée sur le serveur."
            );
            actions.setStatus('error');
            return { assignedId: finalId, serverSuccess: false };
          }

        actions.clearDirty();
        actions.setStatus('success');

        const officialOrderNumber = (missionData as Record<string, unknown>).orderNumber as string | undefined;

        return { assignedId, serverSuccess, orderNumber: officialOrderNumber };
      } catch (err) {
        actions.setStatus('error');
        logger.error('Erreur critique sync', err);
        return null;
      }
    },
    [
      formData,
      members,
      currentMissionId,
      isCertified,
      isSubmitted,
      version,
      auditTrail,
      activeProjectId,
      actions,
      state.version,
      user?.id,
      normalizeServerMission,
    ]
  );

  /**
   * PULL ROBUSTE AVEC GESTION CONFLITS
   */
  const handleSyncFromServer = useCallback(async () => {
    actions.setStatus('saving');
    const now = new Date().toISOString();

    try {
      const missions = await missionService.getMissions(activeProjectId || undefined);
      const hiddenMissionIds = readHiddenMissionIds();
      const serverIds = new Set(missions.map((mission: any) => mission.id).filter(Boolean));

      let merged = 0;
      let conflicts = 0;
      let removedLocalOnlySubmissions = 0;

      for (const m of missions) {
        if (hiddenMissionIds.has((m as any).id) && ((m as any).status === 'draft' || (m as any).data?.status === 'draft' || !(m as any).status)) {
          await db.missions.delete((m as any).id);
          continue;
        }

        if (isEmptyDraftMission(m)) {
          await db.missions.delete((m as any).id);
          continue;
        }

        const serverVersion = (m as any).version || (m as any).data?.version || 1;
        const local = await db.missions.get((m as any).id);

        const normalized = {
          id: (m as any).id,
          projectId: (m as any).projectId,
          ...((m as any).data || {}),
          status: (m as any).status || (m as any).data?.status,
          orderNumber: (m as any).orderNumber || (m as any).data?.orderNumber,
          approvalWorkflow: (m as any).approvalWorkflow || (m as any).data?.approvalWorkflow,
          version: serverVersion,
          updatedAt: (m as any).updatedAt || now,
        };

        if (!local) {
          await db.missions.put(normalized as any);
          merged++;
        } else if (serverVersion > (local.version || 0)) {
          await db.missions.put(normalized as any);
          merged++;
        } else if ((local.version || 0) > serverVersion) {
          await db.missions.put(normalized as any);
          conflicts++;
        }
      }

      const localSubmitted = await db.missions
        .filter((mission: any) => {
          const isLocalSubmitted = mission?.isSubmitted === true || mission?.data?.isSubmitted === true;
          const isLocalCertified = mission?.isCertified === true || mission?.data?.isCertified === true;
          return isLocalSubmitted && !isLocalCertified && !serverIds.has(mission.id);
        })
        .toArray();

      for (const localMission of localSubmitted) {
        await db.missions.delete((localMission as any).id);
        removedLocalOnlySubmissions++;
      }

      actions.setStatus('success');

      if (merged || conflicts || removedLocalOnlySubmissions) {
        actions.addAuditEntry(
          `Sync: ${merged} MAJ, ${conflicts} conflits, ${removedLocalOnlySubmissions} soumissions locales supprimées`,
          'System'
        );
      }
    } catch (err) {
      actions.setStatus('error');
      logger.error('Erreur récupération serveur', err);
    }
  }, [activeProjectId, actions]);

  return {
    handleSaveMission,
    handleSyncFromServer,
  };
};
