import React, { useState } from 'react';
import { X, MapPin, Navigation, Star, Eye, Phone, Navigation2, Plus, CloudOff, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getHouseholdDerivedStatus, getStatusTailwindClasses } from '../../utils/statusUtils';
import type { Household } from '../../utils/types';

interface HouseholdDetailsPanelProps {
    household: Household;
    isDarkMode: boolean;
    onClose: () => void;
    onPhotoOpen: (photos: any[], index: number) => void;
    onStatusUpdate: (newStatus: string) => Promise<void>;
    onPhotoUpload: (file: File) => Promise<string>;
    isFavorite: (id: string) => boolean;
    toggleFavorite: (id: string) => void;
    onTraceItinerary: () => void;
    onCancelItinerary: () => void;
    routingEnabled: boolean;
    followUser: boolean;
    setFollowUser: (follow: boolean) => void;
    routeStats?: { distance: number; duration: number } | null;
    grappeInfo?: { id: string; name: string; count: number } | null;
}

export const HouseholdDetailsPanel: React.FC<HouseholdDetailsPanelProps> = ({
    household,
    isDarkMode,
    onClose,
    onPhotoOpen,
    onStatusUpdate,
    onPhotoUpload,
    isFavorite,
    toggleFavorite,
    onTraceItinerary,
    onCancelItinerary,
    routingEnabled,
    followUser,
    setFollowUser,
    routeStats,
    grappeInfo
}) => {
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedNewStatus, setSelectedNewStatus] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const statuses = [
        'Contrôle conforme',
        'Non conforme',
        'Intérieur terminé',
        'Réseau terminé',
        'Murs terminés',
        'Livraison effectuée',
        'Non encore commencé'
    ];
    const currentStatus = getHouseholdDerivedStatus(household);

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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className={`fixed bottom-0 md:top-0 md:right-0 h-[85vh] md:h-full w-full md:w-[480px] z-[2000] shadow-[-20px_0_50px_rgba(0,0,0,0.2)] p-6 md:p-8 border-t md:border-l rounded-t-[2.5rem] md:rounded-none overflow-y-auto transition-colors ${isDarkMode ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
        >
            <div className="md:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-800 rounded-full mx-auto mb-6" />
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none">MÉNAGE {household.id.slice(-6)}</h2>
                        {(household.syncStatus === 'pending' || household.syncStatus === 'error') && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
                                {household.syncStatus === 'pending' ? <RefreshCcw size={10} className="animate-spin" /> : <CloudOff size={10} />}
                                <span className="text-[9px] font-black uppercase tracking-wider">
                                    {household.syncStatus === 'pending' ? 'En attente' : 'Non synchronisé'}
                                </span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(household.id);
                            toast.success("ID copié !");
                        }}
                        className="text-[9px] font-black text-primary uppercase tracking-widest mt-1 hover:underline text-left"
                    >
                        Copier l'identifiant complet
                    </button>
                </div>
                <button
                    onClick={onClose}
                    title="Fermer"
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-900'}`}
                >
                    <X size={20} />
                </button>
            </div>

            <div className="space-y-6">
                {/* Photos */}
                <div className="space-y-2">
                    <h4 className={`text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <Eye size={12} /> GALERIE DE PHOTOS
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {/* Photo d'installation ou Bouton d'upload */}
                        {household.koboData?.photoUrl ? (
                            <button
                                onClick={() => {
                                    const photos = [
                                        { url: household.koboData!.photoUrl!, label: 'Preuve Installation' }
                                    ];
                                    onPhotoOpen(photos, 0);
                                }}
                                className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity hover:ring-2 hover:ring-indigo-500 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
                            >
                                <img
                                    src={household.koboData.photoUrl}
                                    alt="Preuve"
                                    className="w-full h-full object-cover"
                                />
                            </button>
                        ) : (
                            <div className="relative aspect-square sm:aspect-video">
                                <label className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-2xl cursor-pointer hover:bg-primary/5 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Plus size={20} className="mb-2" />
                                        <p className="text-[9px] font-black uppercase text-center px-4">Preuve d'installation</p>
                                    </div>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*" 
                                        capture="environment"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const loadingToast = toast.loading('Upload de la photo...');
                                            try {
                                                await onPhotoUpload(file);
                                                toast.success('Photo enregistrée !', { id: loadingToast });
                                            } catch (err) {
                                                toast.error("Échec de l'upload", { id: loadingToast });
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        )}
                    </div>
                </div>

                {/* Propriétaire */}
                <div className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20 relative group">
                            <MapPin size={24} />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(household.id);
                                }}
                                className={`absolute -top-2 -right-2 p-1.5 rounded-full border shadow-sm transition-all hover:scale-110 active:scale-90 ${isFavorite(household.id) ? 'bg-amber-100 border-amber-200 text-amber-500' : 'bg-white border-slate-100 text-slate-300'}`}
                                title={isFavorite(household.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                            >
                                <Star size={12} fill={isFavorite(household.id) ? "currentColor" : "none"} />
                            </button>
                        </div>
                        {household.source && (
                            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                                Source: {household.source}
                            </span>
                        )}
                    </div>
                    <div>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>PROPRIÉTAIRE / CHEF DE MÉNAGE</p>
                        <p className="text-primary font-black text-lg uppercase tracking-tight">{household.name || household.owner || '—'}</p>
                    </div>
                </div>

                {/* Informations & Localisation Robustes */}
                <div className="space-y-4">
                    {/* Téléphone & Appel */}
                    <div className={`flex items-start gap-4 p-4 rounded-2xl transition-all ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                        <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
                            <Phone size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Téléphone DU CLIENT</p>
                            <div className="flex items-center justify-between gap-3">
                                <p className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {household.phone || household.ownerPhone || household.koboData?.telephone || household.koboSync?.tel || '—'}
                                </p>
                                {(household.phone || household.ownerPhone || household.koboData?.telephone || household.koboSync?.tel) && (
                                    <a 
                                        href={`tel:${household.phone || household.ownerPhone || household.koboData?.telephone || household.koboSync?.tel}`}
                                        className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                                    >
                                        <Phone size={14} /> Appeler
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Zone & Village */}
                    <div className={`flex items-start gap-4 p-4 rounded-2xl transition-all ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                        <div className="w-10 h-10 rounded-xl bg-orange-600/10 text-orange-600 flex items-center justify-center shrink-0">
                            <MapPin size={20} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 flex-1">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Région</p>
                                <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {household.region || household.koboData?.region || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Village / Localité</p>
                                <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {household.village || household.koboData?.village || household.koboSync?.village || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Département</p>
                                <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {household.departement || household.koboData?.departement || household.koboSync?.departement || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">ID Projet</p>
                                <p className={`text-xs font-bold font-mono truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{household.projectId}</p>
                            </div>
                        </div>
                    </div>

                    {/* GPS */}
                    <div className={`flex items-start gap-4 p-4 rounded-2xl transition-all ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
                            <Navigation2 size={20} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 flex-1">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Latitude</p>
                                <p className={`text-sm font-mono font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {household.latitude || household.location?.coordinates[1] || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Longitude</p>
                                <p className={`text-sm font-mono font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {household.longitude || household.location?.coordinates[0] || '—'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grappe */}
                {grappeInfo && (
                    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                        <h4 className={`text-[9px] font-black uppercase tracking-widest mb-2 text-indigo-600`}>APPARTENANCE GRAPPE</h4>
                        <p className="text-indigo-700 dark:text-indigo-300 font-bold text-sm uppercase">{grappeInfo.name}</p>
                        <p className={`text-[10px] font-bold mt-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{grappeInfo.count} ménages suivis</p>
                    </div>
                )}

                {/* Status */}
                <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <h4 className={`text-[9px] font-black uppercase tracking-widest mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>STATUS DES TRAVAUX</h4>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <p className={`text-sm font-black uppercase tracking-wider ${getStatusTailwindClasses(currentStatus).text}`}>
                                {currentStatus}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">Dernière mise à jour: {household.updatedAt ? new Date(household.updatedAt).toLocaleDateString('fr-FR') : 'Date inconnue'}</p>
                        </div>
                        <button
                            onClick={() => setShowStatusModal(true)}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase hover:brightness-110 shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                            Modifier
                        </button>
                    </div>
                </div>

                {/* Itinéraire */}
                {routeStats && (
                    <div className={`p-6 rounded-3xl border grid grid-cols-2 gap-6 ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div>
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">DISTANCE</p>
                            <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{(routeStats.distance / 1000).toFixed(1)} km</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">TEMPS ESTIMÉ</p>
                            <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{Math.ceil(routeStats.duration / 60)} min</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions Bottom */}
            <div className="pt-8 flex flex-col gap-4 pb-8">
                {!routingEnabled ? (
                    <button
                        onClick={onTraceItinerary}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-[1.5rem] font-black text-sm transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest"
                    >
                        <Navigation size={20} />
                        Tracer l'itinéraire
                    </button>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={onCancelItinerary}
                            className="bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-rose-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide"
                        >
                            <X size={18} />
                            Annuler
                        </button>
                        <button
                            onClick={() => {
                                const [lng, lat] = household.location!.coordinates;
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide"
                        >
                            <Navigation size={18} />
                            Google Maps
                        </button>
                    </div>
                )}

                {routingEnabled && (
                    <button
                        onClick={() => setFollowUser(!followUser)}
                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wide ${
                            followUser 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                : isDarkMode ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                    >
                        <MapPin size={20} className={followUser ? 'animate-pulse' : ''} />
                        {followUser ? 'Suivi GPS Actif' : 'Centrer sur moi'}
                    </button>
                )}
            </div>

            {/* Status Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'}`}
                    >
                        <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Mise à jour Status</h3>
                        <p className={`text-xs mb-8 font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            L'historique sera synchronisé automatiquement.
                        </p>

                        <div className="space-y-2 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                            {statuses.map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setSelectedNewStatus(status)}
                                    className={`w-full p-4 rounded-2xl border-2 transition-all text-left font-black text-xs uppercase tracking-widest ${
                                        selectedNewStatus === status
                                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                            : isDarkMode
                                            ? 'bg-slate-800 border-slate-700 hover:border-primary/50 text-slate-400'
                                            : 'bg-slate-50 border-slate-200 hover:border-primary/50 text-slate-600'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowStatusModal(false);
                                    setSelectedNewStatus(null);
                                }}
                                disabled={isUpdating}
                                className={`flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleConfirmStatusChange}
                                disabled={!selectedNewStatus || isUpdating}
                                className="flex-1 px-6 py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase transition-all hover:brightness-110 disabled:opacity-50 shadow-lg shadow-primary/20"
                            >
                                {isUpdating ? 'Patience...' : 'Valider'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default HouseholdDetailsPanel;
