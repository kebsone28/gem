/* eslint-disable @typescript-eslint/no-explicit-any */
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
  Bug,
  ShieldCheck,
  Terminal,
  Cpu,
  Unplug
} from 'lucide-react';
import { db } from '../store/db';
import { useLiveQuery } from 'dexie-react-hooks';
import apiClient from '../api/client';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { useTheme } from '../contexts/ThemeContext';
import { fmtNum } from '../utils/format';
import { motion, AnimatePresence } from 'framer-motion';

export default function DiagnosticSante() {
  const { isDarkMode } = useTheme();
  const [serverData, setServerData] = useState<any>(null);
  const [systemErrors, setSystemErrors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'server' | 'errors'>('server');
  const [selectedError, setSelectedError] = useState<any>(null);

  // Local Data
  const localLogs = useLiveQuery(() => db.sync_logs.orderBy('id').reverse().limit(50).toArray()) || [];
  const patients = useLiveQuery(() => db.households.toArray()) || [];
  const activeProjectId = safeStorage.getItem('active_project_id');
  const localHouseholds = patients.filter((h) => !activeProjectId || h.projectId === activeProjectId);
  const localZones = useLiveQuery(() => db.zones.toArray()) || [];

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'server') {
        const { data } = await apiClient.get('monitoring/system-health');
        setServerData(data);
      } else if (activeTab === 'errors') {
        const { data } = await apiClient.get('monitoring/system-errors');
        setSystemErrors(data.errors || []);
      }
    } catch (err) {
      logger.error('Failed to fetch diagnostics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const stats = {
    local: {
      households: localHouseholds.length,
      zones: localZones.length,
      errors: localLogs.filter((l) => l.action.toLowerCase().includes('error')).length,
      orphans: localHouseholds.filter((h) => !h.zoneId || !h.projectId).length,
    },
    server: serverData ? {
      dbStatus: serverData?.services?.database?.status ?? 'N/A',
      redisStatus: serverData?.services?.redis?.status ?? 'N/A',
      memoryUsage: serverData?.system?.memory?.usage ?? '---',
      status: serverData?.status ?? 'UNKNOWN',
      uptime: serverData?.system?.uptime ?? 0,
    } : null,
    errors: {
      count: systemErrors.length,
      unresolved: systemErrors.filter(e => !e.isResolved).length
    }
  };

  return (
    <PageContainer className="min-h-screen py-8 bg-[#F8FAFC] dark:bg-slate-950">
      <PageHeader backLink={{ to: '/admin/hub', label: 'Retour au Centre de Contrôle' }}
        title="Santé Système & Diagnostics"
        subtitle="Cockpit de surveillance globale et traçabilité des erreurs"
        icon={<Activity size={24} />}
      />
      
      <ContentArea padding="none" className="bg-transparent border-transparent shadow-none">
        <div className="p-4 sm:p-8 space-y-8">
          
          {/* TOP CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card !p-6 flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Base de Données</p>
                <div className={`w-2 h-2 rounded-full ${stats.server?.dbStatus === 'UP' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 italic">
                  {stats.server?.dbStatus || 'OFFLINE'}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Prisma PostgreSQL Service</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass-card !p-6 flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Mémoire Système</p>
                <Cpu size={14} className="text-indigo-400" />
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 italic">
                  {stats.server?.memoryUsage || '---'}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Utilisation des ressources RAM</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-card !p-6 flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Incidents Actifs</p>
                <Bug size={14} className={stats.errors.unresolved > 0 ? "text-rose-500" : "text-emerald-400"} />
              </div>
              <div className="mt-4">
                <h3 className={`text-2xl font-black flex items-center gap-2 italic ${stats.errors.unresolved > 0 ? "text-rose-500" : "text-white"}`}>
                  {stats.errors.unresolved}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Erreurs non résolues (24h)</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="glass-card !p-6 flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Version Runtime</p>
                <Terminal size={14} className="text-slate-400" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-black text-white italic">
                  {serverData?.version || 'v3.9.0-ENT'}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Environnement GED OS Production</p>
              </div>
            </motion.div>
          </div>

          {/* TABS SELECTOR */}
          <div className="flex bg-slate-900/40 p-1 rounded-2xl w-fit border border-white/5">
            {[
              { id: 'server', label: 'Cloud Diagnostic', icon: Server },
              { id: 'errors', label: 'Journal des Erreurs', icon: Bug },
              { id: 'local', label: 'Terrain (Local)', icon: Terminal },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="glass-card !p-0 overflow-hidden min-h-[500px]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                  {activeTab === 'server' ? <Server className="text-indigo-400" size={18} /> : activeTab === 'errors' ? <Bug className="text-rose-400" size={18} /> : <Terminal className="text-amber-400" size={18} />}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">
                    {activeTab === 'server' ? 'État des Micro-Services' : activeTab === 'errors' ? 'Traçabilité des Incidents SystemError' : 'Logs de Synchronisation Locale'}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                    Flux de données temps réel {isLoading ? '(Mise à jour...)' : ''}
                  </p>
                </div>
              </div>
              <button 
                onClick={fetchData} 
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-slate-900/20">
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest">Horodatage</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest">Catégorie / Code</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest">Détails / Message</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-500 tracking-widest text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="wait">
                    {activeTab === 'errors' && systemErrors.map((error, i) => (
                      <motion.tr 
                        key={error.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                        onClick={() => setSelectedError(error)}
                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <td className="px-8 py-5 text-[10px] font-mono text-slate-400 tabular-nums">
                          {new Date(error.createdAt).toLocaleString()}
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${error.code === 'CLIENT_SIDE_ERROR' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {error.code || 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-400 transition-colors truncate max-w-md">
                            {error.message}
                          </p>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${error.isResolved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500 animate-pulse'}`}>
                            {error.isResolved ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              {error.isResolved ? 'Résolu' : 'ACTIF'}
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}

                    {activeTab === 'server' && serverData && Object.entries(serverData.services).map(([key, service]: [string, any], i) => (
                      <motion.tr 
                        key={key}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-8 py-5 text-[10px] font-mono text-slate-400 uppercase">Service Engine</td>
                        <td className="px-8 py-5">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{key}</span>
                        </td>
                        <td className="px-8 py-5 text-[11px] text-slate-400 font-medium">{service.details}</td>
                        <td className="px-8 py-5 text-right">
                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${service.status === 'UP' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
                            {service.status === 'UP' ? 'ACTIF' : 'DÉFAILLANT'}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                    
                    {activeTab === 'local' && localLogs.map((log, i) => (
                      <motion.tr 
                        key={i}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-8 py-5 text-[10px] font-mono text-slate-400 tabular-nums">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{log.action}</span>
                        </td>
                        <td className="px-8 py-5 text-[11px] text-slate-500 font-mono truncate max-w-xs italic">
                          {JSON.stringify(log.details)}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">SYNCHRONISÉ</span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {activeTab === 'errors' && systemErrors.length === 0 && !isLoading && (
                <div className="py-20 flex flex-col items-center justify-center text-slate-600">
                  <ShieldCheck size={48} className="text-emerald-500/20 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zéro incident détecté</p>
                  <p className="text-[9px] font-bold uppercase mt-1">Le système est parfaitement stable</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentArea>

      {/* ERROR DETAIL MODAL */}
      <AnimatePresence>
        {selectedError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedError.code === 'CLIENT_SIDE_ERROR' ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'}`}>
                    <Bug size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white tracking-widest">Détails de l'incident</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">{selectedError.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedError(null)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400">
                  <Unplug size={18} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Message d'erreur</label>
                  <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-black italic">
                    {selectedError.message}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Code</label>
                    <p className="text-[10px] font-bold text-white uppercase">{selectedError.code || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Date & Heure</label>
                    <p className="text-[10px] font-bold text-white uppercase">{new Date(selectedError.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                {selectedError.context && (
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Contexte de la requête</label>
                    <pre className="p-4 bg-slate-900 rounded-xl border border-white/5 text-[10px] font-mono text-indigo-300 overflow-x-auto">
                      {JSON.stringify(selectedError.context, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedError.stack && (
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Stack Trace (Technique)</label>
                    <pre className="p-4 bg-slate-900 rounded-xl border border-white/5 text-[9px] font-mono text-slate-500 overflow-x-auto whitespace-pre-wrap max-h-48">
                      {selectedError.stack}
                    </pre>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end gap-3">
                <button 
                   className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                   onClick={async () => { 
                     try {
                       await apiClient.patch(`/monitoring/system-errors/${selectedError.id}/resolve`);
                       toast.success('Incident résolu.');
                       fetchData();
                       setSelectedError(null);
                     } catch (err) {
                       toast.error('Erreur lors de la résolution.');
                     }
                   }}
                >
                  Marquer comme Résolu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
