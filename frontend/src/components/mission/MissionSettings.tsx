/* eslint-disable @typescript-eslint/no-explicit-any */
import { Settings as SettingsIcon, Map, DollarSign, ListChecks, Sparkles } from 'lucide-react';

interface MissionSettingsProps {
  features: {
    map: boolean;
    expenses: boolean;
    inventory: boolean;
    ai: boolean;
  };
  onToggle: (feature: keyof MissionSettingsProps['features']) => void;
}

export function MissionSettings({ features, onToggle }: MissionSettingsProps) {
  const featureLabels = [
    {
      id: 'map',
      label: 'Mini-Carte SIG',
      icon: Map,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10',
      desc: "Visualisation de l'itinéraire et des grappes.",
    },
    {
      id: 'expenses',
      label: 'Gestion des Frais',
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      desc: 'Carburant, justificatifs et calculs auto.',
    },
    {
      id: 'inventory',
      label: 'Inventaire & Checklist',
      icon: ListChecks,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      desc: 'Matériel emporté et vérifications départ.',
    },
    {
      id: 'ai',
      label: 'Outils IA',
      icon: Sparkles,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      desc: 'Estimation de charge et conclusion auto.',
    },
  ];

  return (
    <div className="glass-card !p-6 !rounded-[2.5rem] space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-4">
        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <SettingsIcon size={20} className="text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Configuration de la Mission
          </h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5 opacity-60">
            Activer ou désactiver les modules experts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {featureLabels.map((f) => (
          <button
            key={f.id}
            onClick={() => onToggle(f.id as any)}
            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 text-left group ${
              features[f.id as keyof typeof features]
                ? 'bg-white dark:bg-slate-800 border-indigo-500/30 shadow-lg shadow-indigo-500/5'
                : 'bg-slate-100/80 dark:bg-slate-900/30 border-transparent opacity-60 grayscale-[0.5] hover:opacity-80 hover:grayscale-0'
            }`}
          >
            <div
              className={`p-3 rounded-xl ${f.bg} ${f.color} transition-transform group-hover:scale-110`}
            >
              <f.icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-black uppercase tracking-wider ${features[f.id as keyof typeof features] ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}
                >
                  {f.label}
                </span>
                <div
                  className={`w-8 h-4 rounded-full relative transition-colors ${features[f.id as keyof typeof features] ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white dark:bg-slate-900 transition-all ${features[f.id as keyof typeof features] ? 'left-4.5' : 'left-0.5'}`}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {f.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
