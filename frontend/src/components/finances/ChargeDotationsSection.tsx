/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from 'react';
import { Plus, Trash2, Wrench } from 'lucide-react';
import { useFinances } from '../../hooks/useFinances';
import { useProject } from '../../contexts/ProjectContext';
import { useTeams } from '../../hooks/useTeams';
import { fmtFCFA } from '../../utils/format';

const makeAllocationId = () =>
  `alloc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export default function ChargeDotationsSection() {
  const { project, stats } = useFinances();
  const { updateProject } = useProject();
  const { teams, fetchTeams } = useTeams(project?.id);

  const materialCatalog = useMemo(
    () => ((project?.config?.materialCatalog || []) as any[]),
    [project?.config?.materialCatalog]
  );
  const allocations = useMemo(
    () => ((project?.config?.subTeamAllocations || {}) as Record<string, any[]>),
    [project?.config?.subTeamAllocations]
  );

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const subTeams = teams.filter((team: any) => team.parentTeamId);

  const persistAllocations = async (nextAllocations: Record<string, any[]>) => {
    if (!project?.id) return;
    await updateProject(
      {
        config: {
          ...(project.config || {}),
          subTeamAllocations: nextAllocations,
        },
      },
      project.id
    );
  };

  const addAllocation = async (subTeamId: string, itemId: string) => {
    if (!itemId) return;
    const teamAllocations = allocations[subTeamId] || [];
    if (teamAllocations.some((allocation: any) => allocation.itemId === itemId)) return;

    await persistAllocations({
      ...allocations,
      [subTeamId]: [
        ...teamAllocations,
        {
          id: makeAllocationId(),
          itemId,
          quantity: 1,
          acquisitionType: 'achat',
        },
      ],
    });
  };

  const updateAllocation = async (
    subTeamId: string,
    allocationId: string,
    field: 'quantity' | 'acquisitionType',
    value: any
  ) => {
    const teamAllocations = allocations[subTeamId] || [];
    await persistAllocations({
      ...allocations,
      [subTeamId]: teamAllocations.map((allocation: any) =>
        allocation.id === allocationId ? { ...allocation, [field]: value } : allocation
      ),
    });
  };

  const removeAllocation = async (subTeamId: string, allocationId: string) => {
    await persistAllocations({
      ...allocations,
      [subTeamId]: (allocations[subTeamId] || []).filter(
        (allocation: any) => allocation.id !== allocationId
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
            <Wrench size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-white">
              Dotations matériel
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Matériel affecté aux sous-équipes. Les montants sont synchronisés avec le catalogue
              et ajoutés automatiquement aux charges du projet.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-5 py-3 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">
            Total dotations
          </p>
          <p className="text-xl font-black text-white">{fmtFCFA(stats.dotations || 0)}</p>
        </div>
      </div>

      {materialCatalog.length === 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Aucun catalogue matériel n'est renseigné. Ajoutez d'abord les références dans la rubrique
          Matériels ou dans les paramètres projet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {subTeams.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm font-bold text-slate-500">
            Aucune sous-équipe disponible pour ce projet.
          </div>
        ) : (
          subTeams.map((team: any) => {
            const teamAllocations = allocations[team.id] || [];
            return (
              <div key={team.id} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white">
                      {team.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {teamAllocations.length} dotation{teamAllocations.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs font-black uppercase tracking-[0.08em] text-slate-300">
                    <Plus size={14} />
                    <select
                      title="Ajouter une dotation"
                      value=""
                      onChange={(event) => addAllocation(team.id, event.target.value)}
                      className="min-w-0 bg-transparent py-3 outline-none"
                    >
                      <option value="">Ajouter un matériel...</option>
                      {materialCatalog.map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Matériel</th>
                        <th className="px-3 py-3 text-right">Quantité</th>
                        <th className="px-3 py-3">Mode</th>
                        <th className="px-3 py-3 text-right">Prix unitaire</th>
                        <th className="px-3 py-3 text-right">Total</th>
                        <th className="px-3 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {teamAllocations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                            Aucune dotation sur cette équipe.
                          </td>
                        </tr>
                      ) : (
                        teamAllocations.map((allocation: any) => {
                          const catalogItem = materialCatalog.find(
                            (item: any) => item.id === allocation.itemId
                          );
                          const acquisitionType =
                            allocation.acquisitionType === 'location' ? 'location' : 'achat';
                          const unitPrice =
                            acquisitionType === 'location'
                              ? Number(catalogItem?.rentalPrice || 0)
                              : Number(catalogItem?.purchasePrice || 0);
                          const quantity = Number(allocation.quantity || 0);
                          const total = quantity * unitPrice;

                          return (
                            <tr key={allocation.id} className="text-sm text-slate-300">
                              <td className="px-3 py-3 font-bold text-white">
                                {catalogItem?.name || 'Matériel supprimé du catalogue'}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <input
                                  title="Quantité dotée"
                                  type="number"
                                  value={quantity}
                                  onChange={(event) =>
                                    updateAllocation(
                                      team.id,
                                      allocation.id,
                                      'quantity',
                                      Number(event.target.value) || 0
                                    )
                                  }
                                  className="w-24 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-right font-bold text-white outline-none focus:border-violet-400"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <select
                                  title="Mode d'acquisition"
                                  value={acquisitionType}
                                  onChange={(event) =>
                                    updateAllocation(
                                      team.id,
                                      allocation.id,
                                      'acquisitionType',
                                      event.target.value
                                    )
                                  }
                                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-black uppercase text-white outline-none focus:border-violet-400"
                                >
                                  <option value="achat">Achat</option>
                                  <option value="location">Location</option>
                                </select>
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-slate-400">
                                {fmtFCFA(unitPrice)}
                              </td>
                              <td className="px-3 py-3 text-right font-black text-violet-200">
                                {fmtFCFA(total)}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeAllocation(team.id, allocation.id)}
                                  className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
                                  aria-label="Supprimer la dotation"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
