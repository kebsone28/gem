import { useState } from 'react';
import logger from '../../utils/logger';
import { RefreshCw, Settings, CloudDownload, CheckCircle2, AlertCircle } from 'lucide-react';
import apiClient from '../../api/client';
import { useSync } from '../../hooks/useSync';
import { useProject } from '../../contexts/ProjectContext';
import toast from 'react-hot-toast';

interface KoboSyncProps {
    onImport: (data: any[]) => void;
}

export default function KoboSync({ onImport }: KoboSyncProps) {
    const { forceSync } = useSync();
    const [syncResult, setSyncResult] = useState<any>(null);

    const [isSyncing, setIsSyncing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [showConfig, setShowConfig] = useState(false);

    const { project } = useProject();
    const handleSync = async () => {
        if (!project?.id) {
            toast.error("Veuillez sélectionner un projet actif avant de synchroniser.");
            return;
        }

        setIsSyncing(true);
        setStatus('idle');
        setSyncResult(null);
        const toastId = toast.loading('Import Kobo en cours...');
        try {
            // Appel au backend — qui utilise KOBO_TOKEN et KOBO_FORM_ID du .env
            const response = await apiClient.post('kobo/sync', { projectId: project.id });
            const result = response.data?.result;
            setSyncResult(result);

            // Déclenche le pull pour ramener les ménages importés dans le cache local
            // On attend 3s pour être sûr que le backend a tout fini
            await new Promise(r => setTimeout(r, 3000));
            await forceSync();

            setStatus('success');
            const imported = result?.applied || 0;
            const skipped = result?.skipped || 0;

            onImport([]);
            toast.success(
                `${imported} ménage(s) importé(s)${skipped > 0 ? `, ${skipped} ignoré(s)` : ''}.`,
                { id: toastId }
            );
        } catch (error: any) {
            logger.error('Kobo Sync Error:', error);
            setStatus('error');
            const msg = error?.response?.data?.error || 'Erreur de connexion au serveur';
            toast.error(`Échec : ${msg}`, { id: toastId });
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
                    aria-label="Configurer les paramètres Kobo"
                    onClick={() => setShowConfig(!showConfig)}
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {showConfig && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-bold">
                    ✅ Les credentials Kobo (Token &amp; Form ID) sont configurés côté serveur dans les variables d'environnement.
                    Aucune configuration manuelle n'est nécessaire ici.
                </div>
            )}


            <button
                aria-label="Lancer la synchronisation Kobo"
                onClick={handleSync}
                disabled={isSyncing}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                    isSyncing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                }`}
            >
                {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                    <CloudDownload className="w-4 h-4" />
                )}
                {isSyncing ? 'Importation Kobo...' : 'Lancer la Synchronisation'}
            </button>

            {syncResult && (
                <div className="mt-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 font-bold flex gap-4">
                    <span>✅ Importés : {syncResult.applied}</span>
                    {syncResult.skipped > 0 && <span>⏭ Ignorés : {syncResult.skipped}</span>}
                    {syncResult.errors > 0 && <span className="text-red-400">❌ Erreurs : {syncResult.errors}</span>}
                </div>
            )}

            {status !== 'idle' && (
                <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 border ${status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    {status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {status === 'success' ? 'Synchronisation réussie' : 'Erreur de connexion'}
                    </span>
                </div>
            )}
        </div>
    );
}
