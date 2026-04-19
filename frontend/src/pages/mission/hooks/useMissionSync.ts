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
        await db.missions.put(missionData);

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
              const result = await missionService.updateMission(finalId, serverPayload);

              if (result && !('error' in result)) {
                serverSuccess = true;
                actions.setSyncStatus('synced');
                
                // 🔥 CRITIQUE: Injecter le numéro officiel s'il est présent
                let officialOrderNumber = (result as any).orderNumber || (result as any).data?.orderNumber;
                if (officialOrderNumber) {
                  missionData.orderNumber = officialOrderNumber;
                  if ((missionData as any).data) { // Keep cast if really needed, but it's safer
                    (missionData as any).data.orderNumber = officialOrderNumber;
                  }
                  
                  // Mettre à jour l'écran immédiatement via loadMission
                  actions.loadMission(
                    finalId,
                    { ...formData, orderNumber: officialOrderNumber },
                    members,
                    (result as any).version || localVersion,
                    (result as any).updatedAt || now,
                    auditTrail
                  );
                }
              } else if (result && typeof result === 'object' && 'error' in result && result.error === 409) {
                /**
                 * 🔥 CONFLIT VERSION
                 */
                logger.warn('Conflit version détecté → récupération serveur');

                const serverMission = await missionService.getMission(finalId);

                if (serverMission) {
                  await db.missions.put(serverMission);
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
                const created = await missionService.createMission(serverPayload);
                if (created) {
                  assignedId = created.id;
                  serverSuccess = true;
                } else {
                  serverSuccess = false;
                }
              } else {
                serverSuccess = false;
              }
            } else {
              const created = await missionService.createMission(serverPayload);
              if (created) {
                assignedId = created.id;
                serverSuccess = true;
                
                const officialNum = (created as any).orderNumber || (created as any).data?.orderNumber;
                if (officialNum) {
                  actions.loadMission(
                    created.id,
                    { ...formData, orderNumber: officialNum },
                    members,
                    (created as any).version || 1,
                    (created as any).updatedAt || now,
                    auditTrail
                  );
                }
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
            missionData.id = assignedId;
            await db.missions.put(missionData);

            actions.loadMission(
              assignedId,
              formData,
              members,
              localVersion,
              now,
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
              payload: missionData,
            });
          }
        } else {
          /**
           * OFFLINE MODE
           */
          actions.setSyncStatus('pending');

          await syncQueue.enqueue(finalId, {
            type: 'OFFLINE_SAVE',
            payload: missionData,
          });

          actions.addAuditEntry('Mode offline - synchronisation différée', 'System');
        }

        actions.clearDirty();
        actions.setStatus('success');

        let officialOrderNumber = undefined;
        if (navigator.onLine && serverSuccess) {
           // We don't have easy access to the result here unless we refactor, 
           // but wait, I can just grab it from missionData if it was updated
           officialOrderNumber = (missionData as any).orderNumber;
        }

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
        const serverVersion = m.version || (m as any).data?.version || 1;
        const local = await db.missions.get(m.id);

        const normalized = {
          id: m.id,
          projectId: m.projectId,
          ...(m.data || {}),
          version: serverVersion,
          updatedAt: m.updatedAt || now,
        };

        if (!local) {
          await db.missions.put(normalized);
          merged++;
        } else if (serverVersion > (local.version || 0)) {
          await db.missions.put(normalized);
          merged++;
        } else if ((local.version || 0) > serverVersion) {
          /**
           * 🔥 CONFLIT LOCAL PRIORITAIRE
           */
          await syncQueue.enqueue(local.id, {
            type: 'FORCE_PUSH',
            payload: local,
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
