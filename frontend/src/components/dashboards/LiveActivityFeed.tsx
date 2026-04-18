import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  action: string;
  resource: string;
  timestamp: string;
  details: any;
  user: {
    name: string;
    role: string;
  };
}

export default function LiveActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-30">
        <Activity size={32} className="mb-2" />
        <p className="text-xs font-black uppercase tracking-widest">Aucune activité récente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      <AnimatePresence initial={false}>
        {activities.map((act, i) => {
          // Logic for custom display based on action type
          let actionLabel = act.action.replace(/_/g, ' ');
          let accentColor = 'bg-indigo-500';
          let iconBg = 'bg-indigo-500/10';
          let iconColor = 'text-indigo-500';

          if (act.action.includes('MAÇON')) {
            actionLabel = 'Génie Civil / Maçonnerie';
            accentColor = 'bg-amber-500';
            iconBg = 'bg-amber-500/10';
            iconColor = 'text-amber-500';
          } else if (act.action.includes('RÉSEAU')) {
            actionLabel = 'Construction Réseau';
            accentColor = 'bg-blue-500';
            iconBg = 'bg-blue-500/10';
            iconColor = 'text-blue-500';
          } else if (act.action.includes('ÉLECTRICITÉ')) {
            actionLabel = 'Installations Intérieures';
            accentColor = 'bg-violet-500';
            iconBg = 'bg-violet-500/10';
            iconColor = 'text-violet-500';
          } else if (act.action.includes('LOGISTIQUE')) {
            actionLabel = 'Logistique & Livraison';
            accentColor = 'bg-emerald-500';
            iconBg = 'bg-emerald-500/10';
            iconColor = 'text-emerald-500';
          }

          return (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative pl-6 pb-4 border-l border-slate-200 dark:border-white/5 last:pb-0"
            >
              {/* Dot */}
              <div
                className={`absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full ${accentColor} shadow-lg`}
              />

              <div className="bg-white dark:bg-slate-900/5 border border-slate-100 dark:border-white/5 rounded-2xl p-4 hover:shadow-lg transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center`}
                    >
                      <Zap size={12} />
                    </div>
                    <span className={`text-xs font-black uppercase tracking-tight ${iconColor}`}>
                      {actionLabel}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDistanceToNow(new Date(act.timestamp), { addSuffix: true, locale: fr })}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  <span className="font-black text-slate-700 dark:text-slate-200">
                    {act.user.name}
                  </span>{' '}
                  a synchronisé{' '}
                  <span className="text-indigo-400 font-bold">
                    {act.details?.householdsUpdated || 0}
                  </span>{' '}
                  mises à jour de terrain.
                </p>

                <div className="mt-3 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  <div
                    className={`w-4 h-4 rounded-full ${iconBg} ${iconColor} flex items-center justify-center text-[7px] font-black italic shadow-sm`}
                  >
                    {act.user.name[0]}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Agent Terrain
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
