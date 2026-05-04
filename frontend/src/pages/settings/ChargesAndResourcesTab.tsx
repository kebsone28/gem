import React, { useState, useEffect } from 'react';
import { MapPin, Trash2, DollarSign, Wrench } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTeams } from '../../hooks/useTeams';
import { useProject } from '../../contexts/ProjectContext';
import apiClient from '../../api/client';

function DebouncedInput({ value, onChange, type = 'text', placeholder, className, disabled, min, max }: any) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleChange = (e: any) => {
    if (type === 'number') {
      setLocalValue(e.target.value === '' ? '' : (parseInt(e.target.value) || 0));
    } else {
      setLocalValue(e.target.value);
    }
  };

  const displayValue = type === 'number' && localValue === 0 ? '' : localValue;

  return (
    <input
      type={type}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      min={min}
      max={max}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

export default function ChargesAndResourcesTab({
  project,
  households,
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

  const [localConfig, setLocalConfig] = useState(project?.config || {});
  const [isAutoSave, setIsAutoSave] = useState(true);

  useEffect(() => {
    if (isAutoSave) setLocalConfig(project?.config || {});
  }, [project?.config, isAutoSave]);

  const costs = localConfig.costs || {};
  const staffRates = costs.staffRates || {};
  const tradeRates = costs.tradeRates || {};
  const materialCatalog = localConfig.materialCatalog || [];

  const handleUpdateConfig = (newConfig: any) => {
    setLocalConfig(newConfig);
    if (isAutoSave) updateProject({ config: newConfig });
  };

  const handleManualSave = () => {
    updateProject({ config: localConfig });
    toast.success('Configuration sauvegardée avec succès sur le serveur');
  };

  const searchQuery = '';
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  useEffect(() => {
    fetchTeamTree();
    fetchRegions();
    fetchGrappes();
  }, [fetchTeamTree, fetchRegions, fetchGrappes, project?.id]);

  const filteredTeams = teamTree.filter((t: any) => {
    const matchesName = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesName;
  });

  const projectDurationMonths = Math.max(1, Math.round(project?.duration || 1));

  // -- TEAM MANAGEMENT --
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

  const handleUpdateTeamField = async (id: string, field: string, value: any) => {
    try {
      await updateTeam(id, { [field]: value });

      const team = teamTree.find((t: any) => t.id === id);
      if (team) {
         const currentTrade = field === 'tradeKey' ? value : team.tradeKey;
         const currentRegion = field === 'regionId' ? value : team.regionId;
         if (currentTrade && currentRegion) {
            const defRate = tradeRates[currentTrade];
            if (defRate) {
               const newCosts = { ...costs };
               const newStaffRates = { ...(newCosts.staffRates || {}) };
               if (!newStaffRates[currentRegion]) newStaffRates[currentRegion] = {};
               newStaffRates[currentRegion][id] = { ...defRate };
               newCosts.staffRates = newStaffRates;
               handleUpdateConfig({ ...localConfig, costs: newCosts });
            }
         }
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur maj');
    }
  };

  const handleRemoveTeam = async (id: string) => {
    if (!window.confirm('Voulez-vous supprimer ce groupement ?')) return;
    try {
      await deleteTeam(id);
      toast.success('Groupement supprimé');
    } catch (e: any) {
      toast.error(e.message || 'Erreur suppression');
    }
  };

  // -- RATE MANAGEMENT (Auto-synced with team region) --
  const handleUpdateTradeRate = (tradeKey: string, field: string, value: any) => {
    const newCosts = { ...costs };
    const newTradeRates = { ...(newCosts.tradeRates || {}) };
    newTradeRates[tradeKey] = { ...(newTradeRates[tradeKey] || { amount: 0, mode: 'daily' }), [field]: value };

    const newStaffRates = { ...(newCosts.staffRates || {}) };
    teamTree.forEach((t: any) => {
      if (t.tradeKey === tradeKey && t.regionId) {
        if (!newStaffRates[t.regionId]) newStaffRates[t.regionId] = {};
        newStaffRates[t.regionId][t.id] = {
           ...(newStaffRates[t.regionId][t.id] || { amount: 0, mode: 'daily' }),
           [field]: value
        };
      }
    });

    newCosts.tradeRates = newTradeRates;
    newCosts.staffRates = newStaffRates;
    handleUpdateConfig({ ...localConfig, costs: newCosts });
  };

  const handleUpdateRate = (teamId: string, regionId: string, field: string, value: any) => {
    if (!regionId) return;
    const newCosts = { ...costs };
    const newStaffRates = { ...(newCosts.staffRates || {}) };
    if (!newStaffRates[regionId]) newStaffRates[regionId] = {};
    newStaffRates[regionId][teamId] = { ...(newStaffRates[regionId][teamId] || { amount: 0, mode: 'daily' }), [field]: value };
    newCosts.staffRates = newStaffRates;
    handleUpdateConfig({ ...localConfig, costs: newCosts });
  };

  // -- AUTO-GENERATE --
  const handleAutoGenerateTeams = async () => {
    if (!households?.length) return toast.error('Aucun ménage chargé.');
    if (!window.confirm('Créer/Recréer automatiquement les équipes pour toutes les régions détectées ?')) return;

    setIsAutoGenerating(true);
    const toastId = toast.loading('Génération en cours...');

    try {
      const response = await apiClient.post('/teams/auto-generate', {
        projectId: project.id,
        durationMonths: projectDurationMonths,
        productionRates
      });
      await Promise.all([fetchTeamTree(), fetchRegions(), fetchGrappes()]);
      await updateProject({ duration: projectDurationMonths });
      toast.success(response.data?.message || 'Équipes générées', { id: toastId });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur de génération', { id: toastId });
    } finally {
      setIsAutoGenerating(false);
    }
  };

  // -- CATALOG MANAGEMENT --
  const handleAddCatalogItem = () => {
    const newItem = { id: `item_${Date.now()}`, name: 'Nouveau', category: 'Autre', purchasePrice: 0, rentalPrice: 0 };
    handleUpdateConfig({ ...localConfig, materialCatalog: [...materialCatalog, newItem] });
  };
  const handleUpdateCatalogItem = (id: string, field: string, value: any) => {
    const newCatalog = materialCatalog.map((item: any) => item.id === id ? { ...item, [field]: value } : item);
    handleUpdateConfig({ ...localConfig, materialCatalog: newCatalog });
  };
  const handleDeleteCatalogItem = (id: string) => {
    handleUpdateConfig({ ...localConfig, materialCatalog: materialCatalog.filter((i: any) => i.id !== id) });
  };

  if (isTeamsLoading && teamTree.length === 0) return <div className="p-8 text-slate-400">Chargement...</div>;

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
            <DollarSign className="text-emerald-500" /> Charges & Ressources Unifiées
          </h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
            Gérez vos groupements, leurs affectations et leurs grilles tarifaires en un seul endroit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/80 border border-white/10 rounded-xl p-1.5 shadow-inner">
            <button
              onClick={() => setIsAutoSave(!isAutoSave)}
              className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${isAutoSave ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              Auto-Save {isAutoSave ? 'ON' : 'OFF'}
            </button>
            {!isAutoSave && (
              <button
                onClick={handleManualSave}
                className="px-5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/25 whitespace-nowrap"
              >
                Sauvegarder
              </button>
            )}
          </div>
           <button
            onClick={handleAutoGenerateTeams}
            disabled={isAutoGenerating || households.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-500/25 whitespace-nowrap disabled:opacity-50"
          >
            {isAutoGenerating ? 'Calcul...' : 'Génération IA'}
          </button>
          <button
            onClick={handleAddTeam}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all border border-white/10 whitespace-nowrap"
          >
            + Groupement
          </button>
        </div>
      </div>

      {/* GLOBAL CATEGORY PRICING */}
      <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-white/10 space-y-6">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <DollarSign className="text-emerald-500"/> Grille Tarifaire par Métier (Défaut)
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Fixez un tarif global, toutes les équipes de ce métier (nouvelles et existantes) seront mises à jour.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.keys(productionRates).map(tradeKey => {
            const tr = tradeRates[tradeKey] || { amount: 0, mode: 'daily' };
            return (
              <div key={tradeKey} className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">{tradeKey}</h4>
                <div className="flex gap-2">
                  <select
                    title="Mode de paiement"
                    value={tr.mode}
                    onChange={(e) => handleUpdateTradeRate(tradeKey, 'mode', e.target.value)}
                    className="w-1/2 bg-slate-900 border border-white/10 rounded-lg pl-2 pr-6 py-1.5 text-white text-[11px] font-bold outline-none truncate"
                  >
                    <option value="daily">/Jour</option>
                    <option value="monthly">/Mois</option>
                    <option value="task">/Tâche</option>
                  </select>
                  <DebouncedInput
                    type="number"
                    value={tr.amount}
                    placeholder="0"
                    onChange={(val: any) => handleUpdateTradeRate(tradeKey, 'amount', val || 0)}
                    className="w-1/2 bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs outline-none font-bold"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TEAMS CARDS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredTeams.map((team: any) => {
          const teamRate = team.regionId ? (staffRates[team.regionId]?.[team.id] || { amount: 0, mode: 'daily' }) : { amount: 0, mode: 'daily' };

          return (
            <div key={team.id} className="bg-slate-900/50 p-5 rounded-[1.5rem] border border-white/10 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => handleRemoveTeam(team.id)}
                  className="text-slate-500 hover:text-red-500 transition-colors"
                  title="Supprimer le groupement"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-5 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nom du Groupement</label>
                    <DebouncedInput
                      value={team.name}
                      onChange={(val: any) => handleUpdateTeamField(team.id, 'name', val)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white font-bold outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Métier</label>
                    <select
                      title="Métier associé"
                      value={team.tradeKey || ''}
                      onChange={(e) => handleUpdateTeamField(team.id, 'tradeKey', e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl pl-3 pr-7 py-2 text-white text-[11px] font-bold outline-none truncate"
                    >
                      <option value="">Sélectionner...</option>
                      {Object.keys(productionRates).map((tk) => (
                         <option key={tk} value={tk}>{tk.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950 border border-white/5">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-1">
                      <MapPin size={12} className="text-rose-400"/> Affectation
                    </label>
                    <select
                      title="Affectation régionale"
                      value={team.regionId || ''}
                      onChange={(e) => handleUpdateTeamField(team.id, 'regionId', e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg pl-2 pr-6 py-1.5 text-white text-[11px] font-bold outline-none truncate"
                    >
                      <option value="">Aucune région...</option>
                      {regions.map((reg: any) => <option key={reg.id} value={reg.id}>{reg.name}</option>)}
                    </select>
                  </div>

                  <div>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-1">
                      <DollarSign size={12} className="text-emerald-400"/> Mode de Paie
                    </label>
                     <select
                        title="Mode de rémunération"
                        value={teamRate.mode}
                        onChange={(e) => handleUpdateRate(team.id, team.regionId, 'mode', e.target.value)}
                        disabled={!team.regionId}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg pl-2 pr-6 py-1.5 text-white text-[11px] font-bold outline-none truncate disabled:opacity-50"
                      >
                        <option value="daily">Journalier</option>
                        <option value="monthly">Mensuel</option>
                        <option value="task">À la tâche</option>
                      </select>
                  </div>

                  <div>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Montant</label>
                     <DebouncedInput
                        type="number"
                        value={teamRate.amount}
                        placeholder="0"
                        onChange={(val: any) => handleUpdateRate(team.id, team.regionId, 'amount', val || 0)}
                        disabled={!team.regionId}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none font-bold disabled:opacity-50"
                      />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CATALOGUE MATERIEL */}
      <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Wrench className="text-blue-500"/> Catalogue Matériel & Logistique
          </h3>
          <button onClick={handleAddCatalogItem} className="text-xs bg-white/10 px-4 py-2 rounded-lg font-bold text-white uppercase hover:bg-white/20">
            + Ajouter Article
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {materialCatalog.map((item: any) => (
            <div key={item.id} className="bg-slate-950 rounded-xl border border-white/5 p-4 space-y-3 relative group">
              <button
                onClick={() => handleDeleteCatalogItem(item.id)}
                className="absolute top-4 right-4 text-slate-600 hover:text-rose-500"
                title="Supprimer l'article du catalogue"
              >
                <Trash2 size={14}/>
              </button>
              <DebouncedInput
                value={item.name}
                placeholder="Nom du matériel"
                onChange={(val: any) => handleUpdateCatalogItem(item.id, 'name', val)}
                className="bg-transparent text-white font-black text-sm outline-none w-[90%]"
              />
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Achat total</label>
                  <DebouncedInput type="number" placeholder="0" value={item.purchasePrice} onChange={(val: any) => handleUpdateCatalogItem(item.id, 'purchasePrice', val || 0)} className="w-full bg-transparent text-white outline-none"/>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Location /j</label>
                  <DebouncedInput type="number" placeholder="0" value={item.rentalPrice} onChange={(val: any) => handleUpdateCatalogItem(item.id, 'rentalPrice', val || 0)} className="w-full bg-transparent text-white outline-none"/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
