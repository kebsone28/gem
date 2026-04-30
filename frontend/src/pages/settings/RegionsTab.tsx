import React, { useState, useEffect } from 'react';
import { MapPin, ChevronRight, Layers, Trash2 } from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';
import { StatusBadge } from '../../components/dashboards/DashboardComponents';

const makeId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export default function RegionsTab({
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

  const autoRegions = Array.from(
    new Set(households.map((h) => h.region).filter(Boolean))
  ) as string[];

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
              className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between group ${
                selectedRegion === region 
                  ? 'bg-rose-600 border-rose-600 text-white shadow-xl shadow-rose-600/20' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:border-rose-500/30'
              }`}
            >
              <div>
                <span className="font-black uppercase text-sm block mb-1">{region}</span>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    selectedRegion === region ? 'text-rose-100' : 'text-slate-500'
                  }`}
                >
                  {grappes.filter((g) => g.region === region).length} Grappes
                </span>
              </div>
              <ChevronRight
                size={18}
                className={`${
                  selectedRegion === region ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                } transition-all`}
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
