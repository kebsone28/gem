import { useState, useEffect } from 'react';
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
    Zap,
    ChevronRight,
    CloudDownload,
    Navigation2,
    Save,
    RefreshCw
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import type { CatalogItem, SubTeamEquipment } from '../utils/types';
import { generateDynamicGrappes } from '../utils/clustering';
import logger from '../utils/logger';
import { useTeams } from '../hooks/useTeams';
import apiClient from '../api/client';

import { SENEGAL_REGIONS } from '../utils/config';
import { StatusBadge } from '../components/dashboards/DashboardComponents';
import { useTerrainData } from '../hooks/useTerrainData';

type TabType = 'teams' | 'costs' | 'zones' | 'logistics' | 'kobo' | 'data';

interface TeamAllocation {
    id: string;
    subTeamId: string;
    priority: number;
}

interface Zone {
    id: string;
    name: string;
    clusters: string[];
    teamAllocations: TeamAllocation[];
}

export default function Settings() {
    const [activeTab, setActiveTab] = useState<TabType>('teams');
    const { project, updateProject, isLoading: isProjectLoading } = useProject();
    const { households, isLoading: isHouseholdsLoading } = useTerrainData();

    const isLoading = isProjectLoading || isHouseholdsLoading;

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initialisation des paramètres...</p>
            </div>
        </div>
    );

    const tabs = [
        { id: 'teams', label: 'Équipes', icon: Users },
        { id: 'costs', label: 'Tarifs', icon: DollarSign },
        { id: 'zones', label: 'Zones & Affectations', icon: Layers },
        { id: 'logistics', label: 'Dotations Standard', icon: Wrench },
        { id: 'kobo', label: 'KoBo', icon: CloudDownload },
        { id: 'data', label: 'Données', icon: Database },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 p-6 md:p-8 lg:p-10 transition-colors duration-500">
            <div className="max-w-7xl mx-auto space-y-10">
                {/* ── HEADER ── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 shrink-0">
                            <SettingsIcon size={24} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl font-black tracking-tight uppercase italic leading-none text-slate-900 dark:text-white">Configuration</h1>
                                <StatusBadge status="info" label="Projet Actif" />
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none">Paramètres Globaux & Déploiement</p>
                        </div>
                    </div>
                </header>

                {/* ── TABS NAVIGATION ── */}
                <div className="flex gap-2 p-1.5 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 overflow-x-auto no-scrollbar shadow-sm" role="tablist">
                    {tabs.map((tab) => (
                        <button // eslint-disable-line jsx-a11y/aria-proptypes
                            key={tab.id}
                            role="tab"
                            aria-selected={activeTab === tab.id ? "true" : "false"}
                            aria-controls={`panel-${tab.id}`}
                            id={`tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap group ${activeTab === tab.id
                                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                                : 'text-gray-400 dark:text-gray-500 hover:text-slate-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                        >
                            <tab.icon size={16} className={`${activeTab === tab.id ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} />
                            <span className="font-black text-[11px] uppercase tracking-widest">{tab.label}</span>
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
                            transition={{ duration: 0.3, ease: "circOut" }}
                            className="bg-white dark:bg-white/5 rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-8 md:p-12 shadow-sm relative overflow-hidden"
                        >
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />

                            <div className="relative z-10">
                                {activeTab === 'teams' && <TeamsSection project={project} />}
                                {activeTab === 'costs' && <CostsSection project={project} onUpdate={updateProject} />}
                                {activeTab === 'zones' && <ZonesSection project={project} onUpdate={updateProject} />}
                                {activeTab === 'logistics' && <LogisticsSection project={project} onUpdate={updateProject} />}
                                {activeTab === 'kobo' && <KoboSettingsSection project={project} onUpdate={updateProject} />}
                                {activeTab === 'data' && <DataSection project={project} households={households || []} onUpdate={updateProject} />}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </main>
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
        isLoading: isTeamsLoading 
    } = useTeams(project?.id);
    const { updateProject } = useProject();
    const productionRates = project?.config?.productionRates || { macons: 5, reseau: 8, interieur_type1: 6, controle: 15 };

    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchTeamTree();
        fetchRegions();
        fetchGrappes();
    }, [fetchTeamTree, fetchRegions, fetchGrappes, project?.id]);

    const toggleCollapse = (id: string) => {
        setCollapsedTeams(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleAllCollapse = (collapse: boolean) => {
        const newState: Record<string, boolean> = {};
        if (collapse) {
            teamTree.forEach((t: any) => newState[t.id] = true);
        }
        setCollapsedTeams(newState);
    };
    const filteredTeams = teamTree.filter((t: any) => {
        const matchesName = t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSubTeams = (t.children || []).some((sub: any) => 
            sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (sub.leader?.name && sub.leader.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        return matchesName || matchesSubTeams;
    });

    const stats = {
        total: teamTree.reduce((acc: number, t: any) => acc + (t.children || []).length, 0),
        active: teamTree.reduce((acc: number, t: any) => acc + (t.children || []).filter((c: any) => c.status === 'active').length, 0),
        inactive: teamTree.reduce((acc: number, t: any) => acc + (t.children || []).filter((c: any) => c.status !== 'active').length, 0),
    };

    const handleUpdateProductionRate = (trade: string, value: number) => {
        updateProject({
            config: {
                ...project.config,
                productionRates: { ...productionRates, [trade]: value }
            }
        });
    };

    const handleAddProductionRate = () => {
        const tradeName = prompt("Entrez le nom du nouveau corps de métier (ex: Peinture, Soudure) :");
        if (!tradeName) return;
        
        const tradeKey = tradeName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (!tradeKey || productionRates[tradeKey]) {
            alert("Nom invalide ou métier déjà existant.");
            return;
        }

        updateProject({
            config: {
                ...project.config,
                productionRates: { ...productionRates, [tradeKey]: 5 }
            }
        });
    };

    const handleDeleteProductionRate = (tradeKey: string) => {
        if (!window.confirm("Supprimer ce corps de métier ? Attention, si des équipes y sont affectées, elles n'auront plus de cadence valide.")) return;
        
        const newRates = { ...productionRates };
        delete newRates[tradeKey];
        
        updateProject({
            config: {
                ...project.config,
                productionRates: newRates
            }
        });
    };

    const handleAddTeam = async () => {
        await createTeam({
            name: `Nouveau Groupement ${teamTree.length + 1}`,
            role: 'INSTALLATION',
            capacity: 2
        });
    };

    const handleAddSubTeam = async (parentId: string, parentRole: string) => {
        await createTeam({
            name: `Équipe de terrain`,
            role: parentRole as any,
            parentTeamId: parentId,
            capacity: 0
        });
    };

    const handleUpdateTeamField = async (id: string, field: string, value: any) => {
        await updateTeam(id, { [field]: value });
    };

    const handleRemoveTeam = async (id: string) => {
        const team = teamTree.find((t: any) => t.id === id);
        const hasRegion = team?.regionId;
        const msg = hasRegion 
            ? "Cette équipe est affectée à une région. Supprimer cette équipe et ses sous-équipes ?"
            : "Supprimer cette équipe et ses sous-équipes ?";
            
        if (window.confirm(msg)) {
            await deleteTeam(id);
        }
    };

    if (isTeamsLoading && teamTree.length === 0) return <div className="p-8 text-slate-400">Chargement des équipes...</div>;

    return (
        <div className="space-y-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-1">
                        <Users className="text-blue-500" />
                        Gestion des Équipes
                    </h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Configuration des effectifs et sous-équipes terrain</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/5 rounded-xl border border-blue-500/10">
                        <Users size={12} className="text-blue-500" />
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight">{stats.total} Équipes</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">{stats.active} Actives</span>
                    </div>
                    {stats.inactive > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-500/5 rounded-xl border border-slate-500/10">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{stats.inactive} Inactives</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Rechercher une équipe..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 w-64 transition-all"
                        />
                        <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => toggleAllCollapse(true)}
                            className="p-2.5 bg-gray-50 dark:bg-white/5 text-gray-400 hover:text-blue-500 rounded-xl border border-gray-100 dark:border-white/5 transition-colors"
                            title="Réduire tout"
                        >
                            <Layers size={14} />
                        </button>
                        <button 
                            onClick={() => toggleAllCollapse(false)}
                            className="p-2.5 bg-gray-50 dark:bg-white/5 text-gray-400 hover:text-blue-500 rounded-xl border border-gray-100 dark:border-white/5 transition-colors"
                            title="Développer tout"
                        >
                            <ChevronRight size={14} className="rotate-90" />
                        </button>
                    </div>
                    <button
                        onClick={handleAddTeam}
                        className="px-6 py-3 bg-blue-600 dark:bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/10 hover:brightness-110 active:scale-95 ml-2"
                    >
                        + Nouveau Groupement
                    </button>
                </div>
            </div>

            {/* ── CADENCES DE PRODUCTION ── */}
            <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Zap size={18} className="text-amber-500" />
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Cadence Standard (Foyers / Jour)</h3>
                    </div>
                    <button
                        onClick={handleAddProductionRate}
                        className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-amber-500/20"
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
                            preparateurs: 'Préparateurs / Magasin'
                        };
                        const displayLabel = labelMap[tradeKey] || tradeKey.replace(/_/g, ' ').toUpperCase();
                        const isCoreTrade = ['macons', 'reseau', 'interieur_type1', 'controle', 'preparateurs'].includes(tradeKey);

                        return (
                            <div key={tradeKey} className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm relative group">
                                {!isCoreTrade && (
                                    <button
                                        onClick={() => handleDeleteProductionRate(tradeKey)}
                                        className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Supprimer ce métier"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block truncate pr-5" title={displayLabel}>{displayLabel}</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        title={`Cadence ${displayLabel}`}
                                        value={rate as number}
                                        onChange={e => handleUpdateProductionRate(tradeKey, parseInt(e.target.value) || 1)}
                                        className="w-full bg-transparent border-b-2 border-gray-100 dark:border-white/10 py-1 text-xl font-black text-blue-600 focus:border-blue-500 outline-none transition-colors"
                                    />
                                    <span className="text-[10px] font-bold text-gray-400">f/j</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredTeams.map((team: any) => {
                    const isCollapsed = collapsedTeams[team.id];
                    return (
                        <div key={team.id} className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-[1.5rem] border border-gray-100 dark:border-white/10 group hover:border-blue-500/50 transition-all relative overflow-hidden shadow-sm self-start">
                            <div className="absolute top-0 left-0 w-1 y-full bg-blue-500" />
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <button
                                    onClick={() => toggleCollapse(team.id)}
                                    className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                                    title={isCollapsed ? "Développer" : "Réduire"}
                                >
                                    {isCollapsed ? <ChevronRight size={16} /> : <div className="rotate-90"><ChevronRight size={16} /></div>}
                                </button>
                                <button
                                    onClick={() => handleRemoveTeam(team.id)}
                                    title="Supprimer ce groupement"
                                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="space-y-4 pt-1">
                                <div className={isCollapsed ? "pr-14" : ""}>
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">Groupement / Entreprise</label>
                                    <input
                                        title="Nom"
                                        placeholder="Nom"
                                        value={team.name}
                                        onChange={e => handleUpdateTeamField(team.id, 'name', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 pb-1">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Métier Principal</label>
                                        <select
                                            title="Sélectionner le métier principal"
                                            value={team.tradeKey || ''}
                                            onChange={e => handleUpdateTeamField(team.id, 'tradeKey', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Sélectionner métier...</option>
                                            {Object.keys(productionRates).map((tk) => (
                                                <option key={tk} value={tk}>{tk.replace(/_/g, ' ').toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Rôle Global</label>
                                        <select
                                            title="Détermine la visibilité de l'équipe : 'Préparation' pour l'atelier Logistique, 'Installation' pour le terrain."
                                            value={team.role}
                                            onChange={e => handleUpdateTeamField(team.id, 'role', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="INSTALLATION">Installation Terrain</option>
                                            <option value="PREPARATION">Préparation (Atelier)</option>
                                            <option value="LOGISTICS">Logistique / Magasin</option>
                                            <option value="SUPERVISION">Supervision / Contrôle</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Région d'Intervention</label>
                                    <select
                                        title="Sélectionnez la région d'affectation pour filtrer cette équipe dans les différents modules (Logistique, Terrain)."
                                        value={team.regionId || ''}
                                        onChange={e => {
                                            const newRegionId = e.target.value;
                                            handleUpdateTeamField(team.id, 'regionId', newRegionId);
                                            // Reset Grappe when region changes
                                            handleUpdateTeamField(team.id, 'grappeId', null);
                                        }}
                                        className="w-full bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none mb-3"
                                    >
                                        <option value="">Toutes Régions</option>
                                        {regions.map((reg: any) => (
                                            <option key={reg.id} value={reg.id}>{reg.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Grappe / Cluster</label>
                                    <select
                                        title="Sélectionnez la grappe d'affectation précise pour cette équipe."
                                        value={team.grappeId || ''}
                                        onChange={e => handleUpdateTeamField(team.id, 'grappeId', e.target.value)}
                                        disabled={!team.regionId}
                                        className={`w-full bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none ${!team.regionId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="">{team.regionId ? 'Sélectionner une grappe...' : 'Choisir une région d\'abord'}</option>
                                        {grappes
                                            .filter((g: any) => g.regionId === team.regionId)
                                            .map((g: any) => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))
                                        }
                                        {team.regionId && grappes.filter((g: any) => g.regionId === team.regionId).length === 0 && (
                                            <option value="" disabled>Aucune grappe disponible</option>
                                        )}
                                    </select>
                                </div>

                                {!isCollapsed && (
                                    <div className="pt-3 border-t border-gray-100 dark:border-white/5 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">Équipes de terrain ({(team.children || []).length})</label>
                                            <button
                                                onClick={() => handleAddSubTeam(team.id, team.role)}
                                                className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl font-black uppercase tracking-widest transition-colors"
                                            >
                                                + Ajouter Équipe
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {(team.children || []).map((sub: any) => (
                                                <div key={sub.id} className="flex items-center gap-2 bg-white dark:bg-slate-950/50 p-2 rounded-xl border border-gray-100 dark:border-white/5 group/sub relative hover:border-blue-500/30 transition-all">
                                                    <button 
                                                        onClick={() => handleUpdateTeamField(sub.id, 'status', sub.status === 'active' ? 'inactive' : 'active')}
                                                        className={`w-2 h-2 rounded-full shrink-0 transition-transform active:scale-125 ${sub.status === 'active' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} 
                                                        title={`Cliquer pour ${sub.status === 'active' ? 'désactiver' : 'activer'}`}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <input
                                                            title="Nom de l'équipe terrain"
                                                            placeholder="Nom de l'équipe"
                                                            value={sub.name}
                                                            onChange={e => handleUpdateTeamField(sub.id, 'name', e.target.value)}
                                                            className="w-full bg-transparent border-none p-0 text-slate-900 dark:text-white font-bold text-[11px] focus:ring-0 outline-none truncate"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5 shrink-0">
                                                        <Users size={8} className="text-slate-400" />
                                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{sub.leader?.name ? sub.leader.name.split(' ')[0] : 'Chef'}</span>
                                                    </div>
                                                    {team.tradeKey === 'interieur_type1' && (
                                                        <div className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded-lg text-[8px] font-black uppercase tracking-widest border border-yellow-200 dark:border-yellow-500/10">
                                                            Corps d'état
                                                        </div>
                                                    )}
                                                    {team.tradeKey === 'macons' && (
                                                        <div className="px-2 py-0.5 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 rounded-lg text-[8px] font-black uppercase tracking-widest border border-orange-200 dark:border-orange-500/10">
                                                            Ouvrier
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleRemoveTeam(sub.id)}
                                                        title="Supprimer cette équipe terrain"
                                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 transition-opacity p-1"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                            {(team.children?.length === 0) && (
                                                <div className="col-span-full text-[9px] text-slate-400 text-center py-3 bg-white/5 rounded-xl border border-dashed border-white/5 font-medium uppercase tracking-widest">
                                                    Aucune équipe terrain
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CostsSection({ project, onUpdate }: { project: any, onUpdate: any }) {
    const { regions, fetchRegions, teams, fetchTeams } = useTeams(project?.id);
    const [selectedRegionId, setSelectedRegionId] = useState<string>('');
    const costs = project?.config?.costs || {};
    const staffRates = costs.staffRates || {};
    const vehicleRental = costs.vehicleRental || {};

    useEffect(() => {
        fetchRegions();
        fetchTeams();
    }, [fetchRegions, fetchTeams]);

    // Default to first region if available and none selected
    useEffect(() => {
        if (regions.length > 0 && !selectedRegionId) {
            setSelectedRegionId(regions[0].id);
        }
    }, [regions, selectedRegionId]);

    const materialCatalog: CatalogItem[] = project?.config?.materialCatalog || [
        { id: 'cat_1', name: 'Casque de Chantier', category: 'Securité', purchasePrice: 5000, rentalPrice: 0 },
        { id: 'cat_2', name: 'Gilet Réfléchissant', category: 'Securité', purchasePrice: 2000, rentalPrice: 0 },
        { id: 'cat_3', name: 'Perforateur', category: 'Portatif', purchasePrice: 150000, rentalPrice: 5000 },
        { id: 'cat_4', name: 'Epi', category: 'Logistique', purchasePrice: 0, rentalPrice: 1000 }
    ];

    const handleUpdateRate = (category: 'staffRates' | 'vehicleRental', key: string, field: string, value: any) => {
        const newCategory = { ...(costs[category] || {}) };
        
        if (category === 'staffRates') {
            if (!selectedRegionId) return;
            // Nested structure: staffRates[regionId][teamId]
            if (!newCategory[selectedRegionId]) newCategory[selectedRegionId] = {};
            if (!newCategory[selectedRegionId][key]) newCategory[selectedRegionId][key] = { amount: 0, mode: 'daily' };
            
            const oldVal = newCategory[selectedRegionId][key][field];
            newCategory[selectedRegionId][key] = { ...newCategory[selectedRegionId][key], [field]: value };
            
            // Logically, we should trigger an audit log here. 
            // The backend updateProject will log the change to 'config'.
            console.log(`Rate updated for region ${selectedRegionId}, team ${key}: ${oldVal} -> ${value}`);
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
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-1">
                            <DollarSign className="text-emerald-500" />
                            Grille Tarifaire
                        </h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Barèmes de rémunération par région</p>
                    </div>

                    <div className="flex items-center gap-4 bg-white dark:bg-slate-950 p-2 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-2 px-3">
                            <MapPin size={16} className="text-blue-500" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Région Active :</span>
                        </div>
                        <select
                            title="Sélectionner la région"
                            value={selectedRegionId}
                            onChange={(e) => setSelectedRegionId(e.target.value)}
                            className="bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 py-2 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                        >
                            <option value="">Sélectionner...</option>
                            {regions.map(reg => (
                                <option key={reg.id} value={reg.id}>{reg.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {(!teams || teams.length === 0) ? (
                    <div className="bg-gray-50 dark:bg-white/5 p-12 rounded-[2.5rem] border border-gray-100 dark:border-white/5 text-center">
                        <Users size={48} className="text-gray-200 dark:text-white/10 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Aucune équipe configurée</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map((team: any) => {
                            const regionRates = staffRates[selectedRegionId] || {};
                            const rate = regionRates[team.id] || { amount: 0, mode: 'daily' };
                            const subTeamCount = (team.children || []).length;
                            const tradeLabel = team.tradeKey === 'macons' ? 'Maçonnerie' : team.tradeKey === 'reseau' ? 'Réseau' : team.tradeKey === 'interieur_type1' ? 'Intérieur' : team.tradeKey === 'controle' ? 'Contrôle' : team.tradeKey;

                            return (
                                <div key={team.id} className="bg-white dark:bg-slate-950 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 hover:border-blue-500/30 transition-all shadow-sm">
                                    <div className="mb-8">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-tight text-sm">{team.name}</h3>
                                            <StatusBadge status="success" label={`${subTeamCount} UNITÉS`} />
                                        </div>
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{tradeLabel}</p>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Rémunération (FCFA)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    title="Montant"
                                                    value={rate.amount}
                                                    onChange={e => handleUpdateRate('staffRates', team.id, 'amount', parseInt(e.target.value) || 0)}
                                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">FCFA</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Unité de Calcul</label>
                                            <select
                                                title="Mode"
                                                value={rate.mode}
                                                onChange={e => handleUpdateRate('staffRates', team.id, 'mode', e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
                                            >
                                                <option value="daily">Forfait Journalier</option>
                                                <option value="monthly">Forfait Mensuel</option>
                                                <option value="task">Prestation à l'Unité (Task)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <div className="space-y-8">
                <div className="flex items-center gap-3">
                    <Truck className="text-amber-500" size={20} />
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Location & Logistique Véhicules</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-6">Barème Flotte Terrain (FCFA/J)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {['pick_up', 'camion', 'moto'].map(type => (
                                <div key={type} className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">{type.replace('_', ' ')}</label>
                                    <input
                                        type="number"
                                        title={type}
                                        value={vehicleRental[type] || 0}
                                        onChange={e => handleUpdateRate('vehicleRental', type, 'amount', parseInt(e.target.value) || 0)}
                                        className="w-full bg-transparent border-b border-gray-100 dark:border-white/10 text-sm font-black text-slate-900 dark:text-white py-1 outline-none focus:border-blue-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-6">Frais Direction de Projet</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Location CDP (Mensuel)</label>
                                <input
                                    type="number"
                                    title="cdp_location"
                                    value={vehicleRental['cdp_location'] || 0}
                                    onChange={e => handleUpdateRate('vehicleRental', 'cdp_location', 'amount', parseInt(e.target.value) || 0)}
                                    className="w-full bg-transparent border-b border-gray-100 dark:border-white/10 text-sm font-black text-slate-900 dark:text-white py-1 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Achat Véhicule</label>
                                <input
                                    type="number"
                                    title="cdp_achat"
                                    value={vehicleRental['cdp_achat'] || 0}
                                    onChange={e => handleUpdateRate('vehicleRental', 'cdp_achat', 'amount', parseInt(e.target.value) || 0)}
                                    className="w-full bg-transparent border-b border-gray-100 dark:border-white/10 text-sm font-black text-slate-900 dark:text-white py-1 outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <Wrench className="text-blue-500" size={20} />
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Catalogue Matériel & Sécurité</h3>
                    </div>
                    <button
                        onClick={handleAddCatalogItem}
                        className="px-6 py-2.5 bg-blue-500/10 hover:bg-blue-600 hover:text-white text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-blue-500/20"
                    >
                        + Ajouter une Référence
                    </button>
                </div>

                <div className="bg-white dark:bg-white/5 rounded-[2rem] border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 text-gray-400 uppercase tracking-widest text-[9px] font-black">
                                <tr>
                                    <th className="px-8 py-5">Désignation Matériel</th>
                                    <th className="px-8 py-5">Catégorie</th>
                                    <th className="px-8 py-5 text-right">P.A Unitaire (FCFA)</th>
                                    <th className="px-8 py-5 text-right">Loc. Mensuelle (FCFA)</th>
                                    <th className="px-8 py-5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {materialCatalog.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-8 py-4">
                                            <input
                                                title="Nom"
                                                value={item.name}
                                                onChange={e => handleUpdateCatalogItem(item.id, 'name', e.target.value)}
                                                className="w-full bg-transparent font-bold text-slate-900 dark:text-white outline-none focus:text-blue-500 transition-colors"
                                            />
                                        </td>
                                        <td className="px-8 py-4">
                                            <select
                                                title="Caté"
                                                value={item.category}
                                                onChange={e => handleUpdateCatalogItem(item.id, 'category', e.target.value)}
                                                className="bg-transparent font-bold text-gray-500 dark:text-gray-400 outline-none cursor-pointer"
                                            >
                                                <option value="Securité">P.P.E / Sécurité</option>
                                                <option value="Portatif">Outillage Portatif</option>
                                                <option value="Logistique">Logistique Site</option>
                                                <option value="Autre">Consommables / Autre</option>
                                            </select>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <input
                                                type="number"
                                                title="Achat"
                                                value={item.purchasePrice}
                                                onChange={e => handleUpdateCatalogItem(item.id, 'purchasePrice', parseInt(e.target.value) || 0)}
                                                className="w-32 bg-transparent text-right font-black text-slate-900 dark:text-white outline-none"
                                            />
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <input
                                                type="number"
                                                title="Loc"
                                                value={item.rentalPrice}
                                                onChange={e => handleUpdateCatalogItem(item.id, 'rentalPrice', parseInt(e.target.value) || 0)}
                                                className="w-32 bg-transparent text-right font-black text-slate-900 dark:text-white outline-none"
                                            />
                                        </td>
                                        <td className="px-8 py-4 text-center">
                                            <button
                                                title="Supprimer la référence"
                                                onClick={() => handleDeleteCatalogItem(item.id)}
                                                className="text-gray-300 hover:text-rose-500 p-2 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ZonesSection({ project, onUpdate }: { project: any, onUpdate: any }) {
    const { grappes, fetchGrappes } = useTeams(project?.id);
    const [zones, setZones] = useState<Zone[]>(project?.config?.zones || []);
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

    useEffect(() => {
        fetchGrappes();
    }, [fetchGrappes, project?.id]);

    useEffect(() => {
        setZones(project?.config?.zones || []);
        if (project?.config?.zones?.length > 0 && !selectedZoneId) {
            setSelectedZoneId(project.config.zones[0].id);
        }
    }, [project?.config?.zones]);

    const selectedZone = selectedZoneId ? zones.find(z => z.id === selectedZoneId) : null;

    const handleUpdateZones = (newZones: Zone[]) => {
        onUpdate({ config: { ...project.config, zones: newZones } });
    };

    const handleAddZone = () => {
        const newZone: Zone = {
            id: `zone_${Date.now()}`,
            name: `Nouvelle Zone ${zones.length + 1}`,
            clusters: [],
            teamAllocations: []
        };
        const updatedZones = [...zones, newZone];
        handleUpdateZones(updatedZones);
        setSelectedZoneId(newZone.id);
    };

    const handleUpdateZoneName = (id: string, name: string) => {
        const updatedZones = zones.map(z => z.id === id ? { ...z, name } : z);
        handleUpdateZones(updatedZones);
    };

    const handleDeleteZone = (id: string) => {
        if (!window.confirm("Supprimer cette zone ?")) return;
        const updatedZones = zones.filter(z => z.id !== id);
        handleUpdateZones(updatedZones);
        if (selectedZoneId === id) {
            setSelectedZoneId(updatedZones.length > 0 ? updatedZones[0].id : null);
        }
    };

    const toggleClusterInZone = (zoneId: string, cluster: string) => {
        const updatedZones = zones.map(z => {
            if (z.id === zoneId) {
                const newClusters = z.clusters.includes(cluster)
                    ? z.clusters.filter(c => c !== cluster)
                    : [...z.clusters, cluster];
                return { ...z, clusters: newClusters };
            }
            return z;
        });
        handleUpdateZones(updatedZones);
    };

    const handleAddAllocation = (zoneId: string) => {
        const updatedZones = zones.map(z => {
            if (z.id === zoneId) {
                const newAllocation: TeamAllocation = {
                    id: `alloc_${Date.now()}`,
                    subTeamId: '',
                    priority: 1
                };
                return { ...z, teamAllocations: [...z.teamAllocations, newAllocation] };
            }
            return z;
        });
        handleUpdateZones(updatedZones);
    };

    const handleUpdateAllocation = (zoneId: string, allocId: string, field: keyof TeamAllocation, value: any) => {
        const updatedZones = zones.map(z => {
            if (z.id === zoneId) {
                const newAllocations = z.teamAllocations.map(alloc =>
                    alloc.id === allocId ? { ...alloc, [field]: value } : alloc
                );
                return { ...z, teamAllocations: newAllocations };
            }
            return z;
        });
        handleUpdateZones(updatedZones);
    };

    const handleDeleteAllocation = (zoneId: string, allocId: string) => {
        const updatedZones = zones.map(z => {
            if (z.id === zoneId) {
                const newAllocations = z.teamAllocations.filter(alloc => alloc.id !== allocId);
                return { ...z, teamAllocations: newAllocations };
            }
            return z;
        });
        handleUpdateZones(updatedZones);
    };

    const allSubTeams = project?.config?.teams?.flatMap((t: any) => (t.subTeams || []).map((st: any) => ({ ...st, trade: t.type }))) || [];

    return (
        <div className="space-y-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-1">
                        <MapPin className="text-rose-500" />
                        Découpage Géographique
                    </h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Configuration des zones et affectation des grappes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── LISTE DES ZONES ── */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Périmètres Définis</h3>
                        <button
                            onClick={handleAddZone}
                            className="text-blue-500 hover:text-blue-600 text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                            + Nouvelle Zone
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
                        {zones.map(zone => (
                            <button
                                key={zone.id}
                                onClick={() => setSelectedZoneId(zone.id)}
                                className={`w-full text-left p-5 rounded-2xl border transition-all ${selectedZoneId === zone.id
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-white dark:bg-slate-950 border-gray-100 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:border-blue-500/30'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-black uppercase tracking-tight text-sm">{zone.name}</span>
                                    {selectedZoneId === zone.id && <ChevronRight size={16} />}
                                </div>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedZoneId === zone.id ? 'text-blue-100' : 'text-gray-400'}`}>
                                    {zone.teamAllocations.length} Affectations
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── DÉTAILS DE LA ZONE ── */}
                <div className="lg:col-span-2">
                    {selectedZone ? (
                        <div className="bg-gray-50 dark:bg-white/5 rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-8 md:p-10 space-y-10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Identifiant de la Zone</label>
                                    <select
                                        title="Région"
                                        value={selectedZone.name}
                                        onChange={e => handleUpdateZoneName(selectedZone.id, e.target.value)}
                                        className="w-full bg-transparent text-2xl font-black text-slate-900 dark:text-white border-b-2 border-gray-200 dark:border-white/10 focus:border-blue-500 outline-none transition-colors pb-1"
                                    >
                                        <option value="" disabled>Sélectionner...</option>
                                        {SENEGAL_REGIONS.map(reg => (
                                            <option key={reg} value={reg} className="bg-white dark:bg-slate-900 text-sm font-bold">{reg}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={() => handleDeleteZone(selectedZone.id)}
                                    className="p-3 text-gray-400 hover:text-rose-500 transition-colors"
                                    title="Supprimer la zone"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Affectation des Grappes</h4>
                                    <div className="flex items-center gap-2">
                                        <select
                                            title="Ajouter une grappe"
                                            className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/5 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    toggleClusterInZone(selectedZone.id, e.target.value);
                                                    e.target.value = "";
                                                }
                                            }}
                                        >
                                            <option value="">+ Ajouter une grappe...</option>
                                            {grappes
                                                .filter(g => !selectedZone.clusters.includes(g.id))
                                                .map(g => (
                                                    <option key={g.id} value={g.id}>{g.name} ({g.region?.name})</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {selectedZone.clusters.map((clusterId: string) => {
                                        const cluster = grappes.find(g => g.id === clusterId);
                                        return (
                                            <div key={clusterId} className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                                                        <Layers size={18} />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                            {cluster?.name || `Grappe ${clusterId}`}
                                                        </span>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                            {cluster?.region?.name || 'Région Inconnue'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleClusterInZone(selectedZone.id, clusterId)}
                                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Désaffecter la grappe"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {selectedZone.clusters.length === 0 && (
                                        <div className="text-center py-10 bg-white/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aucune grappe affectée à cette zone</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest italic">Unités Terrain Allouées</h4>
                                    <button
                                        onClick={() => handleAddAllocation(selectedZone.id)}
                                        className="text-blue-500 text-[10px] font-black uppercase tracking-[0.2em]"
                                    >
                                        + Allouer Unité
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {selectedZone.teamAllocations.map(alloc => (
                                        <div key={alloc.id} className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-wrap items-center gap-6 shadow-sm">
                                            <div className="flex-1 min-w-[200px]">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Unité de Travail</label>
                                                <select
                                                    title="Equipe"
                                                    value={alloc.subTeamId}
                                                    onChange={e => handleUpdateAllocation(selectedZone.id, alloc.id, 'subTeamId', e.target.value)}
                                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none"
                                                >
                                                    <option value="">Sélectionner une unité...</option>
                                                    {allSubTeams.map((st: any) => (
                                                        <option key={st.id} value={st.id}>{st.name} ({st.trade})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-40">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Priorité</label>
                                                <input
                                                    type="number"
                                                    title="Priorité"
                                                    value={alloc.priority}
                                                    onChange={e => handleUpdateAllocation(selectedZone.id, alloc.id, 'priority', parseInt(e.target.value) || 1)}
                                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-black text-blue-600 outline-none"
                                                />
                                            </div>
                                            <button
                                                title="Retirer l'unité"
                                                onClick={() => handleDeleteAllocation(selectedZone.id, alloc.id)}
                                                className="mt-6 p-2 text-gray-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {selectedZone.teamAllocations.length === 0 && (
                                        <div className="text-center py-10 bg-white/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                                        <div className="flex flex-col items-center gap-4 py-8">
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-slate-300">
                                                <Layers size={20} />
                                            </div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                                                Aucune unité affectée à cette zone.<br/>
                                                Sélectionnez un cluster pour voir les ménages.
                                            </p>
                                        </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center p-20 bg-gray-50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/10">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <MapPin size={24} className="text-gray-300" />
                                </div>
                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Sélectionnez une zone pour configurer</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DataSection({ project, households, onUpdate }: { project: any, households: any[], onUpdate: any }) {
    const { fetchGrappes } = useTeams(project?.id);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleReorganizeGrappes = async () => {
        if (!households || households.length === 0) {
            alert("Aucune donnée de ménages. Synchronisez d'abord vos données terrain.");
            return;
        }
        if (!window.confirm(`Calculer les grappes pour ${households.length} ménages ?`)) return;

        setIsProcessing(true);
        try {
            const { grappes } = generateDynamicGrappes(households, { 'Kaffrine': 600, 'Tambacounda': 600 });
            logger.log(`🗂️ [GRAPPES] Grappes générées: ${grappes.length}`);

            if (grappes.length === 0) {
                alert("Aucune grappe générée. Vérifiez que les ménages ont une région et des coordonnées valides.");
                return;
            }

            // Transform grappes for the sync API
            const grappesToSync = grappes.map((g: any) => ({
                name: g.nom || g.name,
                regionName: g.region
            })).filter((g: any) => g.name && g.regionName);

            logger.log(`📤 [GRAPPES] Envoi au backend: ${grappesToSync.length} grappes`, grappesToSync.slice(0, 3));

            const result = await apiClient.post('/teams/grappes/sync', { grappes: grappesToSync });
            
            logger.log(`✅ [GRAPPES] Résultat sync:`, result.data);

            // Refresh grappes in the UI
            await fetchGrappes();

            alert(`✅ ${result.data.count || grappesToSync.length} grappes synchronisées avec succès !`);
        } catch (error: any) {
            const detail = error?.response?.data?.details || error?.response?.data?.error || error?.message || 'Erreur inconnue';
            logger.error("Erreur clustering :", error);
            alert(`Erreur lors de la génération des grappes:\n${detail}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExportData = () => {
        if (!project?.config) return;

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project.config, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `parametres_${project.name || 'projet'}_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
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
                logger.error("Erreur lors de l'import :", error);
                alert("Erreur lors de la lecture du fichier de paramètres. Veuillez vérifier le format.");
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-12">
            <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-1">
                    <Database className="text-indigo-500" />
                    Administration des Données
                </h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Import/Export de configuration et maintenance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* ── EXPORT ── */}
                <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 flex flex-col justify-between">
                    <div className="mb-6">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                            <Download size={16} className="text-blue-500" />
                            Sauvegarde
                        </h3>
                        <p className="text-xs text-gray-500 font-bold">Télécharger la configuration actuelle du projet au format JSON.</p>
                    </div>
                    <button
                        onClick={handleExportData}
                        title="Démarrer l'exportation"
                        className="w-full py-4 bg-white dark:bg-slate-950 border border-gray-100 dark:border-white/5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                    >
                        Exporter (.json)
                    </button>
                </div>

                {/* ── IMPORT ── */}
                <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 flex flex-col justify-between">
                    <div className="mb-6">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                            <Upload size={16} className="text-emerald-500" />
                            Restauration
                        </h3>
                        <p className="text-xs text-gray-500 font-bold">Importer un fichier de configuration pour mettre à jour les paramètres.</p>
                    </div>
                    <label className="w-full">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImportData}
                            className="hidden"
                            title="Choisir un fichier JSON"
                        />
                        <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-3 cursor-pointer">
                            Choisir & Importer
                        </div>
                    </label>
                </div>
            </div>

            <div className="h-px bg-gray-100 dark:bg-white/5" />

            <div className="space-y-8">
                <div className="bg-blue-600 p-10 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl shadow-blue-500/20">
                    <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                        <Layers size={200} />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <h3 className="text-2xl font-black uppercase tracking-tight mb-4 flex items-center gap-3">
                            Algorithme de Clustering
                            <StatusBadge status="info" label="BÊTA" />
                        </h3>
                        <p className="text-blue-100/80 text-sm font-bold leading-relaxed mb-8">
                            Recalculer dynamiquement le regroupement des ménages selon leur position GPS (algorithme k-means).
                            Cette action réorganisera l'ensemble du déploiement opérationnel.
                        </p>
                        <button
                            onClick={handleReorganizeGrappes}
                            disabled={isProcessing}
                            className={`px-10 py-5 bg-white text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-black/10 flex items-center gap-3 ${isProcessing ? 'opacity-70 cursor-wait' : 'hover:bg-gray-50'}`}
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Calcul en cours...
                                </>
                            ) : (
                                "Démarrer le Calcul des Grappes"
                            )}
                        </button>
                    </div>
                </div>

                <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 p-8 md:p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 group">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-rose-500/10 rounded-[1.25rem] flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-transform">
                            <Trash2 size={24} />
                        </div>
                        <div>
                            <h4 className="text-slate-900 dark:text-white font-black uppercase tracking-tight text-sm mb-1">Zone de Danger</h4>
                            <p className="text-rose-500/60 text-[10px] font-bold uppercase tracking-widest">Toutes les données locales seront supprimées. Cette action est irréversible.</p>
                        </div>
                    </div>
                    <button
                        title="Réinitialiser la base de données locale"
                        className="px-8 py-4 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-95 whitespace-nowrap"
                    >
                        Réinitialiser la Base Locale
                    </button>
                </div>
            </div>
        </div>
    );
}

function LogisticsSection({ project, onUpdate }: { project: any, onUpdate: any }) {
    const { teams, fetchTeams } = useTeams(project?.id);
    const materialCatalog: CatalogItem[] = project?.config?.materialCatalog || [];
    const allocations = project?.config?.subTeamAllocations || {};

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

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

        addIfMissing('Casque', 1);
        addIfMissing('Gilet', 1);

        if (teamType === 'macons') {
            addIfMissing('Epi', 1);
        } else if (teamType === 'reseau') {
            addIfMissing('Epi', 1);
        } else if (teamType === 'interieur_type1') {
            addIfMissing('Perforateur', 1);
            addIfMissing('Epi', 1);
        }

        if (added) {
            onUpdate({
                config: {
                    ...project.config,
                    subTeamAllocations: { ...allocations, [subTeamId]: teamAlloc }
                }
            });
        }
    };

    const handleDuplicateToSiblings = (sourceSubTeamId: string, parentTeamId: string) => {
        const sourceAllocations = allocations[sourceSubTeamId] || [];
        if (sourceAllocations.length === 0) return;

        const parentTeam = teams.find((t: any) => t.id === parentTeamId);
        if (!parentTeam || !parentTeam.children) return;

        const newAllocations = { ...allocations };
        parentTeam.children.forEach((st: any) => {
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

    const allSubTeams = teams.filter((t: any) => t.parentTeamId !== null);

    return (
        <div className="space-y-12">
            {/* ERP Elite Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-indigo-500/10 rounded-xl">
                            <Navigation2 size={20} className="text-indigo-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Périmètre de Sécurité (Geofencing)</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rayon autour des magasins pour validation</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Rayon de détection</span>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    title="Rayon en mètres"
                                    value={project?.config?.logistique?.geofencingRadius || 500}
                                    onChange={(e) => onUpdate({
                                        config: {
                                            ...project.config,
                                            logistique: {
                                                ...(project.config.logistique || { history: [] }),
                                                geofencingRadius: parseInt(e.target.value) || 0
                                            }
                                        }
                                    })}
                                    className="w-24 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-black text-indigo-600 text-center outline-none"
                                />
                                <span className="text-xs font-bold text-slate-500 uppercase">Mètres</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                            Définit la distance maximale autorisée entre l'agent et le magasin pour valider une opération de stock.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-amber-500/10 rounded-xl">
                            <DollarSign size={20} className="text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Valorisation des Variantes</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Coût unitaire indicatif par type de kit</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        {['standard', 'solar_lite', 'solar_premium'].map(variantId => (
                            <div key={variantId} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-white/5">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {variantId.replace('_', ' ')}
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        title={`Prix ${variantId}`}
                                        value={project?.config?.logistique?.variantPricing?.[variantId] || 0}
                                        onChange={(e) => onUpdate({
                                            config: {
                                                ...project.config,
                                                logistique: {
                                                    ...(project.config.logistique || { history: [] }),
                                                    variantPricing: {
                                                        ...(project.config.logistique?.variantPricing || {}),
                                                        [variantId]: parseInt(e.target.value) || 0
                                                    }
                                                }
                                            }
                                        })}
                                        className="w-28 bg-transparent border-none text-right text-xs font-black text-amber-600 outline-none"
                                    />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">FCFA</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-1">
                    <Truck className="text-amber-500" />
                    Dotations Standard (Théoriques)
                </h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Affectation type du matériel par unité opérationnelle (Configuration)</p>
            </div>

            {allSubTeams.length === 0 ? (
                <div className="bg-gray-50 dark:bg-white/5 p-12 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/10 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Aucune sous-équipe terrain disponible</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {allSubTeams.map((st: any) => {
                        const stAllocations = allocations[st.id] || [];
                        const availableCatalog = materialCatalog.filter(c => !stAllocations.find((a: any) => a.itemId === c.id));

                        return (
                            <div key={st.id} className="bg-white dark:bg-slate-950 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                                    <div>
                                        <div className="flex items-center gap-4 mb-2">
                                            <h3 className="text-slate-900 dark:text-white font-black uppercase tracking-tight text-lg">{st.name}</h3>
                                            <StatusBadge status="info" label={st.parentTeam.type} />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">{st.parentTeam.name}</p>
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Chef: {st.leader || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <button
                                            onClick={() => handleAutoFillEquipment(st.id, st.parentTeam.type)}
                                            title="Remplissage Automatique"
                                            className="px-5 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-emerald-500/20 flex items-center gap-2"
                                        >
                                            <Zap size={14} />
                                            Auto
                                        </button>
                                        <select
                                            title="Ajouter matériel"
                                            onChange={(e) => { handleAddAllocation(st.id, e.target.value); e.target.value = ""; }}
                                            className="w-full md:w-64 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none"
                                        >
                                            <option value="">+ Allouer Matériel...</option>
                                            {availableCatalog.map(item => (
                                                <option key={item.id} value={item.id}>{item.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {stAllocations.length > 0 ? (
                                    <div className="space-y-4">
                                        {stAllocations.map((alloc: SubTeamEquipment) => {
                                            const catalogItem = materialCatalog.find(c => c.id === alloc.itemId);
                                            if (!catalogItem) return null;
                                            return (
                                                <div key={alloc.id} className="flex flex-col md:flex-row items-center gap-6 p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                                    <div className="flex-1 w-full text-center md:text-left">
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">{catalogItem.category}</label>
                                                        <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">{catalogItem.name}</span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-center md:justify-end gap-6 w-full md:w-auto">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Quantité</span>
                                                            <input
                                                                type="number"
                                                                title="Quantité"
                                                                value={alloc.quantity}
                                                                min="1"
                                                                onChange={(e) => handleUpdateAllocation(st.id, alloc.itemId, 'quantity', parseInt(e.target.value) || 1)}
                                                                className="w-16 bg-white dark:bg-slate-950 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-black text-blue-600 text-center outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Mode</span>
                                                            <select
                                                                title="Type d'acquisition"
                                                                value={alloc.acquisitionType}
                                                                onChange={(e) => handleUpdateAllocation(st.id, alloc.itemId, 'acquisitionType', e.target.value)}
                                                                className="bg-white dark:bg-slate-950 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none"
                                                            >
                                                                <option value="achat">Achat</option>
                                                                <option value="location">Location</option>
                                                            </select>
                                                        </div>
                                                        <div className="text-right min-w-[120px]">
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Coût Unitaire</span>
                                                            <span className="text-xs font-black text-amber-500 uppercase">
                                                                {alloc.acquisitionType === 'achat' ? catalogItem.purchasePrice : catalogItem.rentalPrice} FCFA
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveAllocation(st.id, alloc.itemId)}
                                                            className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="flex justify-end pt-4">
                                            <button
                                                onClick={() => handleDuplicateToSiblings(st.id, st.parentTeam.id)}
                                                className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 hover:text-blue-600 flex items-center gap-2 transition-colors"
                                            >
                                                <Layers size={14} />
                                                Dupliquer aux autres unités du groupement
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Aucun matériel alloué</p>
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
export function KoboSettingsSection({ project, onUpdate }: { project: any, onUpdate: any }) {
    const defaultKoboConfig = {
        token: '',
        assetUid: ''
    };

    const koboConfig = project?.config?.kobo || defaultKoboConfig;
    const [config, setConfig] = useState(koboConfig);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdate({
                config: {
                    ...project.config,
                    kobo: config
                }
            });
            alert('Paramètres Kobo sauvegardés avec succès !');
        } catch (error) {
            logger.error(error);
            alert('Erreur lors de la sauvegarde.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight mb-1">
                        <CloudDownload className="text-indigo-500" />
                        Synchronisation KoboToolbox
                    </h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Paramétrage de l'API KoBo pour l'import automatique des formulaires Terrain</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={16} />
                    {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
            </div>

            <div className="bg-white dark:bg-slate-950 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm space-y-8">
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-sm text-blue-700 dark:text-blue-400 font-medium">
                        <p>Ces identifiants permettent à l'application de se connecter à votre compte KoboToolbox pour récupérer les réponses des enquêteurs. Le processus de synchronisation est déclenché manuellement depuis le "Data Hub" de la carte.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Token API d'Authentification</label>
                            <input
                                type="password"
                                title="Token Kobo API"
                                value={config.token}
                                onChange={e => setConfig({ ...config, token: e.target.value })}
                                placeholder="ex: 2e3a09a8bff3fbb3a2510dbc..."
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                            <p className="text-[10px] text-gray-400 mt-2">Trouvable dans vos paramètres de compte KoboToolbox sous "API Tokens".</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Identifiant du Formulaire (Asset UID)</label>
                            <input
                                type="text"
                                title="Asset UID Kobo"
                                value={config.assetUid}
                                onChange={e => setConfig({ ...config, assetUid: e.target.value })}
                                placeholder="ex: aEYZwPujJiFBTNb6mxMGCB"
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                            <p className="text-[10px] text-gray-400 mt-2">C'est la partie de l'URL Kobo lorsque vous visualisez le formulaire.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

