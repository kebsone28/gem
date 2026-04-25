/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Users,
  DollarSign,
  Layers,
  Trash2,
  Settings as SettingsIcon,
  Wrench,
  MapPin,
  Zap,
  ChevronRight,
  CloudDownload,
  FileSpreadsheet,
  Database,
  Download,
  Upload,
  Terminal,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import type { CatalogItem, SubTeamEquipment } from '../utils/types';
import logger from '../utils/logger';
import { useTeams } from '../hooks/useTeams';
import { StatusBadge } from '../components/dashboards/DashboardComponents';
import { useTerrainData } from '../hooks/useTerrainData';
import { useAuth } from '../contexts/AuthContext';

import { FinancesSection } from '../components/finances/FinancesSection';
import { KoboSettingsSection } from '../components/KoboSettingsSection';
import { DataSection } from '../components/DataSection';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import {
  LOCAL_DEPLOY_AGENT_URL,
  probeLocalDeployAgent,
  triggerLocalDeploy,
} from '../services/localDeployAgent';

// Helper stable id generator (defined outside components to avoid impure calls during render)
const makeId = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ─── TYPE DEFINITIONS ───────────────────────────────────────────────────
type ProjectConfig = Record<string, unknown> & {
  financials?: Record<string, unknown> & {
    devisItems?: Array<Record<string, unknown>>;
    realCosts?: Record<string, Record<string, number>>;
    plannedCosts?: Record<string, Record<string, number>>;
  };
  costs?: Record<string, unknown> & {
    staffRates?: Record<string, Record<string, unknown>>;
  };
  materialCatalog?: Array<Record<string, unknown>>;
  productionRates?: Record<string, number>;
};

type ProjectData = Record<string, unknown> & {
  config?: ProjectConfig;
};

type TabType =
  | 'teams'
  | 'costs'
  | 'regions'
  | 'logistics'
  | 'kobo'
  | 'data'
  | 'finances'
  | 'system';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('teams');
  const [isDeploying, setIsDeploying] = useState(false);
  const [localAgentState, setLocalAgentState] = useState<{
    checked: boolean;
    ok: boolean;
    busy: boolean;
  }>({
    checked: false,
    ok: false,
    busy: false,
  });
  const { project, updateProject, isLoading: isProjectLoading } = useProject();
  const { households, isLoading: isHouseholdsLoading } = useTerrainData();
  const { user } = useAuth();

  // Cast project config once at the top for type safety
  const cfg = ((project?.config || {}) as ProjectConfig) || ({} as ProjectConfig);
  const canRunDbMaintenance = user?.email === 'admingem';
  const canAccessAdminOnlyTabs =
    user?.email === 'admingem' || user?.role === 'ADMIN_PROQUELEC';


  const isLoading = isProjectLoading || isHouseholdsLoading;

  useEffect(() => {
    if (!canAccessAdminOnlyTabs && ['kobo', 'data', 'system'].includes(activeTab)) {
      setActiveTab('teams');
    }
  }, [activeTab, canAccessAdminOnlyTabs]);

  useEffect(() => {
    if (activeTab !== 'system') return;

    let isMounted = true;

    const refreshAgentState = async () => {
      const health = await probeLocalDeployAgent();
      if (!isMounted) return;

      setLocalAgentState({
        checked: true,
        ok: !!health?.ok,
        busy: !!health?.busy,
      });
    };

    void refreshAgentState();
    const intervalId = window.setInterval(() => {
      void refreshAgentState();
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [activeTab]);

  const handleDeployNow = async () => {
    if (isDeploying) return;

    setIsDeploying(true);
    try {
      const localAgent = await probeLocalDeployAgent();
      setLocalAgentState({
        checked: true,
        ok: !!localAgent?.ok,
        busy: !!localAgent?.busy,
      });

      if (localAgent?.ok) {
        if (localAgent?.busy) {
          toast('Agent local déjà occupé. Attendez la fin du déploiement en cours.', {
            icon: '⏳',
            style: { background: '#1e293b', color: '#fff' },
          });
          return;
        }

        const commitMessage = window.prompt(
          "Message de commit pour le déploiement local",
          "Deploy update"
        );
        if (commitMessage === null) {
          return;
        }

        if (
          !window.confirm(
            "🚀 Lancer le mode local complet ?\n\nCette action va faire commit + push + déploiement VPS depuis cette machine."
          )
        ) {
          return;
        }

        toast.loading('Agent local détecté: commit + push + déploiement en cours...', {
          id: 'deploy-progress',
        });

        const result = await triggerLocalDeploy(commitMessage.trim());
        toast.success(
          result.stdout?.includes('Deployment sequence completed.')
            ? 'Déploiement local complet terminé.'
            : 'Déploiement local terminé.',
          { id: 'deploy-progress', duration: 5000 }
        );
        return;
      }

      const continueWithFallback = window.confirm(
        "⚠️ Agent local introuvable.\n\nPour activer le mode complet sur ce poste, lancez d'abord :\n\nnpm run agent:deploy\n\nCliquez sur OK pour continuer en mode fallback GitHub seulement, ou Annuler pour interrompre."
      );
      if (!continueWithFallback) {
        toast('Rappel: lancez `npm run agent:deploy`, puis recliquez sur le bouton.', {
          icon: '💡',
          style: { background: '#1e293b', color: '#fff' },
        });
        return;
      }

      const hasPushed = window.confirm(
        "Le mode fallback ne déploie que le code déjà poussé sur GitHub.\n\nAvez-vous bien fait un Git Push de vos dernières modifications ?"
      );
      if (!hasPushed) {
        toast('🛑 Veuillez faire `git push origin main` ou lancer `npm run agent:deploy` avant de déployer.', {
          style: { background: '#333', color: '#fff' },
        });
        return;
      }

      if (
        window.confirm(
          "🚀 Lancer la mise à jour complète du serveur ?\n\nCette action va synchroniser le serveur avec GitHub et reconstruire l'application en arrière-plan."
        )
      ) {
        const res = await apiClient.post('/projects/system/deploy');
        toast.success(res.data.message || 'Le déploiement serveur a été lancé !');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Erreur lors du déploiement');
    } finally {
      toast.dismiss('deploy-progress');
      setIsDeploying(false);
    }
  };

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Initialisation des paramètres...
          </p>
        </div>
      </div>
    );

  const localAgentStartCommand = 'npm run agent:deploy';
  const localAgentStatusLabel = !localAgentState.checked
    ? 'Détection de l’agent local...'
    : localAgentState.ok
      ? localAgentState.busy
        ? 'Agent local actif, déploiement déjà en cours'
        : 'Agent local disponible sur ce poste'
      : 'Agent local non détecté sur ce poste';
  const deployButtonLabel = isDeploying
    ? 'DÉPLOIEMENT EN COURS...'
    : localAgentState.ok
      ? localAgentState.busy
        ? 'AGENT LOCAL OCCUPÉ'
        : 'COMMIT + PUSH + DÉPLOYER'
      : 'DÉPLOYER DEPUIS GITHUB';

  const tabs = [
    { id: 'teams', label: 'Équipes', icon: Users },
    { id: 'costs', label: 'Tarifs', icon: DollarSign },
    { id: 'regions', label: 'Régions & Affectations', icon: Layers },
    { id: 'logistics', label: 'Dotations Standard', icon: Wrench },
    { id: 'finances', label: 'Devis & Finances', icon: FileSpreadsheet },
    ...(canAccessAdminOnlyTabs
      ? [
          { id: 'kobo', label: 'KoBo', icon: CloudDownload },
          { id: 'data', label: 'Données', icon: Database },
          { id: 'system', label: 'Système', icon: Server },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-950 py-4 sm:py-8 transition-all duration-500">
      <div>{/* PageHeader removed - not used */}</div>
      <div className="space-y-6 sm:space-y-10 p-4 sm:p-8 bg-slate-950 border-white/5">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-10">
          {/* ── HEADER ── */}
          <header className="sticky top-2 z-20 -mx-1 rounded-[1.6rem] border border-white/10 bg-slate-950/92 px-4 py-4 shadow-[0_18px_45px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:mx-0 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 shrink-0">
                <SettingsIcon size={24} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-none text-white">
                    Configuration <span className="text-blue-500">| {project?.name}</span>
                  </h1>
                  <StatusBadge status="info" label="Projet actif" />
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.08em] sm:tracking-[0.2em] leading-none">
                  Gestion des paramètres et déploiement du projet
                </p>
              </div>
            </div>

            <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                onClick={async () => {
                  try {
                    const { utils, writeFile } = await import('xlsx');
                    const wb = utils.book_new();
                    const cfg = project?.config || {};
                    const devisItems = (cfg.financials as any)?.devisItems ?? [];
                    utils.book_append_sheet(
                      wb,
                      utils.json_to_sheet(
                        devisItems.map((i: any) => ({
                          ID: i.id,
                          Poste_de_Depense: i.label,
                          Region: i.region,
                          Prevision_Qte: i.qty,
                          Prevision_PU: i.unit,
                        }))
                      ),
                      'Devis Items'
                    );
                    const staffRows: any[] = [];
                    Object.entries((cfg.costs as any)?.staffRates || {}).forEach(
                      ([rid, teams]: [string, any]) => {
                        Object.entries(teams).forEach(([tid, rate]: [string, any]) => {
                          staffRows.push({
                            Region_ID: rid,
                            Team_ID: tid,
                            Montant: (rate as any).amount,
                            Mode: (rate as any).mode,
                          });
                        });
                      }
                    );
                    utils.book_append_sheet(
                      wb,
                      utils.json_to_sheet(staffRows.length ? staffRows : [{ info: 'Aucun tarif' }]),
                      'Tarifs Equipes'
                    );
                    utils.book_append_sheet(
                      wb,
                      utils.json_to_sheet(
                        ((cfg as any).materialCatalog || []).length
                          ? (cfg as any).materialCatalog
                          : [{ info: 'Catalogue vide' }]
                      ),
                      'Catalogue Materiel'
                    );
                    const rates = Object.entries((cfg as any).productionRates || {}).map(
                      ([k, v]) => ({ Metier: k, Cadence_F_Jour: v })
                    );
                    utils.book_append_sheet(
                      wb,
                      utils.json_to_sheet(rates.length ? rates : [{ info: 'Aucune cadence' }]),
                      'Cadences Production'
                    );
                    // Onglet Coûts Prévisionnels
                    const plannedRows = Object.entries(
                      (cfg as any)?.financials?.plannedCosts || {}
                    ).map(([id, v]: [string, any]) => ({
                      ID: id,
                      Prevision_Qte: v.qty ?? '',
                      Prevision_PU: v.unit ?? '',
                    }));
                    utils.book_append_sheet(
                      wb,
                      utils.json_to_sheet(
                        plannedRows.length ? plannedRows : [{ info: 'Aucune donnée' }]
                      ),
                      'Couts_Previsionnels'
                    );
                    // Onglet Coûts Réels
                    const realRows = Object.entries((cfg as any)?.financials?.realCosts || {}).map(
                      ([id, v]: [string, any]) => ({
                        ID: id,
                        Reel_Qte: v.qty ?? '',
                        Reel_PU: v.unit ?? '',
                      })
                    );
                    utils.book_append_sheet(
                      wb,
                      utils.json_to_sheet(realRows.length ? realRows : [{ info: 'Aucune donnée' }]),
                      'Couts_Reels'
                    );
                    writeFile(wb, `config_projet_${project?.name || 'export'}.xlsx`);
                  } catch (err) {
                    alert('Erreur export configuration.');
                  }
                }}
                className="w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] sm:text-xs rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-[0.08em]"
              >
                <Download size={15} />
                EXPORTER CONFIG
              </button>

              <label className="w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black text-[10px] sm:text-xs rounded-xl transition-all cursor-pointer active:scale-95 uppercase tracking-[0.08em]">
                <Upload size={15} />
                IMPORTER CONFIG
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const { read, utils } = await import('xlsx');
                      const wb = read(await file.arrayBuffer(), { type: 'array' });
                      const newConfig = { ...(project?.config || {}) };
                      if (wb.SheetNames.includes('Devis Items')) {
                        const data: any[] = utils.sheet_to_json(wb.Sheets['Devis Items']);
                        if (!newConfig.financials) (newConfig as any).financials = {};
                        (newConfig as any).financials.devisItems = data.map((row: any) => ({
                          id: row.ID || `import_${Date.now()}`,
                          label: row.Poste_de_Depense || 'Sans nom',
                          region: row.Region || 'Global',
                          qty: Number(row.Prevision_Qte || 1),
                          unit: Number(row.Prevision_PU || 0),
                        }));
                      }
                      if (wb.SheetNames.includes('Catalogue Materiel')) {
                        const data: any[] = utils.sheet_to_json(wb.Sheets['Catalogue Materiel']);
                        if (data.length > 0 && !data[0]?.info)
                          (newConfig as any).materialCatalog = data;
                      }
                      if (wb.SheetNames.includes('Cadences Production')) {
                        const data: any[] = utils.sheet_to_json(wb.Sheets['Cadences Production']);
                        const rates: any = {};
                        data.forEach((r: any) => {
                          if (r.Metier && !r.info) rates[r.Metier] = Number(r.Cadence_F_Jour || 5);
                        });
                        if (Object.keys(rates).length > 0)
                          (newConfig as any).productionRates = rates;
                      }
                      await updateProject({ config: newConfig });
                      alert(
                        '✅ Configuration importée ! Rechargez la page pour voir les changements.'
                      );
                    } catch (err: any) {
                      alert('❌ Erreur import: ' + (err?.message || 'Format invalide'));
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </header>

          {/* ── TABS NAVIGATION ── */}

          <div
            className="sticky top-[7.25rem] sm:top-[6.5rem] z-10 flex gap-2 p-1.5 bg-slate-950/92 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar shadow-sm backdrop-blur-xl"
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                {...{ 'aria-selected': activeTab === tab.id }}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2.5 px-4 sm:px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap group ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon
                  size={16}
                  className={`${activeTab === tab.id ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`}
                />
                <span className="font-black text-[10px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── TAB CONTENT ── */}
          <main>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3, ease: 'circOut' }}
                className="bg-white/5 rounded-[1.6rem] sm:rounded-[2.5rem] border border-white/5 p-4 sm:p-8 md:p-12 relative overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />

                <div className="relative z-10">
                  {activeTab === 'teams' && <TeamsSection project={project} />}
                  {activeTab === 'costs' && (
                    <CostsSection project={project} onUpdate={updateProject} />
                  )}
                  {activeTab === 'regions' && (
                    <RegionsSection
                      project={project}
                      households={households || []}
                      onUpdate={updateProject}
                    />
                  )}
                  {activeTab === 'logistics' && (
                    <LogisticsSection project={project} onUpdate={updateProject} />
                  )}
                  {activeTab === 'finances' && (
                    <FinancesSection project={project} onUpdate={updateProject} />
                  )}
                  {canAccessAdminOnlyTabs && activeTab === 'kobo' && (
                    <KoboSettingsSection project={project} onUpdate={updateProject} />
                  )}
                  {canAccessAdminOnlyTabs && activeTab === 'data' && (
                    <DataSection
                      project={project}
                      households={households || []}
                      onUpdate={updateProject}
                    />
                  )}
                  {canAccessAdminOnlyTabs && activeTab === 'system' && (
                    <div className="space-y-6 sm:space-y-8">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                          <Terminal className="text-blue-500" /> Maintenance Système
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div className="bg-slate-900/50 p-4 sm:p-8 rounded-[1.6rem] sm:rounded-3xl border border-white/5 space-y-4">
                          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                            <RefreshCw size={24} />
                          </div>
                          <h3 className="text-white font-black uppercase text-[11px] sm:text-sm tracking-[0.08em] sm:tracking-widest">
                            Mise à jour du serveur
                          </h3>
                          <p className="text-xs text-slate-400 font-bold leading-relaxed">
                            Si un agent local est disponible sur ce poste, ce bouton lance
                            commit + push + déploiement VPS. Sinon, il déploie seulement la
                            dernière version déjà poussée sur GitHub.
                          </p>
                          <div
                            className={`rounded-2xl border px-4 py-3 ${
                              localAgentState.ok
                                ? 'border-emerald-500/20 bg-emerald-500/10'
                                : 'border-amber-500/20 bg-amber-500/10'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 ${localAgentState.ok ? 'text-emerald-400' : 'text-amber-400'}`}
                              >
                                {localAgentState.ok ? (
                                  <CheckCircle2 size={18} />
                                ) : (
                                  <AlertTriangle size={18} />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-white">
                                  {localAgentStatusLabel}
                                </p>
                                {!localAgentState.ok && (
                                  <>
                                    <p className="text-xs font-bold leading-relaxed text-slate-300">
                                      Pour activer le mode complet sur cette machine, lancez
                                      d&apos;abord l&apos;agent local dans un terminal ouvert sur ce dépôt.
                                    </p>
                                    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                                      <code className="break-all text-[11px] font-black text-cyan-300">
                                        {localAgentStartCommand}
                                      </code>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(localAgentStartCommand);
                                            toast.success('Commande copiée');
                                          } catch {
                                            toast.error('Copie impossible sur ce navigateur');
                                          }
                                        }}
                                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-white/10"
                                      >
                                        <Copy size={14} />
                                        Copier
                                      </button>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-500">
                                      Endpoint attendu: {LOCAL_DEPLOY_AGENT_URL}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={handleDeployNow}
                            disabled={isDeploying || localAgentState.busy}
                            className="w-full min-h-[48px] py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-300 text-white font-black uppercase text-[10px] sm:text-xs tracking-[0.08em] sm:tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-blue-500/10 active:scale-95 disabled:cursor-not-allowed disabled:shadow-none"
                          >
                            {deployButtonLabel}
                          </button>
                        </div>

                        {canRunDbMaintenance && (
                          <div className="bg-slate-900/50 p-4 sm:p-8 rounded-[1.6rem] sm:rounded-3xl border border-white/5 space-y-4">
                            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                              <Database size={24} />
                            </div>
                            <h3 className="text-white font-black uppercase text-[11px] sm:text-sm tracking-[0.08em] sm:tracking-widest">
                              Nettoyage Base de Données
                            </h3>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed">
                              Supprime définitivement les éléments dans la corbeille depuis plus de 30
                              jours et optimise les structures de la base PostgreSQL.
                            </p>
                            <button
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    '⚠️ Voulez-vous purger complètement la corbeille de la base de données ?\n\nCette action est irréversible et supprimera les données vieilles de +30 jours.'
                                  )
                                ) {
                                  try {
                                    const res = await apiClient.post(
                                      '/projects/system/db-maintenance'
                                    );
                                    toast.success(res.data.details || 'Maintenance réussie', {
                                      duration: 5000,
                                      style: { background: '#22c55e', color: '#fff' },
                                    });
                                  } catch (err: any) {
                                    toast.error(
                                      err.response?.data?.error || 'Erreur lors de la maintenance'
                                    );
                                  }
                                }
                              }}
                              className="w-full min-h-[48px] py-4 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] sm:text-xs tracking-[0.08em] sm:tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-amber-500/10 active:scale-95"
                            >
                              OPTIMISER LA BASE
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

function TeamsSection({ project }: { project: any }) {
  const {
    teamTree,
    regions,
    grappes,
    createTeam,
    updateTeam,
    deleteTeam,
    fetchTeamTree,
    fetchRegions,
    fetchGrappes,
    isLoading: isTeamsLoading,
  } = useTeams(project?.id);
  const { updateProject } = useProject();
  const productionRates = project?.config?.productionRates || {
    macons: 5,
    reseau: 8,
    interieur_type1: 6,
    controle: 15,
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  useEffect(() => {
    fetchTeamTree();
    fetchRegions();
    fetchGrappes();
  }, [fetchTeamTree, fetchRegions, fetchGrappes, project?.id]);

  const toggleCollapse = (id: string) => {
    setCollapsedTeams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllCollapse = (collapse: boolean) => {
    const newState: Record<string, boolean> = {};
    if (collapse) {
      teamTree.forEach((t: any) => (newState[t.id] = true));
    }
    setCollapsedTeams(newState);
  };
  const filteredTeams = teamTree.filter((t: any) => {
    const matchesName = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubTeams = (t.children || []).some(
      (sub: any) =>
        sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sub.leader?.name && sub.leader.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return matchesName || matchesSubTeams;
  });

  const stats = {
    total: teamTree.reduce((acc: number, t: any) => acc + (t.children || []).length, 0),
    active: teamTree.reduce(
      (acc: number, t: any) =>
        acc + (t.children || []).filter((c: any) => c.status === 'active').length,
      0
    ),
    inactive: teamTree.reduce(
      (acc: number, t: any) =>
        acc + (t.children || []).filter((c: any) => c.status !== 'active').length,
      0
    ),
  };

  const handleUpdateProductionRate = (trade: string, value: number) => {
    updateProject({
      config: {
        ...project.config,
        productionRates: { ...productionRates, [trade]: value },
      },
    });
  };

  const handleAddProductionRate = () => {
    const tradeName = prompt('Entrez le nom du nouveau corps de métier (ex: Peinture, Soudure) :');
    if (!tradeName) return;

    const tradeKey = tradeName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    if (!tradeKey || productionRates[tradeKey]) {
      alert('Nom invalide ou métier déjà existant.');
      return;
    }

    updateProject({
      config: {
        ...project.config,
        productionRates: { ...productionRates, [tradeKey]: 5 },
      },
    });
  };

  const handleDeleteProductionRate = (tradeKey: string) => {
    if (
      !window.confirm(
        "Supprimer ce corps de métier ? Attention, si des équipes y sont affectées, elles n'auront plus de cadence valide."
      )
    )
      return;

    const newRates = { ...productionRates };
    delete newRates[tradeKey];

    updateProject({
      config: {
        ...project.config,
        productionRates: newRates,
      },
    });
  };

  const handleAddTeam = async () => {
    await createTeam({
      name: `Nouveau Groupement ${teamTree.length + 1}`,
      role: 'INSTALLATION',
      capacity: 2,
    });
  };

  const handleAddSubTeam = async (parentId: string, parentRole: string) => {
    await createTeam({
      name: `Équipe de terrain`,
      role: parentRole as any,
      parentTeamId: parentId,
      capacity: 0,
    });
  };

  const handleUpdateTeamField = async (id: string, field: string, value: any) => {
    await updateTeam(id, { [field]: value });
  };

  const handleRemoveTeam = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((prev) => (prev === id ? null : prev)), 3000);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await deleteTeam(id);
      logger.log('✅ Équipe supprimée avec succès');
    } catch (err: any) {
      logger.error('❌ Échec de suppression:', err);
      alert(
        'Erreur lors de la suppression : ' +
          (err?.response?.data?.error || err.message || 'Erreur inconnue')
      );
    }
  };

  const handleResetAllTeams = async () => {
    if (!confirmResetAll) {
      setConfirmResetAll(true);
      setTimeout(() => setConfirmResetAll(false), 5000);
      return;
    }
    setConfirmResetAll(false);
    try {
      // Delete all teams (including children) one by one
      const allIds: string[] = [];
      teamTree.forEach((parent: any) => {
        (parent.children || []).forEach((child: any) => allIds.push(child.id));
        allIds.push(parent.id);
      });
      for (const id of allIds) {
        await deleteTeam(id);
      }
      logger.log(`✅ ${allIds.length} équipe(s) supprimée(s)`);
    } catch (err: any) {
      logger.error('❌ Échec réinitialisation:', err);
      alert('Erreur : ' + (err?.response?.data?.error || err.message || 'Erreur inconnue'));
    }
  };

  if (isTeamsLoading && teamTree.length === 0)
    return <div className="p-8 text-slate-400">Chargement des équipes...</div>;

  return (
    <div className="space-y-8 sm:space-y-12">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-1">
            <Users className="text-blue-500" />
            Gestion des Équipes
          </h2>
          <p className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-[0.08em] sm:tracking-widest">
            Configuration des effectifs et sous-équipes terrain
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl border border-blue-600 dark:border-blue-600">
            <Users size={12} className="text-blue-700 dark:text-blue-400" />
            <span className="text-xs font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight">
              {stats.total} Équipes
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl border border-emerald-600 dark:border-emerald-600">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <span className="text-xs font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-tight">
              {stats.active} Actives
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-3 min-h-[48px] bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 w-full sm:min-w-[240px] transition-all text-white"
            />
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button
            onClick={handleAddTeam}
            className="px-6 py-3 min-h-[48px] bg-blue-600 dark:bg-blue-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-[0.08em] sm:tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/10 hover:brightness-110 active:scale-95"
          >
            + Nouveau Groupement
          </button>
          {teamTree.length > 0 && (
            <button
              id="btn-reset-all-teams"
              onClick={handleResetAllTeams}
              className={`px-5 py-3 min-h-[48px] text-[10px] sm:text-xs font-black uppercase tracking-[0.08em] sm:tracking-widest rounded-xl transition-all active:scale-95 border ${
                confirmResetAll
                  ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-lg shadow-red-600/30'
                  : 'bg-red-900/20 border-red-700/40 text-red-400 hover:bg-red-700/30'
              }`}
            >
              {confirmResetAll ? '⚠️ Confirmer suppression' : '🗑️ Réinitialiser tout'}
            </button>
          )}
        </div>
      </div>

      {/* ── CADENCES DE PRODUCTION ── */}
      <div className="bg-white/5 p-4 sm:p-8 rounded-[1.6rem] sm:rounded-[2rem] border border-white/5 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Zap size={18} className="text-amber-500" />
            <h3 className="text-[11px] sm:text-sm font-black text-white uppercase tracking-[0.08em] sm:tracking-widest">
              Cadence Standard (Foyers / Jour)
            </h3>
          </div>
          <button
            onClick={handleAddProductionRate}
            className="px-4 py-3 min-h-[48px] bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 text-amber-900 dark:text-amber-100 text-[10px] sm:text-xs font-black uppercase tracking-[0.08em] sm:tracking-widest rounded-xl transition-all border border-amber-600 dark:border-amber-600"
          >
            + Ajouter un métier
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(productionRates).map(([tradeKey, rate]) => {
            const labelMap: Record<string, string> = {
              macons: 'Maçonnerie',
              reseau: 'Déploiement Réseau',
              interieur_type1: 'Électriciens',
              controle: 'Contrôle & Visite',
            };
            const displayLabel = labelMap[tradeKey] || tradeKey.replace(/_/g, ' ').toUpperCase();
            const isCoreTrade = ['macons', 'reseau', 'interieur_type1', 'controle'].includes(
              tradeKey
            );

            return (
              <div
                key={tradeKey}
                className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm dark:shadow-none relative group"
              >
                {!isCoreTrade && (
                  <button
                    onClick={() => handleDeleteProductionRate(tradeKey)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Supprimer ce métier"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block truncate pr-5">
                  {displayLabel}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    title={`Cadence ${displayLabel}`}
                    value={rate as number}
                    onChange={(e) =>
                      handleUpdateProductionRate(tradeKey, parseInt(e.target.value) || 1)
                    }
                    className="w-full bg-transparent border-b-2 border-gray-100 dark:border-white/10 py-1 text-xl font-black text-blue-600 focus:border-blue-500 outline-none transition-colors"
                  />
                  <span className="text-xs font-bold text-gray-400">f/j</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {filteredTeams.map((team: any) => {
          const isCollapsed = collapsedTeams[team.id];
          return (
            <div
              key={team.id}
              className="bg-white/5 p-4 sm:p-5 rounded-[1.5rem] border border-white/10 group hover:border-blue-500/50 transition-all relative overflow-hidden self-start"
            >
              <div className="absolute top-0 left-0 w-1 y-full bg-blue-500" />
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={() => handleRemoveTeam(team.id)}
                  title="Supprimer le groupement"
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                    Groupement / Entreprise
                  </label>
                  <input
                    value={team.name}
                    title="Nom du groupement"
                    placeholder="Nom de l'entreprise"
                    onChange={(e) => handleUpdateTeamField(team.id, 'name', e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-white font-bold text-sm outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Métier
                    </label>
                    <select
                      value={team.tradeKey || ''}
                      title="Sélectionner le métier"
                      onChange={(e) => handleUpdateTeamField(team.id, 'tradeKey', e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none"
                    >
                      <option value="">Métier...</option>
                      {Object.keys(productionRates).map((tk) => (
                        <option key={tk} value={tk}>
                          {tk.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Région
                    </label>
                    <select
                      value={team.regionId || ''}
                      title="Sélectionner la région d'affectation"
                      onChange={(e) => handleUpdateTeamField(team.id, 'regionId', e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none"
                    >
                      <option value="">Région...</option>
                      {regions.map((reg: any) => (
                        <option key={reg.id} value={reg.id}>
                          {reg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-blue-500 uppercase tracking-widest block">
                      Sous-Équipes terrain
                    </label>
                    <button
                      onClick={() => handleAddSubTeam(team.id, team.role)}
                      className="text-[10px] bg-blue-600 text-white px-3 py-2 rounded-lg font-black uppercase tracking-[0.08em] sm:tracking-widest"
                    >
                      + Ajouter
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {(team.children || []).map((sub: any) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 bg-slate-950/50 p-3 rounded-xl border border-white/5"
                      >
                        <input
                          value={sub.name}
                          title="Nom de la sous-équipe"
                          placeholder="Equipe Terrain"
                          onChange={(e) => handleUpdateTeamField(sub.id, 'name', e.target.value)}
                          className="flex-1 bg-transparent border-none p-0 text-white font-bold text-xs outline-none"
                        />
                        <button
                          onClick={() => handleRemoveTeam(sub.id)}
                          title="Supprimer la sous-équipe"
                          className="text-slate-500 hover:text-red-500"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CostsSection({ project, onUpdate }: { project: any; onUpdate: any }) {
  const { regions, fetchRegions, teams, fetchTeams } = useTeams(project?.id);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const costs = project?.config?.costs || {};
  const staffRates = costs.staffRates || {};
  const vehicleRental = costs.vehicleRental || {};

  useEffect(() => {
    fetchRegions();
    fetchTeams();
  }, [fetchRegions, fetchTeams]);

  useEffect(() => {
    if (regions.length > 0 && !selectedRegionId) {
      const t = window.setTimeout(() => setSelectedRegionId(regions[0].id), 0);
      return () => clearTimeout(t);
    }
  }, [regions, selectedRegionId]);

  const materialCatalog: CatalogItem[] = project?.config?.materialCatalog || [];

  const handleUpdateRate = (
    category: 'staffRates' | 'vehicleRental',
    key: string,
    field: string,
    value: any
  ) => {
    const newCategory = { ...(costs[category] || {}) };
    if (category === 'staffRates') {
      if (!selectedRegionId) return;
      if (!newCategory[selectedRegionId]) newCategory[selectedRegionId] = {};
      if (!newCategory[selectedRegionId][key])
        newCategory[selectedRegionId][key] = { amount: 0, mode: 'daily' };
      newCategory[selectedRegionId][key] = {
        ...newCategory[selectedRegionId][key],
        [field]: value,
      };
    } else {
      newCategory[key] = value;
    }

    onUpdate({
      config: {
        ...project.config,
        costs: { ...costs, [category]: newCategory },
      },
    });
  };

  const handleAddCatalogItem = () => {
    const newItem: CatalogItem = {
      id: `item_${Date.now()}`,
      name: 'Nouveau Matériel',
      category: 'Autre',
      purchasePrice: 0,
      rentalPrice: 0,
    };
    onUpdate({ config: { ...project.config, materialCatalog: [...materialCatalog, newItem] } });
  };

  const handleUpdateCatalogItem = (id: string, field: keyof CatalogItem, value: any) => {
    const newCatalog = materialCatalog.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onUpdate({ config: { ...project.config, materialCatalog: newCatalog } });
  };

  const handleDeleteCatalogItem = (id: string) => {
    onUpdate({
      config: {
        ...project.config,
        materialCatalog: materialCatalog.filter((item) => item.id !== id),
      },
    });
  };

  return (
    <div className="space-y-8 sm:space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight mb-1">
            <DollarSign className="text-emerald-500" />
            Grille Tarifaire
          </h2>
          <p className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-[0.08em] sm:tracking-widest">
            Barèmes de rémunération par région
          </p>
        </div>
        <select
          value={selectedRegionId}
          title="Choisir la région pour les tarifs"
          onChange={(e) => setSelectedRegionId(e.target.value)}
          className="w-full md:w-auto min-h-[48px] bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-black text-white outline-none"
        >
          <option value="">Région...</option>
          {regions.map((reg) => (
            <option key={reg.id} value={reg.id}>
              {reg.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {teams
          .filter((t: any) => !t.parentTeamId)
          .map((team: any) => {
            const regionRates = staffRates[selectedRegionId] || {};
            const rate = regionRates[team.id] || { amount: 0, mode: 'daily' };
            return (
              <div key={team.id} className="bg-white/5 p-4 sm:p-6 rounded-[1.6rem] sm:rounded-[2rem] border border-white/5">
                <h3 className="text-white font-black uppercase text-[11px] sm:text-sm mb-4">{team.name}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">
                      Montant (FCFA)
                    </label>
                    <input
                      type="number"
                      value={rate.amount}
                      title="Montant de la rémunération"
                      onChange={(e) =>
                        handleUpdateRate(
                          'staffRates',
                          team.id,
                          'amount',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white font-black outline-none"
                    />
                  </div>
                  <select
                    value={rate.mode}
                    title="Période de rémunération"
                    onChange={(e) =>
                      handleUpdateRate('staffRates', team.id, 'mode', e.target.value)
                    }
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white text-xs outline-none"
                  >
                    <option value="daily">Journalier</option>
                    <option value="monthly">Mensuel</option>
                    <option value="task">À la tâche</option>
                  </select>
                </div>
              </div>
            );
          })}
      </div>

      <div className="space-y-6 sm:space-y-8 pt-8 border-t border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Wrench className="text-blue-500" /> Catalogue Matériel
          </h3>
          <button
            onClick={handleAddCatalogItem}
            className="px-4 py-3 min-h-[48px] bg-blue-600 text-white text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-[0.08em]"
          >
            + Ajouter
          </button>
        </div>
        <div className="hidden md:block bg-white/5 rounded-2xl border border-white/5 overflow-x-auto">
          <table className="w-full text-left text-xs uppercase font-black">
            <thead className="bg-white/5 text-slate-500 border-b border-white/5">
              <tr>
                <th className="px-6 py-4">Nom</th>
                <th className="px-6 py-4">Prix Achat</th>
                <th className="px-6 py-4">Prix Loc</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {materialCatalog.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <input
                      value={item.name}
                      title="Nom du matériel"
                      placeholder="Article"
                      onChange={(e) => handleUpdateCatalogItem(item.id, 'name', e.target.value)}
                      className="bg-transparent text-white outline-none w-full"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={item.purchasePrice}
                      title="Prix d'achat"
                      placeholder="0"
                      onChange={(e) =>
                        handleUpdateCatalogItem(
                          item.id,
                          'purchasePrice',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="bg-transparent text-white outline-none w-24"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={item.rentalPrice}
                      title="Prix de location"
                      placeholder="0"
                      onChange={(e) =>
                        handleUpdateCatalogItem(
                          item.id,
                          'rentalPrice',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="bg-transparent text-white outline-none w-24"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteCatalogItem(item.id)}
                      title="Supprimer du catalogue"
                    >
                      <Trash2 size={14} className="text-rose-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-3">
          {materialCatalog.map((item) => (
            <div key={item.id} className="bg-white/5 rounded-2xl border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  value={item.name}
                  title="Nom du matériel"
                  placeholder="Article"
                  onChange={(e) => handleUpdateCatalogItem(item.id, 'name', e.target.value)}
                  className="bg-transparent text-white outline-none w-full font-bold text-sm"
                />
                <button
                  onClick={() => handleDeleteCatalogItem(item.id)}
                  title="Supprimer du catalogue"
                  className="p-2"
                >
                  <Trash2 size={14} className="text-rose-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.08em] block mb-1">
                    Prix achat
                  </label>
                  <input
                    type="number"
                    value={item.purchasePrice}
                    title="Prix d'achat"
                    placeholder="0"
                    onChange={(e) =>
                      handleUpdateCatalogItem(item.id, 'purchasePrice', parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-3 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.08em] block mb-1">
                    Prix loc
                  </label>
                  <input
                    type="number"
                    value={item.rentalPrice}
                    title="Prix de location"
                    placeholder="0"
                    onChange={(e) =>
                      handleUpdateCatalogItem(item.id, 'rentalPrice', parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-3 text-white outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegionsSection({
  project,
  households,
  onUpdate,
}: {
  project: any;
  households: any[];
  onUpdate: any;
}) {
  const { grappes, fetchGrappes } = useTeams(project?.id);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Derive unique regions from households
  const autoRegions = Array.from(
    new Set(households.map((h) => h.region).filter(Boolean))
  ) as string[];

  // Maintain team allocations in project config, keyed by region name
  const regionConfigs = project?.config?.regionsConfig || {};

  useEffect(() => {
    fetchGrappes();
  }, [fetchGrappes, project?.id]);

  useEffect(() => {
    if (autoRegions.length > 0 && !selectedRegion) {
      const t = window.setTimeout(() => setSelectedRegion(autoRegions[0]), 0);
      return () => clearTimeout(t);
    }
  }, [autoRegions, selectedRegion]);

  const handleUpdateRegionConfig = (regionName: string, config: any) => {
    onUpdate({
      config: {
        ...project.config,
        regionsConfig: {
          ...regionConfigs,
          [regionName]: config,
        },
      },
    });
  };

  const handleAddAllocation = (regionName: string) => {
    const currentConfig = regionConfigs[regionName] || { teamAllocations: [] };
    const newAllocation = { id: makeId('alloc'), subTeamId: '', priority: 1 };
    handleUpdateRegionConfig(regionName, {
      ...currentConfig,
      teamAllocations: [...(currentConfig.teamAllocations || []), newAllocation],
    });
  };

  const handleUpdateAllocation = (
    regionName: string,
    allocId: string,
    field: string,
    value: any
  ) => {
    const currentConfig = regionConfigs[regionName] || { teamAllocations: [] };
    const newAllocations = currentConfig.teamAllocations.map((a: any) =>
      a.id === allocId ? { ...a, [field]: value } : a
    );
    handleUpdateRegionConfig(regionName, { ...currentConfig, teamAllocations: newAllocations });
  };

  const handleDeleteAllocation = (regionName: string, allocId: string) => {
    const currentConfig = regionConfigs[regionName] || { teamAllocations: [] };
    const newAllocations = currentConfig.teamAllocations.filter((a: any) => a.id !== allocId);
    handleUpdateRegionConfig(regionName, { ...currentConfig, teamAllocations: newAllocations });
  };

  const currentRegionGrappes = grappes.filter((g) => g.region === selectedRegion);
  const currentRegionConfig = selectedRegion
    ? regionConfigs[selectedRegion] || { teamAllocations: [] }
    : { teamAllocations: [] };

  return (
    <div className="space-y-8 sm:space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
          <MapPin className="text-rose-500" />
          Régions & Déploiement
          <StatusBadge status="success" label="AUTO-DETECT" />
        </h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* List of auto-detected regions */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 mb-4">
            Régions détectées dans les données
          </p>
          {autoRegions.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between group ${selectedRegion === region ? 'bg-rose-600 border-rose-600 text-white shadow-xl shadow-rose-600/20' : 'bg-white/5 border-white/10 text-slate-400 hover:border-rose-500/30'}`}
            >
              <div>
                <span className="font-black uppercase text-sm block mb-1">{region}</span>
                <span
                  className={`text-[10px] font-bold uppercase ${selectedRegion === region ? 'text-rose-100' : 'text-slate-500'}`}
                >
                  {grappes.filter((g) => g.region === region).length} Grappes
                </span>
              </div>
              <ChevronRight
                size={18}
                className={`${selectedRegion === region ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all`}
              />
            </button>
          ))}
          {autoRegions.length === 0 && (
            <div className="p-10 bg-white/5 rounded-2xl border border-dashed border-white/10 text-center">
              <p className="text-xs font-bold text-slate-500 uppercase">Aucune donnée de ménage</p>
            </div>
          )}
        </div>

        {/* Region Details & Team Assignments */}
        <div className="lg:col-span-2">
          {selectedRegion ? (
              <div className="space-y-4 sm:space-y-8">
              <div className="bg-white/5 p-4 sm:p-8 rounded-[1.6rem] sm:rounded-[2.5rem] border border-white/5 space-y-6 sm:space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4 sm:pb-6">
                  <h3 className="text-white font-black uppercase text-sm flex items-center gap-3">
                    Grappes associées à {selectedRegion}
                  </h3>
                  <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em] sm:tracking-widest">
                    Mise à jour auto via Village SIG
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                  {currentRegionGrappes.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-white/10"
                    >
                      <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">
                        <Layers size={14} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white uppercase block">
                          {g.nom}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 uppercase">
                          {g.nb_menages} Ménages • {g.village}
                        </span>
                      </div>
                    </div>
                  ))}
                  {currentRegionGrappes.length === 0 && (
                    <div className="col-span-2 py-10 text-center text-slate-500 text-[10px] font-black uppercase tracking-widest italic">
                      Aucune grappe générée pour cette région. <br />
                      Lancez le recalcul spatial dans l'onglet "Données".
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/40 p-4 sm:p-8 rounded-[1.6rem] sm:rounded-[2.5rem] border border-white/5 space-y-6 sm:space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-[11px] sm:text-xs font-black text-rose-500 uppercase tracking-[0.08em] sm:tracking-widest">
                    Unités Terrain Allouées à la Région
                  </h4>
                  <button
                    onClick={() => handleAddAllocation(selectedRegion)}
                    className="px-4 py-3 min-h-[48px] bg-rose-600/10 text-rose-500 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.08em] sm:tracking-[0.2em] hover:bg-rose-600 hover:text-white transition-all"
                  >
                    + Allouer une Unité
                  </button>
                </div>

                <div className="space-y-4">
                  {(currentRegionConfig.teamAllocations || []).map((alloc: any) => (
                    <div
                      key={alloc.id}
                      className="bg-slate-950 p-4 sm:p-6 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4 sm:gap-6 shadow-xl"
                    >
                      <div className="flex-1 min-w-0 sm:min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                          Unité de Travail
                        </label>
                        <select
                          value={alloc.subTeamId}
                          title="Sélectionner l'unité terrain"
                          onChange={(e) =>
                            handleUpdateAllocation(
                              selectedRegion,
                              alloc.id,
                              'subTeamId',
                              e.target.value
                            )
                          }
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-500/50"
                        >
                          <option value="">Sélectionner une unité...</option>
                          {project?.config?.teams
                            ?.flatMap((t: any) =>
                              (t.subTeams || []).map((st: any) => ({ ...st, trade: t.name }))
                            )
                            .map((st: any) => (
                              <option key={st.id} value={st.id}>
                                {st.name} ({st.trade})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-40">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                          Priorité (1-10)
                        </label>
                        <input
                          type="number"
                          value={alloc.priority}
                          title="Niveau de priorité d'affectation"
                          onChange={(e) =>
                            handleUpdateAllocation(
                              selectedRegion,
                              alloc.id,
                              'priority',
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-rose-400 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => handleDeleteAllocation(selectedRegion, alloc.id)}
                        title="Supprimer l'affectation"
                        className="self-end sm:mt-6 p-2 text-slate-600 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {(currentRegionConfig.teamAllocations || []).length === 0 && (
                    <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Aucune équipe affectée à cette région
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8 sm:p-20 bg-white/5 rounded-[1.6rem] sm:rounded-[2.5rem] border border-dashed border-white/10">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MapPin size={24} className="text-slate-600" />
                </div>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
                  Veuillez sélectionner une région
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogisticsSection({ project, onUpdate }: { project: any; onUpdate: any }) {
  const { teams, fetchTeams } = useTeams(project?.id);
  const materialCatalog: CatalogItem[] = project?.config?.materialCatalog || [];
  const allocations = project?.config?.subTeamAllocations || {};

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleUpdateAllocation = (
    subTeamId: string,
    itemId: string,
    field: 'quantity' | 'acquisitionType',
    value: any
  ) => {
    const teamAlloc = allocations[subTeamId] || [];
    const existing = teamAlloc.find((a: any) => a.itemId === itemId);
    let newTeamAlloc = [...teamAlloc];
    if (existing)
      newTeamAlloc = newTeamAlloc.map((a: any) =>
        a.itemId === itemId ? { ...a, [field]: value } : a
      );
    onUpdate({
      config: {
        ...project.config,
        subTeamAllocations: { ...allocations, [subTeamId]: newTeamAlloc },
      },
    });
  };

  const handleAddAllocation = (subTeamId: string, itemId: string) => {
    if (!itemId) return;
    const teamAlloc = allocations[subTeamId] || [];
    if (teamAlloc.find((a: any) => a.itemId === itemId)) return;
    const newAlloc: SubTeamEquipment = {
      id: makeId('alloc'),
      itemId,
      quantity: 1,
      acquisitionType: 'achat',
    };
    onUpdate({
      config: {
        ...project.config,
        subTeamAllocations: { ...allocations, [subTeamId]: [...teamAlloc, newAlloc] },
      },
    });
  };

  const handleRemoveAllocation = (subTeamId: string, itemId: string) => {
    onUpdate({
      config: {
        ...project.config,
        subTeamAllocations: {
          ...allocations,
          [subTeamId]: (allocations[subTeamId] || []).filter((a: any) => a.itemId !== itemId),
        },
      },
    });
  };

  const subTeams = teams.filter((t: any) => t.parentTeamId);

  return (
    <div className="space-y-8 sm:space-y-12">
      <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
        <Wrench className="text-blue-500" /> Dotations Matériel
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:gap-8">
        {subTeams.map((st: any) => (
          <div
            key={st.id}
            className="bg-white/5 p-4 sm:p-8 rounded-[1.6rem] sm:rounded-[2.5rem] border border-white/5 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h3 className="text-white font-black uppercase text-[11px] sm:text-sm">{st.name}</h3>
              <select
                onChange={(e) => handleAddAllocation(st.id, e.target.value)}
                title="Ajouter un article"
                className="w-full sm:w-auto min-h-[48px] bg-slate-950 text-white text-xs p-3 rounded-xl border border-white/10 outline-none"
              >
                <option value="">+ Ajouter Matériel...</option>
                {materialCatalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {(allocations[st.id] || []).map((alloc: any) => {
                const item = materialCatalog.find((c) => c.id === alloc.itemId);
                return (
                  <div
                    key={alloc.id}
                    className="bg-slate-950 p-4 rounded-2xl border border-white/10"
                  >
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] text-white font-bold uppercase">
                        {item?.name || 'Matériel supprimé'}
                      </span>
                      <button
                        onClick={() => handleRemoveAllocation(st.id, alloc.itemId)}
                        title="Supprimer l'article"
                      >
                        <Trash2 size={12} className="text-rose-500" />
                      </button>
                    </div>
                    <input
                      type="number"
                      value={alloc.quantity}
                      title="Modifier la quantité"
                      onChange={(e) =>
                        handleUpdateAllocation(
                          st.id,
                          alloc.itemId,
                          'quantity',
                          parseInt(e.target.value) || 1
                        )
                      }
                      className="w-full bg-transparent text-blue-400 font-black text-lg outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
