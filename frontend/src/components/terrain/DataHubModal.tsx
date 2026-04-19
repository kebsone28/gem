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
  History,
  RefreshCw,
  Edit2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTerrainData } from '../../hooks/useTerrainData';
import { useSync } from '../../hooks/useSync';
import logger from '../../utils/logger';
import { useTheme } from '../../contexts/ThemeContext';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';
import { syncEventBus, SYNC_EVENTS } from '../../utils/syncEventBus';
import { SyncConflictResolver } from './SyncConflictResolver';
import { db } from '../../store/db';

interface DataHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataHubModal: React.FC<DataHubModalProps> = ({ isOpen, onClose }) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { importHouseholds, repairSyncQueue } = useTerrainData();
  const {
    activeProjectId,
    project,
    createProject,
    projects,
    deleteProject,
    updateProject,
    setActiveProjectId,
  } = useProject();
  const [activeTab, setActiveTab] = useState<'import' | 'kobo' | 'backups' | 'danger' | 'projects'>(
    'import'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [useServerImport, setUseServerImport] = useState(true); // Default to Server for mass imports

  // Nouveaux états UX
  const [importResult, setImportResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [koboStep, setKoboStep] = useState<0 | 1 | 2 | 3>(0); // 0: Idle, 1: Connecting, 2: Applying, 3: Done
  const [koboResult, setKoboResult] = useState<any>(null);

  // Etat des sauvegardes
  const [backups, setBackups] = useState<Array<{ id: string; date: string; count: number }>>([]);

  // Gestion des conflits
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any[]>([]);

  // Modals Custom
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    message: string;
    value: string;
    resolve: ((v: string | null) => void) | null;
  }>({ isOpen: false, message: '', value: '', resolve: null });
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    resolve: ((v: boolean) => void) | null;
  }>({ isOpen: false, title: '', message: '', resolve: null });

  const showPrompt = (message: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({ isOpen: true, message, value: '', resolve });
    });
  };

  const showConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ isOpen: true, title, message, resolve });
    });
  };

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
    } catch (e) {
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
      const name = await showPrompt(
        "Veuillez donner un nom à ce nouveau projet avant d'importer :"
      );
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
          const headers = lines[0].split(',').map((h) => h.trim());
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',').map((v) => v.trim());
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
        throw new Error('Format non supporté');
      }

      const normalizeKey = (key: string) => {
        return key
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
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
        photo: ['photo', 'image', 'picture', 'file', 'media', 'lienphoto'],
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

      const currentProjectId = project?.id || activeProjectId;
      const currentOrgId = project?.organizationId || user?.organization || 'org_test_2026';

      const parsedHouseholds = rawData
        .map((household: any) => {
          const hId = findValue(household, aliases.id);
          if (hId) {
            const status = findValue(household, aliases.status) || 'Non encore installée';
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
              zoneId: 'default_zone',
              organizationId: currentOrgId,
              owner: String(owner).trim(),
              photo: String(photo).trim(),
              phone: String(phone).trim(),
              region: String(region).trim(),
              departement: String(departement).trim(),
              village: String(village).trim(),
              location: {
                type: 'Point' as const,
                coordinates: [lon, lat] as [number, number],
              },
              status: String(status).trim(),
              version: 1,
              updatedAt: new Date().toISOString(),
            };
          }
          return null;
        })
        .filter((h) => h !== null);

      // 🔍 DÉTECTION DES CONFLITS (Optimisée O(n) + Smart Sync)
      const householdsInDb = await db.households.toArray();
      const localMap = new Map(householdsInDb.map((h) => [h.id, h]));

      const detectedConflicts: any[] = [];
      const finalProcessedData: any[] = [];

      for (const imported of parsedHouseholds as any[]) {
        // On marque la source et le temps de modif de l'import
        const remote = {
          ...imported,
          source: 'import',
          lastModified: Date.now(),
        };

        const existing = localMap.get(remote.id);

        if (existing) {
          const diffFields: string[] = [];
          const oldCoords = existing.location?.coordinates || [0, 0];
          const newCoords = remote.location?.coordinates || [0, 0];
          if (
            Math.abs(oldCoords[0] - newCoords[0]) > 0.00001 ||
            Math.abs(oldCoords[1] - newCoords[1]) > 0.00001
          ) {
            diffFields.push('gps');
          }
          if (existing.status !== remote.status) {
            diffFields.push('status');
          }
          if (existing.owner !== remote.owner) {
            diffFields.push('owner');
          }

          if (diffFields.length > 0) {
            // LOGIQUE SMART: Auto-merge si le remote est > 5 min plus récent
            const remoteTime = remote.lastModified || 0;
            const localTime = (existing as any).lastModified || 0;
            const isRemoteNewer = remoteTime > localTime + 5 * 60 * 1000;

            if (isRemoteNewer) {
              finalProcessedData.push(remote); // Auto-accept
            } else {
              detectedConflicts.push({ local: existing, remote, fields: diffFields });
            }
          } else {
            finalProcessedData.push(remote); // Identique, on met à jour le timestamp/source
          }
        } else {
          finalProcessedData.push(remote); // Nouveau
        }
      }

      if (detectedConflicts.length > 0) {
        setConflicts(detectedConflicts);
        setPendingImportData(finalProcessedData);
        setIsConflictModalOpen(true);
      } else {
        await finalizeImport(finalProcessedData);
      }
    } catch (err) {
      logger.error("Erreur d'import", err);
      setImportResult({
        type: 'error',
        message: "Erreur lors de l'import : Vérifiez le format du fichier.",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const finalizeImport = async (finalData: any[]) => {
    setIsProcessing(true);
    try {
      const currentProjectId = project?.id || activeProjectId;

      if (useServerImport) {
        // 🚀 DIRECT SERVER IMPORT (FAST)
        toast.loading(`Envoi de ${finalData.length} ménages au serveur...`, { id: 'bulk-import' });
        const response = await apiClient.post('sync/import-bulk', { households: finalData });
        toast.success(response.data.message || 'Import serveur réussi !', { id: 'bulk-import' });

        // On met quand même à jour localement pour l'affichage immédiat
        await db.households.bulkPut(finalData);
      } else {
        // 📱 LOCAL PWA IMPORT (OFFLINE-FIRST)
        await importHouseholds(finalData);
        setImportResult({
          type: 'success',
          message: `✅ Import local réussi (${finalData.length} ménages).`,
        });
        await forceSync();
      }

      syncEventBus.emit(SYNC_EVENTS.IMPORT_COMPLETE, {
        projectId: currentProjectId,
        householdCount: finalData.length,
        timestamp: new Date(),
      });
    } catch (e: any) {
      console.error('Erreur finalisation import:', e);
      toast.error(e?.response?.data?.error || "Erreur lors de la finalisation de l'import.", {
        id: 'bulk-import',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKoboSync = async (force: boolean = false) => {
    const currentProjectId = project?.id || activeProjectId;

    if (!currentProjectId) {
      toast.error("Veuillez d'abord sélectionner ou créer un espace de travail actif.");
      return;
    }

    setIsProcessing(true);
    setKoboStep(1);
    try {
      await apiClient.post('sync/kobo', {
        projectId: currentProjectId,
        force: force,
      });
      setKoboStep(2);
      await forceSync();

      syncEventBus.emit(SYNC_EVENTS.KOBO_SYNC_COMPLETE, { timestamp: new Date() });
      setKoboStep(3);
      const statusRes = await apiClient.get('kobo/status');
      setKoboResult(statusRes.data?.lastResult || { applied: 0, skipped: 0, errors: 0 });
    } catch (e: any) {
      console.error('[KOBO] Erreur de synchronisation:', e);
      setKoboStep(0);
      toast.error(e?.response?.data?.message || 'Erreur de synchronisation Kobo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRepairSync = async () => {
    setIsProcessing(true);
    try {
      const count = await repairSyncQueue();
      if (count > 0) {
        await forceSync();
        toast.success(`${count} ménages synchronisés.`);
      } else {
        toast.success('Aucun ménage orphelin détecté.');
      }
    } catch (e) {
      toast.error('Erreur réparation.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearData = async () => {
    const confirmed = await showConfirm('⚠️ ATTENTION', 'Effacer toutes les données locales ?');
    if (!confirmed) return;

    const password = await showPrompt(
      'Veuillez saisir votre mot de passe pour confirmer le nettoyage local :'
    );
    if (!password) return;

    setIsProcessing(true);
    try {
      await apiClient.post('auth/verify-password', { password });
      await db.households.clear();
      await db.grappes.clear();
      await db.syncOutbox.clear();
      await db.zones.clear();
      localStorage.clear();
      toast.success('✅ Base effacée ! Rechargement...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast.error('Erreur nettoyage.');
      setIsProcessing(false);
    }
  };

  const handleClearServerEntity = async (entity: string) => {
    const confirmed = await showConfirm(
      '⚠️ DANGER SÉVÈRE',
      `Voulez-vous VRAIMENT supprimer définitivement ce type de données (${entity}) de la base centrale du SERVEUR et en local ?`
    );
    if (!confirmed) return;

    const password = await showPrompt(
      'Veuillez saisir votre mot de passe administrateur pour confirmer cette action nucléaire :'
    );
    if (!password) return;

    setIsProcessing(true);
    try {
      await apiClient.delete(`sync/clear/${entity}`, { data: { password } });
      if (entity === 'households' || entity === 'all') await db.households.clear();
      if (entity === 'grappes' || entity === 'all') await db.grappes.clear();
      if (entity === 'zones' || entity === 'all') await db.zones.clear();
      toast.success(`✅ Données '${entity}' supprimées du serveur et du cache.`);
    } catch (err: any) {
      toast.error(`Erreur serveur: ${err?.message || 'Inconnue'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsProcessing(true);
    try {
      const data = await db.households.toArray();
      if (data.length === 0) {
        toast.error('Aucune donnée.');
        return;
      }
      const bkpId = `bkp_${Date.now()}`;
      localStorage.setItem(`gem_backup_data_${bkpId}`, JSON.stringify(data));
      const list = JSON.parse(localStorage.getItem('gem_households_backups') || '[]');
      list.unshift({ id: bkpId, date: new Date().toISOString(), count: data.length });
      localStorage.setItem('gem_households_backups', JSON.stringify(list));
      setBackups(list);
      toast.success('Sauvegarde créée.');
    } catch (e) {
      toast.error('Erreur sauvegarde.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreBackup = async (id: string) => {
    if (!(await showConfirm('Restauration', 'Écraser les données ?'))) return;
    setIsProcessing(true);
    try {
      const data = JSON.parse(localStorage.getItem(`gem_backup_data_${id}`) || '[]');
      await db.households.clear();
      await db.households.bulkPut(data);
      toast.success('Restauration terminée.');
    } catch (e) {
      toast.error('Erreur restauration.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBackup = (id: string) => {
    localStorage.removeItem(`gem_backup_data_${id}`);
    const list = backups.filter((b) => b.id !== id);
    localStorage.setItem('gem_households_backups', JSON.stringify(list));
    setBackups(list);
  };

  const handleDownloadBackup = (id: string) => {
    const data = localStorage.getItem(`gem_backup_data_${id}`);
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${id}.json`;
    a.click();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div
            key="data-hub-overlay"
            className="fixed inset-0 z-[3000] flex items-center justify-center p-2 md:p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-4xl h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border ${isDarkMode ? 'bg-[#0A101D] border-slate-800/50' : 'bg-white border-slate-200'}`}
            >
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-800/50 shrink-0 bg-white/5">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                    <Database size={20} className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <h2
                    className={`text-base md:text-xl font-black uppercase tracking-widest italic ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                  >
                    Data Hub
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="p-2 md:p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                >
                  <X size={20} className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="flex flex-row md:flex-col w-full md:w-64 p-2 md:p-4 border-b md:border-b-0 md:border-r border-slate-800/50 shrink-0 gap-2 overflow-x-auto md:overflow-y-auto bg-black/20 scrollbar-hide">
                  {[
                    { id: 'import', label: 'Import', icon: <Upload size={16} /> },
                    { id: 'kobo', label: 'Kobo Sync', icon: <RefreshCcw size={16} /> },
                    { id: 'projects', label: 'Projets', icon: <Database size={16} /> },
                    { id: 'backups', label: 'Sauvegardes', icon: <History size={16} /> },
                    {
                      id: 'danger',
                      label: 'Danger',
                      icon: <AlertTriangle size={16} />,
                      color: 'text-rose-500 hover:bg-rose-500/10',
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-xl text-[10px] md:text-sm font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : tab.color || 'text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10'}`}
                    >
                      {tab.icon} <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#0A101D]">
                  {activeTab === 'import' && (
                    <div className="space-y-4 md:space-y-6">
                      <div
                        className={`p-6 md:p-10 border-2 border-dashed rounded-3xl flex flex-col items-center transition-all ${isDragActive ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' : 'border-slate-700 hover:border-indigo-400'}`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <Upload
                          size={48}
                          className={`mb-4 transition-colors ${isDragActive ? 'text-indigo-400 align-bounce' : 'text-slate-600'}`}
                        />
                        <p className="text-sm font-bold text-slate-300 mb-6 text-center italic uppercase tracking-widest">
                          {isDragActive
                            ? 'Lâchez le fichier ici !'
                            : 'Glissez votre fichier Excel ou CSV ici'}
                        </p>
                        <input
                          type="file"
                          aria-label="Sélectionner un fichier Excel ou CSV"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg hover:shadow-indigo-500/25"
                        >
                          Sélectionner Fichier
                        </button>

                        <div className="mt-8 flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                              Mode d'importation
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">
                              {useServerImport
                                ? '🚀 Direct Serveur (Recommandé pour 1000+)'
                                : '📱 Local (Mode déconnecté)'}
                            </span>
                          </div>
                          <button
                            onClick={() => setUseServerImport(!useServerImport)}
                            title="Basculer entre l'import local et l'import direct serveur"
                            aria-label="Basculer le mode d'importation"
                            className={`relative w-12 h-6 rounded-full transition-colors ${useServerImport ? 'bg-indigo-600' : 'bg-slate-700'}`}
                          >
                            <div
                              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${useServerImport ? 'translate-x-6' : ''}`}
                            />
                          </button>
                        </div>
                      </div>
                      {importResult && (
                        <div
                          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-3 ${importResult.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'}`}
                        >
                          {importResult.type === 'success' ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                          {importResult.message}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'kobo' && (
                    <div className="flex flex-col items-center justify-center p-4 md:p-10 text-center">
                      <RefreshCcw
                        size={48}
                        className={`text-indigo-500 mb-4 md:mb-6 ${isProcessing ? 'animate-spin' : ''}`}
                      />
                      <h3 className="text-white font-black italic uppercase text-base md:text-lg mb-2">
                        Synchronisation Kobo
                      </h3>

                      {!isProcessing && koboStep === 0 && (
                        <>
                          <p className="text-slate-500 text-xs mb-8 uppercase tracking-widest">
                            Récupérez les nouveaux ménages du serveur
                          </p>
                          <div className="w-full max-w-xs space-y-4">
                            <button
                              disabled={isProcessing}
                              onClick={() => handleKoboSync(false)}
                              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-3"
                            >
                              <RefreshCcw
                                className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`}
                              />
                              {isProcessing ? 'Synchronisation...' : 'Lancer la Synchronisation'}
                            </button>

                            <button
                              disabled={isProcessing}
                              onClick={() => handleKoboSync(true)}
                              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              Forcer une synchronisation totale
                            </button>
                          </div>
                        </>
                      )}

                      {koboStep > 0 && (
                        <div className="w-full max-w-sm mt-6 space-y-4">
                          <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-white/5 border border-white/10">
                            <div
                              className={`w-3 h-3 rounded-full ${koboStep >= 1 ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-slate-700'}`}
                            />
                            <div
                              className={`text-xs font-bold uppercase tracking-widest ${koboStep >= 1 ? 'text-white' : 'text-slate-500'}`}
                            >
                              Connexion au serveur
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-white/5 border border-white/10">
                            <div
                              className={`w-3 h-3 rounded-full ${koboStep >= 2 ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-slate-700'}`}
                            />
                            <div
                              className={`text-xs font-bold uppercase tracking-widest ${koboStep >= 2 ? 'text-white' : 'text-slate-500'}`}
                            >
                              Application locale
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <div
                              className={`w-3 h-3 rounded-full ${koboStep >= 3 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-700'}`}
                            />
                            <div
                              className={`text-xs font-bold uppercase tracking-widest ${koboStep >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}
                            >
                              Terminé
                            </div>
                          </div>

                          {koboResult && koboStep === 3 && (
                            <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10 text-left">
                              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                                Bilan de l'opération
                              </p>
                              <p className="text-white text-xs font-mono mb-4">
                                {JSON.stringify(koboResult)}
                              </p>

                              <button
                                onClick={() => {
                                  setKoboStep(0);
                                  setKoboResult(null);
                                }}
                                className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                Réinitialiser / Recommencer
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'projects' && (
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6 p-4 md:p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl">
                        <div>
                          <h3 className="text-indigo-400 font-black italic uppercase text-sm">
                            Espaces de travail
                          </h3>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                            Gérez vos différentes zones
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              const confirmed = await showConfirm(
                                '🛠️ MAINTENANCE',
                                'Voulez-vous forcer la synchronisation de la liste des projets depuis le serveur ? Cela nettoiera les projets fantômes.'
                              );
                              if (!confirmed) return;

                              setIsProcessing(true);
                              try {
                                const res = await apiClient.get('/projects');
                                const serverProjects = res.data?.projects || [];
                                await db.projects.clear();
                                for (const sp of serverProjects) {
                                  await db.projects.put(sp);
                                }
                                toast.success('Liste des projets synchronisée');
                              } catch (err) {
                                toast.error('Erreur de synchronisation');
                              } finally {
                                setIsProcessing(false);
                              }
                            }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] uppercase font-black tracking-widest text-white/50 hover:text-white rounded-xl transition-all flex items-center gap-2"
                          >
                            <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
                            Synchroniser
                          </button>
                          <button
                            onClick={async () => {
                              const name = await showPrompt('Nom du nouveau projet :');
                              if (name) await createProject(name);
                            }}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/10 text-[10px] uppercase font-black tracking-widest text-white rounded-xl transition-all"
                          >
                            + Nouveau Projet
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {projects
                          ?.sort((a: any) => (a.id === activeProjectId ? -1 : 1))
                          .map((p: any) => {
                            const isActive = p.id === activeProjectId;
                            const userRole = user?.role?.toUpperCase();
                            const userEmail = user?.email?.toLowerCase();
                            const canSwitch =
                              ['ADMIN_PROQUELEC', 'DG_PROQUELEC', 'COMPTABLE', 'ADMIN'].includes(
                                userRole || ''
                              ) ||
                              userEmail === 'admingem' ||
                              userEmail?.includes('admin@proquelec.com');

                            return (
                              <button
                                key={p.id}
                                onClick={async () => {
                                  if (isActive) return;
                                  if (!canSwitch) {
                                    toast.error(
                                      "Seuls l'Admin, le DG ou le Comptable peuvent changer d'espace de travail."
                                    );
                                    return;
                                  }
                                  const confirmed = await showConfirm(
                                    'Changer de projet',
                                    `Voulez-vous basculer sur le projet "${p.name}" ?`
                                  );
                                  if (confirmed) {
                                    setActiveProjectId(p.id);
                                    toast.success(`Direction le projet : ${p.name}`);
                                  }
                                }}
                                className={`group relative flex flex-col text-left p-6 transition-all duration-300 rounded-[32px] border-2 ${
                                  isActive
                                    ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-[1.02] ring-4 ring-indigo-500/10'
                                    : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/8 outline-none'
                                } ${!canSwitch && !isActive ? 'opacity-60 grayscale-[0.5]' : ''}`}
                              >
                                <div className="flex items-center justify-between w-full mb-4">
                                  <div className="flex items-center gap-4">
                                    <div
                                      className={`p-3 rounded-2xl transition-transform group-hover:scale-110 ${isActive ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40 text-white' : 'bg-white/5 text-slate-500'}`}
                                    >
                                      <Database size={20} />
                                    </div>
                                    <div>
                                      <div className="font-black text-white text-sm md:text-base uppercase tracking-tighter truncate max-w-[140px]">
                                        {p.name}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                        {isActive ? 'Session Active' : 'Disponible'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isActive && (
                                      <div className="animate-pulse bg-indigo-500 text-[10px] font-black uppercase text-white px-3 py-1 rounded-full shadow-lg shadow-indigo-500/30">
                                        Actif
                                      </div>
                                    )}

                                    {canSwitch && (
                                      <button
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const newName = await showPrompt(
                                            `Nouveau nom pour "${p.name}" :`
                                          );
                                          if (newName && newName !== p.name) {
                                            await updateProject({ name: newName }, p.id);
                                            toast.success('Projet renommé');
                                          }
                                        }}
                                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                                        title="Modifier le nom"
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                    )}

                                    {canSwitch && !isActive && (
                                      <button
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const pwd = await showPrompt(
                                            `Confirmer suppression de "${p.name}" ? Tapez votre mot de passe :`
                                          );
                                          if (pwd) {
                                            const res = await deleteProject(p.id, pwd);
                                            if (res.success) toast.success('Projet supprimé');
                                            else toast.error(res.error || 'Erreur suppression');
                                          }
                                        }}
                                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-500 transition-colors"
                                        title="Supprimer le projet"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-5 mt-auto pt-4 border-t border-white/5">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                                      Zones
                                    </span>
                                    <span
                                      className={`text-xs font-black ${isActive ? 'text-indigo-400' : 'text-white'}`}
                                    >
                                      {p._count?.zones || 0}
                                    </span>
                                  </div>
                                  <div className="flex flex-col border-l border-white/10 pl-5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                                      ID Unique
                                    </span>
                                    <span className="text-[10px] text-white/30 font-mono tracking-tighter">
                                      {p.id.substring(0, 8).toUpperCase()}...
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {activeTab === 'backups' && (
                    <div className="space-y-4">
                      <button
                        onClick={handleCreateBackup}
                        className="w-full p-4 border border-indigo-500/30 text-indigo-400 rounded-2xl font-bold text-xs uppercase"
                      >
                        + Nouvelle Sauvegarde
                      </button>
                      {backups.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between p-4 bg-white/5 rounded-2xl text-xs"
                        >
                          <div className="text-white font-bold">
                            {new Date(b.date).toLocaleDateString()} - {b.count} éléments
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleDownloadBackup(b.id)}
                              className="text-emerald-400"
                              title="Télécharger"
                            >
                              ⬇️
                            </button>
                            <button
                              onClick={() => handleRestoreBackup(b.id)}
                              className="text-indigo-400 hover:text-indigo-300"
                            >
                              Restaurer
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(b.id)}
                              className="text-rose-500 uppercase font-black hover:text-rose-400"
                            >
                              X
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'danger' && (
                    <div className="space-y-4">
                      <div className="p-4 md:p-6 border border-amber-500/20 bg-amber-500/5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-amber-500 font-black italic uppercase tracking-tight text-sm mb-1">
                            Réparation Base
                          </h4>
                          <p className="text-amber-500/60 text-[10px] uppercase font-bold leading-relaxed">
                            Corriger les blocages de synchronisation
                          </p>
                        </div>
                        <button
                          onClick={handleRepairSync}
                          disabled={isProcessing}
                          className="w-full md:w-auto px-6 py-3 bg-amber-600/20 text-amber-500 border border-amber-500/50 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-500 hover:text-slate-900 transition-all"
                        >
                          Réparer Sync
                        </button>
                      </div>

                      <div className="p-4 md:p-8 border-2 border-rose-500/20 bg-rose-500/5 rounded-3xl">
                        <h4 className="text-rose-500 font-black italic uppercase tracking-tight text-base md:text-lg mb-2 md:mb-4">
                          Effacement Complet
                        </h4>
                        <p className="text-rose-500/60 text-[10px] md:text-xs mb-6 md:mb-8 uppercase font-bold leading-relaxed">
                          Cette action détruira irréversiblement toute votre base de données locale.
                        </p>
                        <button
                          onClick={handleClearData}
                          className="w-full md:w-auto px-8 py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 transition-all shadow-lg hover:shadow-rose-500/25"
                        >
                          Tout vider (Cache Local)
                        </button>

                        <div className="mt-8 pt-8 border-t border-rose-500/30">
                          <h5 className="text-rose-400 font-black uppercase text-xs mb-4 flex items-center gap-2">
                            <AlertTriangle size={14} /> Base de données Centrale (Serveur)
                          </h5>
                          <p className="text-rose-500/60 text-[10px] mb-4 uppercase font-bold">
                            ATTENTION: La suppression impactera tous les utilisateurs du SaaS.
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => handleClearServerEntity('households')}
                              className="px-4 py-2 border border-rose-500/50 text-rose-400 rounded-lg text-[10px] uppercase font-bold hover:bg-rose-500 hover:text-white transition-all"
                            >
                              Purger Ménages
                            </button>
                            <button
                              onClick={() => handleClearServerEntity('grappes')}
                              className="px-4 py-2 border border-rose-500/50 text-rose-400 rounded-lg text-[10px] uppercase font-bold hover:bg-rose-500 hover:text-white transition-all"
                            >
                              Purger Grappes
                            </button>
                            <button
                              onClick={() => handleClearServerEntity('zones')}
                              className="px-4 py-2 border border-rose-500/50 text-rose-400 rounded-lg text-[10px] uppercase font-bold hover:bg-rose-500 hover:text-white transition-all"
                            >
                              Purger Zones (+ Ménages)
                            </button>
                            <button
                              onClick={() => handleClearServerEntity('teams')}
                              className="px-4 py-2 border border-rose-500/50 text-rose-400 rounded-lg text-[10px] uppercase font-bold hover:bg-rose-500 hover:text-white transition-all"
                            >
                              Purger Équipes
                            </button>
                            <button
                              onClick={() => handleClearServerEntity('all')}
                              className="px-4 py-2 bg-rose-900 border border-rose-500/50 text-white rounded-lg text-[10px] uppercase font-bold hover:bg-rose-700 transition-all ml-auto"
                            >
                              NUCLÉAIRE (TOUT)
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
        )}
      </AnimatePresence>

      <SyncConflictResolver
        isOpen={isConflictModalOpen}
        conflicts={conflicts}
        onCancel={() => {
          setIsConflictModalOpen(false);
          setConflicts([]);
        }}
        onResolve={async (resolvedData) => {
          const finalData = [...pendingImportData, ...resolvedData];
          await finalizeImport(finalData);
          setIsConflictModalOpen(false);
          setConflicts([]);
        }}
      />

      {/* Custom Modals */}
      {promptState.isOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <p className="text-white font-black italic uppercase text-xs mb-6 tracking-widest">
              {promptState.message}
            </p>
            <input
              autoFocus
              type="text"
              value={promptState.value}
              onChange={(e) => setPromptState({ ...promptState, value: e.target.value })}
              aria-label={promptState.message}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white mb-6 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-4">
              <button
                onClick={() => {
                  promptState.resolve?.(null);
                  setPromptState({ ...promptState, isOpen: false });
                }}
                className="flex-1 p-4 bg-white/5 text-slate-500 font-bold rounded-2xl uppercase text-[10px]"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  promptState.resolve?.(promptState.value);
                  setPromptState({ ...promptState, isOpen: false });
                }}
                className="flex-1 p-4 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px]"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h4 className="text-rose-500 font-black italic uppercase text-xs mb-2">
              {confirmState.title}
            </h4>
            <p className="text-slate-300 text-[11px] font-bold mb-8 uppercase leading-relaxed">
              {confirmState.message}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  confirmState.resolve?.(false);
                  setConfirmState({ ...confirmState, isOpen: false });
                }}
                className="flex-1 p-4 bg-white/5 text-slate-500 font-bold rounded-2xl uppercase text-[10px]"
              >
                Non
              </button>
              <button
                onClick={() => {
                  confirmState.resolve?.(true);
                  setConfirmState({ ...confirmState, isOpen: false });
                }}
                className="flex-1 p-4 bg-rose-600 text-white font-black rounded-2xl uppercase text-[10px]"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
