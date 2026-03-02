import { useState } from 'react';
import { RefreshCw, Settings, CloudDownload, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface KoboSyncProps {
    onImport: (data: any[]) => void;
}

export default function KoboSync({ onImport }: KoboSyncProps) {
    const [config, setConfig] = useState({
        token: '2e3a09a8bff3fbb3a2510dbcba84486582897f3f',
        assetUid: 'aEYZwPujJiFBTNb6mxMGCB'
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [showConfig, setShowConfig] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        setStatus('idle');
        try {
            // Use local Vite proxy to avoid CORS issues
            const response = await axios.get(`/api/kobo/assets/${config.assetUid}/data.json`, {
                headers: { Authorization: `Token ${config.token}` }
            });

            if (response.data && response.data.results) {
                // Map Kobo fields to our Household type
                const mappedData = response.data.results.map((item: any) => ({
                    id: item._id || item.id_menage || `KOBO-${Math.random().toString(36).substr(2, 9)}`,
                    status: item.etat_avancement || 'En attente',
                    region: item.region || 'Inconnue',
                    location: item._geolocation ? {
                        type: "Point",
                        coordinates: [item._geolocation[1], item._geolocation[0]]
                    } : undefined,
                    delivery: {
                        agent: item.nom_enqueteur,
                        date: item._submission_time
                    }
                }));

                onImport(mappedData);
                setStatus('success');
            }
        } catch (error) {
            console.error('Kobo Sync Error:', error);
            setStatus('error');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="bg-slate-900/50 rounded-3xl border border-slate-800/50 p-6 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    Synchro Kobo
                </h3>
                <button
                    title="Configurer les paramètres Kobo"
                    onClick={() => setShowConfig(!showConfig)}
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {showConfig && (
                <div className="space-y-4 mb-6 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Token API</label>
                        <input
                            type="password"
                            title="Token API"
                            value={config.token}
                            onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Asset UID</label>
                        <input
                            type="text"
                            title="Asset UID"
                            value={config.assetUid}
                            onChange={(e) => setConfig(prev => ({ ...prev, assetUid: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
            )}

            <button
                title="Lancer la synchronisation Kobo"
                onClick={handleSync}
                disabled={isSyncing}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${isSyncing ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    }`}
            >
                {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                    <CloudDownload className="w-4 h-4" />
                )}
                {isSyncing ? 'Synchronisation...' : 'Lancer Synchro'}
            </button>

            {status !== 'idle' && (
                <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 border ${status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    {status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                        {status === 'success' ? 'Synchronisation réussie' : 'Erreur de connexion'}
                    </span>
                </div>
            )}
        </div>
    );
}
