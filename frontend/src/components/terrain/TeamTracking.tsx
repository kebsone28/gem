/**
 * TeamTracking.tsx
 *
 * Affiche la dernière position GPS connue des membres de l'équipe sur la carte.
 * S'appuie sur l'endpoint backend GET /api/team/positions (optionnel — mode simulé si absent).
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import api from '../../api/client';

interface TeamMemberPosition {
    userId: string;
    name: string;
    role: string;
    lat: number;
    lon: number;
    updatedAt: string;
    accuracy?: number;
}

interface Props {
    isDarkMode?: boolean;
    onSelectPosition?: (lat: number, lon: number) => void;
}

const ROLE_COLORS: Record<string, string> = {
    TECHNICIEN: '#3b82f6',
    ADMIN: '#6366f1',
    SUPERVISEUR: '#f59e0b',
    LECTEUR: '#10b981',
    default: '#94a3b8'
};

const ROLE_LABELS: Record<string, string> = {
    TECHNICIEN: 'Chef Équipe',
    ADMIN: 'Admin',
    SUPERVISEUR: 'Superviseur',
    LECTEUR: 'Observateur',
};

function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h`;
}

export function TeamTrackingPanel({ isDarkMode = true, onSelectPosition }: Props) {
    const [positions, setPositions] = useState<TeamMemberPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(false);

    const fetchPositions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/teams/positions');
            const raw = res.data?.positions || [];
            // Supporte 2 formats:
            // - format "ancien" (déjà prêt UI): { userId, name, role, lat, lon, updatedAt }
            // - format backend actuel: { id, name, type, coordinates: { lat, lng }, lastUpdate }
            const normalized: TeamMemberPosition[] = (Array.isArray(raw) ? raw : []).map((p: any) => {
                if (p?.userId && (p?.lat !== undefined) && (p?.lon !== undefined) && p?.updatedAt) {
                    return {
                        userId: String(p.userId),
                        name: String(p.name || 'Équipe'),
                        role: String(p.role || 'TECHNICIEN'),
                        lat: Number(p.lat),
                        lon: Number(p.lon),
                        updatedAt: String(p.updatedAt),
                        accuracy: p.accuracy !== undefined ? Number(p.accuracy) : undefined
                    };
                }

                const lat = p?.coordinates?.lat ?? p?.coordinates?.latitude;
                const lon = p?.coordinates?.lng ?? p?.coordinates?.lon ?? p?.coordinates?.longitude;
                return {
                    userId: String(p?.id || p?.teamId || `team_${Math.random().toString(36).slice(2)}`),
                    name: String(p?.name || 'Équipe'),
                    role: String(p?.type || 'TECHNICIEN'),
                    lat: Number(lat ?? 0),
                    lon: Number(lon ?? 0),
                    updatedAt: String(p?.lastUpdate || p?.updatedAt || new Date().toISOString())
                };
            }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

            setPositions(normalized);
            setIsOnline(true);
        } catch {
            // Fallback: données simulées si l'endpoint n'existe pas encore
            setIsOnline(false);
            // Positions simulées centrées sur le Sénégal
            setPositions([
                { userId: 'sim_1', name: 'Équipe Maçons', role: 'TECHNICIEN', lat: 14.7167, lon: -17.4677, updatedAt: new Date(Date.now() - 5 * 60000).toISOString() },
                { userId: 'sim_2', name: 'Équipe Réseau', role: 'TECHNICIEN', lat: 14.7245, lon: -17.4523, updatedAt: new Date(Date.now() - 12 * 60000).toISOString() },
                { userId: 'sim_3', name: 'Superviseur', role: 'SUPERVISEUR', lat: 14.7089, lon: -17.4801, updatedAt: new Date(Date.now() - 2 * 60000).toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPositions();
        const interval = setInterval(fetchPositions, 30000); // Rafraîchissement toutes les 30s
        return () => clearInterval(interval);
    }, []);

    const bg = isDarkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200';
    const text = isDarkMode ? 'text-white' : 'text-slate-900';
    const sub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
    const rowBg = isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200';

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`absolute top-16 right-4 z-30 w-72 rounded-2xl border shadow-2xl backdrop-blur-sm overflow-hidden ${bg}`}
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                        <Users size={16} className="text-blue-400" />
                    </div>
                    <div>
                        <p className={`text-sm font-bold ${text}`}>Équipes en Terrain</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {isOnline
                                ? <Wifi size={9} className="text-emerald-400" />
                                : <WifiOff size={9} className="text-amber-400" />}
                            <p className={`text-xs ${sub}`}>
                                {isOnline ? 'Données réelles' : 'Simulation locale'} · {positions.length} agent{positions.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    aria-label="Rafraîchir les positions"
                    onClick={fetchPositions}
                    disabled={loading}
                    className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                >
                    <RefreshCw size={13} className={`${sub} ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Positions list */}
            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                {!isOnline && (
                    <div className="bg-amber-500/10 rounded-xl px-3 py-2 mb-1">
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                            ℹ️ Endpoint <code>/api/teams/positions</code> non disponible — données simulées affichées.
                        </div>
                    </div>
                )}
                {positions.map(pos => {
                    const color = ROLE_COLORS[pos.role] || ROLE_COLORS.default;
                    const label = ROLE_LABELS[pos.role] || pos.role;
                    return (
                        <button
                            key={pos.userId}
                            title={`Centrer sur ${pos.name}`}
                            onClick={() => onSelectPosition?.(pos.lat, pos.lon)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:scale-[1.01] ${rowBg}`}
                        >
                            {/* Avatar */}
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                                style={{ backgroundColor: color }}
                                /* eslint-disable-line no-inline-styles */
                            >
                                {pos.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate ${text}`}>{pos.name}</p>
                                <p className={`text-xs ${sub}`}>{label}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className={`text-xs font-bold ${sub}`}>{timeAgo(pos.updatedAt)}</span>
                                </div>
                                <MapPin size={10} style={{ color }} />
                            </div>
                        </button>
                    );
                })}

                {positions.length === 0 && !loading && (
                    <p className={`text-xs text-center py-6 ${sub}`}>Aucun agent en ligne</p>
                )}
            </div>

            {/* Note GPS */}
            <div className={`px-4 py-2 border-t border-slate-700/20 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
                <p className={`text-xs ${sub}`}>
                    🔄 Mise à jour auto toutes les 30s · Cliquez sur un agent pour centrer la carte
                </p>
            </div>
        </motion.div>
    );
}
