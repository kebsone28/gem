import { useCallback } from 'react';
import { db } from '../../../store/db';
import * as missionService from '../../../services/missionService';
import { validateMission } from '../core/missionValidation';
import { calculateMissionTotals } from '../../../utils/missionBudget';
import { syncEventBus, SYNC_EVENTS } from '../../../utils/syncEventBus';
import { syncQueue } from '../core/missionSyncQueue';
import logger from '../../../utils/logger';
import type { MissionState, AuditEntry } from '../core/missionTypes';

/**
 * HOOK : Synchronisation Mission Industrielle (Phase 2 PRO)
 * Gère le versioning, les conflits et l'Audit Trail.
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
  const { formData, members, currentMissionId, isCertified, isSubmitted, version, auditTrail } =
    state;

  /**
   * SAUVEGARDE & SYNC (Push)
   */
  const handleSaveMission = useCallback(
    async (overrideFlags?: { isSubmitted?: boolean; isCertified?: boolean }) => {
      // Mission autonomous: activeProjectId is no longer mandatory

      // 1. Validation Zod (Sécurité & Structure)
      const validation = validateMission({ formData, members, version });
      if (!validation.isValid) {
        actions.setStatus('error');
        logger.warn('Validation Zod échouée', validation.errors);
        return null;
      }

      const isNewMission = !currentMissionId || currentMissionId.startsWith('temp');
      const finalId = currentMissionId || `temp-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      // ⚠️ SÉCURITÉ : Si c'est une nouvelle mission (duplication), on force false
      // sauf si un override explicite est passé (clic sur le bouton soumettre)
      const finalIsSubmitted = isNewMission
        ? (overrideFlags?.isSubmitted ?? false)
        : (overrideFlags?.isSubmitted ?? isSubmitted);

      const finalIsCertified = isNewMission
        ? (overrideFlags?.isCertified ?? false)
        : (overrideFlags?.isCertified ?? isCertified);

      try {
        actions.setStatus('saving');

        // 2. Préparation Data (Versioning)
        const missionData = {
          id: finalId,
          projectId: activeProjectId,
          ...formData,
          members,
          version: state.version, // Utiliser la version du state (incrémentée par le reducer)
          updatedAt: now,
          auditTrail,
          isCertified: finalIsCertified,
          isSubmitted: finalIsSubmitted,
        };

        // 3. Sauvegarde Locale (Offline-First) - Succès garanti ici
        await db.missions.put(missionData);

        let assignedId = currentMissionId || finalId;
        let syncAuditMsg = 'Synchronisation locale réussie';
        let serverSuccess: boolean | null = null;

        // 4. Synchronisation Serveur (Buffered Queue)
        if (navigator.onLine) {
          actions.setSyncStatus('pending');
          const totals = calculateMissionTotals(members);

          // Mapping status for server
          let serverStatus = 'draft';
          if (finalIsCertified) serverStatus = 'approuvee';
          else if (finalIsSubmitted) serverStatus = 'soumise';

          const isoDate = (d?: string) => {
            if (!d || !d.includes('/')) return null;

            const [day, month, year] = d.split('/');
            if (!day || !month || !year) return null;

            const date = new Date(`${year}-${month}-${day}`);
            return isNaN(date.getTime()) ? null : date.toISOString();
          };

          if (!activeProjectId) {
            logger.warn('No projectId, skipping server sync');
            serverSuccess = false;
          } else {
            const serverPayload = {
              projectId: activeProjectId,
              title: formData.purpose || 'Sans titre',
              description: formData.itineraryAller || '',
              startDate: isoDate(formData.startDate),
              endDate: isoDate(formData.endDate),
              budget: totals.totalFrais || 0,
              status: serverStatus,
              version: state.version,
              // DATA CLEAN
              data: {
                orderNumber: formData.orderNumber,
                region: formData.region,
                purpose: formData.purpose,
                itineraryAller: formData.itineraryAller,
                itineraryRetour: formData.itineraryRetour,
                transport: formData.transport,
                planning: formData.planning,
                members: members.map((m) => ({
                  name: m.name,
                  role: m.role,
                  unit: m.unit,
                  dailyIndemnity: m.dailyIndemnity,
                  days: m.days,
                })),
                isCertified: finalIsCertified,
                isSubmitted: finalIsSubmitted,
              },
            };

            if (!isNewMission) {
              const result = await missionService.updateMission(currentMissionId!, serverPayload);
              if (result && !('error' in result)) {
                syncAuditMsg = 'Mise à jour serveur synchronisée (v' + state.version + ')';
                actions.setSyncStatus('synced');
                serverSuccess = true;
              } else if (result && 'error' in result && result.error === 404) {
                logger.warn('Mission fantôme détectée (404). Tentative de re-création autonome.');
                const created = await missionService.createMission(serverPayload);
                if (created) {
                  assignedId = created.id;
                  syncAuditMsg = 'Mission restaurée/recréée suite à une suppression serveur';
                  actions.setSyncStatus('synced');
                  serverSuccess = true;
                } else {
                  actions.setSyncStatus('failed');
                  serverSuccess = false;
                }
              } else {
                actions.setSyncStatus('failed');
                serverSuccess = false;
              }
            } else {
              const created = await missionService.createMission(serverPayload);
              if (created) {
                assignedId = created.id;
                syncAuditMsg = 'Mission créée et synchronisée (v1)';
                actions.setSyncStatus('synced');
                serverSuccess = true;
              } else {
                actions.setSyncStatus('failed');
                serverSuccess = false;
              }
            }
          }

          // Align ID
          if (assignedId !== finalId) {
            actions.loadMission(assignedId, formData, members, state.version, now, auditTrail);
            await db.missions.delete(finalId);
            missionData.id = assignedId;
            await db.missions.put(missionData);
          }

          actions.addAuditEntry(syncAuditMsg, 'System', `ID: ${assignedId}`);
        } else {
          // Offline: Enqueue for later
          actions.setSyncStatus('pending');
          await syncQueue.enqueue(finalId, { type: 'SET_FORM_DATA', payload: formData });
          actions.addAuditEntry("Action en file d'attente (Offline)", 'System');
        }

        if (serverSuccess === true) {
          syncEventBus.emit(SYNC_EVENTS.MISSION_SAVED, { id: assignedId, version: state.version });
          if (finalIsCertified) {
            syncEventBus.emit(SYNC_EVENTS.MISSION_CERTIFIED, { id: assignedId });
          }
        }

        actions.clearDirty(); // Reset tous les flags dirty
        actions.setStatus('success');

        return { assignedId, serverSuccess };
      } catch (err) {
        actions.setStatus('error');
        logger.error('Sync Failure:', err);
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
   * RÉCUPÉRATION (Pull)
   */
  const handleSyncFromServer = useCallback(async () => {
    if (!activeProjectId) return;
    actions.setStatus('saving');
    const now = new Date().toISOString();
    try {
      const missions = await missionService.getMissions(activeProjectId);
      let mergedCount = 0;
      let conflictCount = 0;

      for (const m of missions) {
        const serverVersion = (m as any).version || (m.data as any)?.version || 1;
        const localMission = await db.missions.get(m.id);

        // Aligner la structure back-end -> structure core front-end
        const coreData = {
          id: m.id,
          projectId: m.projectId,
          ...(m.data as any),
          version: serverVersion,
          updatedAt: (m as any).updatedAt || now,
        };

        if (!localMission) {
          // Nouvelle mission du serveur
          await db.missions.put(coreData);
          mergedCount++;
        } else if (serverVersion > (localMission.version || 0)) {
          // Serveur plus récent (ou égal et forcé) - on met à jour le local
          await db.missions.put(coreData);
          mergedCount++;
        } else if ((localMission.version || 0) > serverVersion) {
          // CONFLIT : Local plus récent. On sauvegarde localement la préséance
          // et on force un push vers le serveur plus tard.
          logger.warn(
            `Conflit détecté (Mission ${m.id}): Local v${localMission.version} > Server v${serverVersion}. Push prioritaire.`
          );
          await syncQueue.enqueue(localMission.id, {
            type: 'SET_FORM_DATA',
            payload: localMission,
          });
          conflictCount++;
        }
      }
      actions.setStatus('success');
      if (mergedCount > 0 || conflictCount > 0) {
        actions.addAuditEntry(
          `Import: ${mergedCount} MAJ, ${conflictCount} conflits résolus`,
          'System'
        );
      }
    } catch (err) {
      actions.setStatus('error');
      logger.error('Fetch Failure:', err);
    }
  }, [activeProjectId, actions]);

  return {
    handleSaveMission,
    handleSyncFromServer,
  };
};
