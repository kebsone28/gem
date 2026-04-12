import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    Clock,
    DollarSign,
    Zap,
    Users,
    AlertTriangle,
    Activity,
    Check,
    Link as LinkIcon
} from 'lucide-react';
import { useFinances } from '../hooks/useFinances';
import { fmtFCFA } from '../utils/format';
import { toast } from 'react-hot-toast';
import {
    calculateScenario,
    optimizeTeamConfigs,
    buildRoleCapacities
} from '../hooks/useSimulationModel';
import type {
    TeamConfig,
    RoleKey,
    OptimizationMode
} from '../hooks/useSimulationModel';

// Import centralized design system
import {
    PageContainer,
    PageHeader,
    ContentArea,
    ActionBar
} from '../components';

const ROLE_LABELS = {
    macon: 'Maçons',
    network: 'Réseau',
    interior: 'Intérieur',
    controller: 'Contrôleurs'
};

export default function Simulation() {
    const { devis, householdsCount, project } = useFinances();
    const navigate = useNavigate();

    const roleCapacities = useMemo(
        () => buildRoleCapacities(project?.config?.productionRates),
        [project?.config?.productionRates]
    );

    // Simulation state
    const [unforeseenRate, setUnforeseenRate] = useState(10);
    const [baseVehicleCount, setBaseVehicleCount] = useState(2); // Base logistics vehicles
    const [isHivernage, setIsHivernage] = useState(false);
    const [hivernagePenaltyMacon, setHivernagePenaltyMacon] = useState(30); // 30% penalty
    const [hivernagePenaltyNetwork, setHivernagePenaltyNetwork] = useState(20); // 20% penalty
    const [rejectRate, setRejectRate] = useState(0); // 0 to 20%
    const [acompteRate, setAcompteRate] = useState(30); // 0 to 100%
    const [targetDuration, setTargetDuration] = useState(150);
    const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('duration');

    // Calendar state
    const [workDaysPerWeek, setWorkDaysPerWeek] = useState(6); // 5 or 6 days normally
    const [holidaysCount, setHolidaysCount] = useState(14); // Estimated Senegalese holidays

    const [teamConfigs, setTeamConfigs] = useState<Record<RoleKey, TeamConfig>>({
        macon: { count: 5, paymentMode: 'task', rate: 10000, vehiclesPerTeam: 0 },
        network: { count: 3, paymentMode: 'task', rate: 7500, vehiclesPerTeam: 0 },
        interior: { count: 4, paymentMode: 'task', rate: 30000, vehiclesPerTeam: 0 },
        controller: { count: 2, paymentMode: 'day', rate: 45000, vehiclesPerTeam: 1 } // 1 vehicle per controller
    });

    const [isOptimized, setIsOptimized] = useState(false);
    const [optimizedConfigs, setOptimizedConfigs] = useState<Record<RoleKey, TeamConfig> | null>(null);
    const [showApplyModal, setShowApplyModal] = useState(false);

    const handleApplyConfiguration = useCallback(() => {
        if (!optimizedConfigs) return;
        setTeamConfigs(optimizedConfigs);
        setShowApplyModal(false);
        setIsOptimized(false);
        toast.success('Configuration optimisée appliquée comme scénario courant', { icon: '✅' });
    }, [optimizedConfigs]);

    const currentScenario = useMemo(
        () => calculateScenario({
            householdsCount,
            devisTotalPlanned: devis.totalPlanned,
            projectConfig: project,
            teamConfigs,
            baseVehicleCount,
            unforeseenRate,
            isHivernage,
            rejectRate,
            acompteRate,
            workDaysPerWeek,
            holidaysCount,
            hivernagePenaltyMacon,
            hivernagePenaltyNetwork
        }),
        [
            householdsCount,
            devis.totalPlanned,
            project,
            teamConfigs,
            baseVehicleCount,
            unforeseenRate,
            isHivernage,
            rejectRate,
            acompteRate,
            workDaysPerWeek,
            holidaysCount,
            hivernagePenaltyMacon,
            hivernagePenaltyNetwork
        ]
    );

    const handleOptimize = useCallback(() => {
        const optimized = optimizeTeamConfigs({
            teamConfigs,
            ROLE_CAPACITY: roleCapacities,
            targetDuration,
            householdsCount,
            devisTotalPlanned: devis.totalPlanned,
            workDaysPerWeek,
            holidaysCount,
            projectConfig: project,
            baseVehicleCount,
            unforeseenRate,
            isHivernage,
            rejectRate,
            acompteRate,
            hivernagePenaltyMacon,
            hivernagePenaltyNetwork,
            mode: optimizationMode
        });
        setOptimizedConfigs(optimized);
        setIsOptimized(true);
    }, [teamConfigs, roleCapacities, targetDuration, householdsCount, workDaysPerWeek, holidaysCount, project, baseVehicleCount, unforeseenRate, isHivernage, rejectRate, acompteRate, hivernagePenaltyMacon, hivernagePenaltyNetwork, optimizationMode]);

    const optScenario = useMemo(
        () => optimizedConfigs
            ? calculateScenario({
                householdsCount,
                devisTotalPlanned: devis.totalPlanned,
                projectConfig: project,
                teamConfigs: optimizedConfigs,
                baseVehicleCount,
                unforeseenRate,
                isHivernage,
                rejectRate,
                acompteRate,
                workDaysPerWeek,
                holidaysCount,
                hivernagePenaltyMacon,
                hivernagePenaltyNetwork
            })
            : null,
        [
            optimizedConfigs,
            householdsCount,
            devis.totalPlanned,
            project,
            baseVehicleCount,
            unforeseenRate,
            isHivernage,
            rejectRate,
            acompteRate,
            workDaysPerWeek,
            holidaysCount,
            hivernagePenaltyMacon,
            hivernagePenaltyNetwork
        ]
    );

    const activeConfigs = isOptimized && optimizedConfigs ? optimizedConfigs : teamConfigs;
    const activeScenario = isOptimized && optScenario ? optScenario : currentScenario;

    const updateTeamConfig = useCallback(<K extends keyof TeamConfig>(role: RoleKey, field: K, value: TeamConfig[K]) => {
        setTeamConfigs(prev => ({
            ...prev,
            [role]: { ...prev[role], [field]: value }
        }));
    }, []);

    return (
        <PageContainer>
            <PageHeader
                title="Moteur d'Optimisation"
                subtitle="Réduisez les coûts de revient et maximisez la marge nette à l'aide de l'IA."
                icon={<Activity size={24} className="text-purple-600" />}
                actions={
                    <ActionBar>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/50 border border-purple-600 dark:border-purple-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                            <span className="text-xs font-black text-purple-900 dark:text-purple-100 uppercase tracking-widest leading-none">IA Active</span>
                        </div>
                        <button
                            onClick={handleOptimize}
                            className="w-full sm:w-auto flex justify-center items-center gap-3 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-slate-900 dark:text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 group"
                        >
                            <Zap className="group-hover:animate-pulse" size={20} />
                            LANCER L'IA D'OPTIMISATION
                        </button>
                        {isOptimized && optimizedConfigs && (
                            <button
                                onClick={() => setShowApplyModal(true)}
                                className="w-full sm:w-auto flex justify-center items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 group"
                            >
                                <Check size={20} />
                                APPLIQUER CETTE CONFIG
                            </button>
                        )}
                    </ActionBar>
                }
            />

            <ContentArea className="p-0">
                <div className="max-w-7xl mx-auto p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Controls Sidebar */}
                        <aside className="lg:col-span-4 space-y-6">
                            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
                                <h3 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] flex items-center justify-between">
                                    Paramètres Actuels
                                    {isOptimized && (
                                        <button onClick={() => setIsOptimized(false)} className="text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full text-xs hover:bg-amber-500/20 transition-all">
                                            RÉTABLIR
                                        </button>
                                    )}
                                </h3>

                                <div className="space-y-6 mt-6">
                                    {/* Teams Counter */}
                                    <div className="space-y-4">
                                        <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest block">Effectifs & Rémunérations</label>
                                        {(Object.entries(activeConfigs) as [keyof typeof teamConfigs, TeamConfig][]).map(([role, config]) => {
                                            const originalCount = teamConfigs[role].count;
                                            const diff = isOptimized ? config.count - originalCount : 0;

                                            return (
                                                <div key={role} className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${isOptimized ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800/50'}`}>

                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-800 dark:text-slate-200 font-bold">{ROLE_LABELS[role as keyof typeof ROLE_LABELS]}</span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-black tracking-widest uppercase">{roleCapacities[role as keyof typeof roleCapacities]}/j</span>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex items-center gap-3">
                                                                {!isOptimized && (
                                                                    <button aria-label="Retirer" onClick={() => updateTeamConfig(role, 'count', Math.max(1, config.count - 1))} className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-800 transition-colors">-</button>
                                                                )}
                                                                <span className={`text-xl font-black w-8 text-center ${isOptimized ? 'text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{config.count}</span>
                                                                {!isOptimized && (
                                                                    <button aria-label="Ajouter" onClick={() => updateTeamConfig(role, 'count', config.count + 1)} className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-800 transition-colors">+</button>
                                                                )}
                                                                {isOptimized && diff !== 0 && (
                                                                    <span className={`text-xs font-black ml-2 ${diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                        {diff > 0 ? `+${diff}` : diff}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-base font-bold text-white dark:text-white">{config.count} équipes</span>
                                                        </div>
                                                    </div>

                                                    {/* Advanced Params (only if not optimized globally to keep it clean, or always show but disabled) */}
                                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-200 dark:border-slate-200 dark:border-slate-800/50">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">Paiement</label>
                                                            <select
                                                                aria-label="Mode de paiement"
                                                                disabled={isOptimized}
                                                                value={config.paymentMode}
                                                                onChange={(e) => updateTeamConfig(role, 'paymentMode', e.target.value as 'task' | 'day')}
                                                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                                            >
                                                                <option value="task">À la Tâche</option>
                                                                <option value="day">Par Jour</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">Tarif ({config.paymentMode === 'task' ? '/Foyer' : '/Jour'})</label>
                                                            <input
                                                                title="Tarif"
                                                                disabled={isOptimized}
                                                                type="number"
                                                                value={config.rate}
                                                                onChange={(e) => updateTeamConfig(role, 'rate', parseInt(e.target.value) || 0)}
                                                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1 col-span-2">
                                                            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black flex items-center justify-between">
                                                                Véhicules alloués (par équipe)
                                                                <span className="text-blue-400">{config.vehiclesPerTeam}</span>
                                                            </label>
                                                            <input
                                                                title="Véhicules"
                                                                disabled={isOptimized}
                                                                type="range"
                                                                min="0" max="3"
                                                                value={config.vehiclesPerTeam}
                                                                onChange={(e) => updateTeamConfig(role, 'vehiclesPerTeam', parseInt(e.target.value) || 0)}
                                                                className="w-full accent-blue-500"
                                                            />
                                                        </div>
                                                    </div>

                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Advanced Contexts (Weather, Rejects, Cashflow) */}
                                    <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-200 dark:border-slate-800/50">
                                        <label className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                                            <AlertTriangle size={14} /> Contraintes & Risques
                                        </label>

                                        {/* Weather Toggle */}
                                        <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900 dark:text-white text-sm font-bold">Saison des Pluies (Hivernage)</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">Baisse des cadences Maçons/Réseau</span>
                                                </div>
                                                <button
                                                    aria-label="Activer/Désactiver l'hivernage"
                                                    onClick={() => setIsHivernage(!isHivernage)}
                                                    className={`w-12 h-6 rounded-full transition-colors relative ${isHivernage ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                                >
                                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 transition-transform ${isHivernage ? 'translate-x-6' : ''}`} />
                                                </button>
                                            </div>

                                            {/* Hivernage Modifiable Parameters */}
                                            <AnimatePresence>
                                                {isHivernage && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="origin-top overflow-hidden"
                                                    >
                                                        <div className="space-y-4 pt-3 mt-1 border-t border-slate-200 dark:border-slate-800/50">
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-slate-600 dark:text-slate-400">Pénalité Maçons</span>
                                                                    <span className="text-rose-400 font-bold">-{hivernagePenaltyMacon}%</span>
                                                                </div>
                                                                <input
                                                                    aria-label="Pénalité Maçons"
                                                                    type="range"
                                                                    min="0"
                                                                    max="80"
                                                                    step="5"
                                                                    value={hivernagePenaltyMacon}
                                                                    onChange={(e) => setHivernagePenaltyMacon(parseInt(e.target.value))}
                                                                    className="w-full accent-rose-500"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-slate-600 dark:text-slate-400">Pénalité Réseau</span>
                                                                    <span className="text-rose-400 font-bold">-{hivernagePenaltyNetwork}%</span>
                                                                </div>
                                                                <input
                                                                    title="Pénalité Réseau"
                                                                    type="range"
                                                                    min="0"
                                                                    max="80"
                                                                    step="5"
                                                                    value={hivernagePenaltyNetwork}
                                                                    onChange={(e) => setHivernagePenaltyNetwork(parseInt(e.target.value))}
                                                                    className="w-full accent-rose-500"
                                                                />
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Reject Rate */}
                                        <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                                            <div className="flex justify-between text-sm">
                                                <label htmlFor="reject-rate" className="text-slate-600 dark:text-slate-400">Taux de Rejet & Reprises</label>
                                                <span className="text-slate-900 dark:text-white font-bold">{rejectRate}%</span>
                                            </div>
                                            <input
                                                id="reject-rate"
                                                title="Taux de rejet"
                                                type="range"
                                                min="0"
                                                max="30"
                                                step="1"
                                                value={rejectRate}
                                                onChange={(e) => setRejectRate(parseInt(e.target.value))}
                                                className="w-full accent-rose-500"
                                            />
                                            <div className="text-xs text-slate-500 dark:text-slate-400 text-center">Affecte le volume de travail Réseau/Intérieur</div>
                                        </div>
                                    </div>

                                    {/* Cashflow Context */}
                                    <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800/50">
                                        <label className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                            <DollarSign size={14} /> Trésorerie Client
                                        </label>
                                        <div className="space-y-2 p-4 rounded-xl bg-white/50 dark:bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                                            <div className="flex justify-between text-sm">
                                                <label htmlFor="acompte-rate" className="text-slate-600 dark:text-slate-400">Acompte à la commande</label>
                                                <span className="text-slate-900 dark:text-white font-bold">{acompteRate}%</span>
                                            </div>
                                            <input
                                                id="acompte-rate"
                                                title="Taux d'acompte"
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="5"
                                                value={acompteRate}
                                                onChange={(e) => setAcompteRate(parseInt(e.target.value))}
                                                className="w-full accent-emerald-500"
                                            />
                                            <div className="text-xs text-slate-500 dark:text-slate-400 text-center">Fonds disponibles avant acompte suivant</div>
                                        </div>
                                    </div>

                                    {/* Logistics */}
                                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest block" title="Véhicules mutualisés (Base logistique)">Logistique (Base)</label>
                                            <span className="text-blue-400 font-black">{baseVehicleCount}</span>
                                        </div>
                                        {!isOptimized && (
                                            <input
                                                title="Logistique Base"
                                                type="range"
                                                min="0"
                                                max="10"
                                                value={baseVehicleCount}
                                                onChange={(e) => setBaseVehicleCount(parseInt(e.target.value))}
                                                className="w-full accent-blue-600"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest block">Objectif durée</label>
                                            <span className="text-slate-500 font-black">{targetDuration} jours</span>
                                        </div>
                                        <input
                                            title="Objectif durée"
                                            type="range"
                                            min="120"
                                            max="260"
                                            step="5"
                                            value={targetDuration}
                                            onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                        <div className="text-xs text-slate-500 dark:text-slate-400 text-center">Durée cible pour l'optimisation intelligente</div>

                                        <div className="pt-4">
                                            <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest block mb-2">Stratégie d'optimisation</label>
                                            <select
                                                title="Mode d'optimisation"
                                                value={optimizationMode}
                                                onChange={(e) => setOptimizationMode(e.target.value as OptimizationMode)}
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="duration">Durée cible</option>
                                                <option value="cost">Coût minimal</option>
                                                <option value="cashflow">Cashflow sécurisé</option>
                                            </select>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Choisissez la stratégie de calcul de l'IA.</div>
                                        </div>
                                    </div>

                                    {/* Unforeseen */}
                                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest block">Taux d'aléas estimé</label>
                                            <span className="text-amber-400 font-black">{unforeseenRate}%</span>
                                        </div>
                                        <input
                                            title="Aléas"
                                            type="range"
                                            min="0"
                                            max="30"
                                            value={unforeseenRate}
                                            onChange={(e) => setUnforeseenRate(parseInt(e.target.value))}
                                            className="w-full accent-amber-600"
                                        />
                                    </div>
                                    {/* Calendar Settings */}
                                    <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800/50">
                                        <label className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            <Clock size={14} /> Calendrier & Jours Fériés
                                        </label>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                                                <label htmlFor="work-days" className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-widest font-bold">Jours/Semaine</label>
                                                <select
                                                    id="work-days"
                                                    title="Jours travaillés par semaine"
                                                    value={workDaysPerWeek}
                                                    onChange={(e) => setWorkDaysPerWeek(parseInt(e.target.value))}
                                                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                                                >
                                                    <option value="5">5 Jours (Lun-Ven)</option>
                                                    <option value="6">6 Jours (Lun-Sam)</option>
                                                    <option value="7">7 Jours (Continu)</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                                                <label htmlFor="holidays" className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-widest font-bold">Jours Fériés</label>
                                                <input
                                                    id="holidays"
                                                    title="Jours fériés estimés"
                                                    type="number"
                                                    min="0"
                                                    max="30"
                                                    value={holidaysCount}
                                                    onChange={(e) => setHolidaysCount(parseInt(e.target.value) || 0)}
                                                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 text-center">Affecte la durée calendaire et le coût logistique</div>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Results Display */}
                        <main className="lg:col-span-8 space-y-8">
                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <AnimatePresence mode="popLayout">
                                    <motion.div
                                        key={activeScenario.duration}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`p-8 rounded-2xl border-t-4 shadow-xl ${isOptimized ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 border-x border-b border-x-emerald-500/20 border-b-emerald-500/20' : 'bg-white dark:bg-slate-900/50 border-blue-500 border-x border-b border-slate-200 dark:border-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOptimized ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 text-blue-500'}`}>
                                                <Clock size={24} />
                                            </div>
                                            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Durée Globale</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-end gap-3">
                                                <p className="text-4xl font-black text-slate-900 dark:text-white">{activeScenario.calendarDuration} <span className="text-lg text-slate-500 dark:text-slate-400 font-bold">Jours</span></p>
                                                {isOptimized && currentScenario.calendarDuration !== activeScenario.calendarDuration && (
                                                    <span className="text-emerald-400 font-black mb-1 p-1 bg-emerald-500/10 rounded">
                                                        {currentScenario.calendarDuration - activeScenario.calendarDuration}j gagnés
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
                                                Soit {activeScenario.duration} jours de travail effectif
                                            </p>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        key={activeScenario.cost}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.1 }}
                                        className={`p-8 rounded-2xl border-t-4 shadow-xl ${isOptimized ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 border-x border-b border-x-emerald-500/20 border-b-emerald-500/20' : 'bg-white dark:bg-slate-900/50 border-indigo-500 border-x border-b border-slate-200 dark:border-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOptimized ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                                <DollarSign size={24} />
                                            </div>
                                            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Coût de Revient</span>
                                        </div>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white">{fmtFCFA(activeScenario.cost)}</p>
                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-2">Vs Devis: {fmtFCFA(devis.totalPlanned)}</p>
                                    </motion.div>

                                    <motion.div
                                        key={activeScenario.margin}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className={`p-8 rounded-2xl border-t-4 shadow-xl ${activeScenario.margin >= 0 ? 'bg-white dark:bg-slate-900/50 border-emerald-500 border-x border-b border-slate-200 dark:border-slate-800' : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500 border-x border-b border-rose-500/20'}`}
                                    >
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeScenario.margin >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                <TrendingUp size={24} />
                                            </div>
                                            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Marge Simulée</span>
                                        </div>
                                        <p className={`text-2xl font-black ${activeScenario.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {fmtFCFA(activeScenario.margin)}
                                        </p>
                                        {isOptimized && activeScenario.margin > currentScenario.margin && (
                                            <p className="text-xs font-black text-emerald-500 mt-2 flex items-center gap-1">
                                                <TrendingUp size={12} />
                                                +{fmtFCFA(activeScenario.margin - currentScenario.margin)} optimisés !
                                            </p>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {isOptimized && optScenario && (
                                <div className="bg-slate-950/70 dark:bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                        <div>
                                            <h3 className="text-lg font-black text-white">Comparaison Scénarios</h3>
                                            <p className="text-xs text-slate-500 mt-1">Scénario actuel vs scénario optimisé ({optimizationMode}).</p>
                                        </div>
                                        <span className="rounded-full px-3 py-1 bg-indigo-500/10 text-indigo-200 text-xs font-black uppercase tracking-[0.25em]">{optimizationMode === 'duration' ? 'Durée' : optimizationMode === 'cost' ? 'Coût' : 'Cashflow'}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Durée calendaire</p>
                                            <p className="text-2xl font-black text-white">{activeScenario.calendarDuration}j</p>
                                            <p className="text-xs text-slate-400 mt-1">{currentScenario.calendarDuration - activeScenario.calendarDuration > 0 ? `-${currentScenario.calendarDuration - activeScenario.calendarDuration}j` : `+${activeScenario.calendarDuration - currentScenario.calendarDuration}j`} vs actuel</p>
                                        </div>
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Coût</p>
                                            <p className="text-2xl font-black text-white">{fmtFCFA(activeScenario.cost)}</p>
                                            <p className="text-xs text-slate-400 mt-1">{currentScenario.cost - activeScenario.cost >= 0 ? `-${fmtFCFA(currentScenario.cost - activeScenario.cost)}` : `+${fmtFCFA(activeScenario.cost - currentScenario.cost)}`} vs actuel</p>
                                        </div>
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Marge</p>
                                            <p className={`text-2xl font-black ${activeScenario.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtFCFA(activeScenario.margin)}</p>
                                            <p className="text-xs text-slate-400 mt-1">{fmtFCFA(activeScenario.margin - currentScenario.margin)} vs actuel</p>
                                        </div>
                                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Cashflow</p>
                                            <p className="text-2xl font-black text-white">{activeScenario.hasCashflowRisk ? 'Risque' : 'OK'}</p>
                                            <p className={`text-xs mt-1 ${currentScenario.hasCashflowRisk && !activeScenario.hasCashflowRisk ? 'text-emerald-300' : 'text-slate-400'}`}>{currentScenario.hasCashflowRisk && !activeScenario.hasCashflowRisk ? 'Risque réduit' : 'Pas de changement'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Cashflow Display */}
                            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white italic uppercase tracking-tighter">Profil de Trésorerie</h3>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Risque de rupture de liquidité avant la fin du projet.</p>
                                </div>

                                <div className="space-y-4 mt-6">
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <span className="text-slate-600 dark:text-slate-400">Acompte perçu ({acompteRate}%)</span>
                                        <span className="text-slate-900 dark:text-white font-mono font-bold">{fmtFCFA(activeScenario.initialCash)}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <span className="text-slate-600 dark:text-slate-400">Besoin FdR (Salaires + Logistique)</span>
                                        <span className="text-rose-400 font-mono font-bold">{fmtFCFA(activeScenario.maxOutflow)}</span>
                                    </div>

                                    {activeScenario.hasCashflowRisk ? (
                                        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-4">
                                            <AlertTriangle className="text-rose-500 shrink-0 mt-1" size={24} />
                                            <div>
                                                <h4 className="text-rose-400 font-black">Risque de Rupture de Trésorerie</h4>
                                                <p className="text-rose-400/80 text-xs mt-1">Le paiement des équipes et des locations de véhicules dépassera l'acompte perçu de {fmtFCFA(activeScenario.maxOutflow - activeScenario.initialCash)}. Prévoyez un fond de roulement.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-start gap-4">
                                            <DollarSign className="text-emerald-500 shrink-0 mt-1" size={24} />
                                            <div>
                                                <h4 className="text-emerald-400 font-black">Trésorerie Sécurisée</h4>
                                                <p className="text-emerald-400/80 text-xs mt-1">L'acompte est suffisant pour couvrir les opérations courantes (hors matériel).</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Analysis & Bottlenecks */}
                            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white italic uppercase tracking-tighter">Planning & Flux</h3>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">L'IA décale les équipes plus rapides pour éviter l'attente et le surcoût.</p>
                                </div>

                                <div className="space-y-6 mt-6">
                                    {Object.entries(activeConfigs).map(([role, config]) => {
                                        const sched = activeScenario.schedule[role] || { start: 0, duration: 0, end: 0 };
                                        const isBottleneck = role === activeScenario.bottleneck;

                                        // Visual percentage based on global duration
                                        const startPct = (sched.start / activeScenario.duration) * 100;
                                        const widthPct = (sched.duration / activeScenario.duration) * 100;

                                        return (
                                            <div key={role} className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-900 dark:text-white font-bold">{ROLE_LABELS[role as keyof typeof ROLE_LABELS]}</span>
                                                        {isBottleneck && (
                                                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs font-black uppercase rounded flex items-center gap-1">
                                                                <AlertTriangle size={10} /> Facteur Limitant
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-black text-slate-500 dark:text-slate-400">{config.count * roleCapacities[role as keyof typeof roleCapacities]} Foyers/j</span>
                                                        <span className="text-xs text-indigo-400 font-bold">Jour {sched.start} à {sched.end} ({sched.duration}j)</span>
                                                    </div>
                                                </div>
                                                <div className="h-6 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full overflow-hidden relative">
                                                    <motion.div
                                                        initial={{ width: 0, left: 0 }}
                                                        animate={{ width: `${widthPct}%`, left: `${startPct}%` }}
                                                        transition={{ duration: 1, type: "spring" }}
                                                        className={`absolute top-0 h-full rounded-full transition-all flex justify-center items-center ${isBottleneck ? 'bg-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.3)]'}`}
                                                    >
                                                        {sched.duration > 15 && <span className="text-xs font-black text-slate-900 dark:text-white/80">{sched.duration}j</span>}
                                                    </motion.div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {activeScenario.bottleneck && (
                                    <div className="p-6 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-500/20 rounded-2xl flex items-start gap-4 mt-6">
                                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                                            <Users size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-slate-900 dark:text-white font-bold mb-1">Impact sur la rentabilité</h4>
                                            <p className="text-sm text-indigo-200/70 font-medium">
                                                Les autres équipes produisent plus vite que l'équipe "{ROLE_LABELS[activeScenario.bottleneck as keyof typeof ROLE_LABELS]}". Elles connaîtront des temps d'attente qui vous coûtent en salaires et en location de véhicules sans avancement.
                                                {isOptimized ? " L'IA a lissé ces écarts au maximum !" : " Cliquez sur 'Lancer l'IA d'optimisation' pour équilibrer la chaîne de production."}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </main>
                    </div>
                </div>

                {/* Apply Configuration Modal */}
                <AnimatePresence>
                    {showApplyModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                            onClick={() => setShowApplyModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl max-w-md mx-4 border border-slate-200 dark:border-slate-800"
                            >
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-12 h-12 bg-indigo-500/20 border border-indigo-500/50 rounded-2xl flex items-center justify-center text-indigo-400 shrink-0">
                                        <Check size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white">Appliquer la configuration optimisée ?</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Les effectifs optimisés remplaceront votre configuration actuelle.</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 mb-6 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Durée</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{activeScenario.calendarDuration} jours</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Coût</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{fmtFCFA(activeScenario.cost)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Marge</span>
                                        <span className={`font-bold ${activeScenario.margin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtFCFA(activeScenario.margin)}</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowApplyModal(false)}
                                        className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleApplyConfiguration}
                                        className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                                    >
                                        Appliquer
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </ContentArea>
        </PageContainer>
    );
}