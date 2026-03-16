import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Upload,
    RefreshCcw,
    Database,
    Trash2,
    AlertTriangle,
    CheckCircle2,
    FileText,
    History
} from 'lucide-react';
import { useTerrainData } from '../../hooks/useTerrainData';
import { useSync } from '../../hooks/useSync';
import logger from '../../utils/logger';
import { useTheme } from '../../context/ThemeContext';
import { useProject } from '../../hooks/useProject';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';

interface DataHubModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DataHubModal: React.FC<DataHubModalProps> = ({ isOpen, onClose }) => {
    const { isDarkMode } = useTheme();
    const { user } = useAuth();
    const { importHouseholds, detectDuplicates, clearHouseholds, stats, simulateKoboSync } = useTerrainData();
    const { activeProjectId, project, createProject } = useProject();
    const [activeTab, setActiveTab] = useState<'import' | 'kobo' | 'backups' | 'danger'>('import');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Nouveaux états UX
    const [importResult, setImportResult] = useState<{type: 'success'|'error', message: string} | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [koboStep, setKoboStep] = useState<0|1|2|3>(0); // 0: Idle, 1: Connecting, 2: Applying, 3: Done
    const [koboResult, setKoboResult] = useState<any>(null);
    
    // Etat des sauvegardes
    const [backups, setBackups] = useState<Array<{id: string, date: string, count: number}>>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const { forceSync } = useSync();
    
    // Charger la liste des sauvegardes au montage
    useEffect(() => {
        if (activeTab === 'backups') {
            loadBackupsList();
        }
    }, [activeTab]);

    const loadBackupsList = () => {
        try {
            const list = JSON.parse(localStorage.getItem('gem_households_backups') || '[]');
            setBackups(list);
        } catch(e) {
            setBackups([]);
        }
    };

    // Gestion Drag & Drop
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await processFile(file);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
    };

    const processFile = async (file: File) => {
        setImportResult(null);

        if (!activeProjectId) {
            const name = prompt("Veuillez donner un nom à ce nouveau projet avant d'importer :");
            if (!name) return;
            const newProj = await createProject(name);
            if (!newProj) return;
        }

        setIsProcessing(true);
        try {
            const extension = file.name.split('.').pop()?.toLowerCase();
            let rawData: any[] = [];

            if (extension === 'csv') {
                const text = await file.text();
                const lines = text.split('\n');
                if (lines.length > 0) {
                    const headers = lines[0].split(',').map(h => h.trim());
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        const values = lines[i].split(',').map(v => v.trim());
                        const household: any = {};
                        headers.forEach((h, index) => {
                            household[h] = values[index];
                        });
                        rawData.push(household);
                    }
                }
            } else if (extension === 'xlsx' || extension === 'xls') {
                const { read, utils } = await import('xlsx');
                const arrayBuffer = await file.arrayBuffer();
                const workbook = read(arrayBuffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                rawData = utils.sheet_to_json(worksheet);
            } else {
                throw new Error("Format non supporté");
            }

            const normalizeKey = (key: string) => {
                return key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
            };

            const aliases = {
                id: ['id', 'numeroordre', 'identifiant', 'numero', 'n', 'code'],
                owner: ['owner', 'nom', 'prenometnom', 'chefdemenage', 'client', 'prenomnom'],
                phone: ['phone', 'telephone', 'tel', 'contact'],
                lat: ['lat', 'latitude'],
                lon: ['lon', 'lng', 'longitude'],
                status: ['status', 'statut', 'etat'],
                region: ['region', 'reg', 'province'],
                departement: ['departement', 'dept', 'district'],
                village: ['village', 'localite', 'commune', 'settlement'],
                photo: ['photo', 'image', 'picture', 'file', 'media', 'lienphoto']
            };

            const findValue = (obj: any, aliasList: string[]) => {
                for (const key of Object.keys(obj)) {
                    if (aliasList.includes(normalizeKey(key))) {
                        return obj[key];
                    }
                }
                return undefined;
            };

            const parseFloatSafe = (val: any) => {
                if (!val && val !== 0) return 0;
                if (typeof val === 'number') return val;
                const parsed = parseFloat(String(val).replace(',', '.'));
                return isNaN(parsed) ? 0 : parsed;
            };

            const currentProjectId = activeProjectId || project?.id;
            const currentOrgId = project?.organizationId || user?.organization || 'org_test_2026';

            if (!currentProjectId) throw new Error("Aucun projet actif pour l'import");

            // 1. Ensure we have at least one zone for this project
            let targetZoneId = '';
            try {
                const zonesRes = await apiClient.get(`/zones?projectId=${currentProjectId}`);
                const zones = zonesRes.data.zones;
                if (zones && zones.length > 0) {
                    targetZoneId = zones[0].id;
                } else {
                    // Create a default zone
                    const newZoneRes = await apiClient.post('zones', {
                        projectId: currentProjectId,
                        name: 'Zone Importée'
                    });
                    targetZoneId = newZoneRes.data.id;
                }
            } catch (zErr) {
                console.warn("Could not fetch/create zone, creating a local placeholder", zErr);
                targetZoneId = `zone_${Date.now()}`;
            }

            const parsedHouseholds = rawData.map((household: any) => {
                const hId = findValue(household, aliases.id);
                if (hId) {
                    const status = findValue(household, aliases.status) || 'Non débuté';
                    const owner = findValue(household, aliases.owner) || '';
                    const phone = findValue(household, aliases.phone) || '';
                    const region = findValue(household, aliases.region) || '';
                    const departement = findValue(household, aliases.departement) || '';
                    const village = findValue(household, aliases.village) || '';
                    const photo = findValue(household, aliases.photo) || '';
                    const lat = parseFloatSafe(findValue(household, aliases.lat));
                    const lon = parseFloatSafe(findValue(household, aliases.lon));

                    return {
                        id: String(hId).trim(),
                        projectId: currentProjectId,
                        zoneId: targetZoneId, // CRITICAL: Link to zone
                        organizationId: currentOrgId,
                        owner: String(owner).trim(),
                        photo: String(photo).trim(),
                        phone: String(phone).trim(),
                        region: String(region).trim(),
                        departement: String(departement).trim(),
                        village: String(village).trim(),
                        location: {
                            type: 'Point' as const,
                            coordinates: [lon, lat] as [number, number]
                        },
                        status: String(status).trim(),
                        version: 1,
                        updatedAt: new Date().toISOString()
                    };
                }
                return null;
            }).filter(h => h !== null);

            logger.log(`[IMPORT] Importing ${parsedHouseholds.length} households to zone ${targetZoneId}`);
            
            // 🔍 Détecte les doublons AVANT import
            const duplicateStats = await detectDuplicates(parsedHouseholds as any);
            
            logger.log(`[IMPORT] Duplicate stats:`, duplicateStats);
            
            // Importe les données
            await importHouseholds(parsedHouseholds as any);

            // Message détaillé pour l'utilisateur
            const message = `✅ Import réussi pour "${project?.name || 'Nouveau'}":
  • ${duplicateStats.newItems} nouveaux ménages ajoutés
  • ${duplicateStats.duplicates} ménages détectés (doublons par ID)${duplicateStats.updates > 0 ? `\n  • ${duplicateStats.updates} mises à jour détectées` : ''}
  
Total: ${parsedHouseholds.length} ménages traités`;

            setImportResult({ type: 'success', message });

            // Auto-push to server
            try {
                await forceSync();
            } catch (e) {
                logger.warn("Local import ok, but server sync failed", e);
            }
        } catch (err) {
            logger.error("Erreur d'import", err);
            setImportResult({ type: 'error', message: "Erreur lors de l'import : Vérifiez le format du fichier (CSV ou Excel attendu)." });
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleKoboSync = async () => {
        setIsProcessing(true);
        setKoboStep(1); // Connecting
        setKoboResult(null);
        
        try {
            // Real Server Sync - Triggers both DB and Kobo pull
            await apiClient.post('kobo/sync');
            setKoboStep(2); // Applying
            
            await forceSync(); // Force local DB sync to get new kobo data
            
            setKoboStep(3); // Done
            const statusRes = await apiClient.get('kobo/status');
            setKoboResult(statusRes.data.lastResult);
            
        } catch (e) {
            console.error(e);
            // Simulation fallback if no server
            try {
                await simulateKoboSync();
                setKoboStep(3);
                setKoboResult({ applied: 'Simulé', skipped: 0, errors: 0 });
            } catch (simErr) {
                setKoboStep(0);
                alert("Erreur critique lors de la synchronisation Kobo.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // --- LOGIQUE DES SAUVEGARDES LOCALES ---
    const handleCreateBackup = async () => {
        setIsProcessing(true);
        try {
            const { db } = await import('../../store/db');
            const data = await db.households.toArray();
            
            if (data.length === 0) {
                alert("Aucune donnée à sauvegarder.");
                return;
            }

            const backupMeta = {
                id: `bkp_${Date.now()}`,
                date: new Date().toISOString(),
                count: data.length
            };

            // Stocker les données
            localStorage.setItem(`gem_backup_data_${backupMeta.id}`, JSON.stringify(data));
            
            // Mettre à jour la liste
            const list = JSON.parse(localStorage.getItem('gem_households_backups') || '[]');
            list.unshift(backupMeta);
            localStorage.setItem('gem_households_backups', JSON.stringify(list));
            
            setBackups(list);
            alert("Sauvegarde créée avec succès.");
        } catch (e) {
            console.error("Erreur de sauvegarde", e);
            alert("Impossible de créer la sauvegarde (quota dépassé ?).");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRestoreBackup = async (backupId: string) => {
        if (!window.confirm("Restaurer cette sauvegarde écrasera vos données locales actuelles. Continuer ?")) return;
        
        setIsProcessing(true);
        try {
            const dataStr = localStorage.getItem(`gem_backup_data_${backupId}`);
            if (!dataStr) throw new Error("Données introuvables");
            
            const data = JSON.parse(dataStr);
            const { db } = await import('../../store/db');
            await db.households.clear();
            await db.households.bulkPut(data);
            
            alert(`Restauration terminée (${data.length} ménages).`);
        } catch (e) {
            console.error("Erreur de restauration", e);
            alert("Erreur lors de la restauration.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteBackup = (backupId: string) => {
        if (!window.confirm("Supprimer cette sauvegarde définitivement ?")) return;
        
        localStorage.removeItem(`gem_backup_data_${backupId}`);
        const list = backups.filter(b => b.id !== backupId);
        localStorage.setItem('gem_households_backups', JSON.stringify(list));
        setBackups(list);
    };

    const handleDownloadBackup = (backupId: string) => {
        const dataStr = localStorage.getItem(`gem_backup_data_${backupId}`);
        if (!dataStr) return alert("Données introuvables");
        
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const backupMeta = backups.find(b => b.id === backupId);
        a.download = `gem_backup_${backupMeta?.date.split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleClearData = async () => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer tous les ménages ? Cette action est irréversible.")) {
            if (window.confirm("CONFIRMATION REQUISE : Toutes les données locales seront effacées.")) {
                await clearHouseholds();
                alert("Base de données vidée.");
            }
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                >
                    {/* Header */}
                    <div className={`flex items-center justify-between p-6 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-600 shadow-lg shadow-indigo-600/20">
                                <Database size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className={`text-2xl font-black uppercase tracking-tight italic ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Data Hub</h2>
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Synchronisation, Imports & Sauvegardes</p>
                            </div>
                        </div>
                        <button onClick={onClose} title="Fermer" aria-label="Fermer" className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}>
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Sidebar Tabs */}
                        <div className={`w-64 p-4 border-r shrink-0 space-y-2 overflow-y-auto ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/50'}`}>
                            <button
                                onClick={() => setActiveTab('import')}
                                title="Importer un fichier Excel ou CSV"
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'import' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                <Upload size={18} /> Import Fichier
                            </button>
                            <button
                                onClick={() => setActiveTab('kobo')}
                                title="Synchroniser avec KoboToolbox"
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'kobo' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                <RefreshCcw size={18} /> Synchronisation Kobo
                            </button>
                            <button
                                onClick={() => setActiveTab('backups')}
                                title="Voir les sauvegardes historiques"
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'backups' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                <History size={18} /> Sauvegardes
                            </button>
                            <div className={`my-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />
                            <button
                                onClick={() => setActiveTab('danger')}
                                title="Accéder aux options de suppression et données sensibles"
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'danger' ? 'bg-rose-600 text-white shadow-md' : isDarkMode ? 'text-rose-500/70 hover:bg-rose-500/10 hover:text-rose-400' : 'text-rose-600/70 hover:bg-rose-50'}`}
                            >
                                <AlertTriangle size={18} /> Zone de Danger
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 p-8 overflow-y-auto">
                            {activeTab === 'import' && (
                                <div className="space-y-6">
                                    <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                        <h3 className={`text-lg font-bold mb-2 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                            <FileText size={20} className="text-indigo-500" />
                                            Importation de Ménages
                                        </h3>
                                        <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                            Importez un fichier Excel (.xlsx) ou CSV contenant les données des ménages. Les identifiants existants seront mis à jour.
                                        </p>

                                        <div 
                                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                                                isDragActive 
                                                    ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
                                                    : isDarkMode 
                                                        ? 'border-slate-700 hover:border-indigo-500/50 bg-slate-900/50' 
                                                        : 'border-slate-300 hover:border-indigo-500/50 bg-white'
                                            }`}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDragOver={handleDragOver}
                                            onDrop={handleDrop}
                                        >
                                            <Upload size={32} className={`mb-4 transition-colors ${isDragActive ? 'text-indigo-500' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                            <p className={`text-sm font-bold mb-2 ${isDragActive ? 'text-indigo-600 dark:text-indigo-400' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                                Glissez-déposez votre fichier Excel / CSV ici
                                            </p>
                                            <p className={`text-xs mb-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>ou cliquez pour parcourir</p>
                                            <input
                                                type="file"
                                                accept=".csv, .xlsx, .xls"
                                                className="hidden"
                                                ref={fileInputRef}
                                                title="Choisir un fichier Excel ou CSV"
                                                aria-label="Choisir un fichier Excel ou CSV"
                                                onChange={handleFileUpload}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isProcessing}
                                                title="Parcourir vos fichiers"
                                                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
                                            >
                                                {isProcessing ? 'Traitement...' : 'Sélectionner un fichier'}
                                            </button>
                                        </div>
                                    </div>

                                    {importResult && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`p-4 rounded-xl flex items-start gap-3 ${importResult.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 shadow-sm border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 shadow-sm border border-rose-500/20'}`}
                                        >
                                            {importResult.type === 'success' ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" /> : <AlertTriangle size={20} className="mt-0.5 shrink-0" />}
                                            <div className="text-sm font-medium whitespace-pre-wrap">
                                                {importResult.message}
                                            </div>
                                        </motion.div>
                                    )}

                                    <div className={`p-4 rounded-xl flex gap-3 ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>
                                        <CheckCircle2 size={20} className="shrink-0" />
                                        <div className="text-sm">
                                            <p className="font-bold mb-1">Tolérance sur les en-têtes :</p>
                                            <p className="opacity-80">Notre système est intelligent : "Numéro_ordre", "nom", "Prénom et Nom", "Téléphone", etc., sont détectés automatiquement, peu importe les espaces ou accents. De plus, les coordonnées avec des virgules (14,215) sont gérées correctement.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'kobo' && (
                                <div className="space-y-6">
                                    <h3 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                        <RefreshCcw size={20} className="text-indigo-500" />
                                        Synchronisation KoboCollect
                                    </h3>
                                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        Récupérez les dernières enquêtes terrain et mettez à jour la base de données locale.
                                    </p>

                                    <div className={`p-6 rounded-2xl border flex flex-col items-center text-center ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
                                            <Database size={32} />
                                        </div>
                                        <div className="mb-8">
                                            <h4 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.total || 0}</h4>
                                            <p className={`text-xs uppercase tracking-widest font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ménages Locaux</p>
                                        </div>

                                        {koboStep > 0 && (
                                            <div className="w-full max-w-sm mb-6 space-y-3">
                                                <div className="flex items-center gap-3 text-sm font-medium">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${koboStep >= 1 ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'}`}>1</div>
                                                    <span className={koboStep >= 1 ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-400'}>Connexion API</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm font-medium">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${koboStep >= 2 ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'}`}>2</div>
                                                    <span className={koboStep >= 2 ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-400'}>Récupération & DB Locale</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm font-medium">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${koboStep >= 3 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>3</div>
                                                    <span className={koboStep >= 3 ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-400'}>Terminé</span>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {koboResult && koboStep === 3 && (
                                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`w-full max-w-sm p-4 rounded-xl mb-6 text-sm flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-slate-300' : 'bg-white border border-slate-200 text-slate-600'}`}>
                                                <div className={`flex justify-between font-bold border-b pb-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                                    <span>Résultat de la synchronisation</span>
                                                </div>
                                                <div className="flex justify-between"><span>Nouveaux ménages :</span> <span className="text-emerald-500 font-bold">{koboResult.applied}</span></div>
                                                <div className="flex justify-between"><span>Ignorés (existants) :</span> <span>{koboResult.skipped}</span></div>
                                                {koboResult.errors > 0 && <div className="flex justify-between"><span>Erreurs de format :</span> <span className="text-rose-500">{koboResult.errors}</span></div>}
                                            </motion.div>
                                        )}

                                        <button
                                            onClick={handleKoboSync}
                                            disabled={isProcessing}
                                            className="w-full max-w-sm px-6 py-4 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3"
                                        >
                                            <RefreshCcw size={18} className={isProcessing ? "animate-spin" : ""} />
                                            {isProcessing ? 'Synchronisation en cours...' : koboStep === 3 ? 'Relancer la Synchronisation' : 'Lancer la Synchronisation'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'backups' && (
                                <div className="space-y-6">
                                    <h3 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                        <History size={20} className="text-indigo-500" />
                                        Gestion des Sauvegardes
                                    </h3>

                                    {backups.length === 0 ? (
                                        <div className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed ${isDarkMode ? 'border-slate-700 bg-slate-900/30' : 'border-slate-300 bg-slate-50'}`}>
                                            <History size={48} className={isDarkMode ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'} />
                                            <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Aucune sauvegarde récente trouvée.</p>
                                            <button onClick={handleCreateBackup} disabled={isProcessing} className="mt-4 px-4 py-2 bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600/20 rounded-lg text-sm font-bold transition-colors">
                                                Créer une sauvegarde maintenant
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                                                <div>
                                                    <h4 className="font-bold text-indigo-800 dark:text-indigo-400">Instantané Local</h4>
                                                    <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1">Créez une copie de sécurité des données de votre navigateur.</p>
                                                </div>
                                                <button onClick={handleCreateBackup} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md transition-colors shrink-0">
                                                    {isProcessing ? 'Création...' : '+ Nouvelle Sauvegarde'}
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                {backups.map(backup => (
                                                    <div key={backup.id} className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                                    {new Date(backup.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">
                                                                    {backup.count} ménages
                                                                </span>
                                                            </div>
                                                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID: {backup.id}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleDownloadBackup(backup.id)} title="Télécharger" className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}>
                                                                <Upload size={18} className="rotate-180" />
                                                            </button>
                                                            <button onClick={() => handleRestoreBackup(backup.id)} disabled={isProcessing} className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30 rounded-lg transition-colors">
                                                                Restaurer
                                                            </button>
                                                            <button onClick={() => handleDeleteBackup(backup.id)} title="Supprimer" className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'danger' && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-rose-500 flex items-center gap-2">
                                        <AlertTriangle size={20} />
                                        Zone de Danger
                                    </h3>

                                    <div className={`p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5`}>
                                        <div className="flex gap-4">
                                            <div className="shrink-0 p-3 bg-rose-500/10 rounded-xl text-rose-500 mt-1">
                                                <Trash2 size={24} />
                                            </div>
                                            <div>
                                                <h4 className={`text-base font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Effacer toutes les données</h4>
                                                <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                                    Attention : Cette action va complètement supprimer la base de données locale des ménages et des grappes. Assurez-vous d'avoir une sauvegarde ou une connexion à Kobo pour récupérer les données.
                                                </p>
                                                <button
                                                    onClick={handleClearData}
                                                    className="px-6 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20"
                                                >
                                                    Effacer la base locale
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
