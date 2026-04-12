import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Activity, MapPin, X, ChevronRight, Info, ShieldCheck } from 'lucide-react';

interface AuditAnomaly {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  householdId: string;
  lng?: number;
  lat?: number;
}

interface AuditResult {
  healthScore: number;
  stats: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  anomalies: AuditAnomaly[];
}

interface GisHealthWidgetProps {
  result: AuditResult | null;
  onFlyTo: (lng: number, lat: number, id: string) => void;
  isDarkMode: boolean;
}

const GisHealthWidget: React.FC<GisHealthWidgetProps> = ({ result, onFlyTo, isDarkMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!result) return null;

  const { healthScore, stats, anomalies } = result;

  const getScoreColor = (score: number) => {
    if (score > 95) return 'text-emerald-500';
    if (score > 80) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle size={12} className="text-rose-500 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle size={12} className="text-amber-500 shrink-0" />;
      default:
        return <Info size={12} className="text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-[4000] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`pointer-events-auto w-80 max-h-[450px] rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}
          >
            {/* Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
            >
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-blue-500" />
                <span
                  className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                >
                  Santé GIS (Audit)
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                aria-label="Fermer le panneau d'audit GIS"
                className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-slate-400 font-bold' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X size={14} />
              </button>
            </div>

            {/* Audit Summary Grid */}
            <div
              className={`p-4 grid grid-cols-3 gap-2 border-b ${isDarkMode ? 'border-slate-800 bg-black/20' : 'border-slate-100 bg-slate-100/80'}`}
            >
              <div className="text-center">
                <span className="block text-[14px] font-black text-rose-500">{stats.critical}</span>
                <span className="text-xs font-black uppercase text-slate-500">Critiques</span>
              </div>
              <div className="text-center">
                <span className="block text-[14px] font-black text-amber-500">{stats.warning}</span>
                <span className="text-xs font-black uppercase text-slate-500">Alertes</span>
              </div>
              <div className="text-center">
                <span className="block text-[14px] font-black text-blue-500">{stats.info}</span>
                <span className="text-xs font-black uppercase text-slate-500">Infos</span>
              </div>
            </div>

            {/* Anomalies List */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
              {anomalies.length > 0 ? (
                <div className="space-y-1">
                  {anomalies.map((anno) => (
                    <div
                      key={anno.id}
                      className={`group p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${isDarkMode ? 'bg-slate-800/50 border-white/5 hover:bg-slate-800' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(anno.severity)}
                        <div className="flex-1 flex flex-col gap-0.5">
                          <span
                            className={`text-xs font-black leading-tight uppercase tracking-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}
                          >
                            {anno.message}
                          </span>
                          <span className="text-xs font-mono opacity-50">
                            #{anno.householdId.slice(-8)}
                          </span>
                        </div>
                        {anno.lng && anno.lat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onFlyTo(anno.lng!, anno.lat!, anno.householdId);
                            }}
                            className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all shadow-md"
                            aria-label="Voir sur la carte"
                          >
                            <MapPin size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <ShieldCheck size={32} className="text-emerald-500 opacity-50" />
                  <span className="text-xs font-black uppercase tracking-widest">
                    Aucune anomalie détectée
                  </span>
                </div>
              )}
            </div>

            {/* Footer Notification */}
            <div
              className={`p-4 text-xs font-black uppercase tracking-tighter italic ${isDarkMode ? 'text-slate-500 bg-white/5' : 'text-slate-400 bg-slate-50'}`}
            >
              Scan de {stats.total.toLocaleString()} records terminé.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble Trigger */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`pointer-events-auto p-4 rounded-full shadow-2xl flex items-center gap-3 group transition-all relative ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}
      >
        {/* Visual Ping for Critical errors */}
        {stats.critical > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white dark:border-slate-900"></span>
          </span>
        )}

        <div
          className={`flex flex-col items-start gap-0.5 pr-2 border-r ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
        >
          <span className={`text-[12px] font-black leading-none ${getScoreColor(healthScore)}`}>
            {healthScore}%
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            Santé GIS
          </span>
        </div>

        <Activity
          size={18}
          className={`transition-all ${stats.critical > 0 ? 'text-rose-500 animate-pulse' : 'text-blue-500'}`}
        />

        <ChevronRight
          size={14}
          className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </motion.button>
    </div>
  );
};

export default GisHealthWidget;
