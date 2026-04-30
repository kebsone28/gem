import React, { useState, useEffect } from 'react';
import { Users, MapPin, Layers, Zap, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTeams } from '../../hooks/useTeams';
import { useProject } from '../../contexts/ProjectContext';
import { computeTheoreticalNeeds, getAvailablePlanningRegions } from '../../services/planningDomain';
import logger from '../../utils/logger';

// Helpers (Copied from Settings.tsx to avoid circular dependencies during refactoring)
const makeId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const normalizeGeoKey = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const AUTO_TEAM_BLUEPRINTS = [
  { needKey: 'livraison', tradeKey: 'livraison', role: 'LOGISTICS', label: 'Logistique' },
  { needKey: 'macons', tradeKey: 'macons', role: 'INSTALLATION', label: 'Maçonnerie' },
  { needKey: 'reseau', tradeKey: 'reseau', role: 'INSTALLATION', label: 'Réseau' },
  { needKey: 'interieur', tradeKey: 'interieur_type1', role: 'INSTALLATION', label: 'Installations intérieures' },
  { needKey: 'controle', tradeKey: 'controle', role: 'SUPERVISION', label: 'Contrôle' },
] as const;

// Helper from TeamsSection
const buildLegacyTeamSnapshot = (parents: any[]) => {
  return parents.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    regionId: p.regionId,
    subTeams: (p.children || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      tradeKey: c.tradeKey,
      regionId: c.regionId,
      capacity: c.capacity
    }))
  }));
};

export default function TeamsTab({
  project,
  households,
  householdsError,
}: {
  project: any;
  households: any[];
  householdsError?: string | null;
}) {
  const {
    teamTree,
    regions,
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
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  useEffect(() => {
    fetchTeamTree();
    fetchRegions();
    fetchGrappes();
  }, [fetchTeamTree, fetchRegions, fetchGrappes, project?.id]);

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

  const detectedHouseholdRegions = getAvailablePlanningRegions((households || []) as any[]).filter(
    (region): region is string => typeof region === 'string' && region.trim().length > 0
  );
  const detectedServerRegions = (regions || [])
    .map((region: any) => region?.name)
    .filter((region: unknown): region is string => typeof region === 'string' && region.trim().length > 0);
  const configuredRegions = Object.keys(project?.config?.regionsConfig || {}).filter(
    (region): region is string => typeof region === 'string' && region.trim().length > 0
  );
  const detectedRegions = (
    detectedHouseholdRegions.length > 0
      ? detectedHouseholdRegions
      : [...detectedServerRegions, ...configuredRegions]
  ).filter((region, index, list) => list.findIndex((entry) => normalizeGeoKey(entry) === normalizeGeoKey(region)) === index);
  
  const regionSourceLabel =
    detectedHouseholdRegions.length > 0
      ? 'ménages chargés'
      : detectedServerRegions.length > 0
        ? 'régions serveur'
        : configuredRegions.length > 0
          ? 'configuration projet'
          : 'aucune source disponible';
          
  const projectDurationMonths =
    typeof project?.duration === 'number' && Number.isFinite(project.duration) && project.duration > 0
      ? Math.max(1, Math.round(project.duration))
      : 1;
  const projectWorkingDays = projectDurationMonths * 22;

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
    if (!window.confirm(`Supprimer le corps de métier "${tradeKey}" ?`)) return;
    const newRates = { ...productionRates };
    delete newRates[tradeKey];
    updateProject({ config: { ...project.config, productionRates: newRates } });
  };

  const handleAddTeam = async () => {
    try {
      await createTeam({
        name: `Groupement ${teamTree.length + 1}`,
        role: 'INSTALLATION',
        capacity: 0,
      });
      toast.success('Groupement créé');
    } catch (e: any) {
      toast.error(e.message || 'Erreur création');
    }
  };

  const handleAddSubTeam = async (parentId: string, parentRole: string) => {
    try {
      await createTeam({
        name: `Équipe Terrain`,
        role: parentRole as any,
        parentTeamId: parentId,
        capacity: 5,
      });
      toast.success('Sous-équipe ajoutée');
    } catch (e: any) {
      toast.error(e.message || 'Erreur création');
    }
  };

  const handleRemoveTeam = async (id: string) => {
    if (!window.confirm('Voulez-vous supprimer cette équipe ?')) return;
    try {
      await deleteTeam(id);
      toast.success('Équipe supprimée');
    } catch (e: any) {
      toast.error(e.message || 'Erreur suppression');
    }
  };

  const handleResetAllTeams = async () => {
    if (!confirmResetAll) {
      setConfirmResetAll(true);
      setTimeout(() => setConfirmResetAll(false), 3000);
      return;
    }
    
    const toastId = toast.loading('Suppression de toutes les équipes...');
    try {
      const existingIds: string[] = [];
      teamTree.forEach((parent: any) => {
        (parent.children || []).forEach((child: any) => existingIds.push(child.id));
        existingIds.push(parent.id);
      });

      for (const id of existingIds) {
        await deleteTeam(id);
      }
      toast.success('Toutes les équipes ont été supprimées.', { id: toastId });
      setConfirmResetAll(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de suppression', { id: toastId });
    }
  };

  const handleUpdateTeamField = async (id: string, field: string, value: any) => {
    try {
      await updateTeam(id, { [field]: value });
    } catch (e: any) {
      toast.error(e.message || 'Erreur maj');
    }
  };

  const handleAutoGenerateTeams = async () => {
    if (!project?.id) {
      toast.error('Projet introuvable.');
      return;
    }

    if (!households?.length) {
      toast.error('Aucun ménage chargé pour générer les équipes.');
      return;
    }

    if (!detectedRegions.length) {
      toast.error('Aucune région détectée dans les ménages du projet.');
      return;
    }

    const confirmMessage =
      teamTree.length > 0
        ? `Cette action va supprimer ${teamTree.length} groupement(s) existant(s) puis recréer automatiquement les équipes par région. Continuer ?`
        : `Créer automatiquement les équipes pour ${detectedRegions.length} région(s) et ${households.length} ménage(s) ?`;

    if (!window.confirm(confirmMessage)) return;

    setIsAutoGenerating(true);
    const toastId = toast.loading('Génération automatique des équipes...');

    try {
      if (teamTree.length > 0) {
        const existingIds: string[] = [];
        teamTree.forEach((parent: any) => {
          (parent.children || []).forEach((child: any) => existingIds.push(child.id));
          existingIds.push(parent.id);
        });
        for (const id of existingIds) {
          await deleteTeam(id);
        }
      }

      const regionLookup = new Map(
        (regions || []).map((region: any) => [normalizeGeoKey(region.name), region])
      );
      const generatedParents: any[] = [];
      const nextRegionsConfig = { ...(project?.config?.regionsConfig || {}) };
      let generatedSubTeams = 0;

      for (const regionName of detectedRegions) {
        const matchedRegion = regionLookup.get(normalizeGeoKey(regionName));
        const regionalNeeds = computeTheoreticalNeeds({
          households,
          targetMonths: projectDurationMonths,
          selectedRegion: regionName,
          productionRates,
        });

        if (!regionalNeeds) continue;

        const parentTeam = await createTeam({
          name: `Cellule ${regionName}`,
          role: 'INSTALLATION',
          regionId: matchedRegion?.id,
          capacity: 0,
        });

        const generatedChildren: any[] = [];

        for (const blueprint of AUTO_TEAM_BLUEPRINTS) {
          const requiredTeams = Math.max(
            0,
            Number(regionalNeeds[blueprint.needKey as keyof typeof regionalNeeds] || 0)
          );
          const teamCapacity =
            Number(
              blueprint.needKey === 'interieur'
                ? regionalNeeds.effectiveRates.interieur
                : regionalNeeds.effectiveRates[
                    blueprint.needKey as keyof typeof regionalNeeds.effectiveRates
                  ]
            ) || Number(productionRates?.[blueprint.tradeKey]) || 1;

          for (let index = 0; index < requiredTeams; index += 1) {
            const child = await createTeam({
              name: `${blueprint.label} ${index + 1} - ${regionName}`,
              role: blueprint.role as any,
              tradeKey: blueprint.tradeKey,
              parentTeamId: parentTeam.id,
              regionId: matchedRegion?.id,
              capacity: Math.max(1, Math.round(teamCapacity)),
            });

            generatedChildren.push(child);
            generatedSubTeams += 1;
          }
        }

        generatedParents.push({
          ...parentTeam,
          regionId: matchedRegion?.id,
          children: generatedChildren,
        });

        nextRegionsConfig[regionName] = {
          ...(nextRegionsConfig[regionName] || {}),
          autoGenerated: true,
          planningWindowMonths: projectDurationMonths,
          householdCount: households.filter((household) => household.region === regionName).length,
          teamAllocations: generatedChildren.map((child: any, index: number) => ({
            id: makeId('alloc'),
            subTeamId: child.id,
            priority: index + 1,
          })),
        };
      }

      await updateProject({
        config: {
          ...project.config,
          teams: buildLegacyTeamSnapshot(generatedParents),
          regionsConfig: nextRegionsConfig,
        },
      });

      await Promise.all([fetchTeamTree(), fetchRegions(), fetchGrappes()]);

      toast.success(
        `${generatedParents.length} cellule(s) régionale(s) et ${generatedSubTeams} équipe(s) terrain générées automatiquement.`,
        { id: toastId, duration: 5000 }
      );
    } catch (err: any) {
      logger.error('❌ Génération automatique des équipes impossible:', err);
      toast.error(
        err?.response?.data?.error || err?.message || 'Erreur lors de la génération automatique des équipes.',
        { id: toastId }
      );
    } finally {
      setIsAutoGenerating(false);
    }
  };

  if (isTeamsLoading && teamTree.length === 0)
    return <div className="p-8 text-slate-400">Chargement des équipes...</div>;

  return (
    <div className="space-y-8 sm:space-y-12">
      <div className="flex flex-col gap-4 sm:gap-6">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-1">
            <Users className="text-blue-500" /> Gestion des Équipes
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
            <MapPin size={12} className="text-slate-300" />
            <span className="text-xs font-black text-slate-200 uppercase tracking-tight">
              {detectedRegions.length} Régions
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
            <Layers size={12} className="text-slate-300" />
            <span className="text-xs font-black text-slate-200 uppercase tracking-tight">
              {households.length} Ménages
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
            <Zap size={12} className="text-amber-400" />
            <span className="text-xs font-black text-slate-200 uppercase tracking-tight">
              {projectDurationMonths} Mois Cible
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            Source régions: <span className="text-slate-200">{regionSourceLabel}</span>
          </div>
          {householdsError ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">
              {householdsError}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="rounded-[1.5rem] border border-blue-500/15 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(15,23,42,0.86))] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.28)]">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">
                    Auto-allocation projet
                  </p>
                  <h3 className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">
                    Création automatique des équipes terrain
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                    Le système répartit les ménages par région, applique les cadences de production,
                    puis crée les cellules régionales et leurs équipes métier.
                  </p>
                </div>
                <div className="grid gap-3 2xl:grid-cols-3">
                  {[
                    ['1', 'Lire les ménages', 'Régions et volumes terrain'],
                    ['2', 'Calculer le besoin', 'Durée cible et cadences'],
                    ['3', 'Créer les équipes', 'Affectation par région'],
                  ].map(([step, title, desc]) => (
                    <div key={step} className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">
                          {step}
                        </span>
                        <div className="min-w-0">
                          <p className="break-normal text-[11px] font-black uppercase leading-snug tracking-[0.04em] text-white">
                            {title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleAutoGenerateTeams}
                disabled={isAutoGenerating || households.length === 0}
                className="min-h-[52px] w-full shrink-0 rounded-xl border border-blue-400/30 bg-blue-600 px-5 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-blue-600/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 lg:w-[220px]"
              >
                {isAutoGenerating ? 'Génération...' : 'Auto-créer & affecter'}
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Fenêtre de calcul
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Régions
                </p>
                <p className="mt-2 text-2xl font-black text-white">{detectedRegions.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Ménages
                </p>
                <p className="mt-2 text-2xl font-black text-white">{households.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Jours ouvrés
                </p>
                <p className="mt-2 text-2xl font-black text-white">{projectWorkingDays}</p>
              </div>
            </div>
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

      {/* CADENCES DE PRODUCTION */}
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
            const isCoreTrade = ['macons', 'reseau', 'interieur_type1', 'controle'].includes(tradeKey);

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
