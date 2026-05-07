/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../contexts/AuthContext';
import * as safeStorage from '../utils/safeStorage';
import {
  ClipboardList,
  MapPin,
  KeyRound,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import logger from '../utils/logger';
import * as missionApprovalService from '../services/missionApprovalService';
import * as missionService from '../services/missionService';
import { normalizeMissionApprovalRole, isMasterAdminEmail } from '../utils/roleUtils';

// Services & Store
import { generateMissionOrderPDF } from '../services/missionOrderGenerator';
import {
  generateMissionOrderWord,
  generateMissionReportWord,
} from '../services/missionOrderWordGenerator';
import * as XLSX from 'xlsx';
import { db } from '../store/db';
import { createMissionFromTemplate } from '../services/missionTemplates';

// Types
import type { MissionOrderData, MissionMember } from './mission/core/missionTypes';
import { KAFFRINE_TEMPLATE } from './mission/core/missionTypes';

// Hooks
import { usePermissions } from '../hooks/usePermissions';
import { useFinances } from '../hooks/useFinances';
import { useProject } from '../contexts/ProjectContext';
import { useMissionState } from './mission/hooks/useMissionState';
import { useMissionSync } from './mission/hooks/useMissionSync';
import { useMissionWorkflow } from './mission/hooks/useMissionWorkflow';
import { syncEventBus } from '../utils/syncEventBus';

// Core Selectors
import {
  selectTotalFrais,
  selectMissionHealthScore,
  selectHealthStatus,
  selectBudgetVariance,
} from './mission/core/missionSelectors';

const HIDDEN_MISSION_IDS_KEY = 'gem_hidden_mission_ids';

function rememberHiddenMissionId(id: string) {
  try {
    const raw = localStorage.getItem(HIDDEN_MISSION_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const ids = new Set<string>(Array.isArray(parsed) ? parsed : []);
    ids.add(id);
    localStorage.setItem(HIDDEN_MISSION_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Best effort only; server deletion still remains the primary path.
  }
}

// Components
import { MissionOrderActionBar } from './mission/components/MissionOrderActionBar';
import { MissionListSidebar } from './mission/components/MissionListSidebar';
import { MissionBudgetPanel } from './mission/components/MissionBudgetPanel';
import { MissionTeamEditor } from './mission/components/MissionTeamEditor';
import { MissionAuditTrail } from './mission/components/MissionAuditTrail';
import { MissionInfoSection } from './mission/components/MissionInfoSection';
import { MissionItineraryEditor } from './mission/components/MissionItineraryEditor';
import { MissionMiniMap, MissionStatusWidget, MissionSimplifiedMode } from '../components/mission';
import { MissionApprovalStatusBanner } from './mission/components/MissionApprovalStatusBanner';
import { MissionNotificationCenter } from './mission/components/MissionNotificationCenter';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { WidgetErrorBoundary } from '../components/common/WidgetErrorBoundary';

const DEFAULT_PLANNING_STEPS = [
  "Jour 1 : Dakar ➔ Tambacounda (Mise en route)\n• Matin : Départ 06h00 de Dakar.\n• Après-midi : Trajet Dakar-Tamba.\n• Soir : Réunion de cadrage initiale avec l'entrepreneur principal de Tamba.",
  "Jour 2 : Tamba : Secteur Villages (Terrain 1)\n• Matin : Visite de 2 à 3 villages. Échantillonnage.\n• Action : Prise de coordonnées GPS des grappes et repérage des lieux de stockage.\n• Fin de journée : Identification d'un lieu de formation central.",
  "Jour 3 : Tamba (Négociations) ➔ Kaffrine\n• Matin : Finalisation de la négociation contractuelle avec l'entrepreneur.\n• Après-midi : Route vers Kaffrine (2.5h). Première visite de village.",
];

const buildDraftReference = (suffix?: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSeq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `TEMP-${year}${month}${day}-${randomSeq}${suffix ? `-${suffix}` : ''}`;
};

const hasOfficialMissionNumber = (value?: string | null) => !!value && !value.startsWith('TEMP-');

const getMissionReferenceLabel = (data: Partial<MissionOrderData>) => {
  if (hasOfficialMissionNumber(data.orderNumber)) return data.orderNumber as string;
  return data.purpose || 'BROUILLON';
};

const getMissionFileStem = (data: Partial<MissionOrderData>) =>
  getMissionReferenceLabel(data)
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, '_');

export default function MissionOrder() {
  const { user } = useAuth();
  const { devis } = useFinances();
  const { peut, PERMISSIONS, role } = usePermissions();
  const { activeProjectId } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI Local State
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('gem_mission_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleSidebar = () =>
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gem_mission_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // Ignore storage failures; the sidebar state still updates for this session.
      }
      return next;
    });
  const autosaveTimerRef = useRef<number | null>(null);
  // Toujours initialiser à 'prep' pour éviter l'accès prématuré à state
  const [activeTab, setActiveTab] = useState<'prep' | 'report' | 'approval'>('prep');

  // Sélecteur de mission pour l'archivage
  const [selectedArchiveMission, setSelectedArchiveMission] = useState<string | null>(null);

  // DG PIN Signature Workflow
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinCode, setPinCode] = useState('');

  // Business Logic Hooks
  const missionState = useMissionState();
  const { state } = missionState;

  const { handleSaveMission, handleSyncFromServer } = useMissionSync(
    state,
    missionState,
    activeProjectId
  );

  // DB Queries & Filtered List
  const allMissions = useLiveQuery(() => db.missions.toArray()) || [];
  const savedMissions = useMemo(() => {
    // FILTRAGE STRICT : Chaque utilisateur ne voit que ses propres créations
    // On conserve un accès pour l'administrateur système 'admingem' par sécurité
    const isSystemAdmin = isMasterAdminEmail(user?.email);

    if (isSystemAdmin) return allMissions;

    return allMissions.filter(
      (m: any) =>
        m.createdBy === user?.id || m.createdBy === user?.email || m.creatorId === user?.id
    );
  }, [allMissions, user?.id, user?.email]);

  const unreadCount = useLiveQuery(() => db.notifications.where('read').equals(0).count(), []) || 0;
  const selectedArchiveMissionData = useMemo(
    () => savedMissions.find((m: any) => m.id === selectedArchiveMission) || null,
    [savedMissions, selectedArchiveMission]
  );

  // KPIs
  const projectBudget = useMemo(() => devis?.totalPlanned || 0, [devis]);
  const totalFrais = useMemo(() => selectTotalFrais(state), [state]);
  const healthScore = useMemo(
    () => selectMissionHealthScore(state, projectBudget),
    [state, projectBudget]
  );
  const healthStatus = useMemo(
    () => selectHealthStatus(state, projectBudget),
    [state, projectBudget]
  );
  const budgetVariance = useMemo(
    () => selectBudgetVariance(state, projectBudget),
    [state, projectBudget]
  );

  const { workflow, fetchWorkflow, setWorkflow } = useMissionWorkflow(state.currentMissionId);
  const approvalRole = useMemo(
    () => normalizeMissionApprovalRole(role || user?.role),
    [role, user?.role]
  );
  const isWorkflowApproved = workflow?.overallStatus === 'approved';
  const isWorkflowRejected = workflow?.overallStatus === 'rejected';
  const isWorkflowPending =
    !!workflow && !isWorkflowApproved && !isWorkflowRejected && workflow.overallStatus !== 'draft';
  const effectiveIsCertified = !!state.isCertified || isWorkflowApproved;
  const effectiveIsSubmitted = !effectiveIsCertified && (!!state.isSubmitted || isWorkflowPending);
  const isMissionLocked = effectiveIsSubmitted || effectiveIsCertified;

  useEffect(() => {
    const hasUnsavedChanges =
      missionState.isDirty &&
      !!state.currentMissionId &&
      !isMissionLocked &&
      state.status !== 'saving';

    if (!hasUnsavedChanges) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      handleSaveMission()
        .then((result) => {
          if (result) {
            logger.debug('[MissionOrder] Autosave completed', {
              missionId: result.assignedId || state.currentMissionId,
              serverSuccess: result.serverSuccess,
            });
          }
        })
        .catch((error) => {
          logger.warn('[MissionOrder] Autosave failed', error);
          toast('Sauvegarde automatique échouée - vos données sont conservées localement', {
            icon: '⚠️',
            duration: 3000,
          });
        });
    }, 2500);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    missionState.isDirty,
    state.currentMissionId,
    state.status,
    state.version,
    isMissionLocked,
    handleSaveMission,
  ]);

  // Persistance de la mission : Recharger la demande via URL ou la dernière vue
  useEffect(() => {
    if (!state.currentMissionId) {
      const urlId = searchParams.get('id');
      const lastId = safeStorage.getItem('last_viewed_mission_id');
      const targetId = urlId || lastId;

      if (targetId) {
        const mission = savedMissions.find((m) => m.id === targetId);
        if (mission) {
          handleLoadMission(mission);

          // Clean the URL if it came from the query string
          if (urlId) {
            searchParams.delete('id');
            setSearchParams(searchParams, { replace: true });
          }
        }
      }
    }
  }, [savedMissions.length, searchParams, setSearchParams]); // Re-tenter quand les missions DB sont chargées

  // 🔄 Écoute Globale Real-Time (WebSocket Events)
  useEffect(() => {
    const handleRemoteUpdate = (data: any) => {
      // Pour éviter les boucles, on s'assure qu'on répond surtout aux notifications de type SYNC
      // Mais dans le doute on force le fetch qui est intelligent
      handleSyncFromServer();
      if (state.currentMissionId) {
        fetchWorkflow();
      }
    };

    const unsubNotification = syncEventBus.subscribe('notification', handleRemoteUpdate);
    const unsubMissionUpdate = syncEventBus.subscribe('mission:update', handleRemoteUpdate);
    const unsubMissionSubmitted = syncEventBus.subscribe('mission:submitted', handleRemoteUpdate);
    const unsubMissionCertified = syncEventBus.subscribe('mission:certified', handleRemoteUpdate);

    return () => {
      unsubNotification();
      unsubMissionUpdate();
      unsubMissionSubmitted();
      unsubMissionCertified();
    };
  }, [handleSyncFromServer, state.currentMissionId, fetchWorkflow]);

  // Sauvegarder l'ID de la mission active
  useEffect(() => {
    if (state.currentMissionId) {
      safeStorage.setItem('last_viewed_mission_id', state.currentMissionId);
      fetchWorkflow();
    }
  }, [state.currentMissionId, fetchWorkflow]);

  // Handlers
  const handleNewMission = async () => {
    const existingEmptyDraft = savedMissions.find((mission: any) => {
      const isDraft =
        !mission.isSubmitted &&
        !mission.data?.isSubmitted &&
        !mission.isCertified &&
        !mission.data?.isCertified &&
        (mission.status === 'draft' || !mission.status);
      const belongsToUser =
        !mission.createdBy ||
        mission.createdBy === user?.id ||
        mission.createdBy === user?.email ||
        mission.creatorId === user?.id ||
        mission.createdBy === 'inconnu';
      const hasContent = Boolean(
        mission.purpose ||
        mission.title ||
        mission.region ||
        mission.startDate ||
        mission.endDate ||
        (Array.isArray(mission.members) && mission.members.length > 0)
      );

      return isDraft && belongsToUser && !hasContent;
    });

    if (existingEmptyDraft) {
      // L'autosave a déjà sauvegardé le brouillon existant ; on le recharge directement
      handleLoadMission(existingEmptyDraft);
      safeStorage.setItem('last_viewed_mission_id', existingEmptyDraft.id);
      toast('Brouillon vide existant rechargé.', { icon: '♻️' });
      return;
    }

    const now = new Date();
    const missionId = `temp-${crypto.randomUUID()}`;
    const orderNumber = buildDraftReference();
    const date = now.toLocaleDateString('fr-FR');
    const updatedAt = now.toISOString();
    const auditEntry = {
      id: crypto.randomUUID(),
      action: 'Nouvelle mission créée (Brouillon)',
      author: user?.name || 'Utilisateur',
      timestamp: updatedAt,
    };
    const draftMission = {
      id: missionId,
      projectId: activeProjectId,
      orderNumber,
      date,
      planning: DEFAULT_PLANNING_STEPS,
      features: { map: true, expenses: false, inventory: false, ai: false },
      transport: 'Véhicule de service',
      createdBy: user?.id || user?.email || 'inconnu',
      creatorId: user?.id,
      members: [],
      version: 1,
      updatedAt,
      auditTrail: [auditEntry],
      status: 'draft',
      isCertified: false,
      isSubmitted: false,
    };

    missionState.loadMission(missionId, draftMission, [], 1, updatedAt, [auditEntry]);
    safeStorage.setItem('last_viewed_mission_id', missionId);
    toast.success('Brouillon prêt. Cliquez sur sauvegarder pour l’enregistrer sur le serveur.');
  };

  const handleLoadMission = (m: any) => {
    missionState.loadMission(m.id, m, m.members || [], m.version, m.updatedAt, m.auditTrail);
  };

  const handleDuplicate = async () => {
    if (!state.currentMissionId) return;
    const newId = `temp-${crypto.randomUUID()}`;
    const newOrderNumber = buildDraftReference('COPY');

    // Strip out status, workflow, metadata, AND strict boolean flags so it's a true "draft"
    const {
      id,
      projectId,
      status,
      overallStatus,
      workflow,
      createdAt,
      updatedAt,
      isSubmitted,
      isCertified,
      ...cleanFormData
    } = state.formData as any;

    const duplicatedData = {
      ...cleanFormData,
      orderNumber: newOrderNumber,
      status: 'draft',
      planning: state.formData.planning || DEFAULT_PLANNING_STEPS,
    };

    // Load it into state as a completely new mission instance
    missionState.loadMission(newId, duplicatedData, state.members, 1, new Date().toISOString(), []);

    // Trigger a change to make it "dirty" so the "Enregistrer" button becomes active
    missionState.updateFormField('orderNumber', newOrderNumber);

    missionState.addAuditEntry('Mission dupliquée depuis une mission existante', 'Utilisateur');
    toast.success('Mission dupliquée avec succès !');
  };

  const handleTemplateSelect = (templateId: string) => {
    const orderNumber = buildDraftReference();
    const mission = createMissionFromTemplate(templateId as any, { orderNumber });
    missionState.loadMission(`temp-${crypto.randomUUID()}`, mission.formData, mission.members);
    setShowTemplates(false);
    missionState.addAuditEntry(`Modèle appliqué: ${templateId}`, 'Utilisateur');
  };

  const handleMemberUpdate = useCallback(
    (i: number, field: string | number | symbol, value: any) => {
      missionState.updateMember(i, { [field as keyof MissionMember]: value });
    },
    [missionState]
  );

  const handleAddMember = () => {
    missionState.addMember({ name: '', role: '', unit: 'TECH', dailyIndemnity: 0, days: 1 });
  };

  const handleRemoveMember = (i: number) => {
    missionState.removeMember(i);
  };

  const handleDeleteMission = async (id: string, orderNumber: string) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer la mission ${orderNumber} ? Cette action est irréversible.`
      )
    )
      return;

    try {
      const mission = await db.missions.get(id);
      const missionData = ((mission as any)?.data || {}) as Record<string, any>;
      const isServerMission = Boolean(id && !id.startsWith('temp'));
      const isDraft =
        (mission as any)?.status === 'draft' ||
        (!(mission as any)?.status && !(mission as any)?.isSubmitted && !missionData.isSubmitted);

      if (isServerMission) {
        const serverDeleted = await missionService.deleteMission(id);
        if (!serverDeleted && isDraft) {
          rememberHiddenMissionId(id);
        } else if (!serverDeleted && !isDraft) {
          toast.error('Suppression serveur refusée. La mission officielle reste conservée.');
          return;
        }
      }

      await db.missions.delete(id);
      if (state.currentMissionId === id) {
        missionState.resetMission('', '', []);
      }
      missionState.addAuditEntry(`Mission ${orderNumber} supprimée`, 'Utilisateur');
      toast.success('Mission supprimée de la liste.');
    } catch (err) {
      logger.error('Erreur suppression:', err);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handlePurgeAllMissions = async () => {
    try {
      const result = await missionService.purgeAllMissions();
      if (result.success) {
        toast.success(`${result.count} missions ont été purgées.`);
        // Vider la base locale (Dexie) pour synchroniser
        await db.missions.clear();
        missionState.resetMission('', '', []);
        handleSyncFromServer();
      }
    } catch (error: any) {
      toast.error(error.message || 'Échec de la purge');
    }
  };

  const handleToggleFeature = (feature: string) => {
    const currentFeatures = state.formData.features || {
      map: true,
      expenses: false,
      inventory: false,
      ai: false,
    };
    missionState.updateFormField('features', {
      ...currentFeatures,
      [feature]: !currentFeatures[feature as keyof typeof currentFeatures],
    });
  };

  const handleExportPDF = async () => {
    if (
      effectiveIsCertified &&
      state.currentMissionId &&
      !state.currentMissionId.startsWith('temp')
    ) {
      try {
        await missionApprovalService.downloadCertifiedMissionDocument(
          state.currentMissionId,
          `${getMissionFileStem(state.formData)}_OM_certifie.pdf`
        );
        missionState.addAuditEntry('PDF certifié serveur téléchargé', 'Système');
        return;
      } catch (error) {
        logger.error('[MissionOrder] Certified PDF download failed', error);
        toast.error('Impossible de télécharger le PDF certifié serveur.');
        return;
      }
    }

    await generateMissionOrderPDF(state.formData as MissionOrderData);
    missionState.addAuditEntry('Export PDF brouillon généré', 'Système');
  };

  const handleExportWord = async () => {
    const blob = await generateMissionOrderWord(state.formData as MissionOrderData);
    if (blob) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${getMissionFileStem(state.formData)}_OM.docx`;
      link.click();
      missionState.addAuditEntry('Export Word généré', 'Système');
    }
  };

  const handleExportReportWord = async () => {
    const blob = await generateMissionReportWord(state.formData);
    if (blob) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${getMissionFileStem(state.formData)}_Rapport.docx`;
      link.click();
      missionState.addAuditEntry('Rapport Word post-mission généré', 'Système');
      toast.success('Rapport Word exporté avec succès');
    } else {
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  const handleExportExcel = () => {
    const data = state.formData as MissionOrderData;
    const wb = XLSX.utils.book_new();

    // Feuille 1 : Infos Mission
    const infoRows = [
      ['ORDRE DE MISSION', getMissionReferenceLabel(data)],
      ['Organisation', data.branding?.organizationName || 'PROQUELEC'],
      ['Date', data.date || ''],
      ['Région / Destination', data.region || ''],
      ['Objet de la mission', data.purpose || ''],
      ['Moyen de transport', data.transport || ''],
      [
        'Itinéraire Aller',
        (data.itineraryAller || '').replace(/&/g, '').replace(/!'/g, '->').replace(/→/g, '->'),
      ],
      [
        'Itinéraire Retour',
        (data.itineraryRetour || '').replace(/&/g, '').replace(/!'/g, '->').replace(/→/g, '->'),
      ],
      ['Date de départ', data.startDate || ''],
      ['Date de retour prévue', data.endDate || ''],
      [],
      ["COMPOSITION DE L'ÉQUIPE"],
      [
        'N°',
        'Nom & Prénom',
        'Fonction / Rôle',
        'Unité',
        'Ind. Journalière (FCFA)',
        'Nb Jours',
        'Total Indemnité (FCFA)',
      ],
      ...state.members.map((m, i) => [
        i + 1,
        m.name,
        m.role,
        m.unit || '',
        m.dailyIndemnity,
        m.days,
        m.dailyIndemnity * m.days,
      ]),
      [],
      [
        '',
        '',
        '',
        '',
        '',
        'TOTAL',
        state.members.reduce((s, m) => s + m.dailyIndemnity * m.days, 0),
      ],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(infoRows);
    // Largeurs colonnes
    ws1['!cols'] = [
      { wch: 28 },
      { wch: 40 },
      { wch: 22 },
      { wch: 12 },
      { wch: 24 },
      { wch: 10 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Ordre de Mission');

    // Feuille 2 : Planning
    if (data.planning?.length) {
      const planRows = [
        ['PLANNING DÉTAILLÉ DE LA MISSION'],
        ['Jour', 'Titre', 'Activités détaillées'],
        ...data.planning.map((step, i) => {
          const lines = step.split('\n');
          return [i + 1, lines[0] || '', lines.slice(1).join('\n')];
        }),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(planRows);
      ws2['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Planning');
    }

    const filename = `OM_${getMissionFileStem(data)}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, filename);
    missionState.addAuditEntry('Export Excel généré', 'Système');
  };

  const handleMissionSubmit = async () => {
    if (!state.currentMissionId || isSubmitting) return;
    if (!navigator.onLine) {
      toast.error('La soumission nécessite une connexion serveur.');
      return;
    }

    setIsSubmitting(true);
    try {
      const syncResult = await handleSaveMission({ isSubmitted: true });

      if (syncResult?.serverSuccess === true) {
        missionState.setSubmitted(true);
        missionState.addAuditEntry(
          'Mission soumise pour validation Direction / Administration',
          user?.name || 'Utilisateur'
        );
        const workflowMissionId = syncResult?.assignedId || state.currentMissionId!;
        const updated = await db.missions.get(workflowMissionId);
        if (updated) handleLoadMission(updated);
        const refreshedWorkflow =
          await missionApprovalService.getMissionApprovalHistory(workflowMissionId);
        setWorkflow(refreshedWorkflow as any);
        toast.success('Mission envoyée en approbation');
      } else {
        toast.error("Échec de la soumission. Le serveur n'a pas confirmé l'entrée en workflow.");
      }
    } catch (error) {
      logger.error('Erreur soumission:', error);
      toast.error('Erreur critique lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMissionCertify = () => {
    if (!state.currentMissionId || isSubmitting) return;
    if (!approvalRole) {
      toast.error("Seule la direction ou l'administration peut valider cette mission.");
      return;
    }
    if (!navigator.onLine) {
      toast.error('La validation nécessite une connexion serveur.');
      return;
    }
    if (!effectiveIsSubmitted || !workflow) {
      toast.error("La mission doit d'abord être soumise avant validation.");
      return;
    }
    if (isWorkflowApproved) {
      toast.error('Cette mission est déjà validée.');
      return;
    }

    setPinCode('');
    setIsPinModalOpen(true);
  };

  const confirmCertification = async () => {
    if (!pinCode || pinCode.length < 4) {
      toast.error('Veuillez saisir votre code PIN à 4 chiffres.');
      return;
    }

    setIsPinModalOpen(false);
    setIsSubmitting(true);
    try {
      if (!state.currentMissionId || !approvalRole) {
        toast.error('Mission ou rôle de validation indisponible.');
        return;
      }

      const actionId = globalThis.crypto?.randomUUID?.() || `mission-certify-${Date.now()}`;
      const idempotencyKey = `mission-certify:${state.currentMissionId}:${actionId}`;
      const result = await missionApprovalService.approveMissionStep(
        state.currentMissionId,
        approvalRole,
        `Validation finale confirmée par ${user?.name || approvalRole}`,
        undefined,
        pinCode,
        idempotencyKey
      );

      if (result) {
        const updatedMission = await missionService.getMission(state.currentMissionId);
        if (updatedMission) {
          const normalizedMission = {
            id: updatedMission.id,
            projectId: updatedMission.projectId || activeProjectId,
            ...((updatedMission.data || {}) as Record<string, unknown>),
            version: updatedMission.version || 1,
            updatedAt: updatedMission.updatedAt || new Date().toISOString(),
            orderNumber:
              updatedMission.orderNumber ||
              (updatedMission.data?.orderNumber as string | undefined),
          };
          await db.missions.put(normalizedMission as any);
          missionState.loadMission(
            normalizedMission.id,
            normalizedMission as any,
            (updatedMission.data?.members as MissionMember[]) || state.members,
            normalizedMission.version,
            normalizedMission.updatedAt,
            state.auditTrail
          );
        } else {
          missionState.setCertified(true);
          missionState.setSubmitted(true);
          if (result.orderNumber) {
            missionState.updateFormField('orderNumber', result.orderNumber);
          }
        }
        missionState.addAuditEntry('Validation finale enregistrée', user?.name || approvalRole);
        logger.info('[MissionOrder] certification completed', {
          actionId,
          missionId: state.currentMissionId,
          approvalRole,
        });
        await fetchWorkflow();
        toast.success('Mission validée avec succès.');
      } else {
        toast.error('Échec de la validation finale.');
      }
    } catch (error) {
      logger.error('Erreur validation finale:', error);
      toast.error('Erreur critique lors de la validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si la mission est signée/certifiée, forcer l'onglet rapport
  useEffect(() => {
    if ((effectiveIsCertified || effectiveIsSubmitted) && activeTab !== 'report') {
      setActiveTab('report');
    }
  }, [activeTab, effectiveIsCertified, effectiveIsSubmitted]);

  // Mode terrain simplifié : accès direct au rapport
  if (state.isSimplifiedMode) {
    // Générer un planning terrain à partir du planning validé si la mission est signée/certifiée et qu'il n'y a pas de rapport terrain
    let missionData = state.formData as MissionOrderData;
    if (
      (effectiveIsCertified || effectiveIsSubmitted) &&
      (!missionData.reportDays || missionData.reportDays.length === 0) &&
      Array.isArray(missionData.planning) &&
      missionData.planning.length > 0
    ) {
      // Générer un rapport terrain basé sur le planning validé
      missionData = {
        ...missionData,
        reportDays: missionData.planning.map((step, idx) => {
          // Extraction du titre et du détail
          const [title, ...rest] = step.split('\n');
          return {
            day: idx + 1,
            title: title || `Jour ${idx + 1}`,
            detail: rest.join('\n') || '', // Détail de l'étape
            notes: '',
            observation: '',
            isCompleted: false,
            photos: [], // Nouveau format: tableau de photos
            location: undefined,
          };
        }),
      };
    }
    return (
      <MissionSimplifiedMode
        missionData={missionData}
        members={state.members}
        onBack={() => missionState.setSimplifiedMode(false)}
        onSave={async (updatedReportDays) => {
          logger.debug('=== onSave appelé ===', updatedReportDays);
          // Sauvegarder les données du rapport terrain
          missionState.updateFormField('reportDays', updatedReportDays);
          logger.debug('reportDays mis à jour dans le state');
          // Sauvegarder et synchroniser
          if (handleSaveMission) {
            logger.debug('Appel de handleSaveMission...');
            const result = await handleSaveMission();
            logger.debug('Résultat de handleSaveMission:', result);
          } else {
            logger.error('[MissionOrder] handleSaveMission est undefined');
          }
        }}
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Ordre de Mission"
        subtitle="Configuration & Déploiement Terrain"
        icon={<ClipboardList className="text-indigo-500" />}
      />

      <ContentArea className="!p-3 sm:!p-6 lg:!p-8">
        {/* BARRE D'ACTIONS - HAUTE PRIORITÉ Z-INDEX */}
        <div className="relative z-50 mb-4 sm:mb-6 lg:mb-8 no-print">
          <WidgetErrorBoundary title="Barre d'Actions">
            <MissionOrderActionBar
              formData={state.formData}
              currentMissionId={state.currentMissionId}
              role={role || ''}
              isSyncing={state.isSyncing}
              isSyncingServer={state.isSyncingServer}
              isDirty={missionState.isDirty}
              syncStatus={state.syncStatus}
              showTemplates={showTemplates}
              showConfig={showConfig}
              showAudit={showAudit}
              PERMISSIONS={PERMISSIONS}
              peut={peut}
              onNewMission={handleNewMission}
              onDuplicate={handleDuplicate}
              onTemplateToggle={() => setShowTemplates(!showTemplates)}
              onTemplateSelect={handleTemplateSelect}
              onConfigToggle={() => setShowConfig(!showConfig)}
              onToggleFeature={handleToggleFeature}
              onToggleSimplifiedMode={missionState.setSimplifiedMode}
              isSimplifiedMode={state.isSimplifiedMode}
              onNotificationsToggle={() => setShowNotifications(!showNotifications)}
              onAuditToggle={() => setShowAudit(!showAudit)}
              unreadCount={unreadCount}
              onSyncFromServer={handleSyncFromServer}
              onArchive={() => {}}
              onDelete={() => {}}
              onExportExcel={handleExportExcel}
              onExportWord={handleExportWord}
              onExportPDF={handleExportPDF}
              onSave={() => {
                if (window.confirm('Voulez-vous enregistrer les modifications ?')) {
                  handleSaveMission();
                }
              }}
              onValidate={handleMissionCertify}
              onSubmit={handleMissionSubmit}
              isCertified={effectiveIsCertified}
              isSubmitted={effectiveIsSubmitted}
            />
          </WidgetErrorBoundary>
        </div>

        {/* GRILLE PRINCIPALE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 relative z-10">
          {/* SIDEBAR GAUCHE : collapsible + sticky + persistante */}
          {!focusMode && (
            <div
              className={`no-print transition-all duration-300 ${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-2'}`}
            >
              <div className="sticky top-4">
                {/* Toggle button */}
                <div className="flex items-center justify-between mb-3">
                  {!sidebarCollapsed && (
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Missions
                    </span>
                  )}
                  <button
                    onClick={toggleSidebar}
                    className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                    title={sidebarCollapsed ? 'Afficher la liste' : 'Réduire la liste'}
                  >
                    {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
                  </button>
                </div>
                {!sidebarCollapsed ? (
                  <MissionListSidebar
                    savedMissions={savedMissions}
                    currentMissionId={state.currentMissionId}
                    onLoadMission={handleLoadMission}
                    onDeleteMission={handleDeleteMission}
                    isCertifiedByWorkflow={effectiveIsCertified}
                    role={role || user?.role}
                    onPurgeAll={handlePurgeAllMissions}
                  />
                ) : (
                  /* Mini sidebar – points de statut */
                  <div className="space-y-1.5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {savedMissions.slice(0, 30).map((m: any) => {
                      const isActive = state.currentMissionId === m.id;
                      const isCert =
                        m.isCertified ||
                        m.data?.isCertified ||
                        m.status === 'certified' ||
                        m.status === 'approuvee';
                      const isPend =
                        !isCert && (m.isSubmitted || m.data?.isSubmitted || m.status === 'soumise');
                      const dotColor = isCert
                        ? 'bg-emerald-500'
                        : isPend
                          ? 'bg-amber-500'
                          : 'bg-slate-400';
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleLoadMission(m)}
                          title={m.purpose || m.title || m.orderNumber || 'Mission'}
                          className={`w-full flex items-center justify-center p-2 rounded-xl transition-all ${
                            isActive
                              ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 hover:border-indigo-400/40'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : dotColor}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONTENU PRINCIPAL */}
          <div
            className={`transition-all duration-300 ${
              focusMode ? 'lg:col-span-12' : sidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-10'
            }`}
          >
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-start">
              {/* FORMULAIRE : s'étend selon le focus mode */}
              <div
                className={`space-y-4 sm:space-y-6 ${
                  focusMode ? 'xl:col-span-12' : 'xl:col-span-9'
                }`}
              >
                {(effectiveIsSubmitted || effectiveIsCertified) && (
                  <MissionApprovalStatusBanner workflow={workflow} />
                )}

                {/* BARRE ONGLETS PILL + BOUTON FOCUS */}
                <div className="flex items-center gap-2 mb-5">
                  {/* Segmented control */}
                  <div className="flex-1 flex gap-1.5 p-1 bg-slate-900/60 dark:bg-slate-800/60 border border-white/5 rounded-2xl min-w-0 overflow-x-auto no-scrollbar shadow-inner">
                    <button
                      onClick={() => setActiveTab('prep')}
                      className={`flex-1 shrink-0 px-3 py-2 text-[11px] font-black uppercase tracking-wide rounded-xl transition-all duration-200 whitespace-nowrap ${
                        activeTab === 'prep'
                          ? 'bg-slate-900 dark:bg-slate-900 text-indigo-400 shadow-md shadow-black/10'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      📋 Préparation
                    </button>
                    <button
                      onClick={() => setActiveTab('report')}
                      className={`flex-1 shrink-0 px-3 py-2 text-[11px] font-black uppercase tracking-wide rounded-xl transition-all duration-200 whitespace-nowrap ${
                        activeTab === 'report'
                          ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 shadow-md shadow-black/10'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      📝 Rapport
                    </button>
                    <button
                      onClick={() => setActiveTab('approval')}
                      className={`flex-1 shrink-0 px-3 py-2 text-[11px] font-black uppercase tracking-wide rounded-xl transition-all duration-200 whitespace-nowrap ${
                        activeTab === 'approval'
                          ? 'bg-slate-900 dark:bg-slate-900 text-amber-400 shadow-lg shadow-black/20 ring-1 ring-white/5'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      ✅ Approbation
                    </button>
                  </div>
                  {/* Bouton Focus Mode */}
                  <button
                    onClick={() => setFocusMode((f) => !f)}
                    className={`shrink-0 p-3 rounded-xl transition-all border shadow-sm ${
                      focusMode
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                        : 'text-slate-400 hover:text-indigo-400 border-white/10 hover:border-indigo-400/50 bg-slate-900/40 dark:bg-slate-900'
                    }`}
                    title={focusMode ? 'Quitter le mode plein écran' : 'Mode plein écran'}
                  >
                    {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                </div>

                {/* CONTENU SELON L'ONGLET */}

                {activeTab === 'prep' && (
                  <>
                    <MissionInfoSection
                      formData={state.formData}
                      isReadOnly={effectiveIsCertified || effectiveIsSubmitted}
                      onUpdateField={missionState.updateFormField}
                    />
                    {state.formData.features?.map && (
                      <section className="glass-card !p-0 !rounded-[2.5rem] overflow-hidden border-2 border-indigo-500/10 shadow-2xl shadow-indigo-500/5">
                        <div className="p-4 bg-slate-900 border-b border-white/5 flex justify-between items-center">
                          <h2 className="!text-[9px] font-black uppercase tracking-widest text-indigo-400">
                            Preview SIG Intelligente
                          </h2>
                          <MapPin size={14} className="text-indigo-400" />
                        </div>
                        <MissionMiniMap region={state.formData.region || ''} />
                      </section>
                    )}

                    <MissionTeamEditor
                      members={state.members}
                      isReadOnly={effectiveIsCertified || effectiveIsSubmitted}
                      onUpdateMember={handleMemberUpdate}
                      onRemoveMember={handleRemoveMember}
                      onAddMember={handleAddMember}
                      onSyncDuration={() => {}}
                    />

                    <MissionItineraryEditor
                      planning={state.formData.planning || []}
                      isReadOnly={effectiveIsCertified || effectiveIsSubmitted}
                      onUpdateStep={(i: number, text: string) => {
                        const newPlanning = [...(state.formData.planning || [])];
                        newPlanning[i] = text;
                        missionState.updateFormField('planning', newPlanning);
                      }}
                      onAddStep={() => {
                        const newPlanning = [...(state.formData.planning || []), ''];
                        missionState.updateFormField('planning', newPlanning);
                      }}
                      onRemoveStep={(i: number) => {
                        const newPlanning = (state.formData.planning || []).filter(
                          (_, idx) => idx !== i
                        );
                        missionState.updateFormField('planning', newPlanning);
                      }}
                    />

                    {showAudit && <MissionAuditTrail entries={state.auditTrail} />}
                  </>
                )}

                {/* ONGLET RAPPORT POST-MISSION */}
                {activeTab === 'report' && (
                  <div className="space-y-6">
                    <div className="glass-card !p-5 sm:!p-8">
                      <h3 className="text-clamp-title text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                        <span className="w-2 h-8 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20"></span>
                        Rapport Post-Mission
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Observations générales
                          </label>
                          <textarea
                            value={state.formData.reportObservations || ''}
                            onChange={(e) =>
                              missionState.updateFormField('reportObservations', e.target.value)
                            }
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            placeholder="Saisissez les observations et conclusions de la mission..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Mode de Reporting
                          </label>
                          <div className="flex gap-2 p-1 bg-slate-950/40 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl mb-4">
                            <button
                              onClick={() => missionState.updateFormField('reportingMode', 'daily')}
                              className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                                (state.formData.reportingMode || 'daily') === 'daily'
                                  ? 'bg-emerald-500 text-white shadow-lg'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                            >
                              Suivi Journalier (Jalons)
                            </button>
                            <button
                              onClick={() => {
                                missionState.updateFormField('reportingMode', 'narrative');
                                if (!state.formData.narrativeReport) {
                                  missionState.updateFormField(
                                    'narrativeReport',
                                    KAFFRINE_TEMPLATE
                                  );
                                }
                              }}
                              className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                                state.formData.reportingMode === 'narrative'
                                  ? 'bg-emerald-500 text-white shadow-lg'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                            >
                              Rapport Global de Synthèse
                            </button>
                          </div>
                        </div>

                        {(state.formData.reportingMode || 'daily') === 'daily' ? (
                          <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                              Rapports journaliers
                            </label>
                            {(state.formData.reportDays || []).map((day: any, idx: number) => (
                              <div
                                key={idx}
                                className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                    Jour {idx + 1}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const days = [...(state.formData.reportDays || [])];
                                      days.splice(idx, 1);
                                      missionState.updateFormField('reportDays', days);
                                    }}
                                    className="text-red-500 hover:text-red-700 text-xs font-bold"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                                <textarea
                                  value={day.notes || ''}
                                  onChange={(e) => {
                                    const days = [...(state.formData.reportDays || [])];
                                    days[idx] = { ...day, notes: e.target.value };
                                    missionState.updateFormField('reportDays', days);
                                  }}
                                  rows={3}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                  placeholder="Notes du jour..."
                                />

                                {/* Zone photos responsive */}
                                <div className="mt-2">
                                  <div className="flex flex-wrap gap-2 items-center">
                                    {(day.photos || []).map(
                                      (
                                        photo: import('./mission/core/missionTypes').MissionPhoto,
                                        pidx: number
                                      ) => (
                                        <div
                                          key={photo.id || pidx}
                                          className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center"
                                        >
                                          <img
                                            src={photo.data || photo.url}
                                            alt={`Photo ${pidx + 1}`}
                                            className="object-cover w-full h-2/3"
                                          />
                                          <input
                                            type="text"
                                            value={photo.comment || ''}
                                            onChange={(e) => {
                                              const days = [...(state.formData.reportDays || [])];
                                              const photos = [...(days[idx].photos || [])];
                                              photos[pidx] = {
                                                ...photos[pidx],
                                                comment: e.target.value,
                                              };
                                              days[idx].photos =
                                                photos as import('./mission/core/missionTypes').MissionPhoto[];
                                              missionState.updateFormField('reportDays', days);
                                            }}
                                            placeholder="Commentaire..."
                                            className="w-full px-1 py-0.5 text-[10px] rounded-b bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 photo-comment-input"
                                          />
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const days = [
                                  ...(state.formData.reportDays || []),
                                  {
                                    day: (state.formData.reportDays?.length || 0) + 1,
                                    title: 'Nouveau jour',
                                    notes: '',
                                    photos: [],
                                  },
                                ];
                                missionState.updateFormField('reportDays', days);
                              }}
                              className="mt-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                            >
                              + Ajouter un jour
                            </button>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                              Synthèse narrative (Rapport Global)
                            </label>
                            <textarea
                              value={state.formData.narrativeReport || ''}
                              onChange={(e) =>
                                missionState.updateFormField('narrativeReport', e.target.value)
                              }
                              rows={15}
                              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              placeholder="Rédigez votre synthèse globale ici..."
                            />
                          </div>
                        )}

                        <div className="flex gap-3 pt-4">
                          <button
                            onClick={handleExportReportWord}
                            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                          >
                            <span>📄</span> Exporter Word Rapport
                          </button>
                          <button
                            onClick={handleExportPDF}
                            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                          >
                            <span>📑</span> Exporter PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ONGLET ARCHIVAGE */}
                {activeTab === 'approval' && (
                  <div className="space-y-6">
                    {/* Sélecteur de mission */}
                    <div className="glass-card !p-5 sm:!p-8">
                      <h3 className="text-clamp-title text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                        <span className="w-2 h-8 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/20"></span>
                        Archivage & Rapports
                      </h3>

                      <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Sélectionner une mission
                        </label>
                        <select
                          value={selectedArchiveMission || ''}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            setSelectedArchiveMission(value);
                            if (value) {
                              const mission = savedMissions.find((m: any) => m.id === value);
                              if (mission) {
                                handleLoadMission(mission);
                              }
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                          title="Sélectionner une mission archivée"
                        >
                          <option value="">-- Choisir une mission --</option>
                          {savedMissions
                            .sort((a: any, b: any) => {
                              const titleA = (a.title || a.orderNumber || '').toLowerCase();
                              const titleB = (b.title || b.orderNumber || '').toLowerCase();
                              return titleA.localeCompare(titleB);
                            })
                            .map((m: any) => {
                              const missionDate = m.date || m.missionDate || m.createdAt || null;
                              const dateStr = missionDate
                                ? new Date(missionDate).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Date non définie';
                              return (
                                <option key={m.id} value={m.id}>
                                  {m.title || m.orderNumber || 'Sans titre'} - {dateStr}
                                </option>
                              );
                            })}
                        </select>
                      </div>

                      {!selectedArchiveMission ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <span className="text-4xl mb-2 block">📁</span>
                          <p className="text-sm">Sélectionnez une mission pour voir ses rapports</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">
                              Mission active pour export
                            </p>
                            <p className="mt-1 text-sm font-bold text-white">
                              {String(
                                selectedArchiveMissionData?.title ||
                                  selectedArchiveMissionData?.orderNumber ||
                                  selectedArchiveMission ||
                                  ''
                              )}
                            </p>
                          </div>
                          {/* Rapport Word Post-Mission */}
                          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">📄</span>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                                    Rapport Post-Mission (Word)
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Généré le {new Date().toLocaleDateString('fr-FR')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleExportReportWord}
                                  disabled={!selectedArchiveMission}
                                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                                >
                                  <span>⬇️</span> Télécharger
                                </button>
                                <button
                                  onClick={() => setActiveTab('report')}
                                  className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg"
                                >
                                  Modifier
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Ordre de Mission Word */}
                          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">📋</span>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                                    Ordre de Mission
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Document officiel
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleExportWord}
                                  disabled={!selectedArchiveMission}
                                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                                >
                                  <span>⬇️</span> Télécharger
                                </button>
                                <button
                                  onClick={() => setActiveTab('prep')}
                                  className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg"
                                >
                                  Modifier
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* PDF Rapport */}
                          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">📑</span>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                                    Rapport PDF
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Version imprimable
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleExportPDF}
                                  disabled={!selectedArchiveMission}
                                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                                >
                                  <span>⬇️</span> Télécharger
                                </button>
                                <button
                                  onClick={() => setActiveTab('report')}
                                  className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg"
                                >
                                  Modifier
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Statut de la mission */}
                          <div className="mt-6 p-4 bg-indigo-950/30 dark:bg-indigo-900/20 rounded-xl border border-indigo-500/20 dark:border-indigo-800">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-3 h-3 rounded-full ${effectiveIsCertified ? 'bg-emerald-500' : effectiveIsSubmitted ? 'bg-blue-500' : 'bg-amber-500'}`}
                              ></div>
                              <div>
                                <p className="text-sm font-bold text-white dark:text-indigo-300">
                                  {effectiveIsCertified
                                    ? 'Mission validée et archivée'
                                    : effectiveIsSubmitted
                                      ? 'Mission soumise en attente de validation'
                                      : 'En attente de soumission'}
                                </p>
                                <p className="text-xs text-indigo-400/70 dark:text-indigo-400">
                                  {effectiveIsCertified
                                    ? `Archivée le ${new Date().toLocaleDateString('fr-FR')}`
                                    : effectiveIsSubmitted
                                      ? 'Validation finale attendue par la direction ou l’administration'
                                      : 'Enregistrez puis soumettez la mission pour démarrer le workflow'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* WIDGETS : COL-3 sticky – masqués en focus mode */}
              {!focusMode && (
                <div className="xl:col-span-3 space-y-4 sm:space-y-6">
                  <div className="sticky top-4">
                    <MissionBudgetPanel
                      totalFrais={totalFrais}
                      projectBudget={projectBudget}
                      members={state.members}
                    />
                    <WidgetErrorBoundary title="Indicateurs de Statut">
                      <MissionStatusWidget
                        data={state.formData}
                        members={state.members}
                        isCertified={effectiveIsCertified}
                        isSubmitted={effectiveIsSubmitted}
                        isSyncing={state.isSyncingServer}
                        lastSync={state.lastSavedAt || 'Synchronisé'}
                        version={state.version}
                        isDirty={missionState.isDirty}
                        healthScore={healthScore}
                        healthStatus={healthStatus}
                        budgetVariance={budgetVariance}
                      />
                    </WidgetErrorBoundary>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentArea>

      {showNotifications && (
        <MissionNotificationCenter
          onClose={() => setShowNotifications(false)}
          projectId={activeProjectId || undefined}
        />
      )}

      {/* MODAL VALIDATION FINALE */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200 border border-white/10 dark:border-slate-700">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 ring-4 ring-slate-800 dark:ring-slate-900 shadow-inner">
                <ShieldCheck className="w-8 h-8 text-emerald-400 dark:text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-white dark:text-white mb-2">
                Validation Officielle
              </h3>
              <p className="text-sm font-medium text-slate-500 mb-8 max-w-[280px]">
                Veuillez saisir votre code PIN pour confirmer la validation finale et générer le
                numéro officiel de mission.
              </p>

              <div className="w-full relative mb-8">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="• • • •"
                  className="w-full pl-12 pr-4 py-4 bg-slate-950 dark:bg-slate-800 border-2 border-white/5 dark:border-slate-700 rounded-2xl text-center text-3xl tracking-[1em] font-black text-white dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all font-mono shadow-inner"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-300 dark:text-slate-300 rounded-2xl font-bold transition-all border border-white/5"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmCertification}
                  disabled={pinCode.length < 4 || isSubmitting}
                  className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Validation...' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
