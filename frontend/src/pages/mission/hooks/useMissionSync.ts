/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useCallback } from 'react';
import { db } from '../../../store/db';
import * as missionService from '../../../services/missionService';
import { useAuth } from '../../../contexts/AuthContext';
import { validateMission } from '../core/missionValidation';
import { calculateMissionTotals } from '../../../utils/missionBudget';
import { syncEventBus, SYNC_EVENTS } from '../../../utils/syncEventBus';
import { syncQueue } from '../core/missionSyncQueue';
import logger from '../../../utils/logger';
import toast from 'react-hot-toast';
import type { MissionState, AuditEntry } from '../core/missionTypes';
import { generateIntegrityHash } from '../../../utils/crypto';
import type { Mission } from '../../../services/missionService';

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

      try {
        actions.setStatus('saving');

        /**
         * 1. SAUVEGARDE LOCALE (TOUJOURS)
         */
        await db.missions.put(missionData as any);

        /**
         * 2. VALIDATION (uniquement si soumission)
         */
        const validation = validateMission({ formData, members, version: localVersion });

        if (!validation.isValid && (finalIsSubmitted || finalIsCertified)) {
          actions.setStatus('error');
          logger.warn('Validation échouée', validation.errors);
          toast.error("Données incomplètes pour la soumission.");
          return null;
        }

        let assignedId = finalId;
        let serverSuccess: boolean | null = null;

        /**
         * 3. ONLINE SYNC
         */
        if (navigator.onLine) {
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
            // 🔥 REMAPPING OFFLINE ACTIONS
            if (isNewMission) {
              await syncQueue.remapTempId(finalId, assignedId);
            }

            await db.missions.delete(finalId);
            const persistedMission = await db.missions.get(assignedId);
            if (!persistedMission) {
              (missionData as any).id = assignedId;
              await db.missions.put(missionData as any);
            }

            const missionForUi = persistedMission || { ...missionData, id: assignedId };
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

            if (finalIsCertified) {
              syncEventBus.emit(SYNC_EVENTS.MISSION_CERTIFIED, {
                id: assignedId,
              });
            }
          } else {
            actions.setSyncStatus('failed');
            await syncQueue.enqueue(finalId, {
              type: 'RETRY_SYNC',
              payload: missionData as any,
            });
          }
        } else {
          /**
           * OFFLINE MODE
           */
          actions.setSyncStatus('pending');

          await syncQueue.enqueue(finalId, {
            type: 'OFFLINE_SAVE',
            payload: missionData as any,
          });

          actions.addAuditEntry('Mode offline - synchronisation différée', 'System');
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
    if (!activeProjectId) return;

    actions.setStatus('saving');
    const now = new Date().toISOString();

    try {
      const missions = await missionService.getMissions(activeProjectId);

      let merged = 0;
      let conflicts = 0;

      for (const m of missions) {
        const serverVersion = (m as any).version || (m as any).data?.version || 1;
        const local = await db.missions.get((m as any).id);

        const normalized = {
          id: (m as any).id,
          projectId: (m as any).projectId,
          ...((m as any).data || {}),
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
          /**
           * 🔥 CONFLIT LOCAL PRIORITAIRE
           */
          await syncQueue.enqueue((local as any).id, {
            type: 'FORCE_PUSH',
            payload: local as any,
          });
          conflicts++;
        }
      }

      actions.setStatus('success');

      if (merged || conflicts) {
        actions.addAuditEntry(
          `Sync: ${merged} MAJ, ${conflicts} conflits`,
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
