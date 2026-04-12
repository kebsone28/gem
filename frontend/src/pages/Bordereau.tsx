import { useState, useEffect, useMemo } from 'react';
import {
    Printer,
    FileSpreadsheet,
    RefreshCw,
    ChevronRight,
    ChevronDown,
    MapPin,
    Users,
    Zap,
    CheckCircle2,
    Search,
    Package,
    TrendingUp
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { generateGrappePDF, generateGrappeExcel } from '../services/bordereauGenerator';
import { useProject } from '../contexts/ProjectContext';
import { db } from '../store/db';
import { useSyncListener } from '../hooks/useSyncListener';
import { fmtNum } from '../utils/format';

// Import centralized design system
import {
    PageContainer,
    PageHeader,
    ContentArea,
    ActionBar
} from '../components';

const Bordereau = () => {
    const { activeProjectId: projectId } = useProject();
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [data, setData] = useState({ grappes: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});

    const fetchData = async (forceRefresh = false) => {
        try {
            setLoading(true);

            if (forceRefresh && db) {
                try {
                    if (db.grappes && typeof db.grappes.clear === 'function') {
                        await db.grappes.clear();
                    }
                    if (db.households && typeof db.households.clear === 'function') {
                        await db.households.clear();
                    }
                    console.log('[BORDEREAU] Cache cleared');
                } catch (err) {
                    console.warn('[BORDEREAU] Could not clear cache:', err);
                }
            } else if (forceRefresh && !db) {
                console.warn('[BORDEREAU] Dexie DB not available for cache clear');
            }

            const response = await api.get(`/projects/${projectId}/bordereau?_t=${Date.now()}`);
            setData(response.data);

            const regions = Array.from(
                new Set(response.data.grappes.map((g: any) => g.region || 'Sans Région'))
            );
            const initialExpanded: any = {};
            regions.forEach((r: any) => {
                initialExpanded[r] = true;
            });
            setExpandedRegions(initialExpanded);
        } catch (error) {
            console.error('Error fetching bordereau:', error);
            toast.error('Erreur lors du chargement du bordereau');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            fetchData();
        }
    }, [projectId]);

    useSyncListener((source) => {
        console.log(`[BORDEREAU] Data changed by ${source} - refreshing...`);
        if (source === 'kobo' || source === 'import') {
            // Data is fully downloaded already, just re-fetch from cache
            fetchData(false);
            return;
        }
        fetchData(true); // Complete reset and refresh
    });

    const handleRecalculate = async () => {
        try {
            setSyncing(true);
            await api.post(`/projects/${projectId}/recalculate-grappes`);
            toast.success('Recalculation des grappes terminée !');
            await fetchData();
        } catch (error) {
            console.error('Sync error:', error);
            toast.error('Erreur lors de la synchronisation');
        } finally {
            setSyncing(false);
        }
    };

    const toggleRegion = (region: string) => {
        setExpandedRegions((prev: any) => ({
            ...prev,
            [region]: !prev[region]
        }));
    };

    const groupedData = useMemo(() => {
        return (data?.grappes || []).reduce((acc: any, grappe: any) => {
            const region = grappe.region || 'Sans Région';
            if (!acc[region]) acc[region] = [];
            acc[region].push(grappe);
            return acc;
        }, {});
    }, [data]);

    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const filteredRegions = useMemo(() => {
        return Object.keys(groupedData).filter(region => {
            const matchesRegion = region.toLowerCase().includes(debouncedQuery.toLowerCase());
            const matchesGrappe = groupedData[region].some((g: any) =>
                (g.name || '').toLowerCase().includes(debouncedQuery.toLowerCase())
            );
            return matchesRegion || matchesGrappe;
        });
    }, [groupedData, debouncedQuery]);

    const handleExportGrappe = (grappe: any, format: string) => {
        try {
            if (format === 'pdf') {
                generateGrappePDF({ ...grappe, date: new Date() }, 'Projet GEM');
                toast.success(`Export PDF généré pour ${grappe.name}`);
            } else if (format === 'excel') {
                generateGrappeExcel({ ...grappe, date: new Date() });
                toast.success(`Export Excel généré pour ${grappe.name}`);
            } else {
                toast.success(`Affichage de la liste à venir pour ${grappe.name}`);
            }
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Erreur lors de la génération de l'export");
        }
    };

    const stats = useMemo(() => {
        const allGrappes = data?.grappes || [];
        const total = allGrappes.reduce((acc: number, g: any) => acc + (g.householdCount || 0), 0);
        const delivered = allGrappes.reduce((acc: number, g: any) => acc + (g.electrified || 0), 0);
        const pending = total - delivered;
        const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
        const critical = allGrappes.filter((g: any) => g.electrified === 0 && g.householdCount > 0).length;

        return { total, delivered, pending, pct, critical };
    }, [data]);

    const getGrappeStatus = (g: any) => {
        if (!g.householdCount || g.householdCount === 0) return { label: 'VIDE', color: 'bg-white/5 text-white/20 border-white/5' };
        if (g.electrified === 0) return { label: 'NON DÉMARRÉ', color: 'bg-red-500/10 text-red-500 border-red-500/20' };
        if (g.electrified < g.householdCount) return { label: 'EN COURS', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
        return { label: 'TERMINÉ', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    };

    const getSafeProgress = (grappe: any) => {
        const householdCount = Number(grappe.householdCount) || 0;
        const electrified = Number(grappe.electrified) || 0;
        if (householdCount <= 0) return 0;
        return Math.min(100, Math.max(0, Math.round((electrified / householdCount) * 100)));
    };

    if (loading && !syncing) {
        return (
            <PageContainer className="min-h-screen py-8 bg-surface">
                <PageHeader
                    title="Bordereau de Livraison"
                    subtitle="Initialisation des données..."
                    icon={<FileSpreadsheet size={24} />}
                />
                <ContentArea>
                    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-300 animate-pulse">Chargement en cours</p>
                    </div>
                </ContentArea>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="min-h-screen py-8 bg-surface">
            <PageHeader
                title="Bordereau de Livraison"
                subtitle="Gestion et suivi des expéditions par zone"
                icon={<FileSpreadsheet size={24} />}
                actions={
                    <ActionBar>
                        <button
                            onClick={() => fetchData(true)}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-white/5 text-white hover:bg-white/10 border border-white/5 transition-all uppercase tracking-widest"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                        </button>
                        <button
                            onClick={handleRecalculate}
                            disabled={syncing}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-primary text-white hover:bg-primary-light shadow-lg shadow-primary/20 transition-all uppercase tracking-widest"
                        >
                            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Recalculer
                        </button>
                    </ActionBar>
                }
            />

            <ContentArea padding="none" className="bg-transparent border-transparent shadow-none">
                <div className="p-4 md:p-8 space-y-8">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Ménages', value: fmtNum(stats.total), icon: Users, sub: 'éligibles' },
                            { label: 'En Cours', value: fmtNum(stats.pending), icon: Package, sub: 'à livrer' },
                            { label: 'Livrés', value: fmtNum(stats.delivered), icon: CheckCircle2, sub: 'confirmés' },
                            { label: 'Taux Livraison', value: `${stats.pct}%`, icon: TrendingUp, sub: 'objectif' },
                        ].map((kpi, i) => (
                            <div key={i} className="card p-8 bg-white/5 border-white/5 hover:bg-white/10 transition-all group">
                                <div className="flex items-center justify-between mb-6">
                                    <kpi.icon size={18} className="text-blue-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-black text-blue-300/30 uppercase tracking-[0.2em]">{kpi.label}</span>
                                </div>
                                <div className="text-4xl font-black text-white italic tracking-tighter mb-1">{kpi.value}</div>
                                <div className="text-[10px] font-black text-blue-300/40 uppercase tracking-widest">{kpi.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Filter Bar */}
                    <div className="relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-800 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="RECHERCHER UNE RÉGION OU UNE GRAPPE..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-16 pr-6 py-6 bg-white/5 border border-white/5 rounded-3xl text-white placeholder-blue-800 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-black text-xs tracking-widest uppercase"
                        />
                    </div>

                    {/* Main Content */}
                    <div className="space-y-4">
                        {filteredRegions.length === 0 ? (
                            <div className="card py-24 bg-white/5 border-white/5 text-center flex flex-col items-center justify-center space-y-4 opacity-30">
                                <MapPin size={48} className="text-blue-300" />
                                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-300">Aucune donnée correspondante</h3>
                            </div>
                        ) : (
                            filteredRegions.map((region: string) => (
                                <div key={region} className="card bg-white/5 border-white/5 overflow-hidden">
                                    <button
                                        onClick={() => toggleRegion(region)}
                                        className="w-full px-8 py-6 flex items-center justify-between hover:bg-white/5 transition-colors group"
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-800 group-hover:text-primary transition-colors">
                                                <MapPin size={22} />
                                            </div>
                                            <div className="text-left">
                                                <h2 className="text-xl font-black text-white italic tracking-tight">{region}</h2>
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <span className="text-[9px] font-black text-blue-300/30 uppercase tracking-[0.2em]">
                                                        {groupedData[region].length} GRAPPES
                                                    </span>
                                                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-2 py-0.5 rounded">
                                                        {groupedData[region].reduce((acc: number, g: any) => acc + (g.householdCount || 0), 0)} MÉNAGES
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {expandedRegions[region] ? <ChevronDown size={22} className="text-white/20" /> : <ChevronRight size={22} className="text-white/20" />}
                                    </button>

                                    <AnimatePresence>
                                        {expandedRegions[region] && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="px-8 pb-8 pt-2 border-t border-white/5 bg-black/20"
                                            >
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                                    {groupedData[region]
                                                        .filter((g: any) => {
                                                            const query = debouncedQuery.toLowerCase();
                                                            if (!query) return true;
                                                            return (g.name || '').toLowerCase().includes(query) || region.toLowerCase().includes(query);
                                                        })
                                                        .map((grappe: any) => {
                                                            const progress = getSafeProgress(grappe);
                                                            const status = getGrappeStatus(grappe);
                                                            return (
                                                                <div key={grappe.id} className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/40 transition-all group flex flex-col justify-between">
                                                                    <div className="mb-6">
                                                                        <div className="flex items-start justify-between mb-4">
                                                                            <div className="min-w-0">
                                                                                <h3 className="text-sm font-black text-white truncate uppercase tracking-tight flex items-center gap-3">
                                                                                    {grappe.name}
                                                                                    {String(grappe.id).startsWith('unclassified') && (
                                                                                        <span className="text-[8px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">À CLASSER</span>
                                                                                    )}
                                                                                </h3>
                                                                                <div className="flex items-center gap-3 mt-2">
                                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border tracking-widest uppercase ${status.color}`}>
                                                                                        {status.label}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-bold text-blue-300/30 flex items-center gap-1.5 uppercase">
                                                                                        <Zap size={12} className="text-primary" /> {grappe.householdCount} ménages
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-xl font-black text-white italic">{progress}%</div>
                                                                                <div className="text-[8px] font-black text-blue-300/20 uppercase tracking-widest mt-1">Avancement</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                                            <motion.div 
                                                                                initial={{ width: 0 }}
                                                                                animate={{ width: `${progress}%` }}
                                                                                className={`h-full rounded-full ${progress >= 70 ? 'bg-emerald-500' : 'bg-primary'}`}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                                        <div className="flex gap-2">
                                                                            <button title="Exporter en PDF" onClick={() => handleExportGrappe(grappe, 'pdf')} className="p-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5 transition-all">
                                                                                <Printer size={16} />
                                                                            </button>
                                                                            <button title="Exporter en Excel" onClick={() => handleExportGrappe(grappe, 'excel')} className="p-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5 transition-all">
                                                                                <FileSpreadsheet size={16} />
                                                                            </button>
                                                                        </div>
                                                                        <div className="text-[9px] font-black text-blue-300/20 uppercase tracking-widest">
                                                                            {grappe.electrified} / {grappe.householdCount} terminés
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </ContentArea>
        </PageContainer>
    );
};

export default Bordereau;