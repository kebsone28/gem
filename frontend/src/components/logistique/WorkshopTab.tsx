import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Plus,
  Minus,
  Calculator,
  Compass,
  Activity,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Edit2,
  Save,
  X,
  Warehouse,
  Users,
  Package,
  TrendingUp,
  ArrowRightLeft,
  Globe,
  BarChart3,
} from 'lucide-react';
import { SENEGAL_REGIONS, KIT_VARIANTS } from '../../utils/config';
import { useLogistique } from '../../hooks/useLogistique';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function WorkshopTab() {
  const {
    project,
    warehouses,
    warehouseStats,
    globalStats,
    globalVelocity,
    preparatorTeams,
    addWarehouse,
    deleteWarehouse,
    transferStock,
    receiveStock,
    movementHistory,
    addPreparatorLoading,
    updateWarehouseCoords,
  } = useLogistique();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | 'global'>('global');
  const [editingCoords, setEditingCoords] = useState(false);
  const [coordForm, setCoordForm] = useState({ lat: '', lng: '', address: '' });
  const [loadingInputs, setLoadingInputs] = useState<Record<string, string>>({});
  const [loadingVariants, setLoadingVariants] = useState<Record<string, string>>({});
  const [addingWarehouse, setAddingWarehouse] = useState(false);
  const [newWhForm, setNewWhForm] = useState({ name: '', region: '' });

  // UI Modals / Forms
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingWh, setReceivingWh] = useState<string | null>(null);
  const [receiveForm, setReceiveForm] = useState({ quantity: '', source: '' });
  const [transferForm, setTransferForm] = useState({ from: '', to: '', qty: '' });

  const totalHouses =
    (project as any)?.totalHouses ||
    project?.config?.grappesConfig?.grappes?.reduce(
      (s: number, g: any) => s + (g.nb_menages || 0),
      0
    ) ||
    3500;

  const isGlobal = selectedWarehouseId === 'global';
  const activeWh = isGlobal ? null : warehouseStats?.find((w) => w.id === selectedWarehouseId);

  const velocity = isGlobal ? globalVelocity : activeWh?.teamVelocity || 0;
  const kitsLoadedToday = isGlobal ? globalStats.todayLoaded : activeWh?.kitsLoadedToday || 0;
  const kitsConsumed = isGlobal ? globalStats.totalConsumed : activeWh?.kitsConsumed || 0;
  const totalLoaded = isGlobal ? globalStats.totalLoaded : activeWh?.kitsLoadedAllTime || 0;

  const progress = Math.min(100, Math.round((totalLoaded / totalHouses) * 100));
  const daysRemaining = velocity > 0 ? Math.ceil((totalHouses - totalLoaded) / velocity) : 999;
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysRemaining);

  let healthBadge = { text: 'En Avance', color: 'emerald', icon: CheckCircle2 };
  if (velocity < 10) healthBadge = { text: 'Inactif', color: 'slate', icon: AlertTriangle };
  else if (velocity < 30) healthBadge = { text: 'En Retard', color: 'rose', icon: AlertTriangle };
  else if (velocity < 40) healthBadge = { text: 'Sous Tension', color: 'amber', icon: Activity };

  // Isolated teams for the active warehouse
  const filteredTeams = isGlobal
    ? []
    : preparatorTeams.filter((t) => !t.regionId || t.regionId === activeWh?.regionId);

  const handleSaveLoading = async (whId: string, teamId: string, teamName: string) => {
    const qty = parseInt(loadingInputs[teamId] || '0');
    const variantId = loadingVariants[teamId] || 'standard';
    if (qty <= 0) return;
    await addPreparatorLoading(whId, teamId, teamName, qty, variantId);
    setLoadingInputs((prev) => ({ ...prev, [teamId]: '' }));
    setLoadingVariants((prev) => ({ ...prev, [teamId]: '' }));
    toast.success(`Chargement ${qty} kits (${variantId}) enregistré !`);
  };

  const handleReceiveStock = async () => {
    if (!receivingWh || !receiveForm.quantity || !receiveForm.source) {
      toast.error('Veuillez remplir tous les champs correctement');
      return;
    }
    const qty = parseInt(receiveForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantité invalide');
      return;
    }
    await receiveStock(receivingWh, qty, receiveForm.source);
    setShowReceiveModal(false);
    setReceiveForm({ quantity: '', source: '' });
    setReceivingWh(null);
    toast.success('Réception de matériel enregistrée !');
  };

  const handleDeleteWarehouse = async (id: string, name: string) => {
    const stats = warehouseStats.find((s) => s.id === id);
    const remainingStock = Math.max(0, (stats?.kitsLoadedToday || 0) - (stats?.kitsConsumed || 0));

    if (remainingStock > 0) {
      toast.error(
        `Impossible de supprimer "${name}" : il reste ${remainingStock} kits en stock. Transférez le stock d'abord.`
      );
      return;
    }

    if (
      !confirm(
        `Souhaitez-vous vraiment supprimer le magasin "${name}" ? Cette action est réversible par un administrateur.`
      )
    )
      return;

    await deleteWarehouse(id);
    setSelectedWarehouseId('global');
    toast.success(`Magasin "${name}" supprimé ✓`);
  };

  const handleTransfer = async () => {
    const qty = parseInt(transferForm.qty);
    if (!transferForm.from || !transferForm.to || isNaN(qty) || qty <= 0) {
      toast.error('Veuillez remplir tous les champs correctement');
      return;
    }
    if (transferForm.from === transferForm.to) {
      toast.error('Les magasins source et destination doivent être différents');
      return;
    }

    const sourceWh = warehouseStats.find((w) => w.id === transferForm.from);
    const sourceStock = Math.max(
      0,
      (sourceWh?.kitsLoadedToday || 0) - (sourceWh?.kitsConsumed || 0)
    );

    if (qty > sourceStock) {
      toast.error(`Stock insuffisant dans le magasin source (Disponible: ${sourceStock})`);
      return;
    }

    await transferStock(transferForm.from, transferForm.to, qty);
    setShowTransferModal(false);
    setTransferForm({ from: '', to: '', qty: '' });
    toast.success(`Transfert de ${qty} kits effectué ✓`);
  };

  const handleSaveCoords = async () => {
    if (!activeWh) return;
    const lat = parseFloat(coordForm.lat);
    const lng = parseFloat(coordForm.lng);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Coordonnées invalides');
      return;
    }
    await updateWarehouseCoords(activeWh.id, lat, lng, coordForm.address);
    setEditingCoords(false);
    toast.success('Coordonnées du magasin mises à jour ✓');
  };

  const handleAddWarehouse = async () => {
    if (!newWhForm.name || !newWhForm.region) {
      toast.error('Nom et région requis');
      return;
    }
    await addWarehouse(newWhForm.name, newWhForm.region);
    setAddingWarehouse(false);
    setNewWhForm({ name: '', region: '' });
    toast.success('Magasin créé ✓');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header: Warehouse Selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mr-2">
          Vue :
        </span>

        <button
          onClick={() => setSelectedWarehouseId('global')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
            selectedWarehouseId === 'global'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Globe size={14} />
          Réseau National
        </button>

        <div className="w-px h-6 bg-slate-800 mx-2" />

        {warehouses?.map((wh) => (
          <div key={wh.id} className="relative group">
            <button
              onClick={() => setSelectedWarehouseId(wh.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                selectedWarehouseId === wh.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Warehouse size={14} />
              {wh.name}
              {warehouseStats?.find((s) => s.id === wh.id)?.hasAlert && (
                <span className="w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            {!isGlobal && selectedWarehouseId === wh.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteWarehouse(wh.id, wh.name);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                aria-label="Supprimer ce magasin"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => setAddingWarehouse(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-slate-900 border border-dashed border-slate-700 text-slate-500 hover:text-white hover:border-blue-500 transition-all"
        >
          <Plus size={14} />
          Ajouter Magasin
        </button>

        <button
          onClick={() => setShowTransferModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-indigo-900/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all ml-auto"
        >
          <ArrowRightLeft size={14} />
          Transfert Stock
        </button>
      </div>

      {/* Modals: Add & Transfer */}
      {addingWarehouse && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md">
            <h3 className="text-xl font-black text-white mb-6">Nouveau Magasin</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Nom
                </label>
                <input
                  value={newWhForm.name}
                  onChange={(e) => setNewWhForm((p) => ({ ...p, name: e.target.value }))}
                  className="mt-2 w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Magasin Kaffrine Sud"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Région
                </label>
                <select
                  aria-label="Région du nouveau magasin"
                  value={newWhForm.region}
                  onChange={(e) => setNewWhForm((p) => ({ ...p, region: e.target.value }))}
                  className="mt-2 w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sélectionner une région...</option>
                  {SENEGAL_REGIONS.map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAddingWarehouse(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleAddWarehouse}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
              <ArrowRightLeft className="text-indigo-400" />
              Transfert de Kits
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  De (Source)
                </label>
                <select
                  aria-label="Magasin source"
                  value={transferForm.from}
                  onChange={(e) => setTransferForm((p) => ({ ...p, from: e.target.value }))}
                  className="mt-2 w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Source...</option>
                  {warehouseStats.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (Stock: {Math.max(0, w.kitsLoadedToday - w.kitsConsumed)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Vers (Destination)
                </label>
                <select
                  title="Magasin destination"
                  value={transferForm.to}
                  onChange={(e) => setTransferForm((p) => ({ ...p, to: e.target.value }))}
                  className="mt-2 w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Destination...</option>
                  {warehouses
                    .filter((w) => w.id !== transferForm.from)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Quantité (Kits)
                </label>
                <input
                  type="number"
                  value={transferForm.qty}
                  onChange={(e) => setTransferForm((p) => ({ ...p, qty: e.target.value }))}
                  className="mt-2 w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                  placeholder="Nombre de kits complets"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleTransfer}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all"
              >
                Confirmer Transfert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Stock/Consolidated or Map/Teams */}
        <div className="lg:col-span-3 space-y-6">
          {isGlobal ? (
            /* National Global Dashboard */
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8">
                <div className="flex items-center gap-3 mb-8">
                  <BarChart3 className="text-indigo-400" />
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                    Tableau de Bord National
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                      Stock Pivot
                    </p>
                    <p className="text-3xl font-black text-white">{globalStats.totalAvailable}</p>
                    <p className="text-xs text-slate-400 mt-2 font-bold uppercase">
                      Kits Disponibles
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                      Chargements / Jour
                    </p>
                    <p className="text-3xl font-black text-white">{globalStats.todayLoaded}</p>
                    <p className="text-xs text-indigo-400 mt-2 font-bold uppercase">
                      Tous Magasins
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                      En Transit
                    </p>
                    <p className="text-3xl font-black text-amber-500">{globalStats.inTransit}</p>
                    <p className="text-xs text-slate-400 mt-2 font-bold uppercase">
                      Livraisons Terrain
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                      Installations
                    </p>
                    <p className="text-3xl font-black text-emerald-500">
                      {globalStats.totalConsumed}
                    </p>
                    <p className="text-xs text-slate-400 mt-2 font-bold uppercase">
                      Foyers Conformes
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Répartition par Zone
                  </h4>
                  <div className="space-y-3">
                    {warehouseStats.map((ws) => (
                      <div
                        key={ws.id}
                        className="bg-slate-950/40 border border-slate-800 px-6 py-4 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white">
                            <Warehouse size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{ws.name}</p>
                            <p className="text-xs text-slate-500 font-bold uppercase">
                              {ws.region}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-white">
                            {Math.max(0, ws.kitsLoadedToday - ws.kitsConsumed)}{' '}
                            <span className="text-xs text-slate-500">KITS</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-24 h-1 bg-slate-800 rounded-full">
                              <motion.div
                                className="h-full bg-blue-500 rounded-full"
                                initial={false}
                                animate={{
                                  width: `${Math.min(100, (ws.kitsLoadedAllTime / (totalHouses / warehouses.length)) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500">
                              {Math.round(
                                (ws.kitsLoadedAllTime / (totalHouses / warehouses.length)) * 100
                              )}
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            activeWh && (
              /* Specific Warehouse View */
              <>
                {/* Stock Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                    <Compass size={100} className="text-blue-500" />
                  </div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Package className="text-blue-400" size={20} />
                      <h3 className="text-xl font-black text-white">
                        Stock Local : {activeWh.name}
                      </h3>
                    </div>
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-${healthBadge.color}-500/10 border border-${healthBadge.color}-500/30`}
                    >
                      <healthBadge.icon size={14} className={`text-${healthBadge.color}-400`} />
                      <span className={`text-${healthBadge.color}-400 font-bold text-xs`}>
                        {healthBadge.text}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: 'Chargés (Auj)', val: kitsLoadedToday, color: 'blue' },
                      { label: 'Consommés (Zone)', val: kitsConsumed, color: 'emerald' },
                      {
                        label: 'Disponible',
                        val: Math.max(0, kitsLoadedToday - kitsConsumed),
                        color: activeWh?.hasAlert ? 'rose' : 'slate',
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className={`bg-slate-950/60 border border-${card.color}-500/20 rounded-2xl p-4 text-center`}
                      >
                        <p className="text-3xl font-black text-white">{card.val}</p>
                        <p
                          className={`text-xs font-bold text-${card.color}-400 uppercase tracking-widest mt-1`}
                        >
                          {card.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setReceivingWh(activeWh.id);
                        setShowReceiveModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-black uppercase tracking-widest transition-all border border-emerald-500/20"
                    >
                      <Plus size={14} />
                      Réception Matériel
                    </button>
                  </div>

                  {activeWh?.hasAlert && (
                    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                      <AlertTriangle size={16} className="text-red-400 shrink-0" />
                      <p className="text-red-300 text-xs font-semibold">
                        Risque de rupture locale. Stock insuffisant pour la cadence actuelle.
                      </p>
                    </div>
                  )}
                </div>

                {/* GPS Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="text-orange-400" size={18} />
                      <h4 className="font-black text-white">Localisation</h4>
                    </div>
                    {!editingCoords && (
                      <button
                        onClick={() => {
                          setCoordForm({
                            lat: activeWh?.latitude?.toString() || '',
                            lng: activeWh?.longitude?.toString() || '',
                            address: activeWh?.address || '',
                          });
                          setEditingCoords(true);
                        }}
                        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-semibold transition-all"
                      >
                        <Edit2 size={14} />
                        Modifier
                      </button>
                    )}
                  </div>

                  {editingCoords ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Latitude
                          </label>
                          <input
                            value={coordForm.lat}
                            onChange={(e) => setCoordForm((p) => ({ ...p, lat: e.target.value }))}
                            className="mt-1 w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                            placeholder="Ex: 14.1050"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Longitude
                          </label>
                          <input
                            value={coordForm.lng}
                            onChange={(e) => setCoordForm((p) => ({ ...p, lng: e.target.value }))}
                            className="mt-1 w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                            placeholder="Ex: -15.5560"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Adresse Physique
                        </label>
                        <input
                          value={coordForm.address}
                          onChange={(e) => setCoordForm((p) => ({ ...p, address: e.target.value }))}
                          className="mt-1 w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                          placeholder="Ex: Route nationale, Kaffrine"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setEditingCoords(false)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all"
                        >
                          <X size={14} /> Annuler
                        </button>
                        <button
                          onClick={handleSaveCoords}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-500 transition-all"
                        >
                          <Save size={14} /> Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeWh?.latitude && activeWh?.longitude ? (
                        <>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
                              {activeWh.latitude.toFixed(6)}, {activeWh.longitude.toFixed(6)}
                            </span>
                          </div>
                          {activeWh.address && (
                            <p className="text-slate-400 text-sm">{activeWh.address}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-slate-600 dark:text-slate-400 text-sm italic">
                          Cliquez "Modifier" pour géolocaliser ce magasin.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Preparator Teams Filtered by Role & Region */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-950">
                    <Users size={16} className="text-blue-400" />
                    <h4 className="font-black text-white uppercase tracking-tight text-sm">
                      Équipes de Préparation : {activeWh.region}
                    </h4>
                  </div>
                  <div className="px-6 py-3 bg-blue-900/10 border-b border-blue-900/30">
                    <p className="text-blue-400 text-xs leading-relaxed font-black uppercase tracking-widest">
                      Isolation ERP : Seules les équipes de rôle "PRÉPARATION" assignées à cette
                      zone sont affichées.
                    </p>
                  </div>

                  {filteredTeams.length > 0 ? (
                    <div className="divide-y divide-slate-800">
                      {filteredTeams.map((team) => {
                        const todayLoading = activeWh?.preparatorTeams
                          ?.find((pt: any) => pt.teamId === team.id)
                          ?.loadings?.find(
                            (l: any) => l.date === new Date().toISOString().split('T')[0]
                          );
                        return (
                          <div
                            key={team.id}
                            className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/20 transition-all"
                          >
                            <div className="flex-1">
                              <p className="font-bold text-white text-sm">{team.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 uppercase tracking-widest">
                                  {team.tradeKey || 'EQUIPE'}
                                </span>
                                {team.children && team.children.length > 0 && (
                                  <span className="text-xs text-slate-500 font-bold uppercase">
                                    {team.children.length} UNITÉS
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {todayLoading && (
                                <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                                  {todayLoading.kitsLoaded} KITS ✓
                                </span>
                              )}
                              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                                <select
                                  aria-label="Type de Kit"
                                  value={loadingVariants[team.id] || 'standard'}
                                  onChange={(e) =>
                                    setLoadingVariants((p) => ({ ...p, [team.id]: e.target.value }))
                                  }
                                  className="bg-transparent text-xs font-black text-slate-400 outline-none border-r border-slate-800 pr-1 mr-1 uppercase"
                                >
                                  {KIT_VARIANTS.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.id.split('_')[0]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  aria-label="Diminuer"
                                  onClick={() =>
                                    setLoadingInputs((p) => ({
                                      ...p,
                                      [team.id]: String(
                                        Math.max(0, parseInt(p[team.id] || '0') - 1)
                                      ),
                                    }))
                                  }
                                  className="w-8 h-8 hover:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-all"
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={loadingInputs[team.id] || ''}
                                  onChange={(e) =>
                                    setLoadingInputs((p) => ({ ...p, [team.id]: e.target.value }))
                                  }
                                  placeholder="0"
                                  className="w-12 text-center bg-transparent text-white text-sm font-black outline-none"
                                />
                                <button
                                  aria-label="Augmenter"
                                  onClick={() =>
                                    setLoadingInputs((p) => ({
                                      ...p,
                                      [team.id]: String(parseInt(p[team.id] || '0') + 1),
                                    }))
                                  }
                                  className="w-8 h-8 hover:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-all"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                              <button
                                aria-label="Enregistrer les chargements"
                                onClick={() => handleSaveLoading(activeWh!.id, team.id, team.name)}
                                className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg active:scale-95"
                              >
                                <Save size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <Users
                        size={40}
                        className="text-slate-800 dark:text-slate-100 mx-auto mb-4"
                      />
                      <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">
                        Aucune équipe de préparation trouvée pour "{activeWh.region}"
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                        Configurez le rôle ERP et la région dans{' '}
                        <Link to="/settings" className="text-blue-500 hover:underline">
                          Settings {'>'} Équipes
                        </Link>
                        .
                      </p>
                    </div>
                  )}
                </div>

                {/* Journal de Bord (Specific to this Warehouse) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-950">
                    <Activity size={16} className="text-amber-400" />
                    <h4 className="font-black text-white uppercase tracking-tight text-sm">
                      Journal de Bord : {activeWh.name}
                    </h4>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-800/50">
                    {movementHistory.filter(
                      (m: any) =>
                        m.warehouseId === activeWh.id ||
                        m.fromId === activeWh.id ||
                        m.toId === activeWh.id
                    ).length > 0 ? (
                      movementHistory
                        .filter(
                          (m: any) =>
                            m.warehouseId === activeWh.id ||
                            m.fromId === activeWh.id ||
                            m.toId === activeWh.id
                        )
                        .map((move: any) => (
                          <div
                            key={move.id}
                            className="px-6 py-3 hover:bg-slate-800/20 transition-all flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-2 h-2 rounded-full ${move.type === 'ENTRY' ? 'bg-emerald-500' : move.type === 'TRANSFER' ? 'bg-amber-500' : 'bg-blue-500'}`}
                              />
                              <div>
                                <p className="text-xs font-bold text-slate-200">{move.label}</p>
                                <p className="text-xs text-slate-500 font-medium">
                                  {new Date(move.timestamp).toLocaleDateString('fr-FR')} à{' '}
                                  {new Date(move.timestamp).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-xs font-black ${move.type === 'ENTRY' ? 'text-emerald-400' : move.type === 'TRANSFER' ? 'text-amber-400' : 'text-blue-400'}`}
                              >
                                {move.type === 'ENTRY' ? '+' : '-'}
                                {move.quantity} KITS
                              </p>
                              {move.variantId && (
                                <p className="text-xs text-slate-500 font-bold uppercase">
                                  {move.variantId}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="p-8 text-center text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Aucun historique disponible
                      </div>
                    )}
                  </div>
                </div>
              </>
            )
          )}
        </div>

        {/* --- MODALS --- */}
        {/* Modal Réception Matériel */}
        {showReceiveModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">
                Réception de Matériel
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                Enregistrez l'arrivée de nouveaux kits dans ce magasin.
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="receive_qty"
                    className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2"
                  >
                    Quantité (Kits)
                  </label>
                  <input
                    id="receive_qty"
                    type="number"
                    aria-label="Quantité"
                    value={receiveForm.quantity}
                    onChange={(e) => setReceiveForm((p) => ({ ...p, quantity: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="receive_source"
                    className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2"
                  >
                    Source / Fournisseur
                  </label>
                  <input
                    id="receive_source"
                    type="text"
                    title="Source"
                    value={receiveForm.source}
                    onChange={(e) => setReceiveForm((p) => ({ ...p, source: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: Arrivage Dakar Central"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowReceiveModal(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleReceiveStock}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/40 transition-all"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Right: Intelligence GEM */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/20 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group sticky top-6">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all" />

            <div className="flex items-center gap-3 mb-6">
              <Zap className="text-indigo-400 fill-indigo-400/20" />
              <h3 className="text-xl font-black text-white tracking-tight uppercase">
                Intelligence Réseau
              </h3>
            </div>

            <div className="mb-8">
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">
                Date d'Achèvement Cible
              </p>
              <p className="text-2xl font-black text-white">
                {daysRemaining < 9999
                  ? estimatedDate.toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Recueillez plus de données'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase">
                  J-{daysRemaining}
                </span>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  à la vitesse actuelle
                </p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between text-xs font-black uppercase mb-3">
                <span className="text-slate-500 tracking-widest">
                  Progressions Travaux ({totalHouses} ménages)
                </span>
                <span className="text-indigo-400">{progress}%</span>
              </div>
              <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <p className="text-xs text-indigo-200/40 font-black uppercase tracking-widest">
                Cadence Globale
              </p>
              <div className="flex items-center gap-4 p-5 bg-slate-950/50 rounded-2xl border border-slate-800 group-hover:border-indigo-500/30 transition-colors">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-3xl font-black text-white">{velocity}</p>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    Installations / Jour (Moy 7j)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-start gap-4">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
                <Calculator size={18} />
              </div>
              <p className="text-xs text-indigo-300 font-black leading-relaxed uppercase tracking-wider">
                Les prévisions d'intelligence artificielle "GEM" s'ajustent en temps réel aux
                performances des équipes de terrain et aux capacités logistiques des magasins.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
