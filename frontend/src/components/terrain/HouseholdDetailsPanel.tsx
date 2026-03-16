import React, { useState } from 'react';
import { X, MapPin, Navigation, Star, Eye } from 'lucide-react';
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
                    <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none">MÉNAGE {household.id.slice(-6)}</h2>
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
                        {household.photo ? (
                            <button
                                onClick={() => {
                                    const photos = [
                                        { url: household.photo!, label: 'Photo Ménage' },
                                        ...(household.compteurPhoto ? [{ url: household.compteurPhoto, label: 'Photo Compteur' }] : [])
                                    ];
                                    onPhotoOpen(photos, 0);
                                }}
                                className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity hover:ring-2 hover:ring-indigo-500 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
                            >
                                <img
                                    src={household.photo}
                                    alt={`Ménage ${household.id}`}
                                    className="w-full h-full object-cover"
                                />
                            </button>
                        ) : (
                            <div className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border flex items-center justify-center p-4 text-center ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                <div className="flex flex-col items-center gap-2">
                                    <MapPin size={16} />
                                    <span className="text-[9px] font-bold uppercase">Aucune photo</span>
                                </div>
                            </div>
                        )}
                        {household.compteurPhoto ? (
                            <button
                                onClick={() => {
                                    const photos = [
                                        ...(household.photo ? [{ url: household.photo, label: 'Photo Ménage' }] : []),
                                        { url: household.compteurPhoto!, label: 'Photo Compteur' }
                                    ];
                                    onPhotoOpen(photos, household.photo ? 1 : 0);
                                }}
                                className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity hover:ring-2 hover:ring-indigo-500 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
                            >
                                <img
                                    src={household.compteurPhoto}
                                    alt={`Compteur ${household.id}`}
                                    className="w-full h-full object-cover"
                                />
                            </button>
                        ) : (
                            <div className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border border-dashed flex items-center justify-center p-4 text-center ${isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                                <span className="text-[9px] font-bold uppercase">Compteur<br />En attente</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Propriétaire */}
                <div className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20 relative group mb-4">
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
                    <div>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>PROPRIÉTAIRE / CHEF</p>
                        <p className="text-primary font-black text-sm uppercase tracking-tight">{household.owner || '—'}</p>
                    </div>
                </div>

                {/* Téléphone */}
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/20">
                        <Navigation size={18} />
                    </div>
                    <div>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>TÉLÉPHONE</p>
                        <p className="text-emerald-500 font-black text-sm uppercase tracking-tight">
                            {household.phone || household.ownerPhone || household.koboData?.tel || '—'}
                        </p>
                    </div>
                </div>

                {/* Localisation */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <h4 className={`text-[9px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>LOCALISATION</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>RÉGION</p>
                            <p className="text-[10px] font-bold">{household.region || '—'}</p>
                        </div>
                        <div>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>VILLAGE</p>
                            <p className="text-[10px] font-bold">{household.village || household.koboData?.village || '—'}</p>
                        </div>
                        <div>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>DÉPARTEMENT</p>
                            <p className="text-[10px] font-bold">{household.departement || household.koboData?.departement || '—'}</p>
                        </div>
                        <div>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>ID MÉNAGE</p>
                            <p className="text-[10px] font-bold text-primary">{household.id.slice(-6)}</p>
                        </div>
                    </div>
                </div>

                {/* Grappe */}
                {grappeInfo && (
                    <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                        <h4 className={`text-[9px] font-black uppercase tracking-widest mb-2 text-indigo-600`}>APPARTENANCE GRAPPE</h4>
                        <p className="text-indigo-700 dark:text-indigo-300 font-bold text-sm">{grappeInfo.name}</p>
                        <p className={`text-[8px] font-bold mt-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{grappeInfo.count} ménages</p>
                    </div>
                )}

                {/* Status */}
                <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <h4 className={`text-[9px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>STATUS ACTUEL</h4>
                    <div className="flex items-center justify-between">
                        <p className={`text-sm font-black uppercase tracking-wider ${getStatusTailwindClasses(currentStatus).text}`}>
                            {currentStatus}
                        </p>
                        <button
                            onClick={() => setShowStatusModal(true)}
                            className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-[10px] font-bold uppercase hover:bg-primary/30 transition-all"
                        >
                            Modifier
                        </button>
                    </div>
                </div>

                {/* Statistiques itinéraire */}
                {routeStats && (
                    <div className={`p-5 rounded-2xl border grid grid-cols-2 gap-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                        <div>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>DISTANCE EST.</p>
                            <p className="text-[11px] font-bold text-emerald-500">{(routeStats.distance / 1000).toFixed(1)} km</p>
                        </div>
                        <div>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>TEMPS EST.</p>
                            <p className="text-[11px] font-bold text-indigo-500">{Math.ceil(routeStats.duration / 60)} min</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="pt-6 flex flex-col gap-3">
                {!routingEnabled ? (
                    <button
                        onClick={onTraceItinerary}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-tighter"
                    >
                        <Navigation size={16} />
                        Tracer l'itinéraire
                    </button>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={onCancelItinerary}
                            className="bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black text-[10px] transition-all shadow-lg shadow-rose-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-tighter"
                        >
                            <X size={14} />
                            Annuler
                        </button>
                        <button
                            onClick={() => {
                                const [lng, lat] = household.location!.coordinates;
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-[10px] transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-tighter"
                        >
                            <Navigation size={14} />
                            Guidage GPS
                        </button>
                    </div>
                )}

                {routingEnabled && (
                    <button
                        onClick={() => setFollowUser(!followUser)}
                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-tighter ${
                            followUser 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                : isDarkMode ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                    >
                        <MapPin size={16} className={followUser ? 'animate-pulse' : ''} />
                        {followUser ? 'Suivi actif' : 'Suivre ma position'}
                    </button>
                )}
            </div>

            {/* Modal de changement de status */}
            {showStatusModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`rounded-3xl p-8 max-w-sm w-full ${isDarkMode ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'}`}
                    >
                        <h3 className="text-lg font-black uppercase tracking-tight mb-2">Changer le Status</h3>
                        <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Sélectionnez le nouveau statut pour ce ménage. Les modifications seront horodatées.
                        </p>

                        <div className="space-y-2 mb-6">
                            {statuses.map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setSelectedNewStatus(status)}
                                    className={`w-full p-4 rounded-xl border-2 transition-all text-left font-bold text-sm uppercase tracking-wider ${
                                        selectedNewStatus === status
                                            ? 'bg-primary border-primary text-white'
                                            : isDarkMode
                                            ? 'bg-slate-800 border-slate-700 hover:border-primary'
                                            : 'bg-slate-50 border-slate-200 hover:border-primary'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        {selectedNewStatus && (
                            <div className={`p-4 rounded-xl mb-6 text-sm ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-[11px] font-black uppercase mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>CONFIRMATION</p>
                                <p className="font-bold">Passer le status à: <span className="text-primary">{selectedNewStatus}</span></p>
                                <p className={`text-sm mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Horodatage: {new Date().toLocaleString('fr-FR')}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowStatusModal(false);
                                    setSelectedNewStatus(null);
                                }}
                                disabled={isUpdating}
                                className={`flex-1 px-6 py-3 rounded-xl border font-black text-sm uppercase transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'}`}
                            >
                                ANNULER
                            </button>
                            <button
                                onClick={handleConfirmStatusChange}
                                disabled={!selectedNewStatus || isUpdating}
                                className="flex-1 px-6 py-3 rounded-xl bg-primary text-white font-black text-sm uppercase transition-all hover:brightness-110 disabled:opacity-50"
                            >
                                {isUpdating ? 'Mise à jour...' : 'CONFIRMER'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default HouseholdDetailsPanel;
