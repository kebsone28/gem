import { useState } from 'react';
import logger from '@services/logger';
import {
  Plus,
  Minus,
  CheckCircle2,
  Warehouse,
  Save,
  Clock,
  LayoutGrid,
  Edit2,
  Trash2,
  X,
  Check,
  ChevronDown,
  ArrowUpDown
} from 'lucide-react';
import { useLogistique } from '@hooks/useLogistique';
import { useAuth } from '@contexts/AuthContext';
import { usePermissions } from '@hooks/usePermissions';
import { normalizeRole, ROLES } from '@core/security/permissions';
import { AppRole } from '@core/security/types';
import toast from 'react-hot-toast';
import {
  PageContainer,
  PageHeader,
  ModulePageShell,
  ContentArea
} from '@components';
import { ModuleStatePanel } from '@components/common/ModuleStatePanel';
import { useProject } from '@contexts/ProjectContext';

export default function Atelier() {
  const { activeProjectId, isLoading: isProjectLoading } = useProject();
  const {
    warehouses,
    warehouseStats,
    addPreparatorLoading,
    movementHistory,
    deleteMovement,
    updateMovement,
  } = useLogistique();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  const nRole = normalizeRole(user?.role);
  const isMaster = isAdmin || nRole === AppRole.ADMIN || nRole === AppRole.DIRECTEUR;

  // Filtrer les magasins selon l'autorisation de l'utilisateur
  const allowedWarehouses = (warehouses || []).filter(w => {
    if (isMaster) return true;
    const userRegion = (user as any)?.region || (user as any)?.zone;
    if (userRegion) {
      return w.region?.toLowerCase() === userRegion.toLowerCase();
    }
    // S'il n'est pas master et n'a pas de région, on affiche ceux où il est assigné ?
    // Par défaut, si pas de région définie, on restreint ou on laisse ouvert selon la logique d'entreprise.
    // Pour être safe, on laisse tout s'il n'a pas de contrainte stricte définie.
    return true; 
  });

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    allowedWarehouses?.[0]?.id || null
  );
  
  // Simple form state for the 2 categories
  const [qtyPrincipal, setQtyPrincipal] = useState<string>('');
  const [qtyPrincipalPlus, setQtyPrincipalPlus] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

  // Editing state for journal
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<string>('');

  const activeWh = warehouseStats?.find((w) => w.id === selectedWarehouseId) || 
                   allowedWarehouses.find(w => w.id === selectedWarehouseId);

  // Filter history for "LOAD_TEAM" (Production) and specific to the selected warehouse
  const productionJournal = movementHistory.filter(m => m.type === 'LOAD_TEAM' && m.warehouseId === selectedWarehouseId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedJournal = [...productionJournal].sort((a: any, b: any) => {
     let valA: any, valB: any;
     switch(sortConfig.key) {
        case 'timestamp':
          valA = new Date(a.timestamp).getTime();
          valB = new Date(b.timestamp).getTime();
          break;
        case 'type':
          valA = a.variantId || '';
          valB = b.variantId || '';
          break;
        case 'qty':
          valA = a.quantity || 0;
          valB = b.quantity || 0;
          break;
        case 'author':
          valA = a.author?.toLowerCase() || '';
          valB = b.author?.toLowerCase() || '';
          break;
        default:
          valA = 0;
          valB = 0;
     }
     if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
     if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
     return 0;
  });

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleValidateProduction = async () => {
    if (!activeWh) {
      toast.error('Veuillez sélectionner un magasin');
      return;
    }

    const q1 = parseInt(qtyPrincipal || '0');
    const q2 = parseInt(qtyPrincipalPlus || '0');

    if (q1 <= 0 && q2 <= 0) {
      toast.error('Veuillez entrer une quantité valide');
      return;
    }

    setIsSaving(true);
    const teamId = `atelier_${activeWh.id}`;
    const teamName = `Atelier ${activeWh.region}`;

    try {
      const entries = [];
      const authorName = user?.name || user?.email || 'Inconnu';
      if (q1 > 0) entries.push({ variantId: 'standard', kitsLoaded: q1, author: authorName });
      if (q2 > 0) entries.push({ variantId: 'premium', kitsLoaded: q2, author: authorName });

      if (entries.length > 0) {
        await addPreparatorLoading(activeWh.id, teamId, teamName, entries);
      }
      
      setQtyPrincipal('');
      setQtyPrincipalPlus('');
      toast.success('Enregistré avec succès !');
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMovement(id);
      toast.success('Supprimé');
    } catch (err) {
      toast.error('Erreur lors de la suppression');
      logger.error(err);
    }
  };

  const handleStartEdit = (id: string, currentQty: number) => {
    setEditingMovementId(id);
    setEditingQty(currentQty.toString());
  };

  const handleSaveEdit = async (id: string) => {
    const q = parseInt(editingQty);
    if (isNaN(q) || q <= 0) {
      toast.error('Quantité invalide');
      return;
    }
    await updateMovement(id, q);
    setEditingMovementId(null);
    toast.success('Mis à jour');
  };

  const getVariantLabel = (variantId: string) => {
    if (variantId === 'premium') return 'KIT Principal+';
    if (variantId === 'standard') return 'KIT Principal';
    return variantId;
  };

  if (isProjectLoading) {
    return (
      <PageContainer>
        <ModuleStatePanel
          tone="loading"
          title="Chargement du projet"
          description="Le contexte projet est en cours d'initialisation pour l'atelier de production."
        />
      </PageContainer>
    );
  }

  if (!activeProjectId) {
    return (
      <PageContainer>
        <ModuleStatePanel
          title="Aucun projet actif"
          description="L'atelier de production est rattaché à un projet. Sélectionnez un projet pour préparer les kits de déploiement."
          actionLabel="Choisir un projet"
          actionTo="/projects"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Atelier de Production"
        subtitle="Saisie et journalisation de la préparation des kits avant leur déploiement."
        icon={LayoutGrid}
        accent="logistique"
      />
      <ModulePageShell accent="logistique" className="space-y-6">
        <ContentArea className="p-0">
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header compact */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/40 backdrop-blur-md border border-white/5 p-4 rounded-[2rem] shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight uppercase">Saisie Atelier</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Vérification de stock</p>
                </div>
              </div>

              {/* Sélecteur de magasin filtré */}
              <div className="mt-4 sm:mt-0 flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden md:block">Zone Autorisée :</span>
                <div className="relative">
                  <select
                    value={selectedWarehouseId || ''}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="appearance-none bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl pl-4 pr-10 py-2.5 outline-none focus:border-indigo-500 transition-colors shadow-inner w-48 sm:w-64"
                  >
                    {allowedWarehouses?.map((wh) => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {!activeWh ? (
              <div className="flex flex-col items-center justify-center py-12 bg-slate-900/30 border border-dashed border-slate-800 rounded-[2rem]">
                <Warehouse size={32} className="text-slate-700 mb-3" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sélectionnez une zone pour commencer</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Section Saisie Rapide */}
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2rem] p-4 lg:p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex flex-col lg:flex-row lg:items-end gap-6 relative z-10">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* KIT Principal */}
                      <div className="bg-slate-950/80 border border-slate-800/60 rounded-2xl p-3 flex items-center justify-between">
                        <div className="pl-2">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saisie</p>
                          <h5 className="text-sm font-black text-white">KIT Principal</h5>
                        </div>
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-inner">
                          <button
                            onClick={() => setQtyPrincipal((p) => String(Math.max(0, parseInt(p || '0') - 1)))}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            type="number"
                            value={qtyPrincipal}
                            onChange={(e) => setQtyPrincipal(e.target.value)}
                            className="w-14 bg-transparent text-center font-black text-white outline-none text-lg"
                            placeholder="0"
                          />
                          <button
                            onClick={() => setQtyPrincipal((p) => String(parseInt(p || '0') + 1))}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      {/* KIT Principal+ */}
                      <div className="bg-slate-950/80 border border-slate-800/60 rounded-2xl p-3 flex items-center justify-between">
                        <div className="pl-2">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saisie</p>
                          <h5 className="text-sm font-black text-white flex items-center gap-1">
                            KIT Principal<span className="text-amber-500 bg-amber-500/10 px-1 rounded-md text-[10px]">+</span>
                          </h5>
                        </div>
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-inner">
                          <button
                            onClick={() => setQtyPrincipalPlus((p) => String(Math.max(0, parseInt(p || '0') - 1)))}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            type="number"
                            value={qtyPrincipalPlus}
                            onChange={(e) => setQtyPrincipalPlus(e.target.value)}
                            className="w-14 bg-transparent text-center font-black text-white outline-none text-lg"
                            placeholder="0"
                          />
                          <button
                            onClick={() => setQtyPrincipalPlus((p) => String(parseInt(p || '0') + 1))}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleValidateProduction}
                      disabled={isSaving || ((!qtyPrincipal || qtyPrincipal === '0') && (!qtyPrincipalPlus || qtyPrincipalPlus === '0'))}
                      className="lg:w-48 h-[68px] rounded-2xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shrink-0"
                    >
                      {isSaving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save size={16} className="group-active:scale-90 transition-transform" />
                          <span>Valider</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Section Journal */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl flex-1 flex flex-col min-h-[400px]">
                  <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-slate-500" />
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Journal du jour</h4>
                    </div>
                    <div className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                      {sortedJournal.length} Session(s)
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950/80 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                        <tr>
                          <th className="px-6 py-3 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => requestSort('timestamp')}>
                            <div className="flex items-center gap-1">Heure<ArrowUpDown size={10} className={sortConfig.key === 'timestamp' ? 'text-indigo-400' : 'opacity-50'} /></div>
                          </th>
                          <th className="px-6 py-3">Magasin</th>
                          <th className="px-6 py-3 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => requestSort('type')}>
                            <div className="flex items-center gap-1">Type<ArrowUpDown size={10} className={sortConfig.key === 'type' ? 'text-indigo-400' : 'opacity-50'} /></div>
                          </th>
                          <th className="px-6 py-3 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => requestSort('author')}>
                            <div className="flex items-center gap-1">Auteur<ArrowUpDown size={10} className={sortConfig.key === 'author' ? 'text-indigo-400' : 'opacity-50'} /></div>
                          </th>
                          <th className="px-6 py-3 text-right cursor-pointer hover:text-slate-300 transition-colors" onClick={() => requestSort('qty')}>
                            <div className="flex items-center justify-end gap-1">Qté<ArrowUpDown size={10} className={sortConfig.key === 'qty' ? 'text-indigo-400' : 'opacity-50'} /></div>
                          </th>
                          <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {sortedJournal.map((entry) => {
                          const isEditing = editingMovementId === entry.id;
                          const dateObj = new Date(entry.timestamp);
                          return (
                            <tr key={entry.id} className="group hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-white text-sm">{dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  <span className="text-[9px] text-slate-500 font-medium">{dateObj.toLocaleDateString()}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                 <span className="text-xs font-bold text-slate-300">{activeWh?.name || 'Inconnu'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${entry.variantId === 'premium' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{getVariantLabel(entry.variantId || 'standard')}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-md">{entry.author || 'Inconnu'}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {isEditing ? (
                                  <div className="flex justify-end">
                                    <input type="number" value={editingQty} onChange={(e) => setEditingQty(e.target.value)} className="w-16 bg-slate-950 border border-slate-700 text-center text-white rounded-lg px-2 py-1 outline-none focus:border-indigo-500 font-bold text-sm" autoFocus />
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-lg font-black text-emerald-400">+{entry.quantity}</span>
                                    <span className="text-[9px] font-black text-slate-600 mt-1">U</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {isEditing ? (
                                    <>
                                      <button onClick={() => setEditingMovementId(null)} className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"><X size={14} /></button>
                                      <button onClick={() => handleSaveEdit(entry.id)} className="p-1.5 rounded-md text-emerald-500 hover:text-white hover:bg-emerald-600 transition-colors"><Check size={14} /></button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => handleStartEdit(entry.id, entry.quantity || 0)} className="p-1.5 rounded-md text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100"><Edit2 size={14} /></button>
                                      <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {sortedJournal.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-16 text-center">
                              <CheckCircle2 size={24} className="text-slate-700 mx-auto mb-2" />
                              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Aucune saisie pour ce magasin</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ContentArea>
      </ModulePageShell>
    </PageContainer>
  );
}
