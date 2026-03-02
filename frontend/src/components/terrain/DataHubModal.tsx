import React, { useRef, useState } from 'react';
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
import { useTheme } from '../../context/ThemeContext';

interface DataHubModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DataHubModal: React.FC<DataHubModalProps> = ({ isOpen, onClose }) => {
    const { isDarkMode } = useTheme();
    const { importHouseholds, clearHouseholds, stats, simulateKoboSync } = useTerrainData();
    const [activeTab, setActiveTab] = useState<'import' | 'kobo' | 'backups' | 'danger'>('import');
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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
                region: ['region', 'reg', 'province', 'departement'],
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
                // Replace comma with dot for french locale numbers
                const parsed = parseFloat(String(val).replace(',', '.'));
                return isNaN(parsed) ? 0 : parsed;
            };

            const parsedHouseholds = rawData.map((household: any) => {
                const hId = findValue(household, aliases.id);
                if (hId) {
                    const status = findValue(household, aliases.status) || 'Non débuté';
                    const owner = findValue(household, aliases.owner) || '';
                    const phone = findValue(household, aliases.phone) || '';
                    const region = findValue(household, aliases.region) || '';
                    const photo = findValue(household, aliases.photo) || '';
                    const lat = parseFloatSafe(findValue(household, aliases.lat));
                    const lon = parseFloatSafe(findValue(household, aliases.lon));

                    return {
                        ...household, // keep original data just in case
                        id: String(hId).trim(),
                        owner: String(owner).trim(),
                        photo: String(photo).trim(),
                        phone: String(phone).trim(),
                        region: String(region).trim(),
                        location: {
                            type: 'Point',
                            coordinates: [lon, lat]
                        },
                        status: String(status).trim()
                    };
                }
                return null;
            }).filter(h => h !== null);

            await importHouseholds(parsedHouseholds);
            alert(`Import réussi : ${parsedHouseholds.length} ménages ajoutés/mis à jour.`);
        } catch (err) {
            console.error("Erreur d'import", err);
            alert("Erreur lors de l'import : Vérifiez le format du fichier (CSV ou Excel attendu).");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleKoboSync = async () => {
        setIsProcessing(true);
        try {
            await simulateKoboSync();
            alert("Synchronisation Kobo réussie. Les ménages ont été mis à jour.");
        } catch (e) {
            console.error(e);
            alert("Erreur lors de la synchronisation.");
        } finally {
            setIsProcessing(false);
        }
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
                        <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}>
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Sidebar Tabs */}
                        <div className={`w-64 p-4 border-r shrink-0 space-y-2 overflow-y-auto ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/50'}`}>
                            <button
                                onClick={() => setActiveTab('import')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'import' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                <Upload size={18} /> Import Fichier
                            </button>
                            <button
                                onClick={() => setActiveTab('kobo')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'kobo' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                <RefreshCcw size={18} /> Synchronisation Kobo
                            </button>
                            <button
                                onClick={() => setActiveTab('backups')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'backups' ? 'bg-indigo-600 text-white shadow-md' : isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                <History size={18} /> Sauvegardes
                            </button>
                            <div className={`my-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />
                            <button
                                onClick={() => setActiveTab('danger')}
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

                                        <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${isDarkMode ? 'border-slate-700 hover:border-indigo-500/50 bg-slate-900/50' : 'border-slate-300 hover:border-indigo-500/50 bg-white'}`}>
                                            <Upload size={32} className={`mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                            <p className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Glissez-déposez votre fichier Excel / CSV ici</p>
                                            <p className={`text-xs mb-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>ou cliquez pour parcourir</p>
                                            <input
                                                type="file"
                                                accept=".csv, .xlsx, .xls"
                                                className="hidden"
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isProcessing}
                                                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
                                            >
                                                {isProcessing ? 'Traitement...' : 'Sélectionner un fichier'}
                                            </button>
                                        </div>
                                    </div>

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

                                        <button
                                            onClick={handleKoboSync}
                                            disabled={isProcessing}
                                            className="w-full max-w-sm px-6 py-4 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3"
                                        >
                                            <RefreshCcw size={18} className={isProcessing ? "animate-spin" : ""} />
                                            {isProcessing ? 'Synchronisation en cours...' : 'Lancer la Synchronisation'}
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

                                    <div className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed ${isDarkMode ? 'border-slate-700 bg-slate-900/30' : 'border-slate-300 bg-slate-50'}`}>
                                        <History size={48} className={isDarkMode ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'} />
                                        <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Aucune sauvegarde récente trouvée.</p>
                                        <button className="mt-4 px-4 py-2 bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600/20 rounded-lg text-sm font-bold transition-colors">
                                            Créer une sauvegarde maintenant
                                        </button>
                                    </div>
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
