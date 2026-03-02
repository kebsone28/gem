import { useState } from 'react';
import {
    MapPin,
    ShieldAlert,
    Zap,
    Hammer,
    HardHat,
    ClipboardCheck,
    CheckCircle2,
    ChevronDown,
    Layers,
    Save
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';
import type { Team } from '../../utils/types';

const getTradeIcon = (type: string) => {
    switch (type) {
        case 'macons': return Hammer;
        case 'reseau': return Zap;
        case 'interieur_type1': return HardHat;
        case 'controle': return ClipboardCheck;
        default: return Layers; // Generic icon
    }
};

const getTradeLabel = (type: string) => {
    switch (type) {
        case 'macons': return 'Maçonnerie';
        case 'reseau': return 'Réseau';
        case 'interieur_type1': return 'Intérieur';
        case 'controle': return 'Contrôle';
        default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
};

export default function GrappesTab() {
    const { project, computeCompleteness, computeRiskIndex, updateAssignment, grappesConfig } = useLogistique();
    const teams = project?.config?.teams || [];
    const [selectedSubGrappe, setSelectedSubGrappe] = useState<any>(null);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [bulkAssignments, setBulkAssignments] = useState<Record<string, string[]>>({});

    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkSave = () => {
        selectedIds.forEach(id => {
            Object.entries(bulkAssignments).forEach(([key, val]) => {
                if (val && val.length > 0) {
                    if (val.includes('UNASSIGN')) {
                        updateAssignment(id, key, []);
                    } else {
                        updateAssignment(id, key, val);
                    }
                }
            });
        });
        setSelectedIds([]);
        setIsBulkMode(false);
        setBulkAssignments({});
    };

    const subGrappes = grappesConfig.sous_grappes;
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Summary Header */}
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h3 className="text-2xl font-bold text-white">Affectations par Zones</h3>
                    <p className="text-slate-500 font-medium mt-1">Gérez le déploiement des équipes sur les sous-grappes.</p>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => { setIsBulkMode(!isBulkMode); setSelectedIds([]); }}
                        className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all ${isBulkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                    >
                        <Layers size={16} />
                        <span>Sélection Multiple</span>
                    </button>
                    <div className="flex -space-x-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                É{i}
                            </div>
                        ))}
                        <div className="w-10 h-10 rounded-full border-2 border-slate-950 bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                            +12
                        </div>
                    </div>
                    <span className="text-sm font-bold text-slate-300">16 Équipes Actives</span>
                </div>
            </div>

            {/* Grappes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {subGrappes.map((sg: any) => {
                    const assignments = project?.config?.assignments?.[sg.id] || {};
                    const score = computeCompleteness(assignments);
                    const risk = computeRiskIndex(sg, assignments);

                    return (
                        <div
                            key={sg.id}
                            onClick={(e) => isBulkMode ? toggleSelection(sg.id, e) : setSelectedSubGrappe(sg)}
                            className={`bg-slate-900 border rounded-3xl p-6 transition-all cursor-pointer group relative overflow-hidden active:scale-95 ${selectedIds.includes(sg.id)
                                ? 'border-indigo-500 shadow-lg shadow-indigo-500/20 bg-indigo-500/5'
                                : 'border-slate-800 hover:border-blue-500/50'
                                }`}
                        >
                            {isBulkMode && (
                                <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIds.includes(sg.id) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-600'}`}>
                                    {selectedIds.includes(sg.id) && <CheckCircle2 size={14} />}
                                </div>
                            )}
                            {risk > 70 && (
                                <div className="absolute top-4 right-4 text-amber-500 animate-pulse">
                                    <ShieldAlert size={20} />
                                </div>
                            )}

                            <div className="flex items-center space-x-3 mb-6">
                                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
                                    <MapPin size={18} className="text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{sg.code}</h4>
                                    <p className="text-white font-bold truncate max-w-[150px]">{sg.nom.split(' – ').pop()}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span className="text-slate-400">Complétude</span>
                                    <span className={score === 100 ? 'text-emerald-400' : 'text-blue-400'}>{score}%</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-1000"
                                        style={{ width: `${score}%` }}
                                    />
                                </div>

                                <div className="grid grid-cols-4 gap-2 pt-2">
                                    {Array.from(new Set(teams.map((t: Team) => t.type))).map((key: any) => {
                                        const Icon = getTradeIcon(key);
                                        const assignedTeams = (assignments as any)[key] || [];
                                        const isAssigned = assignedTeams.length > 0;
                                        return (
                                            <div
                                                key={key}
                                                className={`h-8 rounded-lg flex items-center justify-center border transition-all ${isAssigned
                                                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                                                    : 'bg-slate-950 border-slate-800 text-slate-600'
                                                    }`}
                                                title={isAssigned ? `${assignedTeams.length} équipe(s) affectée(s)` : 'Aucune équipe affectée'}
                                            >
                                                <div className="flex items-center gap-1">
                                                    <Icon size={14} />
                                                    {isAssigned && <span className="text-[10px] font-bold">{assignedTeams.length}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bulk Actions Bar */}
            {isBulkMode && selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 p-6 rounded-[2rem] shadow-2xl z-[1500] animate-in slide-in-from-bottom-8 w-full max-w-5xl flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center font-black text-white text-lg">
                            {selectedIds.length}
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-lg">zones sélectionnées</h4>
                            <p className="text-slate-400 text-sm">Assignez des équipes en masse</p>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start">
                        {Array.from(new Set(teams.map((t: Team) => t.type))).map((key: any) => {
                            const tradeLabel = getTradeLabel(key);
                            const currentBulk = bulkAssignments[key] || [];

                            return (
                                <div key={key} className="flex flex-col gap-2">
                                    <div className="relative">
                                        <select
                                            className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded-xl px-4 py-3 appearance-none focus:ring-2 focus:ring-indigo-500 outline-none hover:bg-slate-800 transition-colors cursor-pointer text-xs font-bold"
                                            value=""
                                            title={`Affecter ${tradeLabel}`}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'UNASSIGN') {
                                                    setBulkAssignments({ ...bulkAssignments, [key]: ['UNASSIGN'] });
                                                } else if (val && !currentBulk.includes(val) && !currentBulk.includes('UNASSIGN')) {
                                                    setBulkAssignments({ ...bulkAssignments, [key]: [...currentBulk, val] });
                                                }
                                            }}
                                        >
                                            <option value="" disabled>+ {tradeLabel}</option>
                                            <option value="UNASSIGN">Désassigner tout</option>
                                            {teams?.filter((t: Team) => t.type === key).map((t: Team) => (
                                                <optgroup key={t.id} label={t.name}>
                                                    {(t.subTeams || []).map(st => (
                                                        <option key={st.id} value={st.id}>{st.name} {st.leader ? `(${st.leader})` : ''}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
                                    </div>

                                    {/* Selected chips for bulk */}
                                    {currentBulk.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {currentBulk.map(val => {
                                                if (val === 'UNASSIGN') {
                                                    return (
                                                        <div key={val} className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-300 font-bold px-2 py-1 rounded">
                                                            <span>Désassignation</span>
                                                            <button onClick={() => setBulkAssignments({ ...bulkAssignments, [key]: [] })} className="hover:text-white ml-1">✕</button>
                                                        </div>
                                                    );
                                                }
                                                const stName = teams?.flatMap(t => t.subTeams || []).find(st => st.id === val)?.name || val;
                                                return (
                                                    <div key={val} className="flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-1 rounded">
                                                        <span className="truncate max-w-[100px]">{stName}</span>
                                                        <button onClick={() => setBulkAssignments({ ...bulkAssignments, [key]: currentBulk.filter(v => v !== val) })} className="hover:text-white ml-1">✕</button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center space-x-4 ml-8">
                        <button
                            onClick={handleBulkSave}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2"
                        >
                            <Save size={18} />
                            <span>Appliquer</span>
                        </button>
                    </div>
                </div>
            )}

            {selectedSubGrappe && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-8">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-2xl shadow-2xl p-10 relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setSelectedSubGrappe(null)}
                            className="absolute top-8 right-8 text-slate-500 hover:text-white"
                        >✕</button>

                        <div className="flex items-center space-x-4 mb-8">
                            <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-600/20">
                                <MapPin size={28} className="text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white">{selectedSubGrappe.nom}</h3>
                                <p className="text-slate-500 font-medium">Affectation des équipes par métier</p>
                            </div>
                        </div>

                        <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-2">
                            {Array.from(new Set(teams.map((t: Team) => t.type))).map((key: any) => {
                                const tradeLabel = getTradeLabel(key);
                                const Icon = getTradeIcon(key);
                                const currentAssignments = project?.config?.assignments?.[selectedSubGrappe.id]?.[key] || [];

                                return (
                                    <div key={key} className="bg-slate-950 border border-slate-800 p-6 rounded-3xl group hover:border-blue-500/20 transition-all">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center space-x-3">
                                                <Icon size={20} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                                                <span className="text-slate-200 font-bold">{tradeLabel}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{currentAssignments.length} affectée(s)</span>
                                        </div>

                                        {/* Render existing assignments as chips */}
                                        {currentAssignments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {currentAssignments.map((assignedId: string) => {
                                                    const foundSubTeam = teams?.flatMap((t: Team) => t.subTeams || []).find(st => st.id === assignedId);
                                                    return (
                                                        <div key={assignedId} className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-bold">
                                                            <span>{foundSubTeam ? foundSubTeam.name : assignedId}</span>
                                                            <button
                                                                onClick={() => updateAssignment(selectedSubGrappe.id, key, currentAssignments.filter((id: string) => id !== assignedId))}
                                                                className="text-indigo-400 hover:text-white"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="relative">
                                            <select
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                                value=""
                                                title={`Affecter ${tradeLabel}`}
                                                onChange={(e) => {
                                                    if (e.target.value && !currentAssignments.includes(e.target.value)) {
                                                        updateAssignment(selectedSubGrappe.id, key, [...currentAssignments, e.target.value]);
                                                    }
                                                }}
                                            >
                                                <option value="" disabled>+ Ajouter une équipe...</option>
                                                {teams?.filter((t: Team) => t.type === key).map((t: Team) => (
                                                    <optgroup key={t.id} label={t.name}>
                                                        {(t.subTeams || []).map(st => (
                                                            <option key={st.id} value={st.id}>{st.name} {st.leader ? `(${st.leader})` : ''}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setSelectedSubGrappe(null)}
                            className="w-full mt-10 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center space-x-2"
                        >
                            <CheckCircle2 size={18} />
                            <span>Confirmer la Configuration</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
