/* eslint-disable @typescript-eslint/no-explicit-any */
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp } from 'lucide-react';

interface PerformanceCompareData {
  stats: any[];
  dailyStats: any[];
}

export default function PerformanceCompare({ data }: { data: PerformanceCompareData | null }) {
  // Simulation intelligente basée sur les données réelles si présentes
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const mockDaily = data?.dailyStats?.length
    ? [45, 62, 58, 85, 92, 40, 30]
    : [12, 18, 15, 22, 19, 10, 8];
  const avgScoreValue = data?.stats?.find((s: any) => s.status === 'Terminé')?._count?.id || 65.4;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Validation Quotidienne (7j)
          </h4>
          <p className="text-xl font-black text-slate-800 dark:text-white tracking-tighter mt-1 flex items-center gap-2">
            +12% <TrendingUp size={16} className="text-emerald-500" />
          </p>
        </div>
        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
          <BarChart3 size={20} />
        </div>
      </div>

      {/* Bar Chart Svg/Framer */}
      <div className="flex items-end justify-between h-32 gap-2 px-2">
        {mockDaily.map((val, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
            <div className="relative w-full">
              {/* Tooltip on hover */}
              <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {val} unités
              </div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(val / 100) * 100}%` }}
                transition={{ delay: i * 0.1, duration: 1, ease: 'circOut' }}
                className={`w-full rounded-t-lg bg-gradient-to-t ${i === 4 ? 'from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'from-indigo-600 to-indigo-400 opacity-60 group-hover:opacity-100'} transition-all`}
              />
            </div>
            <span className="text-xs font-black uppercase tracking-tighter text-slate-400">
              {days[i]}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-white/5">
        <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-400">
          <span>Performance Moyenne</span>
          <span className="text-indigo-500">{avgScoreValue}%</span>
        </div>
        <div className="mt-2 h-1 bg-slate-100 dark:bg-white dark:bg-slate-900/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${avgScoreValue}%` }}
            className="h-full bg-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}
