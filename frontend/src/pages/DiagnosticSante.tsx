/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, useEffect } from 'react';
import logger from '../utils/logger';
import * as safeStorage from '../utils/safeStorage';
import {
  Activity,
  RefreshCw,
  Database,
  Server,
  Clock,
  FileJson,
  AlertTriangle,
} from 'lucide-react';
import { db } from '../store/db';
import { useLiveQuery } from 'dexie-react-hooks';
import apiClient from '../api/client';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { useTheme } from '../contexts/ThemeContext';
import { fmtNum } from '../utils/format';

export default function DiagnosticSante() {
  const { isDarkMode } = useTheme();
  const [serverData, setServerData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'server'>('local');

  // Local Data
  const localLogs =
    useLiveQuery(() => db.sync_logs.orderBy('id').reverse().limit(50).toArray()) || [];
  const patients = useLiveQuery(() => db.households.toArray()) || [];
  const activeProjectId = safeStorage.getItem('active_project_id');

  // Filtrer les ménages par projet actif pour éviter les doublons (7072 -> 3536)
  const localHouseholds = patients.filter(
    (h) => !activeProjectId || h.projectId === activeProjectId
  );
  const localZones = useLiveQuery(() => db.zones.toArray()) || [];

  const fetchServerHealth = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('monitoring/system-health');
      setServerData(data);
    } catch (err) {
      logger.error('Failed to fetch diagnostics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'server') fetchServerHealth();
  }, [activeTab]);

  const stats = {
    local: {
      households: localHouseholds.length,
      zones: localZones.length,
      errors: localLogs.filter((l) => l.action.toLowerCase().includes('error')).length,
      orphans: localHouseholds.filter((h) => !h.zoneId || !h.projectId).length,
    },
    server: serverData
      ? {
          dbStatus: serverData?.services?.database?.status ?? 'N/A',
          redisStatus: serverData?.services?.redis?.status ?? 'N/A',
          memoryUsage: serverData?.system?.memory?.usage ?? '---',
          status: serverData?.status ?? 'UNKNOWN',
        }
      : null,
  };

  return (
    <PageContainer className="min-h-screen py-8 bg-[#F8FAFC] dark:bg-slate-950">
      <PageHeader
        title="Diagnostic & Santé Système"
        subtitle="Surveillance en temps réel de l'intégrité des raccordements"
        icon={<Activity size={24} />}
      />
      <ContentArea padding="none" className="bg-transparent border-transparent shadow-none">
        <div className="p-8 space-y-10">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                <Activity className="text-white" size={28} />
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter italic text-slate-800 dark:text-white">
                  Diagnostic & Santé Système
                </h2>
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-0.5">
                  Surveillance en temps réel de l'intégrité des raccordements
                </p>
              </div>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('local')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'local' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
              >
                Terminal Terrain (Local)
              </button>
              <button
                onClick={() => setActiveTab('server')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'server' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
              >
                Centre Serveur (Cloud)
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div
              className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}
            >
              <p className="text-xs font-black uppercase text-slate-500 tracking-widest mb-1">
                {activeTab === 'local' ? 'Ménages Locaux' : 'Mémoire Système'}
              </p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-indigo-500 font-mono italic">
                  {activeTab === 'local'
                    ? fmtNum(stats.local.households)
                    : stats.server?.memoryUsage || '---'}
                </span>
                <Database className="mb-2 text-slate-300" size={16} />
              </div>
            </div>
            <div
              className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}
            >
              <p className="text-xs font-black uppercase text-slate-500 tracking-widest mb-1">
                {activeTab === 'local' ? 'Anomalies Liaisons' : 'État Base de Données'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className={`w-3 h-3 rounded-full ${activeTab === 'local' ? (stats.local.orphans > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500') : stats.server?.dbStatus === 'UP' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}
                />
                <span
                  className={`text-xs font-black uppercase tracking-widest ${activeTab === 'local' ? (stats.local.orphans > 0 ? 'text-rose-500' : 'text-emerald-500') : stats.server?.dbStatus === 'UP' ? 'text-emerald-500' : 'text-rose-500'}`}
                >
                  {activeTab === 'local'
                    ? stats.local.orphans > 0
                      ? `${stats.local.orphans} Orphelins`
                      : 'OK'
                    : stats.server?.dbStatus || 'OFFLINE'}
                </span>
              </div>
            </div>
            <div
              className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}
            >
              <p className="text-xs font-black uppercase text-slate-500 tracking-widest mb-1">
                {activeTab === 'local' ? 'Status API' : 'État File Redis (Workers)'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className={`w-3 h-3 rounded-full ${activeTab === 'local' ? 'bg-emerald-500 animate-pulse' : stats.server?.redisStatus === 'UP' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}
                />
                <span
                  className={`text-xs font-black uppercase tracking-widest ${activeTab === 'local' ? 'text-emerald-500' : stats.server?.redisStatus === 'UP' ? 'text-emerald-500' : 'text-rose-500'}`}
                >
                  {activeTab === 'local' ? 'Connecté' : stats.server?.redisStatus || 'OFFLINE'}
                </span>
              </div>
            </div>
            <div
              className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}
            >
              <p className="text-xs font-black uppercase text-slate-500 tracking-widest mb-1">
                Version Logicielle
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Clock size={16} className="text-slate-400" />
                <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                  {serverData?.version || 'SaaS v3.0'}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`rounded-[2.5rem] border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-2xl`}
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-100/80 dark:bg-slate-950/50">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3 italic">
                {activeTab === 'local' ? (
                  <Database className="text-indigo-500" size={20} />
                ) : (
                  <Server className="text-emerald-500" size={20} />
                )}
                {activeTab === 'local'
                  ? 'Historique Global des Synchronisations'
                  : "Journaux d'Audit Serveur (Diagnostic)"}
              </h3>
              <div className="flex gap-2">
                {activeTab === 'local' && (
                  <button
                    onClick={async () => {
                      if (
                        confirm(
                          'Voulez-vous supprimer toutes les données locales et forcer une resynchronisation ?'
                        )
                      ) {
                        await db.households.clear();
                        await db.zones.clear();
                        await db.sync_logs.clear();
                        safeStorage.removeItem('last_sync_timestamp');
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition-all"
                  >
                    Purge Locale
                  </button>
                )}
                <button
                  onClick={activeTab === 'local' ? () => {} : fetchServerHealth}
                  disabled={isLoading}
                  aria-label="Rafraîchir les données"
                  className={`p-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'local' ? 'text-slate-400 hover:text-slate-500' : 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20'} disabled:opacity-50`}
                >
                  <RefreshCw className={isLoading ? 'animate-spin' : ''} size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr
                    className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
                  >
                    <th className="px-8 py-4 text-xs font-black uppercase text-slate-400 tracking-widest">
                      Temps
                    </th>
                    <th className="px-8 py-4 text-xs font-black uppercase text-slate-400 tracking-widest">
                      Action / Diagnostic
                    </th>
                    <th className="px-8 py-4 text-xs font-black uppercase text-slate-400 tracking-widest">
                      Détails Techniques
                    </th>
                    <th className="px-8 py-4 text-xs font-black uppercase text-slate-400 tracking-widest text-right">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {activeTab === 'local'
                    ? localLogs.map((log, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-950/50 transition-colors group"
                        >
                          <td className="px-8 py-5 text-xs font-mono text-slate-400 tabular-nums">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="px-8 py-5">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                              {log.action}
                            </p>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2 max-w-xs truncate">
                              <FileJson size={14} className="text-slate-300" />
                              <span className="text-xs text-slate-500 font-mono">
                                {typeof log.details === 'string'
                                  ? log.details
                                  : JSON.stringify(log.details).slice(0, 50)}
                                ...
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <span
                              className={`px-2 py-1 rounded text-xs font-black uppercase tracking-widest ${
                                log.action.toLowerCase().includes('error')
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {log.action.toLowerCase().includes('error') ? 'Échec' : 'Succès'}
                            </span>
                          </td>
                        </tr>
                      ))
                    : serverData &&
                      Object.entries(serverData.services).map(
                        ([key, service]: [string, any], i) => (
                          <tr
                            key={i}
                            className="hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-950/50 transition-colors"
                          >
                            <td className="px-8 py-5 text-xs font-mono text-slate-400 tabular-nums uppercase">
                              {key}
                            </td>
                            <td className="px-8 py-5">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                                Vérification du service {key}
                              </p>
                            </td>
                            <td className="px-8 py-5 text-xs text-slate-500 italic">
                              {service.details}
                            </td>
                            <td className="px-8 py-5 text-right">
                              <span
                                className={`px-2 py-1 rounded text-xs font-black uppercase tracking-widest ${service.status === 'UP' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}
                              >
                                {service.status === 'UP' ? 'ACTIF' : 'DEFAILLANT'}
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                </tbody>
              </table>
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div
              className={`p-8 rounded-[2rem] border ${isDarkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-amber-500" size={24} />
                <h4 className="text-sm font-black uppercase tracking-widest text-amber-600">
                  Recommandations de Maintenance
                </h4>
              </div>
              <ul className="space-y-3">
                <li className="text-xs text-slate-600 dark:text-slate-400 font-bold flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  {activeTab === 'local'
                    ? stats.local.orphans > 0
                      ? "Action Recommandée: Certains ménages ne sont liés à aucune zone. Vérifiez vos fichiers d'import Excel."
                      : 'Intégrité structurelle parfaite: Tous les ménages sont rattachés à des zones valides.'
                    : stats.server?.status === 'DEGRADED'
                      ? 'Attention: Un service serveur est dégradé. Vérifiez les logs Redis/DB.'
                      : 'Serveur Optimal: Tous les services cloud répondent normalement.'}
                </li>
                {activeTab === 'server' && (serverData?.system?.load?.[0] ?? 0) > 1.5 && (
                  <li className="text-xs text-rose-500 font-bold flex items-start gap-2">
                    <span className="text-rose-500">•</span>
                    Alerte Charge: Le CPU du serveur montre des signes de fatigue. Envisagez une
                    augmentation d'instance.
                  </li>
                )}
              </ul>
            </div>

            <div
              className={`p-8 rounded-[2rem] border ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'} flex items-center justify-between`}
            >
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-1 italic">
                  Guide de Robustesse
                </h4>
                <p className="text-xs text-slate-500 font-bold max-w-sm">
                  Besoin de comprendre comment le système se protège contre les erreurs de
                  synchronisation ?
                </p>
              </div>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Consultez le fichier robustness_guide.md à la racine du projet.');
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
              >
                Lire le Manuel
              </a>
            </div>
          </section>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
