/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  Download,
  Upload,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Settings as SettingsIcon,
  Filter,
  Search,
  FileText,
  Users,
  MapPin,
  Calendar,
  BarChart3,
  Activity,
  Layers,
  Globe,
  Server,
  Wifi,
  WifiOff,
  Clock,
  Zap,
  Shield,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  Info,
  HelpCircle,
  ExternalLink,
  Copy,
  Share2,
  Lock,
  Unlock,
  Key,
  UserCheck,
  FileSpreadsheet,
  FileJson,
  FileArchive,
  HardDrive,
  CloudDownload as CloudDownloadIcon,
  CloudUpload,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Grid3x3,
  List,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  History,
  Edit2,
  X,
  Wrench as WrenchIcon,
} from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { useTerrainData } from '../hooks/useTerrainData';
import toast from 'react-hot-toast';
import logger from '../utils/logger';
import { StatusBadge } from './dashboards/DashboardComponents';
import apiClient from '../api/client';
import { db } from '../store/db';
import { syncEventBus, SYNC_EVENTS } from '../utils/syncEventBus';

interface DataHubSectionProps {
  project: any;
  onUpdate: (updates: any) => Promise<void>;
}

type HubTab = 'flux' | 'import' | 'projects' | 'backups' | 'maintenance';

export default function DataHubSection({ project, onUpdate }: DataHubSectionProps) {
  const { user } = useAuth();
  const { forceSync } = useSync();
  const { importHouseholds, repairSyncQueue } = useTerrainData();
  const {
    activeProjectId,
    createProject,
    projects,
    deleteProject,
    updateProject: updateProjectContext,
    setActiveProjectId,
    refreshProjects,
  } = useProject();

  const [activeTab, setActiveTab] = useState<HubTab>('flux');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [dataCount, setDataCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  
  // States ported from DataHubModal
  const [isProcessing, setIsProcessing] = useState(false);
  const [useServerImport, setUseServerImport] = useState(true);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState(5); // minutes
  const [backups, setBackups] = useState<Array<{ id: string; date: string; count: number }>>([]);
  const [koboStep, setKoboStep] = useState<0 | 1 | 2 | 3>(0);
  const [koboResult, setKoboResult] = useState<any>(null);
  const [collectSource, setCollectSource] = useState<'kobo' | 'gedtoolbox'>(project?.config?.collectSource || 'kobo');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔄 AUTOMATIC SYNC LOGIC
  useEffect(() => {
    if (!isAutoSyncEnabled || connectionStatus !== 'connected') return;

    logger.info(`[DataHub] Auto-sync enabled. Interval: ${syncInterval}min`);
    
    const interval = setInterval(() => {
      logger.info('[DataHub] Triggering scheduled auto-sync...');
      void handleSyncData(true);
    }, syncInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAutoSyncEnabled, syncInterval, connectionStatus]);

  // Load backups on mount
  useEffect(() => {
    loadBackupsList();
    void handleTestConnection(); // Auto-test connection on load
  }, []);

  const loadBackupsList = () => {
    try {
      const list = JSON.parse(localStorage.getItem('ged_os_households_backups') || '[]');
      setBackups(list);
    } catch (e) {
      setBackups([]);
    }
  };

  const handleSyncData = async (isAuto = false) => {
    if (syncStatus === 'syncing') return;
    
    setSyncStatus('syncing');
    try {
      await forceSync();
      setSyncStatus('success');
      setLastSync(new Date());
      
      const count = await db.households.count();
      setDataCount(count);
      
      if (!isAuto) {
        toast.success('Synchronisation terminée');
      }
      logger.info('[DataHubSection] Sync completed');
    } catch (error) {
      setSyncStatus('error');
      if (!isAuto) {
        toast.error('Erreur lors de la synchronisation');
      }
      logger.error('[DataHubSection] Sync failed:', error);
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('connecting');
    try {
      // Test server availability via monitoring endpoint
      await apiClient.get('/monitoring/system-health');
      setConnectionStatus('connected');
      logger.info('[DataHubSection] Connection successful');
    } catch (error) {
      setConnectionStatus('disconnected');
      logger.error('[DataHubSection] Connection failed:', error);
    }
  };

  const handleKoboSync = async (force = false) => {
    const currentProjectId = project?.id || activeProjectId;
    if (!currentProjectId) {
      toast.error("Projet non identifié");
      return;
    }

    setIsProcessing(true);
    setKoboStep(1);
    try {
      if (collectSource === 'kobo') {
        await apiClient.post('sync/kobo', {
          projectId: currentProjectId,
          force: force,
        });
        setKoboStep(2);
      } else {
        // Mode GedToolbox : La synchro est déjà faite en temps réel, 
        // on force juste un rafraîchissement global du contexte local
        toast.loading("Calcul des données GedToolbox...", { id: 'ged-os-sync' });
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate work
        setKoboStep(2);
      }

      await forceSync();
      syncEventBus.emit(SYNC_EVENTS.KOBO_SYNC_COMPLETE, { timestamp: new Date() });
      setKoboStep(3);
      
      if (collectSource === 'kobo') {
        const statusRes = await apiClient.get('kobo/status');
        setKoboResult(statusRes.data?.lastResult || { applied: 0, skipped: 0, errors: 0 });
        toast.success('Sync Kobo terminée');
      } else {
        toast.success('Données GedToolbox rafraîchies', { id: 'ged-os-sync' });
      }
    } catch (e: any) {
      logger.error(`[DataHub] ${collectSource} sync error`, e);
      setKoboStep(0);
      toast.error(e?.response?.data?.message || `Erreur ${collectSource === 'kobo' ? 'Kobo' : 'GedToolbox'}`, { id: 'ged-os-sync' });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCollectSource = async () => {
    const newSource = collectSource === 'kobo' ? 'gedtoolbox' : 'kobo';
    setCollectSource(newSource);
    try {
      await onUpdate({
        config: {
          ...project.config,
          collectSource: newSource
        }
      });
      toast.success(`Mode ${newSource === 'kobo' ? 'KoBoToolbox' : 'GedToolbox'} activé`);
    } catch (e) {
      toast.error("Erreur lors du changement de source");
      setCollectSource(collectSource); // Revert
    }
  };

  const processFile = async (file: File) => {
    const currentProjectId = project?.id || activeProjectId;
    if (!currentProjectId) {
      toast.error("Veuillez sélectionner un projet");
      return;
    }

    setIsProcessing(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let rawData: any[] = [];

      if (extension === 'csv') {
        const text = await file.text();
        const lines = text.split('\n');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map((h) => h.trim());
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',').map((v) => v.trim());
            const household: any = {};
            headers.forEach((h, index) => { household[h] = values[index]; });
            rawData.push(household);
          }
        }
      } else if (extension === 'xlsx' || extension === 'xls') {
        const { read, utils } = await import('../utils/safeExcel');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = await read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = utils.sheet_to_json(worksheet);
      }

      if (rawData.length > 0) {
        // --- PORTED ENHANCEMENT: Advanced Column Mapping & Normalization ---
        const normalizeKey = (key: string) => key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const aliases = {
            id: ['id', 'numeroordre', 'identifiant', 'numero', 'n', 'code', 'num_ordre', 'ordre'],
            owner: ['owner', 'nom', 'prenometnom', 'chefdemenage', 'client', 'prenomnom', 'beneficiaire', 'titulaire'],
            phone: ['phone', 'telephone', 'tel', 'contact', 'mobile', 'cellulaire'],
            lat: ['lat', 'latitude', 'gpslatitude', 'y', 'lat_gps'],
            lon: ['lon', 'lng', 'longitude', 'gpslongitude', 'x', 'lon_gps', 'long'],
            status: ['status', 'statut', 'etat', 'avancement', 'phase'],
            region: ['region', 'reg', 'province', 'nom_region', 'region_nom'],
            departement: ['departement', 'dept', 'district', 'prefecture', 'pref'],
            village: ['village', 'nom_village', 'nom_grappe', 'grappe', 'localite', 'commune', 'settlement', 'quartier'],
            photo: ['photo', 'image', 'picture', 'file', 'media', 'lienphoto', 'photo_lieu'],
        };
        const findValue = (obj: any, aliasList: string[]) => {
            const normalizedObjKeys = new Map<string, string>();
            for (const key of Object.keys(obj)) normalizedObjKeys.set(normalizeKey(key), key);
            for (const alias of aliasList) if (normalizedObjKeys.has(alias)) return obj[normalizedObjKeys.get(alias)!];
            return undefined;
        };
        
        const currentOrgId = user?.organization || 'org_test_2026';
        const parsedData = rawData.map((row: any) => {
            const hId = findValue(row, aliases.id);
            if (!hId) return null;
            return {
                id: String(hId).trim(),
                numeroordre: String(hId).trim(),
                projectId: currentProjectId,
                organizationId: currentOrgId,
                name: String(findValue(row, aliases.owner) || '').trim(),
                phone: String(findValue(row, aliases.phone) || '').trim(),
                region: String(findValue(row, aliases.region) || '').trim(),
                departement: String(findValue(row, aliases.departement) || '').trim(),
                village: String(findValue(row, aliases.village) || '').trim(),
                status: String(findValue(row, aliases.status) || 'Non encore installée').trim(),
                location: {
                    type: 'Point',
                    coordinates: [
                        parseFloat(String(findValue(row, aliases.lon) || 0).replace(',', '.')),
                        parseFloat(String(findValue(row, aliases.lat) || 0).replace(',', '.'))
                    ]
                },
                source: 'Excel-Import',
                updatedAt: new Date().toISOString(),
            };
        }).filter(d => d !== null);

        if (parsedData.length === 0) {
            toast.error("Aucun ménage valide trouvé dans le fichier.");
            return;
        }

        toast.loading(`Envoi de ${parsedData.length} ménages...`, { id: 'import' });
        const response = await apiClient.post('sync/import-bulk', { 
            households: parsedData,
            projectId: currentProjectId 
        });
        toast.success(response.data.message || 'Import réussi !', { id: 'import' });
        await forceSync();
      }
    } catch (err) {
      logger.error("Import error", err);
      toast.error("Erreur d'import", { id: 'import' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateBackup = async () => {
    setIsProcessing(true);
    try {
      const data = await db.households.toArray();
      if (data.length === 0) {
        toast.error('Aucune donnée à sauvegarder');
        return;
      }
      const bkpId = `bkp_${Date.now()}`;
      localStorage.setItem(`ged_os_backup_data_${bkpId}`, JSON.stringify(data));
      const list = JSON.parse(localStorage.getItem('ged_os_households_backups') || '[]');
      list.unshift({ id: bkpId, date: new Date().toISOString(), count: data.length });
      localStorage.setItem('ged_os_households_backups', JSON.stringify(list));
      setBackups(list);
      toast.success('Sauvegarde créée localement');
    } catch (e) {
      toast.error('Erreur sauvegarde');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMaintenance = async (action: string) => {
    let confirmMsg = `Confirmer l'action de maintenance : ${action} ?`;
    if (action.includes('purge_server')) confirmMsg = `⚠️ DANGER SÉVÈRE : Voulez-vous VRAIMENT supprimer définitivement ces données du SERVEUR CENTRAL ? Cette action est irréversible.`;
    
    if (!window.confirm(confirmMsg)) return;
    
    const password = action.includes('purge_server') ? prompt("Veuillez saisir votre mot de passe pour confirmer l'action nucléaire :") : null;
    if (action.includes('purge_server') && !password) return;

    setIsProcessing(true);
    try {
        if (action === 'repair') {
            const count = await repairSyncQueue();
            toast.success(`${count} éléments réparés`);
        } else if (action === 'clear_cache') {
            await db.households.clear();
            await db.syncOutbox.clear();
            localStorage.removeItem('ged-os-terrain-sync-cache');
            toast.success('Cache local vidé');
            setTimeout(() => window.location.reload(), 1000);
        } else if (action.startsWith('purge_server_')) {
            const entity = action.replace('purge_server_', '');
            await apiClient.delete(`sync/clear/${entity}`, { data: { password } });
            if (entity === 'households' || entity === 'all') await db.households.clear();
            toast.success(`Données '${entity}' purgées du serveur et du local.`);
        }
    } catch (e: any) {
        logger.error('Maintenance error', e);
        toast.error(e?.response?.data?.error || 'Erreur maintenance');
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 🚀 TOP HUD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
            <Zap size={28} fill="currentColor" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              Data Hub <span className="text-blue-500">Pro</span>
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase text-emerald-400">
                <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${connectionStatus === 'connected' ? 'animate-pulse' : 'opacity-50'}`} />
                {connectionStatus === 'connected' ? 'Serveur Online' : 'Hors-ligne'}
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                v3.0 • {dataCount} Ménages
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
          <button
            onClick={() => setIsAutoSyncEnabled(!isAutoSyncEnabled)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all ${isAutoSyncEnabled ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            {isAutoSyncEnabled ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-[10px] font-black uppercase tracking-widest">
              {isAutoSyncEnabled ? 'Auto-Sync ON' : 'Auto-Sync OFF'}
            </span>
          </button>
          <button
            onClick={() => void handleSyncData()}
            disabled={syncStatus === 'syncing'}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl transition-all border border-white/5"
          >
            <RefreshCw size={18} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 📑 NAVIGATION TABS */}
      <div className="flex gap-2 border-b border-white/5 pb-1 overflow-x-auto no-scrollbar">
        {(['flux', 'import', 'projects', 'backups', 'maintenance'] as HubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activeTabHub" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* 🖼️ TAB CONTENT */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-8"
          >
            {/* 🌊 FLUX & KOBO */}
            {activeTab === 'flux' && (
              <div className="space-y-8">
                {/* 🎚️ SOURCE SELECTOR (PLAN B) */}
                <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${collectSource === 'kobo' ? 'bg-blue-600/20 text-blue-400' : 'bg-emerald-600/20 text-emerald-400'}`}>
                         {collectSource === 'kobo' ? <Globe size={24} /> : <Zap size={24} />}
                      </div>
                      <div>
                         <h3 className="text-white font-black uppercase tracking-widest text-sm">
                            Source de Collecte : <span className={collectSource === 'kobo' ? 'text-blue-400' : 'text-emerald-400'}>{collectSource === 'kobo' ? 'KoBoToolbox' : 'GedToolbox'}</span>
                         </h3>
                         <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                            {collectSource === 'kobo' ? 'Récupération via API externe KoBo' : 'Plan B : Utilisation des formulaires internes GEM'}
                         </p>
                      </div>
                   </div>
                   
                   <div 
                      onClick={toggleCollectSource}
                      className="relative w-48 h-12 bg-black/40 rounded-full p-1 cursor-pointer border border-white/5 group overflow-hidden"
                   >
                      <div className={`absolute inset-y-1 transition-all duration-500 rounded-full ${collectSource === 'kobo' ? 'left-1 right-24 bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'left-24 right-1 bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.5)]'}`} />
                      <div className="relative z-10 h-full flex items-center justify-between px-4">
                         <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${collectSource === 'kobo' ? 'text-white' : 'text-slate-500'}`}>KoBo</span>
                         <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${collectSource !== 'kobo' ? 'text-white' : 'text-slate-500'}`}>GedToolbox</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-slate-900/30 p-8 rounded-[2rem] border border-white/5 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                      <RefreshCw size={24} />
                    </div>
                    <div>
                      <h3 className="text-white font-black uppercase tracking-widest text-sm">Sync Statut</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Dernière sync : {lastSync ? lastSync.toLocaleTimeString() : 'Jamais'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ménages</p>
                      <p className="text-2xl font-black text-white mt-1">{dataCount}</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">En attente</p>
                      <p className="text-2xl font-black text-blue-500 mt-1">0</p>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleSyncData()}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-900/10"
                  >
                    Synchroniser maintenant
                  </button>
                </div>

                <div className="bg-slate-900/30 p-8 rounded-[2rem] border border-white/5 space-y-6 relative overflow-hidden">
                  {collectSource !== 'kobo' && (
                    <div className="absolute top-0 right-0 px-4 py-1 bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl z-20">
                       Plan B Actif
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${collectSource === 'kobo' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {collectSource === 'kobo' ? <Cloud size={24} /> : <Zap size={24} />}
                    </div>
                    <div>
                      <h3 className="text-white font-black uppercase tracking-widest text-sm">
                         {collectSource === 'kobo' ? 'KoboToolbox' : 'GedToolbox'}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                         {collectSource === 'kobo' 
                            ? `Étape : ${koboStep === 0 ? 'Prêt' : koboStep === 1 ? 'Connexion' : koboStep === 2 ? 'Calcul' : 'Terminé'}`
                            : 'Collecte Interne Active'}
                      </p>
                    </div>
                  </div>

                  {koboStep === 3 && koboResult && collectSource === 'kobo' && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl grid grid-cols-3 gap-2">
                       <div className="text-center">
                          <p className="text-[8px] font-black text-emerald-400 uppercase">Appliqués</p>
                          <p className="text-lg font-black text-white">{koboResult.applied}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Ignorés</p>
                          <p className="text-lg font-black text-white">{koboResult.skipped}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[8px] font-black text-rose-400 uppercase">Erreurs</p>
                          <p className="text-lg font-black text-white">{koboResult.errors}</p>
                       </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full animate-pulse ${collectSource === 'kobo' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${collectSource === 'kobo' ? 'text-blue-400' : 'text-emerald-400'}`}>
                             {collectSource === 'kobo' ? 'Écoute Kobo' : 'Écoute Interne'}
                          </span>
                       </div>
                       <div className={`px-2 py-0.5 border rounded-md text-[8px] font-black uppercase transition-all ${collectSource === 'kobo' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                          Auto-Sync: 5m
                       </div>
                    </div>
                    <button
                        onClick={() => void handleKoboSync(false)}
                        disabled={isProcessing}
                        className={`w-full py-4 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 ${collectSource === 'kobo' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'}`}
                    >
                        {isProcessing ? (
                          <div className="flex items-center justify-center gap-3">
                            <RefreshCw className="animate-spin" size={14} />
                            <span>Traitement...</span>
                          </div>
                        ) : collectSource === 'kobo' ? 'Synchroniser Kobo' : 'Synchroniser GedToolbox'}
                    </button>
                    <p className="text-[9px] text-slate-500 font-medium text-center px-4 leading-relaxed uppercase tracking-wider">
                       {collectSource === 'kobo' 
                          ? 'Récupère les dernières soumissions non encore synchronisées.'
                          : 'Force le rafraîchissement des données collectées via l\'application.'}
                    </p>

                    <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                       <button
                           onClick={() => void handleKoboSync(true)}
                           disabled={isProcessing}
                           className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all py-1 ${collectSource === 'kobo' ? 'text-slate-400 hover:text-blue-400' : 'text-slate-400 hover:text-emerald-400'}`}
                       >
                           {collectSource === 'kobo' ? 'Forcer une synchronisation totale' : 'Réindexer toutes les soumissions'}
                       </button>
                       <p className="text-[8px] text-slate-600 font-medium text-center uppercase tracking-tighter">
                          {collectSource === 'kobo'
                             ? "Réanalyse l'intégralité du formulaire (plus lent, utile en cas d'erreurs)."
                             : "Recalcule tous les ménages à partir des formulaires GedToolbox."}
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* 📥 IMPORT SECTION */}
            {activeTab === 'import' && (
              <div className="max-w-3xl mx-auto">
                 <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group border-2 border-dashed border-white/10 hover:border-blue-500/50 bg-white/[0.02] hover:bg-blue-500/[0.02] rounded-[3rem] p-16 text-center transition-all cursor-pointer relative overflow-hidden"
                 >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".xlsx,.xls,.csv" 
                        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                    />
                    <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-6 group-hover:scale-110 transition-transform">
                        <Upload size={32} />
                    </div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">Glisser-déposer vos fichiers</h4>
                    <p className="text-sm text-slate-500 font-bold mt-2 uppercase tracking-widest">Excel (xlsx) ou CSV supportés</p>
                    <p className="text-[10px] text-slate-600 font-medium mt-4 uppercase tracking-[0.2em] max-w-md mx-auto leading-relaxed">
                       Importez manuellement vos données. Le système détectera automatiquement les colonnes et les distribuera dans les bons projets.
                    </p>
                    <div className="mt-8 flex justify-center gap-4">
                        <span className="px-4 py-2 rounded-xl bg-black/40 border border-white/5 text-[10px] font-black text-slate-400 uppercase">Detection auto</span>
                        <span className="px-4 py-2 rounded-xl bg-black/40 border border-white/5 text-[10px] font-black text-slate-400 uppercase">Multi-projets</span>
                    </div>
                 </div>
              </div>
            )}

            {/* 📁 PROJECTS SECTION */}
            {activeTab === 'projects' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects?.map((p: any) => (
                        <div key={p.id} className={`p-6 rounded-3xl border transition-all ${p.id === activeProjectId ? 'bg-blue-600 border-blue-400 shadow-xl shadow-blue-900/20' : 'bg-slate-900/30 border-white/5 hover:bg-white/5'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <Database size={20} className={p.id === activeProjectId ? 'text-white' : 'text-blue-500'} />
                                {p.id === activeProjectId && <StatusBadge status="success" label="Actif" />}
                            </div>
                            <h4 className={`font-black uppercase tracking-tight text-lg ${p.id === activeProjectId ? 'text-white' : 'text-slate-200'}`}>{p.name}</h4>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${p.id === activeProjectId ? 'text-blue-100' : 'text-slate-500'}`}>{p.id.slice(0, 8)}</p>
                            
                            <div className="mt-6 flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setActiveProjectId(p.id)}
                                        className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${p.id === activeProjectId ? 'bg-white text-blue-600' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                                    >
                                        {p.id === activeProjectId ? 'Actuel' : 'Basculer'}
                                    </button>
                                    <button 
                                        disabled={p.id === activeProjectId}
                                        onClick={() => window.confirm('Supprimer ?') && deleteProject(p.id)}
                                        className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-30"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter text-center">
                                   {p.id === activeProjectId 
                                      ? "Ce projet reçoit les données synchronisées." 
                                      : "Cliquer pour définir ce projet comme cible active."}
                                </p>
                            </div>
                        </div>
                    ))}
                    <button 
                        onClick={async () => {
                            const name = prompt('Nom du projet :');
                            if (name) await createProject(name);
                        }}
                        className="p-6 rounded-3xl border border-dashed border-white/10 hover:border-blue-500/50 bg-white/[0.02] hover:bg-blue-500/[0.02] flex flex-col items-center justify-center gap-3 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-all">
                            <Plus size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">Nouveau Projet</span>
                        <p className="text-[8px] text-slate-600 font-bold uppercase mt-2 tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                           Créer un espace de travail vierge
                        </p>
                    </button>
                </div>
            )}

            {/* 💾 BACKUPS SECTION */}
            {activeTab === 'backups' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="flex items-center justify-between">
                        <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-3">
                            <History size={20} className="text-amber-500" /> Points de Restauration
                        </h3>
                        <button 
                            onClick={handleCreateBackup}
                            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all"
                        >
                            Créer un point maintenant
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {backups.length > 0 ? backups.map((b) => (
                            <div key={b.id} className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                                        <Database size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">{new Date(b.date).toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{b.count} Enregistrements • {b.id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleMaintenance('restore')}
                                        className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const data = localStorage.getItem(`gem_backup_data_${b.id}`);
                                            if (data) {
                                                const blob = new Blob([data], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `backup_${b.id}.json`;
                                                a.click();
                                            }
                                        }}
                                        className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const list = backups.filter(bk => bk.id !== b.id);
                                            localStorage.setItem('gem_households_backups', JSON.stringify(list));
                                            localStorage.removeItem(`gem_backup_data_${b.id}`);
                                            setBackups(list);
                                        }}
                                        className="p-2.5 rounded-xl bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem] opacity-30">
                                <Database size={40} className="mx-auto mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Aucune sauvegarde trouvée</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ⚠️ MAINTENANCE SECTION */}
            {activeTab === 'maintenance' && (
                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/30 p-8 rounded-[2rem] border border-white/5 space-y-4">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                            <WrenchIcon size={24} />
                        </div>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm">Réparation Locale</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-bold">Nettoie les doublons et répare les files de synchronisation corrompues dans votre navigateur.</p>
                        <button 
                            onClick={() => handleMaintenance('repair')}
                            className="w-full py-4 bg-amber-600/10 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-600/20 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                        >
                            Lancer la réparation
                        </button>
                    </div>

                    <div className="bg-slate-900/30 p-8 rounded-[2rem] border border-white/5 space-y-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm">Vider le Cache</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-bold">Supprime toutes les données locales pour forcer un rechargement complet depuis le serveur.</p>
                        <button 
                            onClick={() => handleMaintenance('clear_cache')}
                            className="w-full py-4 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/20 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                        >
                            Vider le cache local
                        </button>
                    </div>

                    <div className="bg-rose-500/5 p-8 rounded-[2rem] border border-rose-500/10 space-y-4 md:col-span-2">
                        <div className="flex items-center gap-4 text-rose-500">
                            <AlertTriangle size={32} />
                            <div>
                                <h3 className="font-black uppercase tracking-widest text-lg">Zone de Danger Nucléaire</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Actions irréversibles sur le serveur central</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                            <button 
                                onClick={() => void handleMaintenance('purge_server_households')}
                                className="py-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                            >
                                Purger les ménages serveur
                            </button>
                            <button 
                                onClick={() => void handleMaintenance('purge_server_zones')}
                                className="py-4 bg-rose-600/20 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                            >
                                Purger les zones serveur
                            </button>
                            <button 
                                onClick={() => void handleMaintenance('purge_server_grappes')}
                                className="py-4 bg-rose-600/20 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                            >
                                Purger les grappes serveur
                            </button>
                            <button 
                                onClick={() => void handleMaintenance('purge_server_all')}
                                className="py-4 bg-black border border-rose-600 text-rose-500 hover:bg-rose-600 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                            >
                                Reset Complet Serveur
                            </button>
                        </div>
                    </div>
                </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ⚙️ ADVANCED SETTINGS COLLAPSIBLE */}
      <div className="pt-8 border-t border-white/5">
        <button
          onClick={() => setIsConfiguring(!isConfiguring)}
          className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all"
        >
          {isConfiguring ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Configuration Avancée du Hub
        </button>

        <AnimatePresence>
          {isConfiguring && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Fréquence Auto-Sync</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(parseInt(e.target.value))}
                      className="flex-1 accent-blue-600"
                    />
                    <span className="text-xs font-black text-white w-12">{syncInterval}m</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Import Mode</label>
                  <div className="flex p-1 rounded-xl bg-slate-900 border border-white/5">
                    <button 
                        onClick={() => setUseServerImport(true)}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${useServerImport ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Serveur
                    </button>
                    <button 
                        onClick={() => setUseServerImport(false)}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${!useServerImport ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Hybride
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">URL Kobo Server</label>
                  <input
                    type="text"
                    defaultValue="https://kf.kobotoolbox.org"
                    className="w-full px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-bold focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
