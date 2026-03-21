import { useState, useEffect } from 'react';
import {
    Users,
    Home,
    Search,
    Filter,
    Download,
    MapPin,
    ChevronRight,
    Briefcase,
    Loader2,
    FileText,
    CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/client';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '../context/ThemeContext';
import { fmtNum } from '../utils/format';
import logger from '../utils/logger';

interface Zone {
    id: string;
    name: string;
    villageCount?: number;
    householdCount?: number;
    electrified?: number;
    _count?: {
        households: number;
    };
}

interface Household {
    id: string;
    status: string;
    owner: {
        name?: string;
        phone?: string;
    };
    location?: any;
}

export default function Bordereau() {
    const { isDarkMode } = useTheme();
    const [zones, setZones] = useState<Zone[]>([]);
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [householdsLoading, setHouseholdsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Fetch zones and teams on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [zonesRes] = await Promise.all([
                    apiClient.get('zones'),
                ]);

                let fetchedTeams = [];
                try {
                    const tRes = await apiClient.get('teams');
                    fetchedTeams = tRes.data.teams;
                } catch (e) {
                    fetchedTeams = [
                        { id: 'T1', name: 'Équipe Maçons Alpha', type: 'Maçonnerie', status: 'Active' },
                        { id: 'T2', name: 'Équipe Réseau Beta', type: 'Réseau', status: 'Active' },
                    ];
                }

                const fetchedZones = zonesRes.data.zones.map((z: any) => ({
                    ...z,
                    householdCount: z._count?.households || 0,
                    electrified: 0,
                    villageCount: 1
                }));

                setZones(fetchedZones);
                setTeams(fetchedTeams);

                if (fetchedZones.length > 0) {
                    setSelectedZone(fetchedZones[0]);
                }
            } catch (err) {
                logger.error('Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Fetch households when zone changes
    useEffect(() => {
        if (!selectedZone) return;

        const fetchHouseholds = async () => {
            setHouseholdsLoading(true);
            try {
                const { data } = await apiClient.get(`/households?zoneId=${selectedZone.id}`);
                setHouseholds(data.households);
            } catch (err) {
                logger.error('Error fetching households:', err);
            } finally {
                setHouseholdsLoading(false);
            }
        };
        fetchHouseholds();
    }, [selectedZone]);

    const handleExportPDF = async () => {
        if (!selectedZone) return;

        const doc = new jsPDF({ orientation: 'landscape' });

        // Add Logo
        try {
            const logoRes = await fetch('/logo-proquelec.png');
            const logoBlob = await logoRes.blob();
            const logoBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(logoBlob);
            });
            doc.addImage(logoBase64, 'PNG', 14, 10, 40, 15);
        } catch (e) {
            logger.error('Could not add logo to PDF', e);
        }

        const assignedTeams = ['Maçonnerie', 'Réseau', 'Installation intérieure', 'Contrôle & Validation'].map(type => {
            const team = teams.find(t => t.type === type && t.zoneId === selectedZone.id);
            return team ? `${type}: ${team.name}` : null;
        }).filter(Boolean).join(' | ');

        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229);
        doc.text(`BORDEREAU D'INTERVENTION`, 60, 22);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`PROJET D'ÉLECTRIFICATION RURALE - LOT 24 (SENELEC / PROQUELEC)`, 60, 28);

        doc.setDrawColor(79, 70, 229);
        doc.setLineWidth(0.5);
        doc.line(14, 40, 283, 40);

        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(`Zone (Arrondissement) : ${selectedZone.name?.toUpperCase()}`, 14, 48);
        doc.text(`Date de génération : ${new Date().toLocaleDateString('fr-FR')}`, 14, 55);
        doc.text(`Équipes affectées : ${assignedTeams || 'Aucune'}`, 14, 62);

        const tableBody = filteredHouseholds.map((h, index) => {
            let gps = 'Non défini';
            try {
                const loc = typeof h.location === 'string' ? JSON.parse(h.location) : h.location;
                if (loc?.type === 'Point' && Array.isArray(loc.coordinates)) {
                    const lng = Number(loc.coordinates[0]).toFixed(5);
                    const lat = Number(loc.coordinates[1]).toFixed(5);
                    gps = `${lat}, ${lng}`;
                } else if (loc?.lat !== undefined) {
                    gps = `${Number(loc.lat).toFixed(5)}, ${Number(loc.lng || loc.longitude || 0).toFixed(5)}`;
                }
            } catch (e) { }

            return [
                (index + 1).toString(),
                h.id.substring(0, 8),
                h.owner?.name || 'Non renseigné',
                h.owner?.phone || 'N/A',
                gps,
                h.status === 'completed' ? 'Terminé' : 'En attente'
            ];
        });

        autoTable(doc, {
            startY: 70,
            head: [['#', 'ID Village / Ménage', 'Responsable / Propriétaire', 'Téléphone', 'Coordonnées GPS', 'Statut intervention']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold', halign: 'center' },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 14, right: 14 }
        });

        // Add African Pattern footer decoration
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const footerY = doc.internal.pageSize.height - 10;
            // Draw colorful line
            const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6'];
            const segmentWidth = (283 - 14) / colors.length;
            colors.forEach((color, idx) => {
                doc.setDrawColor(color);
                doc.setLineWidth(1.5);
                doc.line(14 + (idx * segmentWidth), footerY + 2, 14 + ((idx + 1) * segmentWidth), footerY + 2);
            });

            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} sur ${pageCount} - Document généré par GEM SaaS - Proquelec Raccordement Senelec`, 14, footerY);
        }

        doc.save(`Bordereau_${selectedZone.name}_${new Date().getTime()}.pdf`);
    };


    const handleExportExcel = () => {
        if (!selectedZone) return;

        const assignedTeams = ['Maçonnerie', 'Réseau', 'Installation intérieure', 'Contrôle & Validation'].map(type => {
            const team = teams.find(t => t.type === type && t.zoneId === selectedZone.id);
            return team ? `${type}: ${team.name}` : null;
        }).filter(Boolean).join(' | ');

        const dataToExport = filteredHouseholds.map((h, index) => {
            let gps = 'Non défini';
            try {
                const loc = typeof h.location === 'string' ? JSON.parse(h.location) : h.location;
                if (loc?.type === 'Point' && Array.isArray(loc.coordinates)) {
                    gps = `${loc.coordinates[1]}, ${loc.coordinates[0]}`;
                } else if (loc?.lat !== undefined) {
                    gps = `${loc.lat}, ${loc.lng || loc.longitude || 0}`;
                }
            } catch (e) {
                // Ignore
            }

            return {
                'N°': index + 1,
                'Identifiant Ménage': h.id,
                'Nom du Propriétaire': h.owner?.name || 'Non renseigné',
                'N° de Téléphone': h.owner?.phone || 'N/A',
                'Coordonnées GPS': gps,
                'Statut': h.status === 'completed' ? 'Terminé' : 'En attente',
                'Zone/Village': selectedZone.name,
                'Équipes Affectées': assignedTeams || 'Aucune'
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ménages");
        XLSX.writeFile(wb, `Export_Ménages_${selectedZone.name}.xlsx`);
    };

    const filteredHouseholds = households.filter(h => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'completed') return h.status === 'completed';
        return h.status !== 'completed';
    });

    const searchedZones = zones.filter(z =>
        z.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className={`flex items-center justify-center h-full ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full transition-colors ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
            <header className={`p-8 border-b backdrop-blur-xl sticky top-0 z-20 transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white/70 border-slate-200 shadow-sm'}`}>
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Users size={24} className="text-white" />
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tight italic">Bordereau Terrain</h1>
                        </div>
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Gestion des zones, villages et affectations d'équipes techniques.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleExportExcel}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black tracking-widest uppercase transition-all border ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'}`}>
                            <Download size={16} /> Export Excel
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 px-6 py-3 rounded-2xl text-[11px] font-black tracking-widest uppercase text-white transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
                            <FileText size={16} /> Export & Imprimer PDF
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">

                    {/* Zone Selector */}
                    <aside className="lg:col-span-4 space-y-6">
                        <div className="relative group">
                            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher une zone, un village..."
                                className={`w-full border rounded-[1.5rem] py-4 pl-12 pr-6 text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-indigo-500 text-white shadow-inner' : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 shadow-sm'}`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="space-y-4">
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 flex items-center justify-between ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                <span>Zones / Arrondissements ({searchedZones.length})</span>
                            </h3>
                            <div className="space-y-3">
                                {searchedZones.map((zone) => {
                                    const progress = Math.round(((zone.electrified || 0) / (zone.householdCount || 1)) * 100);
                                    const isSelected = selectedZone?.id === zone.id;

                                    return (
                                        <button
                                            key={zone.id}
                                            onClick={() => setSelectedZone(zone)}
                                            className={`w-full group relative p-6 rounded-[2rem] border transition-all text-left ${isSelected
                                                ? isDarkMode
                                                    ? 'bg-indigo-600/10 border-indigo-500/50 shadow-xl shadow-indigo-500/5 ring-1 ring-indigo-500/20'
                                                    : 'bg-indigo-50 border-indigo-200 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/10'
                                                : isDarkMode
                                                    ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                                                    : 'bg-white border-slate-200 hover:border-indigo-100 hover:shadow-md'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className={`text-sm font-black uppercase tracking-tighter ${isSelected ? (isDarkMode ? 'text-white' : 'text-indigo-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}`}>{zone.name}</h4>
                                                    <p className={`text-[10px] font-bold italic mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{fmtNum(zone.villageCount || 1)} Village(s)</p>
                                                </div>
                                                <ChevronRight size={18} className={isSelected ? 'text-indigo-500' : (isDarkMode ? 'text-slate-700' : 'text-slate-300')} />
                                            </div>

                                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 1, type: 'spring' }}
                                                    className={`h-full ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                />
                                            </div>
                                            <div className={`flex justify-between mt-3 text-[9px] font-black uppercase tracking-widest ${isSelected ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-600') : (isDarkMode ? 'text-slate-600' : 'text-slate-400')}`}>
                                                <span>Avancement global</span>
                                                <span className={progress === 100 ? 'text-emerald-500' : ''}>{progress}%</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="lg:col-span-8 space-y-8">
                        <AnimatePresence mode="wait">
                            {selectedZone ? (
                                <motion.div
                                    key={selectedZone.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="space-y-8"
                                >
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className={`p-8 rounded-[2rem] border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Home size={14} className="text-slate-400" />
                                                Ménages Cibles
                                            </div>
                                            <div className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{fmtNum(selectedZone.householdCount || 0)}</div>
                                        </div>
                                        <div className={`p-8 rounded-[2rem] border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-emerald-50 border-emerald-100 shadow-xl shadow-emerald-600/5'}`}>
                                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <CheckCircle2 size={14} className="text-emerald-500" />
                                                Électrifiés
                                            </div>
                                            <div className="text-4xl font-black text-emerald-500">{fmtNum(selectedZone.electrified || 0)}</div>
                                        </div>
                                        <div className={`p-8 rounded-[2rem] border transition-all ${isDarkMode ? 'bg-indigo-900/20 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100 shadow-xl shadow-indigo-600/5'}`}>
                                            <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <MapPin size={14} className="text-indigo-500" />
                                                Couverture Géo
                                            </div>
                                            <div className="text-4xl font-black text-indigo-500">
                                                {selectedZone.householdCount ? Math.round(((selectedZone.electrified || 0) / selectedZone.householdCount) * 100) : 0}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Team Assignments */}
                                    <div className={`rounded-[2.5rem] overflow-hidden border shadow-2xl transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                        <div className={`p-8 border-b ${isDarkMode ? 'border-slate-800 bg-gradient-to-r from-indigo-500/5 to-transparent' : 'border-slate-100 bg-gradient-to-r from-indigo-50 to-white'}`}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className={`text-xl font-black uppercase tracking-tighter flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                        <div className="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                                                            <Briefcase size={20} />
                                                        </div>
                                                        Affectations Techniques
                                                    </h3>
                                                    <p className={`text-xs mt-2 font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Équipes responsables des opérations de déploiement et validation dans la zone.</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {['Maçonnerie', 'Réseau', 'Installation intérieure', 'Contrôle & Validation'].map((type) => {
                                                const assignedTeam = teams.find(t => t.type === type && t.zoneId === selectedZone.id);
                                                return (
                                                    <div key={type} className={`p-6 rounded-[2rem] border flex flex-col gap-4 group transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-indigo-500/30' : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5'}`}>
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30' : 'bg-white border-slate-200 text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-200'}`}>
                                                                <MapPin size={20} />
                                                            </div>
                                                            <div>
                                                                <p className={`text-[10px] font-black uppercase tracking-widest font-mono ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>{type}</p>
                                                                <h5 className={`font-black text-sm mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                                                    {assignedTeam ? assignedTeam.name : 'En attente d\'affectation'}
                                                                </h5>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <select
                                                                title={`Assigner équipe ${type}`}
                                                                className={`w-full appearance-none text-xs font-bold px-4 py-3 rounded-xl border transition-all cursor-pointer outline-none ${isDarkMode
                                                                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                                                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                                                                    }`}
                                                                value={assignedTeam?.id || ''}
                                                                onChange={async (e) => {
                                                                    const teamId = e.target.value;
                                                                    if (!teamId) return;
                                                                    try {
                                                                        await apiClient.post(`/teams/${teamId}/assign`, { zoneId: selectedZone.id });
                                                                        const tRes = await apiClient.get('teams');
                                                                        setTeams(tRes.data.teams);
                                                                    } catch (err) {
                                                                        logger.error('Failed to assign team', err);
                                                                    }
                                                                }}
                                                            >
                                                                <option value="">-- Modifier l'équipe affectée --</option>
                                                                {teams.filter(t => t.type === type || !t.type).map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                            <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                <ChevronRight size={16} className="rotate-90" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Household List */}
                                    <div className={`rounded-[2.5rem] p-8 shadow-2xl border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pt-2">
                                            <h3 className={`text-xl font-black uppercase tracking-tighter flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/30">
                                                    <Home size={20} />
                                                </div>
                                                Registre de la zone
                                            </h3>

                                            <div className="flex items-center gap-2">
                                                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                                    <Filter size={16} /> Filtre
                                                </div>
                                                <select
                                                    title="Filtrer"
                                                    value={statusFilter}
                                                    onChange={(e) => setStatusFilter(e.target.value)}
                                                    className={`appearance-none px-6 py-3 rounded-xl border text-xs font-bold outline-none cursor-pointer transition-all ${isDarkMode
                                                        ? 'bg-slate-950 border-slate-800 text-white hover:border-slate-700'
                                                        : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <option value="all">Tous les statuts ({households.length})</option>
                                                    <option value="pending">En attente ({households.filter(h => h.status !== 'completed').length})</option>
                                                    <option value="completed">Terminés ({households.filter(h => h.status === 'completed').length})</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className={`rounded-[1.5rem] border overflow-hidden relative min-h-[300px] ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/50'}`}>
                                            {householdsLoading ? (
                                                <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-sm z-10 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white/50'}`}>
                                                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                                </div>
                                            ) : null}

                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className={`border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-100/50'}`}>
                                                        <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>N°</th>
                                                        <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Propriétaire / Représentant</th>
                                                        <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID Localité</th>
                                                        <th className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Statut</th>
                                                        <th className="px-6 py-4 text-right"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                                    {filteredHouseholds.map((h, i) => (
                                                        <tr key={h.id} className={`group transition-colors ${isDarkMode ? 'hover:bg-slate-900/80' : 'hover:bg-white'}`}>
                                                            <td className="px-6 py-4">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                                                    {i + 1}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{h.owner?.name || 'Nom non communiqué'}</div>
                                                                <div className="text-[10px] text-slate-500 mt-0.5">{h.owner?.phone || 'Contact introuvable'}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="font-mono text-xs text-slate-500 bg-slate-500/10 inline-block px-2 py-1 rounded">
                                                                    {h.id.substring(0, 8)}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {h.status === 'completed' ? (
                                                                    <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                                                                        <CheckCircle2 size={14} /> Achevé
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                                                        <Loader2 size={14} className="animate-spin" /> En cours
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    title="Voir les détails"
                                                                    aria-label={`Voir les détails de ${h.id}`}
                                                                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${isDarkMode
                                                                        ? 'border-slate-800 text-slate-500 hover:text-white hover:bg-slate-800'
                                                                        : 'border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300'
                                                                        }`}
                                                                >
                                                                    <ChevronRight size={18} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {filteredHouseholds.length === 0 && !householdsLoading && (
                                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-900 text-slate-700' : 'bg-slate-100 text-slate-300'}`}>
                                                        <Search size={32} />
                                                    </div>
                                                    <p className={`text-lg font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Aucun résultat pour ces critères</p>
                                                    <p className="text-sm text-slate-500 mt-2">Essayez de modifier vos filtres.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </motion.div>
                            ) : (
                                <div className="h-[600px] flex flex-col items-center justify-center text-center">
                                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                                        <MapPin size={48} />
                                    </div>
                                    <h2 className={`text-2xl font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Aucune zone sélectionnée</h2>
                                    <p className={`text-sm mt-2 max-w-sm ${isDarkMode ? 'text-slate-600' : 'text-slate-500'}`}>
                                        Veuillez choisir un arrondissement ou une localité dans le menu latéral pour afficher son bordereau technique.
                                    </p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>

                </div>
            </main>
        </div>
    );
}
