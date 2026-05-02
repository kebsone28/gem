/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { motion } from 'framer-motion';
import { Target, AlertCircle, CheckCircle2, Map as MapIcon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface MapStatsWidgetProps {
  stats: {
    visible: number;
    completed: number;
    problems: number;
    pending: number;
  };
}

export const MapStatsWidget: React.FC<MapStatsWidgetProps> = ({ stats }) => {
  const { isDarkMode } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`absolute bottom-[132px] left-3 right-3 top-auto z-[1000] max-h-[calc(100dvh-11rem)] overflow-y-auto p-4 rounded-[1.5rem] border shadow-2xl backdrop-blur-xl transition-all md:bottom-auto md:left-auto md:right-6 md:top-24 md:w-64 md:overflow-visible md:p-6 md:rounded-[2rem] ${
        isDarkMode ? 'bg-slate-900/90 border-white/10' : 'bg-white/90 border-slate-200'
      }`}
    >
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <div className="w-8 h-8 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 border border-blue-600/20">
          <Target size={16} />
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-50 italic">
            Analytique
          </h4>
          <p className="text-xs font-black uppercase tracking-tight">Zone Visible</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 md:block md:space-y-4">
          <StatRow
            icon={<MapIcon size={14} />}
            label="Visible"
            value={stats.visible}
            color="text-slate-500"
          />
          <StatRow
            icon={<CheckCircle2 size={14} />}
            label="Raccordés"
            value={stats.completed}
            color="text-emerald-500"
          />
          <StatRow
            icon={<AlertCircle size={14} />}
            label="Anomalies"
            value={stats.problems}
            color="text-rose-500"
          />
        </div>

        <div className="pt-3 md:pt-4 mt-2 border-t border-gray-100 dark:border-white/5">
          <div className="flex justify-between items-end">
            <span className="text-xs font-black uppercase tracking-[0.2em] opacity-40 italic leading-none">
              Taux de Livraison
            </span>
            <span className="text-sm font-black text-blue-600 leading-none">
              {stats.visible > 0 ? Math.round((stats.completed / stats.visible) * 100) : 0}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 dark:bg-white dark:bg-slate-900/10 rounded-full mt-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${stats.visible > 0 ? (stats.completed / stats.visible) * 100 : 0}%`,
              }}
              className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const StatRow = ({
  icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) => (
  <div className="flex flex-col gap-1 rounded-xl bg-black/5 dark:bg-white/[0.03] px-2 py-2 md:flex-row md:items-center md:justify-between md:bg-transparent md:px-0 md:py-0">
    <div className="flex items-center gap-2">
      <span className={`${color} opacity-80`}>{icon}</span>
      <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-60 italic">{label}</span>
    </div>
    <span className="text-sm md:text-xs font-black tabular-nums">{value}</span>
  </div>
);
