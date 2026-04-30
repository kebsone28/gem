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

import { KoboSettingsSection } from '../components/KoboSettingsSection';
import { DataSection } from '../components/DataSection';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import {
  LOCAL_DEPLOY_AGENT_URL,
  probeLocalDeployAgent,
  triggerLocalDeploy,
} from '../services/localDeployAgent';
import { computeTheoreticalNeeds, getAvailablePlanningRegions } from '../services/planningDomain';
import { exportProjectConfig, importProjectConfig } from '../services/configExportService';
import TeamsTab from './settings/TeamsTab';
import CostsTab from './settings/CostsTab';
import RegionsTab from './settings/RegionsTab';

// Helper stable id generator (defined outside components to avoid impure calls during render)
const makeId = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const normalizeGeoKey = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const AUTO_TEAM_BLUEPRINTS = [
  { needKey: 'livraison', tradeKey: 'livraison', role: 'LOGISTICS', label: 'Logistique' },
  { needKey: 'macons', tradeKey: 'macons', role: 'INSTALLATION', label: 'Maçonnerie' },
  { needKey: 'reseau', tradeKey: 'reseau', role: 'INSTALLATION', label: 'Réseau' },
  {
    needKey: 'interieur',
    tradeKey: 'interieur_type1',
    role: 'INSTALLATION',
    label: 'Installations intérieures',
  },
  { needKey: 'controle', tradeKey: 'controle', role: 'SUPERVISION', label: 'Contrôle' },
] as const;

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
  | 'kobo'
  | 'data'
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
  const {
    households,
    isLoading: isHouseholdsLoading,
    error: householdsError,
  } = useTerrainData();
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
                    await exportProjectConfig(project);
                  } catch (err: any) {
                    toast.error(err.message || 'Erreur lors de l\'exportation');
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
                      const result = await importProjectConfig(file, project?.config);
                      if (result.success) {
                        await updateProject({ config: result.newConfig });
                        toast.success('✅ Configuration importée ! Rechargez la page pour voir les changements.');
                      }
                    } catch (err: any) {
                      toast.error('❌ Erreur import: ' + (err?.message || 'Format invalide'));
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
                  {activeTab === 'teams' && (
                    <TeamsTab
                      project={project}
                      households={households}
                      householdsError={householdsError}
                    />
                  )}
                  {activeTab === 'costs' && (
                    <CostsTab project={project} onUpdate={updateProject} />
                  )}
                  {activeTab === 'regions' && (
                    <RegionsTab
                      project={project}
                      households={households || []}
                      onUpdate={updateProject}
                    />
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
