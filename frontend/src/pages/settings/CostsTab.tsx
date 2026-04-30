import React, { useState, useEffect } from 'react';
import { DollarSign, Trash2, Wrench } from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';
import type { CatalogItem } from '../../utils/types';

export default function CostsTab({ project, onUpdate }: { project: any; onUpdate: any }) {
  const { regions, fetchRegions, teams, fetchTeams } = useTeams(project?.id);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const costs = project?.config?.costs || {};
  const staffRates = costs.staffRates || {};

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
          {regions.map((reg: any) => (
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
