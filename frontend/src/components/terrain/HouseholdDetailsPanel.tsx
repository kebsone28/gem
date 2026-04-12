import React, { useState } from 'react';
import { X, MapPin, Navigation, Star, Phone, Navigation2, Plus, CloudOff, RefreshCcw, Zap, Hammer, AlertTriangle, Users, Database, MessageCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getHouseholdDerivedStatus, getStatusTailwindClasses } from '../../utils/statusUtils';
import type { Household } from '../../utils/types';
import { useTerrainUIStore } from '../../store/terrainUIStore';

interface HouseholdDetailsPanelProps {
    household: Household;
    onPhotoOpen: (photos: any[], index: number) => void;
    onStatusUpdate: (newStatus: string) => Promise<void>;
    onPhotoUpload: (file: File) => Promise<string>;
    isFavorite: (id: string) => boolean;
    toggleFavorite: (id: string) => void;
    onTraceItinerary: () => void;
    onCancelItinerary: () => void;
    routeStats?: { distance: number; duration: number } | null;
    grappeInfo?: { id: string; name: string; count: number } | null;
    userRole?: string;
    isAdmin?: boolean;
}

export const HouseholdDetailsPanel: React.FC<HouseholdDetailsPanelProps> = ({
    household,
    onPhotoOpen,
    onStatusUpdate,
    onPhotoUpload,
    isFavorite,
    toggleFavorite,
    onTraceItinerary,
    onCancelItinerary,
    grappeInfo,
    isAdmin = false
}) => {
    const closePanel = useTerrainUIStore(s => s.closePanel);
    const setSelectedHouseholdId = useTerrainUIStore(s => s.setSelectedHouseholdId);
    const routingEnabled = useTerrainUIStore(s => s.activePanel === 'routing');

    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedNewStatus, setSelectedNewStatus] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Kobo sometimes saves photos in different fields depending on the sync phase
    const extractPhotoUrl = () => {
        if (household.photo) return household.photo;
        if (household.koboData?.photoUrl) return household.koboData.photoUrl;
        if (household.koboData?.photo) return household.koboData.photo;
        if (household.koboData?.Photo) return household.koboData.Photo;
        
        // Direct Kobo API attachment structure
        const attachments = household.koboData?._attachments;
        if (Array.isArray(attachments) && attachments.length > 0) {
            return attachments[0].download_url || attachments[0].url;
        }
        return null;
    };
    const photoSrc = extractPhotoUrl();

    const statuses = [
        'Contrôle conforme',
        'Non conforme',
        'Intérieur terminé',
        'Réseau terminé',
        'Murs terminés',
        'Livraison effectuée',
        'Non encore commencé'
    ];

    const timelineStages = [
        'Non encore commencé',
        'Livraison effectuée',
        'Murs terminés',
        'Réseau terminé',
        'Intérieur terminé',
        'Contrôle conforme'
    ];

    const currentStatus = getHouseholdDerivedStatus(household);
    
    // Normalize status for timeline. If derived status says 'Conforme ✅', match it to 'Contrôle conforme'
    const normalizedStatus = currentStatus.toLowerCase().includes('conforme') && !currentStatus.toLowerCase().includes('non conforme') 
        ? 'Contrôle conforme' 
        : currentStatus.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();

    const currentStageIndex = timelineStages.findIndex(s => s.toLowerCase() === normalizedStatus.toLowerCase());
    const progressPercent = currentStageIndex >= 0 ? Math.round((currentStageIndex / (timelineStages.length - 1)) * 100) : 0;


    const handleConfirmStatusChange = async () => {
        if (!selectedNewStatus) return;
        
        setIsUpdating(true);
        try {
            await onStatusUpdate(selectedNewStatus);
            toast.success(`Status changé en "${selectedNewStatus}" ✓`);
            setShowStatusModal(false);
            setSelectedNewStatus(null);
        } catch (error) {
            toast.error("Erreur lors de la mise à jour du status");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 md:top-0 md:right-0 h-[92vh] md:h-screen w-full md:w-[460px] z-[2000] shadow-[-20px_0_100px_rgba(0,0,0,0.6)] border-t md:border-l rounded-t-[3rem] md:rounded-none overflow-y-auto custom-scrollbar bg-slate-950/80 backdrop-blur-3xl border-white/10 text-white flex flex-col"
        >
            {/* Drag Handle for Mobile */}
            <div className="md:hidden w-12 h-1.5 bg-white/10 rounded-full mx-auto my-4 shrink-0" />
            
            {/* Header Sticky */}
            <div className="sticky top-0 z-10 px-6 py-6 md:px-10 md:py-8 bg-slate-950/40 backdrop-blur-md border-b border-white/5 flex justify-between items-center shrink-0">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none text-white drop-shadow-sm">MÉNAGE {household.numeroordre || household.id.slice(-6)}</h2>
                        {(household.syncStatus === 'pending' || household.syncStatus === 'error') && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                                {household.syncStatus === 'pending' ? <RefreshCcw size={10} className="animate-spin text-amber-500" /> : <CloudOff size={10} />}
                                <span className="text-[9px] font-black uppercase tracking-[0.1em]">
                                    {household.syncStatus === 'pending' ? 'Sync...' : 'Offline'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => {
                        setSelectedHouseholdId(null);
                        closePanel();
                    }}
                    title="Fermer le panneau"
                    className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5 shadow-inner group"
                >
                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 px-6 md:px-10 py-6 space-y-8 pb-40">

                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    
                    {/* ALERTES BLOQUANTES */}
                    {household.alerts && household.alerts.length > 0 && (
                        <div className="p-6 rounded-[2rem] bg-rose-500/10 border-2 border-rose-500/20 shadow-inner flex flex-col gap-4 animate-pulse-slow">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2 text-rose-500 italic">
                                <AlertTriangle size={16} /> ALERTES TERRAIN ACTIVES
                            </h4>
                            <div className="space-y-3">
                                {household.alerts.map((alert: any, i: number) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 uppercase tracking-widest shadow-inner">
                                        <div className="w-2 h-2 mt-1 rounded-full bg-rose-500 shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                                        <span>{typeof alert === 'string' ? alert : alert.message || JSON.stringify(alert)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PROGRESS BAR TIMELINE */}
                    <div className="p-8 rounded-[2.5rem] bg-gradient-to-b from-white/10 to-white/5 border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5" />
                        <div className="flex justify-between items-center mb-6">
                             <h4 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-emerald-400 opacity-80 italic">
                                <Clock size={14} /> PROGRESSION DU CHANTIER
                             </h4>
                             <span className="text-xl font-black italic text-emerald-400 drop-shadow-md">{progressPercent}%</span>
                        </div>
                        
                        <div className="relative pt-4 pb-2">
                            <div className="absolute left-0 top-6 bottom-0 w-1 bg-white/10 rounded-full" />
                            <div 
                                className="absolute left-0 top-6 w-1 bg-gradient-to-b from-emerald-400 to-blue-500 rounded-full transition-all duration-1000" 
                                style={{ height: `${progressPercent}%` } as React.CSSProperties} 
                            />
                            
                            <div className="space-y-6">
                                {timelineStages.map((stage, idx) => {
                                    const isCompleted = currentStageIndex >= idx;
                                    const isCurrent = currentStageIndex === idx;
                                    return (
                                        <div key={stage} className={`relative pl-8 flex items-center transition-all duration-500 ${isCompleted ? 'opacity-100' : 'opacity-30'}`}>
                                            <div className={`absolute left-[-5px] w-3.5 h-3.5 rounded-full border-2 transition-all ${isCompleted ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-white/20'}`} />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-white text-xs italic shadow-emerald-500/50' : 'text-slate-400'}`}>
                                                {stage}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Gallery Section */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2 text-blue-400 opacity-60">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                GALERIE TERRAIN
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                {photoSrc ? (
                                    <button
                                        onClick={() => onPhotoOpen([{ url: photoSrc as string, label: 'Preuve' }], 0)}
                                        title="Voir l'image agrandie"
                                        className="aspect-[4/3] rounded-[1.5rem] overflow-hidden border border-white/10 bg-white/5 group relative shadow-2xl"
                                    >
                                        <img src={photoSrc as string} alt="Terrain" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white italic">Agrandir +</span>
                                        </div>
                                    </button>
                                ) : isAdmin ? (
                                    <label className="aspect-[4/3] rounded-[1.5rem] border-2 border-dashed border-white/10 bg-slate-900/40 hover:bg-white/5 transition-all flex flex-col items-center justify-center p-6 text-slate-500 hover:border-blue-500/30 group cursor-pointer shadow-inner">
                                        <Plus size={24} className="mb-2 group-hover:text-blue-400 group-hover:scale-110 transition-all opacity-40 group-hover:opacity-100" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-center">Preuve Photo</span>
                                        <input 
                                            id="household-photo-upload"
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*" 
                                            title="Uploader une photo de preuve terrain" 
                                            aria-label="Charger une photo de preuve"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                const tid = toast.loading('Upload...'); 
                                                try { await onPhotoUpload(file); toast.success('Upload OK ✓', { id: tid }); } 
                                                catch { toast.error('Erreur', { id: tid }); }
                                            }} 
                                        />
                                    </label>
                                ) : (
                                    <div className="aspect-[4/3] rounded-[1.5rem] border border-white/5 bg-slate-900/20 flex flex-col items-center justify-center p-6 text-slate-600 shadow-inner">
                                        <CloudOff size={24} className="mb-2 opacity-20" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-center opacity-50">Aucune photo</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Owner Identity Card */}
                        <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 shadow-2xl relative overflow-hidden group">
                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 blur-[80px] rounded-full group-hover:bg-blue-500/20 transition-colors duration-1000" />
                            <div className="flex items-center justify-between mb-8 relative z-10">
                                <div className="w-14 h-14 bg-blue-600/10 text-blue-400 rounded-2xl flex items-center justify-center border border-blue-600/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
                                    <MapPin size={26} />
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(household.id); }}
                                    title={isFavorite(household.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                                    className={`p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 shadow-lg ${isFavorite(household.id) ? 'bg-amber-400/20 border-amber-400/40 text-amber-500 shadow-amber-500/10' : 'bg-slate-900/50 border-white/5 text-slate-600'}`}
                                >
                                    <Star size={14} fill={isFavorite(household.id) ? "currentColor" : "none"} />
                                </button>
                            </div>
                            <div className="relative z-10">
                                <p className="text-[9px] font-black uppercase tracking-[0.4em] mb-3 text-blue-400/40 opacity-80 italic">TITULAIRE DU COMPTE</p>
                                <p className="text-white font-black text-3xl italic uppercase tracking-tighter leading-none mb-1">
                                    {household.name || household.owner || 'SANS NOM'}
                                </p>
                            </div>
                        </div>

                        {/* Practical Information List */}
                        <div className="space-y-4">
                            {/* Contact */}
                            <div className="p-5 rounded-[1.8rem] bg-white/5 border border-white/5 flex items-center justify-between group hover:bg-white/[0.08] transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/10 shadow-inner">
                                        <Phone size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5 opacity-60 italic">CONTACT DIRECT</p>
                                        <p className="text-base font-black text-white tracking-[0.1em]">
                                            {household.phone || household.ownerPhone || '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <a 
                                        href={`tel:${household.phone || household.ownerPhone}`}
                                        title="Appeler localement"
                                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/30 hover:brightness-110 transition-all italic active:scale-95"
                                    >
                                        Appel
                                    </a>
                                    {(household.phone || household.ownerPhone) && (
                                        <a 
                                            href={`https://wa.me/${(household.phone || household.ownerPhone || '').toString().replace(/\D/g,'')}`}
                                            target="_blank" rel="noopener noreferrer"
                                            title="Ouvrir WhatsApp"
                                            className="px-4 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-500/30 transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            <MessageCircle size={14} /> WhatsApp
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Localisation & Administratif */}
                            <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <Database size={100} />
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/10 shadow-inner">
                                        <MapPin size={20} />
                                    </div>
                                    <div className="flex-1">
                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 italic opacity-60">HIÉRARCHIE GÉOGRAPHIQUE</p>
                                         <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                                             <span className="text-white">{household.region || '?'}</span>
                                             <ArrowRight size={10} />
                                             <span className="text-white/80">{household.departement || '?'}</span>
                                             <ArrowRight size={10} />
                                             <span className="text-orange-400 drop-shadow-md">{household.village || '?'}</span>
                                         </div>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-white/5 flex gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/10 shadow-inner">
                                        <Navigation2 size={20} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-8 flex-1">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic opacity-60">LATITUDE</p>
                                            <p className="text-[10px] font-mono font-black text-blue-300">{household.latitude || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic opacity-60">LONGITUDE</p>
                                            <p className="text-[10px] font-mono font-black text-blue-300">{household.longitude || '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Technical Specs Glass Card */}
                        <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 shadow-xl space-y-8">
                            <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400/40 italic">CONSTRUCTION AUDIT LOG</h4>
                            
                            {/* Main Metrics */}
                            <div className="grid grid-cols-2 gap-6 pb-6 border-b border-white/5">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap size={14} className="text-amber-500 opacity-60" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Terre / Ohm</span>
                                    </div>
                                    <p className={`text-xl font-black italic ${(household.constructionData as any)?.earthResistance > 1500 ? 'text-rose-400' : 'text-blue-400'} drop-shadow-md`}>
                                        {(household.constructionData as any)?.earthResistance ?? '—'} <span className="text-[10px] uppercase font-bold text-slate-600 not-italic ml-1">Ω</span>
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Hammer size={14} className="text-blue-500 opacity-60" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Maçonnerie</span>
                                    </div>
                                    <p className="text-xs font-black uppercase text-white tracking-widest italic truncate leading-none">
                                        {(household.constructionData as any)?.wallType || 'SANS DONNÉE'}
                                    </p>
                                </div>
                            </div>

                            {/* Job Toggles / Statuses */}
                            <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                {[
                                    { label: 'Maçonnerie', ok: household.koboSync?.maconOk },
                                    { label: 'Réseau', ok: household.koboSync?.reseauOk },
                                    { label: 'Intérieur', ok: household.koboSync?.interieurOk },
                                    { label: 'Contrôle Final', ok: household.koboSync?.controleOk }
                                ].map((task, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 transition-colors">
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border shadow-inner ${
                                            task.ok === true ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 
                                            task.ok === false ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 
                                            'bg-slate-800 border-slate-700 text-slate-600'
                                        }`}>
                                            {task.ok === true ? <CheckCircle2 size={12} /> : task.ok === false ? <X size={12} /> : '-'}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${task.ok === undefined ? 'text-slate-600' : 'text-slate-300'}`}>
                                            {task.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Assigned Teams */}
                        <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 shadow-xl flex items-center justify-between group hover:bg-white/[0.08] transition-all relative overflow-hidden">
                            <div className="absolute top-0 right-0 bottom-0 w-32 bg-indigo-500/5 blur-2xl rounded-full" />
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shadow-inner border border-indigo-500/20 group-hover:scale-105 transition-transform duration-500">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-indigo-400/60 uppercase tracking-[0.3em] mb-1 italic">ÉQUIPES ASSIGNÉES</p>
                                    <p className="text-sm font-black text-white tracking-widest">
                                        {household.assignedTeams && household.assignedTeams.length > 0 ? (
                                            <span className="flex items-center gap-2">
                                                {household.assignedTeams.map(t => typeof t === 'string' ? t : (t as any).name || 'Team').join(', ')}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 opacity-60">NON ASSIGNÉ</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Final Status Section */}
                        <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/5 shadow-inner">
                            <h4 className="text-[9px] font-black uppercase tracking-[0.4em] mb-6 text-slate-500 opacity-60 italic">GLOBAL STATUS TRACKING</h4>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col">
                                    <p className={`text-xl font-black italic uppercase tracking-tighter ${getStatusTailwindClasses(currentStatus).text} animate-pulse-slow`}>
                                        {currentStatus}
                                    </p>
                                    {household.updatedAt && (
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-2">Dernière inspection: {new Date(household.updatedAt).toLocaleDateString()}</p>
                                    )}
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => setShowStatusModal(true)}
                                        title="Changer l'état global du ménage"
                                        className="px-6 py-4 bg-white/5 text-blue-400 border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-inner hover:bg-white/10 hover:text-white transition-all italic"
                                    >
                                        Modifier Status
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Grappe */}
                        {grappeInfo && (
                            <div className="p-8 rounded-[2rem] border border-blue-500/20 bg-blue-500/5 shadow-lg shadow-blue-500/5">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-3 text-blue-400/50 italic">DOMAIN / UNIT</h4>
                                <p className="text-blue-300 font-black text-base uppercase italic tracking-tight leading-tight">{grappeInfo.name}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest mt-2 text-blue-400/60">{grappeInfo.count} SIBLINGS IN AREA</p>
                            </div>
                        )}

                        {/* Kobo Metadata */}
                        <div className="p-8 rounded-[2rem] border-dashed border-2 border-slate-800 bg-slate-900/30 space-y-6">
                             <h4 className="text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-slate-500">
                                <Database size={14} /> DONNÉES TECHNIQUES & SYNC
                             </h4>
                             <div className="grid grid-cols-2 gap-6 text-[10px] font-mono text-slate-400">
                                 <div>
                                     <p className="text-slate-600 mb-1 tracking-widest font-sans font-bold">SOURCE</p>
                                     <p className="font-bold text-slate-300 uppercase bg-slate-800/50 inline-block px-2 py-0.5 rounded">{household.source || 'INCONNUE'}</p>
                                 </div>
                                 <div>
                                     <p className="text-slate-600 mb-1 tracking-widest font-sans font-bold">KOBO SUBMISSION ID</p>
                                     <p className="font-bold text-slate-300 truncate" title={household.koboSubmissionId?.toString()}>
                                         {household.koboSubmissionId?.toString() || '—'}
                                     </p>
                                 </div>
                                 <div className="col-span-2 pt-2 border-t border-slate-800/50">
                                     <p className="text-slate-600 mb-1 tracking-widest font-sans font-bold">DERNIÈRE SYNCHRONISATION (UTC)</p>
                                     <p className="font-bold text-blue-400/80 text-xs">
                                         {household.updatedAt ? new Date(household.updatedAt).toLocaleString('fr-FR', { timeZoneName: 'short' }) : '—'}
                                     </p>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>

            {/* Navigation Actions Bottom Sticky */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:px-10 bg-slate-950/95 backdrop-blur-2xl border-t border-white/10 flex flex-col gap-4 shadow-[0_-30px_50px_rgba(0,0,0,0.8)]">
                    {!routingEnabled ? (
                        <button
                            onClick={onTraceItinerary}
                            title="Lancer le calcul d'itinéraire vers ce ménage"
                            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.8rem] font-black text-sm transition-all shadow-3xl shadow-blue-600/40 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-[0.2em] italic"
                        >
                            <Navigation size={22} className="rotate-45" />
                            CALCULER L'ITINÉRAIRE
                        </button>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={onCancelItinerary}
                                title="Arrêter le guidage en cours"
                                className="h-16 bg-white/5 border border-white/10 text-slate-400 rounded-[1.8rem] font-black text-[10px] transition-all hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 active:scale-95 uppercase tracking-widest"
                            >
                                ARRÊTER
                            </button>
                            <button
                                onClick={() => {
                                    const [lng, lat] = household.location!.coordinates;
                                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                                }}
                                title="Ouvrir dans l'application Google Maps"
                                className="h-16 bg-blue-600 text-white rounded-[1.8rem] font-black text-[10px] transition-all shadow-2xl shadow-blue-600/30 hover:brightness-110 active:scale-95 uppercase tracking-widest italic"
                            >
                                GOOGLE NAV
                            </button>
                        </div>
                    )}
                </div>

            {/* Status Modal - Premium Version */}
            {showStatusModal && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/60 backdrop-blur-3xl p-6">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="rounded-[3rem] p-10 max-w-sm w-full shadow-3xl bg-slate-900 border border-white/10 ring-1 ring-white/5"
                    >
                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 italic text-white leading-none">Status Audit</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-10 text-blue-500/50 italic leading-none">
                            Évolution du cycle de vie terrain
                        </p>

                        <div className="space-y-2 mb-10 max-h-[40vh] overflow-y-auto pr-3 custom-scrollbar">
                            {statuses.map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setSelectedNewStatus(status)}
                                    className={`w-full p-5 rounded-2xl border-2 transition-all text-left font-black text-[9px] uppercase tracking-[0.2em] ${
                                        selectedNewStatus === status
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/30 scale-[1.02] italic'
                                            : 'bg-white/5 border-white/10 hover:border-blue-500/40 text-slate-400'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => { setShowStatusModal(false); setSelectedNewStatus(null); }}
                                disabled={isUpdating}
                                className="flex-1 h-14 rounded-2xl font-black text-[9px] uppercase tracking-widest bg-white/5 text-slate-500 hover:bg-white/10 transition-all"
                            >
                                FERMER
                            </button>
                            <button
                                onClick={handleConfirmStatusChange}
                                disabled={!selectedNewStatus || isUpdating}
                                className="flex-1 h-14 rounded-2xl bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest italic shadow-xl shadow-blue-600/20 hover:brightness-110 active:scale-95 disabled:opacity-20"
                            >
                                {isUpdating ? 'PROCESS...' : 'Mettre à jour'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default HouseholdDetailsPanel;
