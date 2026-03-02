import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    DollarSign,
    Database,
    Layers,
    Download,
    Upload,
    Trash2,
    Settings as SettingsIcon,
    Wrench,
    Truck,
    MapPin,
    Zap
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Team, SubTeam, CatalogItem, SubTeamEquipment } from '../utils/types';
import { db } from '../store/db';
import { generateDynamicGrappes } from '../utils/clustering';

type TabType = 'teams' | 'costs' | 'zones' | 'logistics' | 'data';

export default function Settings() {
    const [activeTab, setActiveTab] = useState<TabType>('teams');
    const { project, updateProject, isLoading } = useProject();

    if (isLoading) return <div className="p-8 text-slate-400">Chargement...</div>;

    const tabs = [
        { id: 'teams', label: 'Équipes', icon: Users },
        { id: 'costs', label: 'Tarifs', icon: DollarSign },
        { id: 'zones', label: 'Zones & Affectations', icon: Layers },
        { id: 'logistics', label: 'Dotations & Logistique', icon: Wrench },
        { id: 'data', label: 'Données', icon: Database },
    ];

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                            <SettingsIcon className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Configuration</h1>
                            <p className="text-slate-500 font-medium">Gérez les paramètres globaux de votre projet</p>
                        </div>
                    </div>
                </header>

                {/* Tabs Navigation */}
                <div className="flex gap-2 p-1 bg-slate-900/50 rounded-2xl border border-slate-800/50 overflow-x-auto no-scrollbar" role="tablist">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-controls={`panel-${tab.id}`}
                            id={`tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            <tab.icon size={18} />
                            <span className="font-bold text-sm">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <main className="bg-slate-900/30 rounded-[2.5rem] border border-slate-800/50 p-6 md:p-10 backdrop-blur-xl">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            id={`panel-${activeTab}`}
                            role="tabpanel"
                            aria-labelledby={`tab-${activeTab}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'teams' && <TeamsSection project={project} onUpdate={updateProject} />}
                            {activeTab === 'costs' && <CostsSection project={project} onUpdate={updateProject} />}
                            {activeTab === 'zones' && <ZonesSection project={project} onUpdate={updateProject} />}
                            {activeTab === 'logistics' && <LogisticsSection project={project} onUpdate={updateProject} />}
                            {activeTab === 'data' && <DataSection project={project} onUpdate={updateProject} />}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}

function TeamsSection({ project, onUpdate }: { project: any, onUpdate: any }) {
    const teams: Team[] = project?.config?.teams || [];
    const productionRates = project?.config?.productionRates || { macons: 5, reseau: 8, interieur_type1: 6, controle: 15 };

    const handleUpdateProductionRate = (trade: string, value: number) => {
        onUpdate({
            config: {
                ...project.config,
                productionRates: { ...productionRates, [trade]: value }
            }
        });
    };

    const handleAddTeam = () => {
        const newTeam: Team = {
            id: `team_${Date.now()}`,
            name: `Entreprise / Groupement ${teams.length + 1}`,
            type: 'macons',
            capacity: 2,
            subTeams: []
        };
        onUpdate({
            config: { ...project.config, teams: [...teams, newTeam] }
        });
    };

    const handleAddSubTeam = (parentId: string, parentType: string) => {
        const teamIndex = teams.findIndex(t => t.id === parentId);
        if (teamIndex === -1) return;
        const parent = teams[teamIndex];
        const subTeams = parent.subTeams || [];
        const prefixe = parentType === 'macons' ? 'Eq-macon' : parentType === 'reseau' ? 'Eq-reseau' : parentType === 'interieur_type1' ? 'Eq-interieur' : 'Eq-controle';

        const newSubTeam: SubTeam = {
            id: `sub_${Date.now()}`,
            name: `${prefixe}${subTeams.length + 1}`,
            leader: ''
        };
        handleUpdateTeam(parentId, 'subTeams', [...subTeams, newSubTeam]);
    };

    const handleUpdateSubTeam = (parentId: string, subId: string, field: 'name' | 'leader' | 'phone', value: string) => {
        const teamIndex = teams.findIndex(t => t.id === parentId);
        if (teamIndex === -1) return;
        const parent = teams[teamIndex];
        const subTeams = parent.subTeams || [];
        const updatedSubs = subTeams.map(st => st.id === subId ? { ...st, [field]: value } : st);
        handleUpdateTeam(parentId, 'subTeams', updatedSubs);
    };

    const handleDeleteSubTeam = (parentId: string, subId: string) => {
        const teamIndex = teams.findIndex(t => t.id === parentId);
        if (teamIndex === -1) return;
        const parent = teams[teamIndex];
        const subTeams = parent.subTeams || [];
        const updatedSubs = subTeams.filter(st => st.id !== subId);
        handleUpdateTeam(parentId, 'subTeams', updatedSubs);
    };

    const handleUpdateTeam = (id: string, field: keyof Team, value: any) => {
        const newTeams = teams.map(t => t.id === id ? { ...t, [field]: value } : t);
        onUpdate({ config: { ...project.config, teams: newTeams } });
    };

    const handleDeleteTeam = (id: string) => {
        if (!window.confirm("Supprimer cette équipe ?")) return;
        const newTeams = teams.filter(t => t.id !== id);
        onUpdate({ config: { ...project.config, teams: newTeams } });
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <Users className="text-indigo-500" />
                    Gestion des Équipes
                </h2>
                <div className="flex gap-4 items-center">
                    <div className="p-2 px-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                        <span className="text-indigo-400 text-sm font-bold">Total: {teams.length} équipes</span>
                    </div>
                    <button
                        onClick={handleAddTeam}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                    >
                        + Ajouter une Équipe
                    </button>
                </div>
            </div>

            {/* Standard Trade Capacities */}
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800/50 mb-8 space-y-4">
                <h3 className="text-white font-bold text-lg mb-2">Cadence de production standard (Foyers / Jour / Équipe)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { id: 'macons', label: 'Maçons', default: 5 },
                        { id: 'reseau', label: 'Réseau', default: 8 },
                        { id: 'interieur_type1', label: 'Intérieur', default: 6 },
                        { id: 'controle', label: 'Contrôleurs', default: 15 }
                    ].map(trade => (
                        <div key={trade.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{trade.label}</label>
                            <input
                                type="number"
                                title={`Cadence ${trade.label} (foyers/jour)`}
                                placeholder={String(trade.default)}
                                value={productionRates[trade.id] ?? trade.default}
                                onChange={e => handleUpdateProductionRate(trade.id, parseInt(e.target.value) || 1)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-black focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-500 italic mt-2">Ces valeurs sont utilisées par le Moteur d'Optimisation (Simulation).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map(team => (
                    <div key={team.id} className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800/50 group hover:border-indigo-500/50 transition-all relative">
                        <button
                            onClick={() => handleDeleteTeam(team.id)}
                            title="Supprimer cette équipe"
                            aria-label="Supprimer cette équipe"
                            className="absolute top-4 right-4 text-slate-600 hover:text-red-500 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>

                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nom de l'équipe</label>
                                <input
                                    title="Nom de l'équipe"
                                    placeholder="Nom de l'équipe"
                                    value={team.name}
                                    onChange={e => handleUpdateTeam(team.id, 'name', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Métier</label>
                                    <input
                                        list="trades-list"
                                        value={team.type}
                                        onChange={e => handleUpdateTeam(team.id, 'type', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Taper ou sélectionner..."
                                    />
                                    <datalist id="trades-list">
                                        <option value="macons">Maçons</option>
                                        <option value="reseau">Réseau</option>
                                        <option value="interieur_type1">Intérieur</option>
                                        <option value="controle">Contrôle</option>
                                    </datalist>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Effectif</label>
                                    <input
                                        type="number"
                                        title="Effectif de l'équipe"
                                        placeholder="2"
                                        value={team.capacity}
                                        onChange={e => handleUpdateTeam(team.id, 'capacity', parseInt(e.target.value) || 1)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Contact Principal / Entreprise</label>
                                <div className="flex gap-2">
                                    <input
                                        placeholder="Nom du contact"
                                        value={team.leader || ''}
                                        onChange={e => handleUpdateTeam(team.id, 'leader', e.target.value)}
                                        className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <input
                                        title="Numéro de téléphone"
                                        placeholder="Téléphone"
                                        value={team.phone || ''}
                                        onChange={e => handleUpdateTeam(team.id, 'phone', e.target.value)}
                                        className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800/50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Sous-équipes Terrain ({(team.subTeams || []).length})</label>
                                    <button
                                        onClick={() => handleAddSubTeam(team.id, team.type)}
                                        className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-lg font-bold transition-colors"
                                    >
                                        + Sous-équipe
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {(team.subTeams || []).map(st => (
                                        <div key={st.id} className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 relative group">
                                            <input
                                                value={st.name}
                                                onChange={e => handleUpdateSubTeam(team.id, st.id, 'name', e.target.value)}
                                                placeholder="N° Equipe"
                                                className="w-[90px] bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                            <input
                                                value={st.leader}
                                                onChange={e => handleUpdateSubTeam(team.id, st.id, 'leader', e.target.value)}
                                                placeholder="Nom du Chef"
                                                className="w-[120px] bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                            <input
                                                value={st.phone || ''}
                                                onChange={e => handleUpdateSubTeam(team.id, st.id, 'phone', e.target.value)}
                                                placeholder="Téléphone"
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                            <button
                                                onClick={() => handleDeleteSubTeam(team.id, st.id)}
                                                title="Supprimer cette sous-équipe"
                                                aria-label="Supprimer cette sous-équipe"
                                                className="text-slate-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!team.subTeams || team.subTeams.length === 0) && (
                                        <div className="text-xs text-slate-500 text-center py-2 italic font-medium">
                                            Aucune sous-équipe. Les affectations terrain nécessitent au moins une sous-équipe.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CostsSection({ project, onUpdate }: { project: any, onUpdate: any }) {
    const teams = project?.config?.teams || [];
    const costs = project?.config?.costs || {};
    const staffRates = costs.staffRates || {};
    const vehicleRental = costs.vehicleRental || {};

    const materialCatalog: CatalogItem[] = project?.config?.materialCatalog || [
        { id: 'cat_1', name: 'Casque de Chantier', category: 'Securité', purchasePrice: 5000, rentalPrice: 0 },
        { id: 'cat_2', name: 'Gilet Réfléchissant', category: 'Securité', purchasePrice: 2000, rentalPrice: 0 },
        { id: 'cat_3', name: 'Perforateur', category: 'Portatif', purchasePrice: 150000, rentalPrice: 5000 },
        { id: 'cat_4', name: 'Epi', category: 'Logistique', purchasePrice: 0, rentalPrice: 1000 }
    ];

    const handleUpdateRate = (category: 'staffRates' | 'vehicleRental', key: string, field: string, value: any) => {
        const newCategory = { ...(costs[category] || {}) };
        if (category === 'staffRates') {
            if (!newCategory[key]) newCategory[key] = { amount: 0, mode: 'daily' };
            newCategory[key] = { ...newCategory[key], [field]: value };
        } else {
            newCategory[key] = value;
        }

        onUpdate({
            config: {
                ...project.config,
                costs: { ...costs, [category]: newCategory }
            }
        });
    };

    const handleAddCatalogItem = () => {
        const newItem: CatalogItem = {
            id: `item_${Date.now()}`,
            name: 'Nouveau Matériel',
            category: 'Autre',
            purchasePrice: 0,
            rentalPrice: 0
        };
        onUpdate({
            config: {
                ...project.config,
                materialCatalog: [...materialCatalog, newItem]
            }
        });
    };

    const handleUpdateCatalogItem = (id: string, field: keyof CatalogItem, value: any) => {
        const newCatalog = materialCatalog.map(item => item.id === id ? { ...item, [field]: value } : item);
        onUpdate({ config: { ...project.config, materialCatalog: newCatalog } });
    };

    const handleDeleteCatalogItem = (id: string) => {
        const newCatalog = materialCatalog.filter(item => item.id !== id);
        onUpdate({ config: { ...project.config, materialCatalog: newCatalog } });
    };

    return (
        <div className="space-y-12">
            <div className="space-y-6">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <DollarSign className="text-emerald-500" />
                    Rémunération des Équipes
                </h2>

                {(!teams || teams.length === 0) ? (
                    <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800/50 text-center">
                        <p className="text-slate-500 italic">Aucune équipe n'a encore été ajoutée. Veuillez définir des équipes dans la rubrique "Équipes".</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map((team: any) => {
                            const rate = staffRates[team.id] || { amount: 0, mode: 'daily' };
                            const subTeamCount = (team.subTeams || []).length;
                            const tradeLabel = team.type === 'macons' ? 'Maçonnerie' : team.type === 'reseau' ? 'Réseau' : team.type === 'interieur_type1' ? 'Intérieur' : team.type === 'controle' ? 'Contrôle' : team.type;

                            return (
                                <div key={team.id} className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800/50 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
                                    <div className="mb-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-white font-bold text-lg">{team.name}</h3>
                                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-1 rounded-lg">
                                                {subTeamCount} Sous-équipe{subTeamCount > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">{tradeLabel}</div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Montant (FCFA)</label>
                                            <input
                                                type="number"
                                                title="Montant en FCFA"
                                                placeholder="0"
                                                value={rate.amount}
                                                onChange={e => handleUpdateRate('staffRates', team.id, 'amount', parseInt(e.target.value) || 0)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Mode de paiement</label>
                                            <select
                                                title="Mode de paiement"
                                                value={rate.mode}
                                                onChange={e => handleUpdateRate('staffRates', team.id, 'mode', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            >
                                                <option value="daily">Par Jour</option>
                                                <option value="monthly">Par Mois</option>
                                                <option value="task">À la tâche</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="w-full h-px bg-slate-800/50"></div>

            <div className="space-y-6">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <Truck className="text-amber-500" />
                    Location Véhicules & Logistique
                </h2>
                <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800/50 max-w-2xl">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {['pick_up', 'camion', 'moto'].map(type => (
                            <div key={type}>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{type.replace('_', ' ')} (FCFA/J)</label>
                                <input
                                    type="number"
                                    title={`Location ${type.replace('_', ' ')} FCFA/jour`}
                                    placeholder="0"
                                    value={vehicleRental[type] || 0}
                                    onChange={e => handleUpdateRate('vehicleRental', type, 'amount', parseInt(e.target.value) || 0)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800/50 max-w-2xl">
                    <h3 className="text-white font-bold mb-4">Véhicule Chef de Projet</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Location (FCFA/Mois)</label>
                            <input
                                type="number"
                                title="Location véhicule CDP (FCFA/Mois)"
                                placeholder="0"
                                value={vehicleRental['cdp_location'] || 0}
                                onChange={e => handleUpdateRate('vehicleRental', 'cdp_location', 'amount', parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Achat (FCFA)</label>
                            <input
                                type="number"
                                title="Achat véhicule CDP (FCFA)"
                                placeholder="0"
                                value={vehicleRental['cdp_achat'] || 0}
                                onChange={e => handleUpdateRate('vehicleRental', 'cdp_achat', 'amount', parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full h-px bg-slate-800/50"></div>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <Wrench className="text-emerald-500" />
                        Catalogue Matériel, Sécurité & Logistique
                    </h2>
                    <button
                        onClick={handleAddCatalogItem}
                        className="px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600 hover:text-white text-emerald-500 text-sm font-bold rounded-xl transition-all border border-emerald-500/20"
                    >
                        + Ajouter Matériel
                    </button>
                </div>

                <div className="bg-slate-950/50 rounded-3xl border border-slate-800/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-900 border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-black">
                                <tr>
                                    <th className="px-6 py-4">Nom du matériel</th>
                                    <th className="px-6 py-4">Catégorie</th>
                                    <th className="px-6 py-4 text-right">Prix d'Achat (FCFA)</th>
                                    <th className="px-6 py-4 text-right">Location Mensuelle (FCFA)</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {materialCatalog.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <input
                                                title="Nom du matériel"
                                                placeholder="Nom du matériel"
                                                value={item.name}
                                                onChange={e => handleUpdateCatalogItem(item.id, 'name', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <select
                                                title="Catégorie du matériel"
                                                value={item.category}
                                                onChange={e => handleUpdateCatalogItem(item.id, 'category', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                            >
                                                <option value="Securité">Sécurité</option>
                                                <option value="Portatif">Portatif</option>
                                                <option value="Logistique">Logistique</option>
                                                <option value="Autre">Autre</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <input
                                                type="number"
                                                title="Prix d'achat (FCFA)"
                                                placeholder="0"
                                                value={item.purchasePrice}
                                                onChange={e => handleUpdateCatalogItem(item.id, 'purchasePrice', parseInt(e.target.value) || 0)}
                                                className="w-32 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm text-right focus:ring-1 focus:ring-emerald-500 outline-none ml-auto"
                                            />
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <input
                                                type="number"
                                                title="Location mensuelle (FCFA)"
                                                placeholder="0"
                                                value={item.rentalPrice}
                                                onChange={e => handleUpdateCatalogItem(item.id, 'rentalPrice', parseInt(e.target.value) || 0)}
                                                className="w-32 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm text-right focus:ring-1 focus:ring-emerald-500 outline-none ml-auto"
                                            />
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <button
                                                onClick={() => handleDeleteCatalogItem(item.id)}
                                                title="Supprimer ce matériel"
                                                aria-label="Supprimer ce matériel du catalogue"
                                                className="text-slate-500 hover:text-red-500 p-2 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {materialCatalog.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                                            Aucun matériel dans le catalogue.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ZonesSection({ project, onUpdate }: { project: any, onUpdate: any }) {
    const subGrappes = useLiveQuery(() => db.zones.toArray()) || [];
    const teams: Team[] = project?.config?.teams || [];
    const assignments = project?.config?.assignments || {};

    const handleAssign = (sgId: string, trade: string, teamId: string) => {
        const newAssignments = { ...assignments };
        if (!newAssignments[sgId]) newAssignments[sgId] = {};

        if (teamId) {
            newAssignments[sgId][trade] = [teamId];
        } else {
            delete newAssignments[sgId][trade];
        }

        onUpdate({
            config: {
                ...project.config,
                assignments: newAssignments
            }
        });
    };

    const trades = [
        { id: 'macons', label: 'Maçons' },
        { id: 'reseau', label: 'Réseau' },
        { id: 'interieur_type1', label: 'Intérieur' },
        { id: 'controle', label: 'Contrôle' }
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <Layers className="text-emerald-500" />
                    Zones & Affectations ({subGrappes.length})
                </h2>
                <div className="p-2 px-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                    <span className="text-emerald-400 text-sm font-bold">Base Kobo synchronisée</span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {subGrappes.map((sg: any) => (
                    <div key={sg.id} className="bg-slate-950/20 p-6 rounded-3xl border border-slate-800/50 flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <span className="text-indigo-400 font-black text-xs block mb-1">{sg.code}</span>
                            <h4 className="text-white font-bold">{sg.nom}</h4>
                            <div className="mt-4 flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase">
                                <span className="flex items-center gap-1"><Users size={12} /> {sg.nb_menages} Ménages</span>
                                <span className="text-slate-700">|</span>
                                <span>{sg.region}</span>
                            </div>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                            {trades.map(trade => {
                                const availableTeams = teams.filter(t => t.type === trade.id);
                                const currentAssigned = assignments[sg.id]?.[trade.id]?.[0] || '';
                                return (
                                    <div key={trade.id}>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1 truncate">{trade.label}</label>
                                        <select
                                            title={`Équipe ${trade.label} pour ${sg.nom}`}
                                            value={currentAssigned}
                                            onChange={(e) => handleAssign(sg.id, trade.id, e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-white text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                        >
                                            <option value="">Non affecté</option>
                                            {availableTeams.map(t => (
                                                <optgroup key={t.id} label={t.name}>
                                                    {(t.subTeams || []).map(st => (
                                                        <option key={st.id} value={st.id}>{st.name} {st.leader ? `(${st.leader})` : ''}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
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

function DataSection({ project, onUpdate }: { project: any, onUpdate: any }) {

    const handleReorganizeGrappes = async () => {
        if (!window.confirm("Voulez-vous vraiment réorganiser les grappes ? Les affectations actuelles seront réinitialisées.")) return;

        try {
            const households = await db.households.toArray();
            const newConfig = generateDynamicGrappes(households);

            onUpdate({
                config: {
                    ...project.config,
                    grappesConfig: newConfig,
                    assignments: {}
                }
            });
            alert("Les grappes ont été réorganisées avec succès !");
        } catch (error) {
            console.error(error);
            alert("Erreur lors de la réorganisation.");
        }
    };

    const handleExportConfig = () => {
        if (!project?.config) return;

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project.config, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `parametres_${project.name || 'projet'}_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (json) {
                    onUpdate({ config: json });
                    alert("Paramètres importés avec succès !");
                }
            } catch (error) {
                console.error("Erreur lors de l'import :", error);
                alert("Erreur lors de la lecture du fichier de paramètres. Veuillez vérifier le format.");
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-black text-white flex items-center gap-3">
                <Database className="text-blue-500" />
                Gestion des Paramètres et Données
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800/50 space-y-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                        <Upload size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white mb-2">Importation des Paramètres</h3>
                        <p className="text-slate-500 text-sm">Importez un fichier de paramètres JSON précédemment exporté pour restaurer la configuration de ce projet (équipes, tarifs, logistique).</p>
                    </div>
                    <label className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 cursor-pointer">
                        <Upload size={20} />
                        Sélectionner un fichier JSON
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleImportConfig}
                            title="Importer des paramètres"
                        />
                    </label>
                </div>

                <div className="bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800/50 space-y-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
                        <Download size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white mb-2">Sauvegarde des Paramètres</h3>
                        <p className="text-slate-500 text-sm">Générez une copie de sauvegarde JSON complète contenant tous les paramètres, équipes, et configurations de ce projet.</p>
                    </div>
                    <button
                        onClick={handleExportConfig}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3"
                    >
                        <Download size={20} />
                        Exporter les paramètres
                    </button>
                </div>
            </div>

            {/* Reorganisation */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h4 className="text-white font-bold">Réorganiser les Grappes (Algorithme de Proximité)</h4>
                        <p className="text-indigo-400/60 text-sm">Recalculer dynamiquement le regroupement des ménages selon leur position GPS (algorithme k-means).</p>
                    </div>
                </div>
                <button
                    onClick={handleReorganizeGrappes}
                    className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap"
                >
                    Générer Grappes
                </button>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                        <Trash2 size={24} />
                    </div>
                    <div>
                        <h4 className="text-white font-bold">Réinitialisation complète</h4>
                        <p className="text-red-500/60 text-sm">Toutes les données locales seront supprimées. Cette action est irréversible.</p>
                    </div>
                </div>
                <button className="px-8 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-black rounded-xl transition-all border border-red-500/30">
                    Réinitialiser Tout
                </button>
            </div>
        </div>
    );
}

function LogisticsSection({ project, onUpdate }: { project: any, onUpdate: any }) {
    const teams = project?.config?.teams || [];
    const materialCatalog: CatalogItem[] = project?.config?.materialCatalog || [];
    const allocations = project?.config?.subTeamAllocations || {};

    const handleUpdateAllocation = (subTeamId: string, itemId: string, field: 'quantity' | 'acquisitionType', value: any) => {
        const teamAlloc = allocations[subTeamId] || [];
        const existing = teamAlloc.find((a: any) => a.itemId === itemId);
        let newTeamAlloc = [...teamAlloc];

        if (existing) {
            newTeamAlloc = newTeamAlloc.map((a: any) => a.itemId === itemId ? { ...a, [field]: value } : a);
        }

        onUpdate({
            config: {
                ...project.config,
                subTeamAllocations: { ...allocations, [subTeamId]: newTeamAlloc }
            }
        });
    };

    const handleAddAllocation = (subTeamId: string, itemId: string) => {
        if (!itemId) return;
        const teamAlloc = allocations[subTeamId] || [];
        if (teamAlloc.find((a: any) => a.itemId === itemId)) return; // Already added

        const newAlloc: SubTeamEquipment = {
            id: `alloc_${Date.now()}`,
            itemId,
            quantity: 1,
            acquisitionType: 'achat'
        };

        onUpdate({
            config: {
                ...project.config,
                subTeamAllocations: { ...allocations, [subTeamId]: [...teamAlloc, newAlloc] }
            }
        });
    };

    const handleRemoveAllocation = (subTeamId: string, itemId: string) => {
        const teamAlloc = allocations[subTeamId] || [];
        const newTeamAlloc = teamAlloc.filter((a: any) => a.itemId !== itemId);

        onUpdate({
            config: {
                ...project.config,
                subTeamAllocations: { ...allocations, [subTeamId]: newTeamAlloc }
            }
        });
    };

    const handleAutoFillEquipment = (subTeamId: string, teamType: string) => {
        const teamAlloc = [...(allocations[subTeamId] || [])];
        let added = false;

        // Auto-fill logic based on default material Catalog categories / names
        const addIfMissing = (nameMatch: string, qty: number) => {
            const catalogItem = materialCatalog.find(c => c.name.toLowerCase().includes(nameMatch.toLowerCase()));
            if (!catalogItem) return;

            if (!teamAlloc.find(a => a.itemId === catalogItem.id)) {
                teamAlloc.push({
                    id: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    itemId: catalogItem.id,
                    quantity: qty,
                    acquisitionType: 'achat'
                });
                added = true;
            }
        };

        // Common for all field workers
        addIfMissing('Casque', 1);
        addIfMissing('Gilet', 1);

        if (teamType === 'macons') {
            addIfMissing('Epi', 1);
        } else if (teamType === 'reseau') {
            addIfMissing('Epi', 1);
        } else if (teamType === 'interieur_type1') {
            addIfMissing('Perforateur', 1);
            addIfMissing('Epi', 1);
        } else if (teamType === 'controle') {
            // specific to controle if needed
        }

        if (added) {
            onUpdate({
                config: {
                    ...project.config,
                    subTeamAllocations: { ...allocations, [subTeamId]: teamAlloc }
                }
            });
        } else {
            alert("Aucun nouveau matériel automatique trouvé ou matériel déjà assigné.");
        }
    };

    const handleDuplicateToSiblings = (sourceSubTeamId: string, parentTeamId: string) => {
        const sourceAllocations = allocations[sourceSubTeamId] || [];
        if (sourceAllocations.length === 0) return;

        const parentTeam = teams.find((t: any) => t.id === parentTeamId);
        if (!parentTeam || !parentTeam.subTeams) return;

        const newAllocations = { ...allocations };
        parentTeam.subTeams.forEach((st: any) => {
            if (st.id !== sourceSubTeamId) {
                newAllocations[st.id] = sourceAllocations.map((alloc: any) => ({
                    ...alloc,
                    id: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                }));
            }
        });

        onUpdate({
            config: {
                ...project.config,
                subTeamAllocations: newAllocations
            }
        });
    };

    // Calculate all subteams with parent details
    const allSubTeams = teams.flatMap((t: any) => (t.subTeams || []).map((st: any) => ({ ...st, parentTeam: t })));

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-black text-white flex items-center gap-3">
                <Wrench className="text-indigo-500" />
                Dotation Matériel par Sous-Équipe
            </h2>
            <p className="text-slate-400 text-sm max-w-3xl">
                Allouez de l'équipement, du matériel de sécurité et de la logistique à chaque sous-équipe terrain depuis le catalogue de l'entreprise. L'option achat/location et le prix de référence dépendent directement du Catalogue.
            </p>

            {allSubTeams.length === 0 ? (
                <div className="bg-slate-950/50 p-8 rounded-3xl border border-slate-800/50 text-center">
                    <p className="text-slate-500 italic">Aucune sous-équipe trouvée. Veuillez d'abord en créer dans la rubrique "Équipes".</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {allSubTeams.map((st: any) => {
                        const stAllocations = allocations[st.id] || [];
                        const availableCatalog = materialCatalog.filter(c => !stAllocations.find((a: any) => a.itemId === c.id));

                        return (
                            <div key={st.id} className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800/50 hover:border-indigo-500/50 transition-all">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                    <div>
                                        <h3 className="text-white font-bold text-lg">{st.name} <span className="text-xs text-slate-500 ml-2 font-normal">Chef: {st.leader || 'N/A'}</span></h3>
                                        <p className="text-[10px] font-black tracking-widest text-indigo-400 uppercase mt-1">{st.parentTeam.name} ({st.parentTeam.type})</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        <button
                                            onClick={() => handleAutoFillEquipment(st.id, st.parentTeam.type)}
                                            title="Remplissage Automatique"
                                            className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-xl transition-colors flex items-center gap-2 border border-emerald-500/20 text-xs"
                                        >
                                            <Zap size={14} />
                                            <span className="hidden sm:inline">Auto</span>
                                        </button>
                                        <select
                                            className="w-full md:w-auto bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                                            onChange={(e) => { handleAddAllocation(st.id, e.target.value); e.target.value = ""; }}
                                            title="Ajouter du Matériel"
                                        >
                                            <option value="">+ Ajouter du Matériel...</option>
                                            {availableCatalog.map(item => (
                                                <option key={item.id} value={item.id}>{item.name} ({item.category})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {stAllocations.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-end mb-2">
                                            <button
                                                onClick={() => handleDuplicateToSiblings(st.id, st.parentTeam.id)}
                                                className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/w0000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                Dupliquer aux autres options {st.parentTeam.name}
                                            </button>
                                        </div>
                                        {stAllocations.map((alloc: SubTeamEquipment) => {
                                            const catalogItem = materialCatalog.find(c => c.id === alloc.itemId);
                                            if (!catalogItem) return null;
                                            return (
                                                <div key={alloc.id} className="flex flex-col sm:flex-row gap-4 items-end sm:items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
                                                    <div className="flex-1 w-full sm:w-auto">
                                                        <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-black block mb-1">{catalogItem.category}</span>
                                                        <span className="text-sm font-bold text-white block">{catalogItem.name}</span>
                                                    </div>

                                                    <div className="flex items-center gap-4 w-full sm:w-auto flex-wrap sm:flex-nowrap justify-end">
                                                        <div className="flex items-center gap-2">
                                                            <label title="Quantité" className="text-[10px] text-slate-500 uppercase font-bold">Qté</label>
                                                            <input
                                                                type="number"
                                                                title="Quantité"
                                                                value={alloc.quantity}
                                                                min="1"
                                                                onChange={(e) => handleUpdateAllocation(st.id, alloc.itemId, 'quantity', parseInt(e.target.value) || 1)}
                                                                className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <label title="Type d'acquisition" className="text-[10px] text-slate-500 uppercase font-bold">Type</label>
                                                            <select
                                                                value={alloc.acquisitionType}
                                                                onChange={(e) => handleUpdateAllocation(st.id, alloc.itemId, 'acquisitionType', e.target.value)}
                                                                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                                                                title="Type d'acquisition"
                                                            >
                                                                <option value="achat">Achat</option>
                                                                <option value="location">Location</option>
                                                            </select>
                                                        </div>
                                                        <div className="text-right ml-2 min-w-[80px]">
                                                            <div className="text-[9px] text-slate-500 uppercase font-bold block">Prix unitaire</div>
                                                            <div className="text-xs text-amber-400 font-bold block whitespace-nowrap">
                                                                {alloc.acquisitionType === 'achat' ? catalogItem.purchasePrice : catalogItem.rentalPrice} FCFA
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveAllocation(st.id, alloc.itemId)}
                                                            className="text-slate-600 hover:text-red-500 p-2 sm:ml-2"
                                                            title="Retirer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-2xl">
                                        <p className="text-xs font-bold text-slate-600 italic">Aucun matériel alloué à cette sous-équipe.</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
