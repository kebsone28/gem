import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../contexts/AuthContext';
import * as safeStorage from '../utils/safeStorage';
import { ClipboardList, MapPin, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Services & Store
import { generateMissionOrderPDF } from '../services/missionOrderGenerator';
import { generateMissionOrderWord } from '../services/missionOrderWordGenerator';
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

  // DB Queries
  const savedMissions = useLiveQuery(() => db.missions.toArray(), []) || [];

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

  // Sauvegarder l'ID de la mission active
  useEffect(() => {
    if (state.currentMissionId) {
      safeStorage.setItem('last_viewed_mission_id', state.currentMissionId);
      fetchWorkflow();
    }
  }, [state.currentMissionId, fetchWorkflow]);

  // Handlers
  const handleNewMission = () => {
    const orderNumber = `TEMP-${Date.now().toString().slice(-6)}`;
    const date = new Date().toLocaleDateString('fr-FR');
    missionState.resetMission(orderNumber, date, DEFAULT_PLANNING_STEPS, user?.email, user?.id);
    missionState.addAuditEntry('Nouvelle mission créée (Brouillon)', user?.name || 'Utilisateur');
  };

  const handleLoadMission = (m: any) => {
    missionState.loadMission(m.id, m, m.members || [], m.version, m.updatedAt, m.auditTrail);
  };

  const handleDuplicate = async () => {
    if (!state.currentMissionId) return;
    const newId = `temp-${crypto.randomUUID()}`;
    const newOrderNumber = `${state.formData.orderNumber || 'MISSION'}-COPY`;

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
    const orderNumber = `TEMP-${Date.now().toString().slice(-6)}`;
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

  // Main Render
  if (state.isSimplifiedMode) {
    return (
      <MissionSimplifiedMode
        missionData={state.formData as MissionOrderData}
        members={state.members}
        onBack={() => missionState.setSimplifiedMode(false)}
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
              </div>

              {/* WIDGETS : COL-4 (interne) */}
              <div className="xl:col-span-4 space-y-8">
                <MissionBudgetPanel
                  totalFrais={totalFrais}
                  projectBudget={projectBudget}
                  members={state.members}
                />
                <MissionStatusWidget
                  data={state.formData}
                  members={state.members}
                  isCertified={state.isCertified}
                  isSubmitted={state.isSubmitted}
                  isSyncing={state.isSyncingServer}
                  lastSync={state.lastSavedAt || 'Jamais'}
                  version={state.version}
                  isDirty={missionState.isDirty}
                  healthScore={healthScore}
                  healthStatus={healthStatus}
                  budgetVariance={budgetVariance}
                />
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
