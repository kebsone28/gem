import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import * as safeStorage from '../utils/safeStorage';
import {
    ClipboardList,
    Trash2,
    FileDown,
    ShieldCheck,
    Sparkles,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    FileText,
    DollarSign,
    User,
    ListChecks,
    History,
    FileSearch,
    Clock,
    PenTool,
    Camera,
    Image as ImageIcon,
    MapPin
} from 'lucide-react';
import { generateMissionOrderPDF, generateMissionReportPDF } from '../services/missionOrderGenerator';
import { generateMissionOrderWord, generateMissionReportWord } from '../services/missionOrderWordGenerator';
import type { MissionOrderData, MissionMember } from '../services/missionOrderGenerator';
import { db } from '../store/db';
import SignatureModal from '../components/common/SignatureModal';
import { MissionSettings } from '../components/mission/MissionSettings';
import { MissionExpenses } from '../components/mission/MissionExpenses';
import { MissionInventory } from '../components/mission/MissionInventory';
import { MissionAI } from '../components/mission/MissionAI';
import { MissionMiniMap } from '../components/mission/MissionMiniMap';
import logger from '../utils/logger';

const DEFAULT_PLANNING_STEPS = [
    "Jour 1 : Dakar ➔ Tambacounda (Mise en route)\n• Matin : Départ 06h00 de Dakar.\n• Après-midi : Trajet Dakar-Tamba.\n• Soir : Réunion de cadrage initiale avec l'entrepreneur principal de Tamba.",
    "Jour 2 : Tamba : Secteur Villages (Terrain 1)\n• Matin : Visite de 2 à 3 villages. Échantillonnage.\n• Action : Prise de coordonnées GPS des grappes et repérage des lieux de stockage.\n• Fin de journée : Identification d'un lieu de formation central.",
    "Jour 3 : Tamba (Négociations) ➔ Kaffrine\n• Matin : Finalisation de la négociation contractuelle avec l'entrepreneur.\n• Après-midi : Route vers Kaffrine (2.5h). Première visite de village."
];

export default function MissionOrder() {
    const activeProjectId = safeStorage.getItem('active_project_id');
    const [currentMissionId, setCurrentMissionId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'prep' | 'report'>('prep');

    // DB Queries
    const savedMissions = useLiveQuery(
        () => db.missions.where('projectId').equals(activeProjectId || '').toArray(),
        [activeProjectId]
    ) || [];

    const [isCertified, setIsCertified] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    const [formData, setFormData] = useState<Partial<MissionOrderData>>({
        orderNumber: '20/2026',
        date: new Date().toLocaleDateString('fr-FR'),
        region: 'Sénégal',
        startDate: '05/03/2026',
        endDate: '10/03/2026',
        itineraryAller: 'Dakar – Tamba –Kaffrine',
        itineraryRetour: 'Kaffrine – Dakar',
        purpose: 'Préparation Projet électrification LES 3750 Ménages',
        transport: 'Véhicule PROQUELEC DK 4673 BH',
        planning: DEFAULT_PLANNING_STEPS,
        features: {
            map: true,
            expenses: false,
            inventory: false,
            ai: false
        }
    });

    const [members, setMembers] = useState<MissionMember[]>([
        { name: 'Pape Oumar KEBE', role: 'Chef de projet', unit: 'Technique', dailyIndemnity: 40000, days: 6 },
        { name: 'Mamadou Fall', role: 'Chauffeur', unit: 'Technique', dailyIndemnity: 20000, days: 6 }
    ]);

    const [showPlanningEditor, setShowPlanningEditor] = useState(false);
    const [reportView, setReportView] = useState<'status' | 'timeline'>('status');

    // Load Last mission on mount
    useEffect(() => {
        if (savedMissions.length > 0 && !currentMissionId) {
            loadMission(savedMissions[savedMissions.length - 1]);
        }
    }, [savedMissions.length]);

    const loadMission = (mission: any) => {
        setCurrentMissionId(mission.id);
        setFormData({ ...mission });
        setMembers(mission.members || []);
        setIsCertified(mission.isCertified || false);
    };

    const handleNewMission = () => {
        setCurrentMissionId(null);
        setFormData({
            orderNumber: `20/${new Date().getFullYear()}`,
            date: new Date().toLocaleDateString('fr-FR'),
            region: 'Sénégal',
            startDate: new Date().toLocaleDateString('fr-FR'),
            endDate: '',
            itineraryAller: '',
            itineraryRetour: '',
            purpose: '',
            transport: '',
            planning: DEFAULT_PLANNING_STEPS
        });
        setMembers([]);
        setIsCertified(false);
        setFormData(prev => ({
            ...prev,
            features: {
                map: true,
                expenses: false,
                inventory: false,
                ai: false
            }
        }));
    };

    const handleSaveMission = async () => {
        if (!activeProjectId) return;
        const missionData = {
            id: currentMissionId || crypto.randomUUID(),
            projectId: activeProjectId,
            ...formData,
            members,
            isCertified,
            updatedAt: new Date().toISOString()
        };

        try {
            await db.missions.put(missionData);
            if (!currentMissionId) setCurrentMissionId(missionData.id);
            logger.log("Mission sauvegardée localement");
        } catch (err) {
            logger.error(err);
        }
    };

    // Auto-save debounced
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeProjectId && formData.purpose) {
                handleSaveMission();
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [formData, members, isCertified]);

    useEffect(() => {
        if (formData.planning) {
            const currentReportDays = formData.reportDays || [];
            const newReportDays = formData.planning.map((p, i) => {
                const existing = currentReportDays.find(rd => rd.day === i + 1);
                return existing || {
                    day: i + 1,
                    title: p.split('\n')[0],
                    observation: '',
                    isCompleted: false
                };
            });
            if (JSON.stringify(newReportDays) !== JSON.stringify(currentReportDays)) {
                setFormData(prev => ({ ...prev, reportDays: newReportDays }));
            }
        }
    }, [formData.planning]);

    const updateReportDay = (index: number, field: string, value: any) => {
        const newReportDays = [...(formData.reportDays || [])];
        newReportDays[index] = { ...newReportDays[index], [field]: value };

        // Auto-capture GPS coordinate when marking task as completed
        if (field === 'isCompleted' && value === true && !newReportDays[index].location) {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    newReportDays[index].location = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                    setFormData({ ...formData, reportDays: [...newReportDays] });
                }, (err) => {
                    console.warn("GPS capture failed or denied", err);
                });
            }
        }

        setFormData({ ...formData, reportDays: newReportDays });
    };

    const handlePhotoCapture = (index: number) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Prefer back camera on mobile
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    const base64 = loadEvent.target?.result as string;
                    updateReportDay(index, 'photo' as any, base64);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const totalFrais = members.reduce((sum, m) => sum + (m.dailyIndemnity * m.days), 0);

    const handleSyncFinance = async () => {
        if (!activeProjectId) return;
        setIsSyncing(true);
        try {
            const project = await db.projects.get(activeProjectId);
            if (project) {
                const newConfig = { ...(project.config || {}) };
                if (!newConfig.financials) newConfig.financials = {};
                if (!newConfig.financials.realCosts) newConfig.financials.realCosts = {};

                const missionKey = `mission_${formData.orderNumber?.replace('/', '_')}`;
                newConfig.financials.realCosts[missionKey] = {
                    label: `Mission ${formData.orderNumber} : ${formData.purpose}`,
                    qty: 1,
                    unit: totalFrais,
                    total: totalFrais,
                    date: new Date().toISOString()
                };

                await db.projects.update(activeProjectId, { config: newConfig });
                alert("Frais de mission synchronisés avec la comptabilité du projet !");
            }
        } catch (error) {
            logger.error(error);
        } finally {
            setIsSyncing(false);
        }
    };

    const addMember = () => {
        setMembers([...members, {
            name: '',
            role: '',
            unit: 'Technique',
            dailyIndemnity: 0,
            days: formData.planning?.length || 6
        }]);
    };

    const removeMember = (index: number) => {
        setMembers(members.filter((_, i) => i !== index));
    };

    const updateMember = (index: number, field: keyof MissionMember, value: any) => {
        const newMembers = [...members];
        newMembers[index] = { ...newMembers[index], [field]: value };
        setMembers(newMembers);
    };

    const syncDurationWithPlanning = () => {
        const daysCount = formData.planning?.length || 0;
        setMembers(members.map(m => ({ ...m, days: daysCount })));
    };

    const reorderPlanning = (steps: string[]) => {
        return steps.map((step, i) => {
            const cleanStep = step.replace(/^Jour\s*\d+\s*:\s*/i, '').trim();
            if (cleanStep.toLowerCase().startsWith('dimanche')) return `Jour ${i + 1} : ${cleanStep}`;
            return `Jour ${i + 1} : ${cleanStep}`;
        });
    };

    const updatePlanningStep = (index: number, value: string) => {
        const newPlanning = [...(formData.planning || [])];
        newPlanning[index] = value;
        setFormData({ ...formData, planning: newPlanning });
    };

    const addPlanningStep = () => {
        const newPlanning = [...(formData.planning || []), "Nouvelle étape..."];
        const reordered = reorderPlanning(newPlanning);
        setFormData({ ...formData, planning: reordered });
    };

    const removePlanningStep = (index: number) => {
        const remaining = (formData.planning || []).filter((_, i) => i !== index);
        const reordered = reorderPlanning(remaining);
        setFormData({ ...formData, planning: reordered });
    };

    const handleGenerateAIPlanning = () => {
        const startStr = formData.startDate || '05/03/2026';
        let d, m, y;
        try {
            const parts = startStr.split('/');
            d = Number(parts[0]);
            m = Number(parts[1]);
            y = Number(parts[2]);
        } catch (e) {
            [d, m, y] = [5, 3, 2026];
        }

        const startDate = new Date(y, m - 1, d);
        const itinerary = formData.itineraryAller || 'Dakar – Tambacounda';
        const mainCity = itinerary.split(' – ')[1] || 'Sénégal Oriental';

        const detailedTasks = [
            `Mise en route vers ${mainCity}\n• Départ matinal avec le véhicule PROQ.\n• Briefing logistique et installation base vie.\n• Réunion avec les autorités locales.`,
            `Prospection Terrain: Secteur Nord\n• Relevés GPS grappes et repérage lieux de stockage.\n• Échantillonnage 15 % des ménages.\n• Photos état initial des bâtis.`,
            `Prospection Terrain: Secteur Sud\n• Extension relevés GPS et accessibilité technique.\n• Audit social et sensibilisation chefs de village.`,
            `Négociations Entrepreneurs\n• Séance de travail sur les bordereaux de prix.\n• Signature des protocoles d'entente régionaux.`,
            `Reporting & Clôture\n• Consolidation des données SIG sur KoboToolbox.\n• Réunion de synthèse avant repli.`,
            `Repli vers Dakar\n• Inventaire final base vie et trajet retour.\n• Débriefing Direction.`
        ];

        const suggestion: string[] = [];
        let taskIdx = 0;
        let currentDate = new Date(startDate);

        while (taskIdx < detailedTasks.length) {
            const dateStr = currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            if (currentDate.getDay() === 0) {
                suggestion.push(`Jour ${suggestion.length + 1} : Dimanche (${dateStr})\n• Repos hebdomadaire obligatoire.`);
            } else {
                const parts = detailedTasks[taskIdx].split('\n');
                const title = parts[0];
                const desc = parts.slice(1);
                suggestion.push(`Jour ${suggestion.length + 1} : ${title} (${dateStr})\n${desc.join('\n')}`);
                taskIdx++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const lastDate = new Date(currentDate);
        lastDate.setDate(lastDate.getDate() - 1);
        const fEnd = `${lastDate.getDate().toString().padStart(2, '0')}/${(lastDate.getMonth() + 1).toString().padStart(2, '0')}/${lastDate.getFullYear()}`;

        setFormData(prev => ({ ...prev, planning: suggestion, endDate: fEnd }));
        setMembers(prev => prev.map(mm => ({ ...mm, days: suggestion.length })));
    };

    const handleExport = () => {
        const data = { ...(formData as MissionOrderData), members, isCertified };
        if (activeTab === 'prep') {
            generateMissionOrderPDF(data);
        } else {
            generateMissionReportPDF(data);
        }
    };

    const handleExportWord = () => {
        const data = { ...(formData as MissionOrderData), members, isCertified };
        if (activeTab === 'prep') {
            generateMissionOrderWord(data);
        } else {
            generateMissionReportWord(data);
        }
    };

    const handleToggleFeature = (feature: keyof NonNullable<typeof formData.features>) => {
        setFormData(prev => ({
            ...prev,
            features: {
                ...(prev.features || { map: true, expenses: false, inventory: false, ai: false }),
                [feature]: !((prev.features || {})[feature])
            }
        }));
    };

    const handleExpensesChange = (data: { expenses?: any[]; fuelStats?: any }) => {
        setFormData(prev => ({
            ...prev,
            ...data
        }));
    };

    const handleAIConclusion = (conclusion: string) => {
        setFormData(prev => ({
            ...prev,
            reportObservations: conclusion
        }));
    };

    return (
        <div className="p-6 md:p-8 space-y-10 min-h-full relative overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
            {/* Background glows */}
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

            {/* Mission Selector Bar - Glass chips */}
            <div className="flex items-center gap-3 overflow-x-auto pb-4 px-1 custom-scrollbar scroll-smooth relative z-20">
                <button
                    onClick={handleNewMission}
                    className="flex-shrink-0 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/30 transition-all active:scale-95"
                >
                    + PROTOCOL
                </button>
                <div className="h-8 w-px bg-slate-200 dark:bg-white/10 flex-shrink-0 mx-2" />
                {savedMissions.map(m => (
                    <button
                        key={m.id}
                        onClick={() => loadMission(m)}
                        className={`flex-shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${currentMissionId === m.id
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/10 scale-105'
                            : 'bg-white/60 dark:bg-slate-900/40 text-slate-500 border-slate-200 dark:border-white/10 hover:border-slate-300 hover:text-slate-700'
                            }`}
                    >
                        {m.orderNumber} • {m.region}
                    </button>
                ))}
            </div>

            {/* Main Header & Strategy Tabs */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-[0_20px_40px_rgba(79,70,229,0.3)] rotate-[-4deg] group hover:rotate-0 transition-transform duration-500 relative">
                        <div className="absolute inset-0 bg-white/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <ClipboardList className="text-white relative z-10" size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter italic text-slate-800 dark:text-white leading-none">
                            {activeTab === 'prep' ? 'Plan de Lancement' : 'Rapport d\'Exécution Terrain'}
                        </h1>
                        <div className="flex items-center gap-3 mt-3">
                            <div className="flex -space-x-2">
                                {members.slice(0, 3).map((m, i) => (
                                    <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-50 dark:border-slate-900 bg-indigo-500 flex items-center justify-center text-[8px] font-black text-white shadow-sm ring-2 ring-white/50 dark:ring-slate-800/50">
                                        {m.name.charAt(0)}
                                    </div>
                                ))}
                            </div>
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest opacity-60 ml-2">
                                {members.length} Opératifs Actifs • {formData.region || 'Secteur Non Assigné'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-md p-1.5 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-inner">
                    {[
                        { id: 'prep', label: 'STRATÉGIE', icon: FileText },
                        { id: 'report', label: 'EXÉCUTION', icon: CheckCircle2 }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-3 px-8 py-3.5 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all duration-500 relative overflow-hidden group ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-xl shadow-indigo-500/10 scale-105 ring-1 ring-indigo-500/20'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                }`}
                        >
                            <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} className={activeTab === tab.id ? 'animate-pulse' : ''} />
                            <span className="relative z-10">{tab.label}</span>
                            {activeTab === tab.id && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/5 to-transparent translate-x-[-100%] animate-shimmer" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions & Export */}
            <div className="flex items-center justify-between gap-4 relative z-10">
                <div>
                    {activeTab === 'report' && (
                        <button
                            onClick={handleSyncFinance}
                            disabled={isSyncing}
                            className={`flex items-center gap-2 px-5 py-3 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500/20 transition-all shadow-sm shadow-emerald-500/10 ${isSyncing ? 'opacity-50' : ''}`}
                        >
                            <DollarSign size={14} className={isSyncing ? 'animate-ping' : ''} />
                            {isSyncing ? 'Synchronisation...' : 'SYNCHRONISER AVEC LA COMPTABILITÉ'}
                        </button>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportWord}
                        className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-xl font-black shadow-sm hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-all text-[10px] uppercase tracking-widest"
                    >
                        <FileDown size={14} className="text-blue-600 dark:text-blue-400" />
                        Word (.docx)
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-7 py-3 bg-slate-900 dark:bg-black text-white rounded-xl font-black shadow-lg hover:shadow-xl hover:scale-105 transition-all text-[10px] uppercase tracking-widest ring-1 ring-white/10"
                    >
                        <FileDown size={14} />
                        Télécharger PDF
                    </button>
                </div>
            </div>

            {/* Feature Configuration & Modular Toggles */}
            <MissionSettings 
                features={formData.features || { map: true, expenses: false, inventory: false, ai: false }} 
                onToggle={handleToggleFeature} 
            />

            {/* Modular SIG Preview */}
            {formData.features?.map && (
                <div className="relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    <MissionMiniMap 
                        region={formData.region || ''}
                        households={[]} // Could be populated with actual households from Dexie if needed
                    />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                <div className="lg:col-span-8 space-y-8">
                    {activeTab === 'prep' ? (
                        <section className="glass-card !p-8 !rounded-[2.5rem] space-y-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-indigo-500/10 rounded-xl">
                                    <ClipboardList size={20} className="text-indigo-500" />
                                </div>
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white">Spécifications de Base</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="group space-y-2">
                                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest pl-2">Identifiant du Protocole</label>
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl transition-all focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 shadow-sm shadow-slate-200/50 dark:shadow-none">
                                            <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-500/70" />
                                            <input
                                                type="text"
                                                value={formData.orderNumber}
                                                onChange={e => setFormData({ ...formData, orderNumber: e.target.value })}
                                                className="bg-transparent border-none outline-none font-black text-slate-900 dark:text-white w-full focus:ring-0 p-0 placeholder-slate-400"
                                                placeholder="Ex: 20/2026"
                                            />
                                        </div>
                                    </div>
                                    <div className="group space-y-2">
                                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest pl-2">Objectif Stratégique</label>
                                        <textarea
                                            value={formData.purpose}
                                            onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                            className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm font-medium text-slate-800 dark:text-slate-300 transition-all resize-none shadow-sm shadow-slate-200/50 dark:shadow-none placeholder-slate-400"
                                            rows={3}
                                            placeholder="Définir l'objectif principal de ce déploiement..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest pl-2">Date de Lancement</label>
                                            <div className="flex items-center gap-2 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl focus-within:border-indigo-500/50 transition-all shadow-sm shadow-slate-200/50 dark:shadow-none">
                                                <input
                                                    type="text"
                                                    value={formData.startDate}
                                                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                                    className="w-full bg-transparent border-none p-0 outline-none text-xs font-bold text-slate-900 dark:text-slate-300 placeholder-slate-400"
                                                    placeholder="JJ/MM/AAAA"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest pl-2">Date de Fin</label>
                                            <div className="flex items-center gap-2 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl focus-within:border-indigo-500/50 transition-all shadow-sm shadow-slate-200/50 dark:shadow-none">
                                                <input
                                                    type="text"
                                                    value={formData.endDate}
                                                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                                    className="w-full bg-transparent border-none p-0 outline-none text-xs font-bold text-slate-900 dark:text-slate-300 placeholder-slate-400"
                                                    placeholder="JJ/MM/AAAA"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest pl-2">Vecteur d'Itinéraire (Aller)</label>
                                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl focus-within:border-indigo-500/50 transition-all shadow-sm shadow-slate-200/50 dark:shadow-none">
                                            <MapPin size={16} className="text-emerald-600 dark:text-emerald-500/70" />
                                            <input
                                                type="text"
                                                value={formData.itineraryAller}
                                                onChange={e => setFormData({ ...formData, itineraryAller: e.target.value })}
                                                className="w-full bg-transparent border-none p-0 outline-none text-sm font-bold text-slate-900 dark:text-slate-300 placeholder-slate-400"
                                                placeholder="Dakar - Tamba"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <div className="space-y-6">
                            {/* Report Header Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <section className="glass-card !p-6 !rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4 relative group">
                                    <div className={`absolute inset-0 rounded-[2rem] opacity-20 transition-opacity duration-500 blur-xl ${isCertified ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                    <div className={`p-5 rounded-2xl relative z-10 transition-all duration-500 shadow-xl border ${isCertified ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/40 scale-110' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'}`}>
                                        <ShieldCheck size={32} />
                                    </div>
                                    <div className="relative z-10 w-full">
                                        <h2 className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest mb-3">Statut du Protocole</h2>
                                        <button
                                            onClick={() => setIsCertified(!isCertified)}
                                            className={`w-full max-w-[140px] mx-auto block px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-95 border ${isCertified ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' : 'bg-slate-800 dark:bg-slate-700 border-slate-900 dark:border-slate-600 text-white hover:bg-slate-700'}`}
                                        >
                                            {isCertified ? 'CERTIFIÉ ✓' : 'AUTORISER'}
                                        </button>
                                    </div>
                                </section>

                                <section className="glass-card !p-6 !rounded-[2rem] flex flex-col items-center justify-center text-center space-y-3">
                                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 border border-indigo-200 dark:border-indigo-500/20 shadow-inner">
                                        <ListChecks size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest mb-1 mt-2">Objectifs Atteints</h2>
                                        <div className="flex items-baseline justify-center gap-1">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                                                {formData.reportDays?.filter(d => d.isCompleted).length || 0}
                                            </span>
                                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">/ {formData.reportDays?.length || 0}</span>
                                        </div>
                                    </div>
                                </section>

                                <section className="glass-card !p-6 !rounded-[2rem] flex flex-col items-center justify-center text-center space-y-3">
                                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20 shadow-inner">
                                        <History size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest mb-1 mt-2">Delta Temporel</h2>
                                        <div className="flex items-baseline justify-center gap-1">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{formData.planning?.length || 0}</span>
                                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Jours</span>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Execution Details per Day */}
                            <section className="glass-card !p-8 !rounded-[2.5rem] space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-6">
                                    <h2 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm flex items-center gap-3">
                                        <div className="p-1.5 bg-indigo-500/10 rounded-lg"><FileSearch size={16} className="text-indigo-500" /></div> Journal d'Exécution
                                    </h2>
                                    <div className="flex bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-white/5">
                                        <button onClick={() => setReportView('status')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${reportView === 'status' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>LISTE</button>
                                        <button onClick={() => setReportView('timeline')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${reportView === 'timeline' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>CHRONOLOGIE</button>
                                    </div>
                                </div>

                                {reportView === 'status' ? (
                                    <div className="space-y-4">
                                        {formData.reportDays?.map((rd, i) => (
                                            <div key={i} className={`p-5 rounded-2xl border transition-all duration-300 ${rd.isCompleted ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5'}`}>
                                                <div className="flex items-start gap-5">
                                                    <button
                                                        onClick={() => updateReportDay(i, 'isCompleted', !rd.isCompleted)}
                                                        className={`mt-1 w-6 h-6 rounded-full border-[3px] flex items-center justify-center transition-all ${rd.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent'}`}
                                                        title={rd.isCompleted ? "Mark as Incomplete" : "Mark as Completed"}
                                                    >
                                                        {rd.isCompleted && <CheckCircle2 size={14} strokeWidth={3} />}
                                                    </button>
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-none">{rd.title}</h3>
                                                                {rd.location && (
                                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                                                                        <MapPin size={10} className="animate-bounce" />
                                                                        <span className="text-[8px] font-black uppercase tracking-widest">GPS Verrouillé</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-500/60 uppercase tracking-widest">Jour {rd.day}</span>
                                                        </div>
                                                        <div className="flex gap-4 items-start">
                                                            <textarea
                                                                value={rd.observation}
                                                                onChange={e => updateReportDay(i, 'observation', e.target.value)}
                                                                className="flex-1 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none text-slate-800 dark:text-slate-300 shadow-inner"
                                                                placeholder="Enregistrer les observations de terrain, anomalies, actions entreprises..."
                                                                rows={2}
                                                            />
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={() => handlePhotoCapture(i)}
                                                                    className={`p-3 rounded-xl border transition-all shadow-sm ${rd.photo ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500' : 'bg-white/60 dark:bg-slate-800 border-slate-200/50 dark:border-white/10 text-slate-500 hover:text-indigo-500'}`}
                                                                    title="Capture terrain photo"
                                                                >
                                                                    <Camera size={18} />
                                                                </button>
                                                                {rd.photo && (
                                                                    <div className="w-14 h-14 rounded-xl border-2 border-slate-200/50 dark:border-white/10 overflow-hidden bg-slate-900 flex items-center justify-center group relative shadow-md">
                                                                        <img src={rd.photo} alt="Terrain" className="w-full h-full object-cover opacity-90 group-hover:opacity-50 transition-opacity" />
                                                                        <button
                                                                            onClick={() => updateReportDay(i, 'photo' as any, undefined)}
                                                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-rose-500 hover:scale-110"
                                                                            title="Delete photo"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="relative py-6 px-4">
                                        <div className="absolute left-8 top-10 bottom-10 w-[3px] bg-slate-200 dark:bg-white/5 rounded-full" />
                                        <div className="space-y-10">
                                            {formData.reportDays?.map((rd, i) => (
                                                <div key={i} className="relative pl-14">
                                                    <div className={`absolute left-0 top-0 w-12 h-12 rounded-2xl flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-xl z-10 transition-colors ${rd.isCompleted ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                                        <Clock size={18} />
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-500 uppercase tracking-widest">Jour {rd.day}</span>
                                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{rd.title}</h4>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                {rd.photo && (
                                                                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-500">
                                                                        <ImageIcon size={14} />
                                                                    </div>
                                                                )}
                                                                {rd.location && (
                                                                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500">
                                                                        <MapPin size={14} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-slate-700 dark:text-slate-400 mt-3 italic font-medium">{rd.observation || "Aucune donnée de débriefing saisie pour ce cycle."}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-8 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row gap-8">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase mb-3 block tracking-widest pl-2">Résumé Exécutif</label>
                                        <textarea
                                            value={formData.reportObservations}
                                            onChange={e => setFormData({ ...formData, reportObservations: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl p-5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none text-slate-900 dark:text-slate-300 shadow-inner placeholder-slate-400"
                                            rows={5}
                                            placeholder="Débriefing final, recommandations stratégiques..."
                                        />
                                    </div>
                                    <div className="w-full md:w-72 space-y-3">
                                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase block tracking-widest pl-2">Autorisation du Commandant</label>
                                        <div
                                            onClick={() => setIsSignatureModalOpen(true)}
                                            className="h-32 bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-2xl flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/5 hover:border-indigo-400 transition-all overflow-hidden relative group"
                                        >
                                            {formData.signatureImage ? (
                                                <>
                                                    <img src={formData.signatureImage} alt="Signature" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-screen" />
                                                    <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm gap-2">
                                                        <PenTool size={20} className="text-white" />
                                                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Signer à nouveau</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 mb-2 group-hover:scale-110 transition-transform">
                                                        <PenTool size={24} />
                                                    </div>
                                                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-500/70 uppercase tracking-[0.2em] text-center">Signer Numériquement</span>
                                                </>
                                            )}
                                        </div>
                                        {formData.signatureImage && (
                                            <button
                                                onClick={() => setFormData({ ...formData, signatureImage: undefined })}
                                                className="w-full py-2.5 bg-rose-500/10 text-rose-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all border border-rose-500/20"
                                            >
                                                Effacer la Signature
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* Modular Add-ons - Expenses */}
                    {formData.features?.expenses && (
                        <MissionExpenses 
                            expenses={formData.expenses} 
                            fuelStats={formData.fuelStats}
                            onChange={handleExpensesChange}
                        />
                    )}

                    {/* Modular Add-ons - Inventory */}
                    {formData.features?.inventory && (
                        <MissionInventory 
                            inventory={formData.inventory}
                            onChange={(inv) => setFormData(prev => ({ ...prev, inventory: inv }))}
                        />
                    )}

                    {/* Modular Add-ons - AI */}
                    {formData.features?.ai && (
                        <MissionAI 
                            region={formData.region || ''}
                            reportDays={formData.reportDays}
                            onReportAutoGenerated={handleAIConclusion}
                        />
                    )}

                    <SignatureModal
                        isOpen={isSignatureModalOpen}
                        onClose={() => setIsSignatureModalOpen(false)}
                        onSave={(sig) => setFormData({ ...formData, signatureImage: sig })}
                    />

                    {/* ALWAYS VISIBLE PERSONNEL BUDGET */}
                    <section className="glass-card !p-8 !rounded-[2.5rem] mt-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm flex items-center gap-3">
                                <div className="p-1.5 bg-indigo-500/10 rounded-lg"><User size={16} className="text-indigo-500" /></div> Coût Unitaire & Allocation
                            </h2>
                            <button onClick={addMember} className="px-4 py-2 bg-indigo-500/10 text-indigo-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all">+ Assigner un membre</button>
                        </div>
                        <div className="space-y-4">
                            {members.map((m, i) => (
                                <div key={i} className="grid grid-cols-12 gap-3 items-center bg-white/40 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/50 dark:border-white/5 hover:border-indigo-500/30 transition-all group">
                                    <div className="col-span-12 md:col-span-4">
                                        <input
                                            type="text"
                                            value={m.name}
                                            onChange={e => updateMember(i, 'name', e.target.value)}
                                            className="w-full bg-transparent border-none text-xs font-bold text-slate-800 dark:text-white outline-none px-2 placeholder-slate-400"
                                            placeholder="Nom de l'opératif"
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-3">
                                        <input
                                            type="text"
                                            value={m.role}
                                            onChange={e => updateMember(i, 'role', e.target.value)}
                                            className="w-full bg-transparent border-none text-xs italic text-slate-600 dark:text-slate-400 outline-none px-2 placeholder-slate-400/50"
                                            placeholder="Spécialité/Rôle"
                                        />
                                    </div>
                                    <div className="col-span-5 md:col-span-2">
                                        <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800 p-2 rounded-xl ring-1 ring-slate-200/50 dark:ring-white/10">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Taux</span>
                                            <input
                                                type="number"
                                                value={m.dailyIndemnity}
                                                onChange={e => updateMember(i, 'dailyIndemnity', Number(e.target.value))}
                                                className="w-full bg-transparent border-none text-xs font-black text-emerald-700 dark:text-emerald-400 outline-none text-right px-1 focus:ring-0 placeholder-slate-400"
                                                title="Taux Journalier"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-5 md:col-span-2">
                                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl ring-1 ring-slate-200 dark:ring-white/10">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Jours</span>
                                            <input
                                                type="number"
                                                value={m.days}
                                                onChange={e => updateMember(i, 'days', Number(e.target.value))}
                                                className="w-full bg-transparent border-none text-xs font-black text-indigo-700 dark:text-indigo-400 outline-none text-center px-1 focus:ring-0 placeholder-slate-400"
                                                title="Durée"
                                                placeholder="1"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-end pr-2">
                                        <button onClick={() => removeMember(i)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors" title="Retirer le membre">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    {/* Finance Summary */}
                    <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full transition-transform duration-700 group-hover:scale-[2]" />
                        <div className="relative z-10 space-y-6">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <DollarSign size={14} className="text-emerald-500" /> Projection Budgétaire
                            </h2>
                            <div className="text-4xl font-black text-white italic tracking-tighter">
                                {totalFrais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} <span className="text-xl text-emerald-500 font-bold ml-1">XOF</span>
                            </div>
                            <div className="space-y-3 pt-6 border-t border-slate-800">
                                {members.slice(0, 4).map((m, i) => (
                                    <div key={i} className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400 font-bold truncate max-w-[120px]">{m.name || 'Non assigné'}</span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-white font-black font-mono">{(m.dailyIndemnity * m.days).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} <span className="text-[8px] text-slate-500">XOF</span></span>
                                        </div>
                                    </div>
                                ))}
                                {members.length > 4 && (
                                    <div className="text-[9px] font-black text-slate-600 text-center pt-2 uppercase tracking-widest">+ {members.length - 4} Autres...</div>
                                )}
                            </div>
                            <button onClick={syncDurationWithPlanning} className="w-full mt-6 py-3.5 bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/10 rounded-xl text-[10px] font-black text-amber-500 uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm">
                                <Sparkles size={14} /> Sync. Durée Matrice
                            </button>
                        </div>
                    </section>

                    {/* Planning Editor (Mini/Expanded) */}
                    <section className="glass-card !p-8 !rounded-[2.5rem] space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-500/10 rounded-lg"><CheckCircle2 size={16} className="text-indigo-500" /></div> Pipeline de Mission
                            </h2>
                            <button onClick={() => setShowPlanningEditor(!showPlanningEditor)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-indigo-500 transition-colors">
                                {showPlanningEditor ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>

                        {showPlanningEditor ? (
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <button onClick={handleGenerateAIPlanning} className="flex-1 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-md transition-all flex items-center justify-center gap-2">
                                        <Sparkles size={14} className="text-amber-500" /> Générer Chronologie IA
                                    </button>
                                    <button onClick={addPlanningStep} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-indigo-500 transition-all flex items-center gap-2">
                                        <span className="text-lg leading-none">+</span> Étape
                                    </button>
                                </div>
                                <div className="space-y-3 pt-2">
                                    {formData.planning?.map((p, i) => (
                                        <div key={i} className="relative group flex items-start gap-3">
                                            <div className="mt-2 text-[9px] font-black text-indigo-700 dark:text-indigo-500 bg-indigo-100 dark:bg-indigo-500/10 px-2 py-1 rounded-md">J{i + 1}</div>
                                            <textarea
                                                value={p}
                                                onChange={e => updatePlanningStep(i, e.target.value)}
                                                className="flex-1 p-3 text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl min-h-[80px] outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium text-slate-900 dark:text-slate-300 resize-none transition-all placeholder-slate-400"
                                                placeholder={`Paramètres du Jour ${i + 1}...`}
                                            />
                                            <button
                                                onClick={() => removePlanningStep(i)}
                                                className="absolute top-2 right-2 text-rose-500 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                                                title="Supprimer l'étape"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-3 bg-white/30 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-200/50 dark:border-white/5">
                                {formData.planning?.slice(0, 3).map((p, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-indigo-500 font-black">·</span>
                                        <span className="truncate font-medium">{p.split('\n')[0]}</span>
                                    </div>
                                ))}
                                {formData.planning && formData.planning.length > 3 && (
                                    <button onClick={() => setShowPlanningEditor(true)} className="text-indigo-500 font-bold text-[10px] flex items-center gap-1 mt-2 hover:translate-x-1 transition-transform uppercase tracking-widest pt-2 border-t border-slate-200/50 dark:border-white/5 w-full">
                                        + Dérouler tout le pipeline ({formData.planning?.length} étapes)
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div >
    );
}
