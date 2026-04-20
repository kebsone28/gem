/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../contexts/AuthContext';
import * as safeStorage from '../utils/safeStorage';
import { ClipboardList, MapPin, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Services & Store
import { generateMissionOrderPDF } from '../services/missionOrderGenerator';
import { generateMissionOrderWord, generateMissionReportWord } from '../services/missionOrderWordGenerator';
import * as XLSX from 'xlsx';
import { db } from '../store/db';
import { createMissionFromTemplate } from '../services/missionTemplates';

// Types
import type { MissionOrderData, MissionMember } from './mission/core/missionTypes';

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

  // Auto-save logic
  useEffect(() => {
    if (!missionState.isDirty || !state.currentMissionId) return;
    const timer = setTimeout(() => handleSaveMission(), 2000);
    return () => clearTimeout(timer);
  }, [missionState.isDirty, handleSaveMission, state.currentMissionId]);

  // DB Queries & Filtered List
  const allMissions = useLiveQuery(() => db.missions.toArray()) || [];
  const savedMissions = useMemo(() => {
    const r = role?.toUpperCase() || '';
    const isPowerful = r === 'ADMIN_PROQUELEC' || r === 'ADMIN' || r === 'DIRECTEUR' || r === 'DG_PROQUELEC' || r === 'COMPTABLE';
    
    if (isPowerful) return allMissions;
    
    // Inclure les missions créées par l'utilisateur OU les missions sans 'createdBy' (données legacy)
    return allMissions.filter((m: any) => !m.createdBy || m.createdBy === user?.id || m.createdBy === 'inconnu');
  }, [allMissions, role, user?.id]);

  const unreadCount = useLiveQuery(() => db.notifications.where('read').equals(0).count(), []) || 0;

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

  const { workflow, fetchWorkflow } = useMissionWorkflow(state.currentMissionId);

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
    
    return () => {
      unsubNotification();
      unsubMissionUpdate();
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
  const handleNewMission = () => {
    // Format professionnel : OM-AAAA-MM-NNN (Ordre de Mission - Année - Mois - Numéro séquentiel)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomSeq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const orderNumber = `OM-${year}-${month}-${randomSeq}`;
    const date = now.toLocaleDateString('fr-FR');
    missionState.resetMission(orderNumber, date, DEFAULT_PLANNING_STEPS, user?.email || 'inconnu', user?.id);
    missionState.addAuditEntry('Nouvelle mission créée (Brouillon)', user?.name || 'Utilisateur');
  };

  const handleLoadMission = (m: any) => {
    missionState.loadMission(m.id, m, m.members || [], m.version, m.updatedAt, m.auditTrail);
  };

  const handleDuplicate = async () => {
    if (!state.currentMissionId) return;
    const newId = `om-${crypto.randomUUID()}`;
    // Format professionnel pour la duplication
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomSeq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const newOrderNumber = `OM-${year}-${month}-${randomSeq}-COPY`;

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

    // Trigger a change to make it "dirty" so the "Enregistrer" button becomes active and auto-save can pick it up
    missionState.updateFormField('orderNumber', newOrderNumber);

    missionState.addAuditEntry('Mission dupliquée depuis une mission existante', 'Utilisateur');
    toast.success('Mission dupliquée avec succès !');
  };

  const handleTemplateSelect = (templateId: string) => {
    // Format professionnel : OM-AAAA-MM-NNN
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomSeq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const orderNumber = `OM-${year}-${month}-${randomSeq}`;
    const mission = createMissionFromTemplate(templateId as any, { orderNumber });
    missionState.loadMission(`om-${crypto.randomUUID()}`, mission.formData, mission.members);
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
      await db.missions.delete(id);
      if (state.currentMissionId === id) {
        missionState.resetMission('', '', []);
      }
      missionState.addAuditEntry(`Mission ${orderNumber} supprimée`, 'Utilisateur');
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert('Erreur lors de la suppression.');
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
    await generateMissionOrderPDF(state.formData as MissionOrderData);
    missionState.addAuditEntry('Export PDF généré', 'Système');
  };

  const handleExportWord = async () => {
    const blob = await generateMissionOrderWord(state.formData as MissionOrderData);
    if (blob) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${state.formData.orderNumber || 'Mission'}_OM.docx`;
      link.click();
      missionState.addAuditEntry('Export Word généré', 'Système');
    }
  };

  const handleExportReportWord = async () => {
    const blob = await generateMissionReportWord(state.formData);
    if (blob) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${state.formData.orderNumber || 'Mission'}_Rapport.docx`;
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
      ['ORDRE DE MISSION', data.orderNumber || 'BROUILLON'],
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

    const filename = `OM_${(data.orderNumber || 'Mission').replace('/', '-')}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, filename);
    missionState.addAuditEntry('Export Excel généré', 'Système');
  };

  const handleMissionSubmit = async () => {
    if (!state.currentMissionId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 1. Sauvegarde des données actuelles
      const syncResult = await handleSaveMission({ isSubmitted: true });

      if (syncResult?.serverSuccess === true || navigator.onLine === false) {
        // 2. Initialisation et soumission du workflow d'approbation
        import('../services/missionWorkflow').then((wfService) => {
          wfService.submitForApproval(
            state.currentMissionId!,
            user?.name || 'Demandeur',
            "Soumission initiale de l'ordre de mission pour validation hiérarchique."
          );
          fetchWorkflow(); // Rafraîchir l'UI du workflow
        });

        missionState.setSubmitted(true);
        missionState.addAuditEntry(
          'Mission soumise pour approbation (Workflow activé)',
          user?.name || 'Utilisateur'
        );
        const updated = await db.missions.get(syncResult?.assignedId || state.currentMissionId!);
        if (updated) handleLoadMission(updated);
        toast.success('Mission envoyée en approbation');
      } else {
        toast.error('Échec de la soumission. Veuillez vérifier votre connexion.');
      }
    } catch (error) {
      console.error('Erreur soumission:', error);
      toast.error('Erreur critique lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMissionCertify = () => {
    if (!state.currentMissionId || isSubmitting) return;

    // On vérifie si on est à la dernière étape du workflow (Directeur)
    if (workflow && typeof workflow.currentStep === 'number' && workflow.currentStep < 3) {
      toast.error(
        "Toutes les étapes d'approbation précédentes doivent être validées avant la certification DG."
      );
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
      const syncResult = await handleSaveMission({ isCertified: true });

      if (syncResult?.serverSuccess === true || navigator.onLine === false) {
        // Finaliser le workflow localement
        import('../services/missionWorkflow').then((wfService) => {
          wfService.approveStep(
            state.currentMissionId!,
            'directeur',
            user?.name || 'Directeur Général',
            "Certification finale et signature de l'ordre de mission."
          );
          fetchWorkflow();
        });

        missionState.setCertified(true);
        if (syncResult?.orderNumber) {
          missionState.updateFormField('orderNumber', syncResult.orderNumber);
        }
        missionState.addAuditEntry('Certification DG & Signature confirmée', 'Directeur Général');
        const updated = await db.missions.get(syncResult?.assignedId || state.currentMissionId!);
        if (updated) {
          handleLoadMission(updated);
          toast.success('Mission certifiée et signée.');
          // On ne génère pas le PDF direct, l'utilisateur cliquera sur exporter
        } else {
          toast.success('Mission certifiée avec succès');
        }
      } else {
        toast.error('Échec de la certification. Veuillez vérifier votre connexion.');
      }
    } catch (error) {
      console.error('Erreur certification:', error);
      toast.error('Erreur critique lors de la certification');
    } finally {
      setIsSubmitting(false);
    }
  };


  // Si la mission est signée/certifiée, forcer l'onglet rapport
  useEffect(() => {
    if ((state.isCertified || state.isSubmitted) && activeTab !== 'report') {
      setActiveTab('report');
    }
  }, [state.isCertified, state.isSubmitted]);

  // Mode terrain simplifié : accès direct au rapport
  if (state.isSimplifiedMode) {
    // Générer un planning terrain à partir du planning validé si la mission est signée/certifiée et qu'il n'y a pas de rapport terrain
    let missionData = state.formData as MissionOrderData;
    if ((state.isCertified || state.isSubmitted) && (!missionData.reportDays || missionData.reportDays.length === 0) && Array.isArray(missionData.planning) && missionData.planning.length > 0) {
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
        })
      };
    }
    return (
      <MissionSimplifiedMode
        missionData={missionData}
        members={state.members}
        onBack={() => missionState.setSimplifiedMode(false)}
        onSave={async (updatedReportDays) => {
          console.log('=== onSave appelé ===', updatedReportDays);
          // Sauvegarder les données du rapport terrain
          missionState.updateFormField('reportDays', updatedReportDays);
          console.log('reportDays mis à jour dans le state');
          // Sauvegarder et synchroniser
          if (handleSaveMission) {
            console.log('Appel de handleSaveMission...');
            const result = await handleSaveMission();
            console.log('Résultat de handleSaveMission:', result);
          } else {
            console.error('handleSaveMission est undefined!');
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

      <ContentArea>
        {/* BARRE D'ACTIONS - HAUTE PRIORITÉ Z-INDEX */}
        <div className="relative z-50 mb-8 no-print">
          <WidgetErrorBoundary title="Barre d'Actions">
            <MissionOrderActionBar
            formData={state.formData}
            currentMissionId={state.currentMissionId}
            role={role || ''}
            isSyncing={state.isSyncing}
            isSyncingServer={state.isSyncingServer}
            isDirty={missionState.isDirty}
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
            isCertified={state.isCertified}
            isSubmitted={state.isSubmitted}
          />
          </WidgetErrorBoundary>
        </div>

        {/* GRILLE PRINCIPALE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          {/* SIDEBAR : COL-3 */}
          <div className="lg:col-span-3 no-print">
            <MissionListSidebar
              savedMissions={savedMissions}
              currentMissionId={state.currentMissionId}
              onLoadMission={handleLoadMission}
              onDeleteMission={handleDeleteMission}
              isCertifiedByWorkflow={workflow?.overallStatus === 'approved'}
            />
          </div>

          {/* CONTENU : COL-9 */}
          <div className="lg:col-span-9">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              {/* FORMULAIRE : COL-8 (interne) */}
              <div className="xl:col-span-8 space-y-8">
                {(state.isSubmitted || state.isCertified) && (
                  <MissionApprovalStatusBanner workflow={workflow} />
                )}

                {/* ONGLETS PRÉPARATION / RAPPORT / APPROBATION */}
                <div className="flex gap-2 mb-6 border-b-2 border-slate-300 dark:border-slate-700 pb-2">
                  <button
                    onClick={() => setActiveTab('prep')}
                    className={`min-w-[180px] px-6 py-3 text-base font-extrabold uppercase tracking-wider rounded-t-lg focus:outline-none transition-all duration-200
                      ${activeTab === 'prep'
                        ? 'text-indigo-600 dark:text-indigo-300 border-b-4 border-indigo-500 bg-white dark:bg-slate-900 shadow-lg'
                        : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 bg-transparent'}
                    `}
                  >
                    PRÉPARATION
                  </button>
                  <button
                    onClick={() => setActiveTab('report')}
                    className={`min-w-[220px] px-6 py-3 text-base font-extrabold uppercase tracking-wider rounded-t-lg focus:outline-none transition-all duration-200
                      ${activeTab === 'report'
                        ? 'text-emerald-600 dark:text-emerald-300 border-b-4 border-emerald-500 bg-white dark:bg-slate-900 shadow-lg'
                        : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 bg-transparent'}
                    `}
                  >
                    RAPPORT POST-MISSION
                  </button>
                  <button
                    onClick={() => setActiveTab('approval')}
                    className={`min-w-[180px] px-6 py-3 text-base font-extrabold uppercase tracking-wider rounded-t-lg focus:outline-none transition-all duration-200
                      ${activeTab === 'approval'
                        ? 'text-amber-600 dark:text-amber-300 border-b-4 border-amber-500 bg-white dark:bg-slate-900 shadow-lg'
                        : 'text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 bg-transparent'}
                    `}
                  >
                    APPROBATION
                  </button>
                </div>

                {/* CONTENU SELON L'ONGLET */}
                {activeTab === 'prep' && (
                  <>
                <MissionInfoSection
                  formData={state.formData}
                  isReadOnly={state.isCertified || state.isSubmitted}
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
                  isReadOnly={state.isCertified || state.isSubmitted}
                  onUpdateMember={handleMemberUpdate}
                  onRemoveMember={handleRemoveMember}
                  onAddMember={handleAddMember}
                  onSyncDuration={() => {}}
                />

                <MissionItineraryEditor
                  planning={state.formData.planning || []}
                  isReadOnly={state.isCertified || state.isSubmitted}
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
                    <div className="glass-card !p-6">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
                        Rapport Post-Mission
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Observations générales
                          </label>
                          <textarea
                            value={state.formData.reportObservations || ''}
                            onChange={(e) => missionState.updateFormField('reportObservations', e.target.value)}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            placeholder="Saisissez les observations et conclusions de la mission..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Rapports journaliers
                          </label>
                          {(state.formData.reportDays || []).map((day: any, idx: number) => (
                            <div key={idx} className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Jour {idx + 1}</span>
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
                                  {(day.photos || []).map((photo: import('./mission/core/missionTypes').MissionPhoto, pidx: number) => (
                                    <div key={photo.id || pidx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center">
                                      <img
                                        src={photo.data}
                                        alt={`Photo ${pidx + 1}`}
                                        className="object-cover w-full h-2/3"
                                      />
                                      <input
                                        type="text"
                                        value={photo.comment || ''}
                                        onChange={e => {
                                          const days = [...(state.formData.reportDays || [])];
                                          const photos = [...(days[idx].photos || [])];
                                          photos[pidx] = { ...photos[pidx], comment: e.target.value };
                                          days[idx].photos = photos as import('./mission/core/missionTypes').MissionPhoto[];
                                          missionState.updateFormField('reportDays', days);
                                        }}
                                        placeholder="Commentaire..."
                                        className="w-full px-1 py-0.5 text-[10px] rounded-b bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        style={{ minHeight: 18, maxHeight: 28 }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const days = [...(state.formData.reportDays || [])];
                                          days[idx].photos = (days[idx].photos || []).filter((_: unknown, i: number) => i !== pidx);
                                          missionState.updateFormField('reportDays', days);
                                        }}
                                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 text-xs"
                                        title="Supprimer la photo"
                                      >✕</button>
                                    </div>
                                  ))}
                                  {/* Bouton ajout photo */}
                                  <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-indigo-400 dark:border-indigo-700 rounded-lg cursor-pointer hover:border-indigo-600 bg-white dark:bg-slate-800 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    <span className="text-[10px] font-bold">Photo</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files && e.target.files[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          const days = [...(state.formData.reportDays || [])];
                                          const photoObj = {
                                            id: crypto.randomUUID(),
                                            data: ev.target.result,
                                            comment: '',
                                            timestamp: new Date().toISOString(),
                                          };
                                          missionState.updateFormField('reportDays', days);
                                        };
                                        reader.readAsDataURL(file);
                                        // Reset input pour permettre de reprendre une photo
                                        e.target.value = '';
                                      }}
                                    />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files && e.target.files[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev: ProgressEvent<FileReader>) => {
                                          const result = ev.target?.result;
                                          if (typeof result === 'string' && result) {
                                            const days = [...(state.formData.reportDays || [])];
                                            const photoObj = {
                                              id: crypto.randomUUID(),
                                              data: result as string,
                                              comment: '',
                                              timestamp: new Date().toISOString(),
                                            } as import('./mission/core/missionTypes').MissionPhoto;
                                            days[idx].photos = ([...(days[idx].photos || []), photoObj] as import('./mission/core/missionTypes').MissionPhoto[]);
                                            missionState.updateFormField('reportDays', days);
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                        // Reset input pour permettre de reprendre une photo
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const days = [...(state.formData.reportDays || []), { date: new Date().toISOString().split('T')[0], notes: '' }];
                              missionState.updateFormField('reportDays', days);
                            }}
                            className="mt-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                          >
                            + Ajouter un jour
                          </button>
                        </div>

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
                    <div className="glass-card !p-6">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-2 h-8 bg-indigo-500 rounded-full"></span>
                        Archivage & Rapports
                      </h3>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Sélectionner une mission
                        </label>
                        <select
                          value={selectedArchiveMission || ''}
                          onChange={(e) => setSelectedArchiveMission(e.target.value || null)}
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
                              const dateStr = missionDate ? new Date(missionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date non définie';
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
                        {/* Rapport Word Post-Mission */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <span className="text-xl">📄</span>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Rapport Post-Mission (Word)</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Généré le {new Date().toLocaleDateString('fr-FR')}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleExportReportWord}
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
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Ordre de Mission</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Document officiel</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleExportWord}
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
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Rapport PDF</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Version imprimable</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleExportPDF}
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
                        <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${state.isCertified || state.isSubmitted ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                            <div>
                              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
                                {state.isCertified || state.isSubmitted ? 'Mission Certifiée & Archivée' : 'En attente de certification'}
                              </p>
                              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                                {state.isCertified || state.isSubmitted 
                                  ? `Archivé le ${new Date().toLocaleDateString('fr-FR')}` 
                                  : 'Finalisez le rapport et certifiez la mission pour archiver'}
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

              {/* WIDGETS : COL-4 (interne) */}
              <div className="xl:col-span-4 space-y-8">
                <MissionBudgetPanel
                  totalFrais={totalFrais}
                  projectBudget={projectBudget}
                  members={state.members}
                />
              <WidgetErrorBoundary title="Indicateurs de Statut">
                <MissionStatusWidget
                  data={state.formData}
                  members={state.members}
                  isCertified={!!state.isCertified || workflow?.overallStatus === 'approved'}
                  isSubmitted={!!state.isSubmitted || (workflow ? (workflow.currentStep || 0) > 1 : false)}
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
          </div>
        </div>
      </ContentArea>

      {showNotifications && (
        <MissionNotificationCenter
          onClose={() => setShowNotifications(false)}
          projectId={activeProjectId || undefined}
        />
      )}

      {/* MODAL SIGNATURE DG */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 ring-4 ring-white dark:ring-slate-900 shadow-inner">
                <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                Signature Officielle
              </h3>
              <p className="text-sm font-medium text-slate-500 mb-8 max-w-[280px]">
                Veuillez saisir votre code PIN de Directeur Général pour certifier et générer cet
                ordre de mission.
              </p>

              <div className="w-full relative mb-8">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="• • • •"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center text-3xl tracking-[1em] font-black text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all font-mono"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmCertification}
                  disabled={pinCode.length < 4}
                  className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
                >
                  Certifier & Signer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
