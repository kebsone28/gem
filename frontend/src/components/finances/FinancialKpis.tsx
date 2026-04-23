/* eslint-disable @typescript-eslint/no-explicit-any */
import { DollarSign, Users, Truck, Package, TrendingUp, Target, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { fmtFCFA } from '../../utils/format';
import './FinancialKpis.css';

export default function FinancialKpis({ stats, devis }: { stats: any; devis: any }) {
  const { isDarkMode } = useTheme();

  const includeSupply = !!devis.includeSupplyMode;

  const items = [
    {
      label: 'Coût Total Estimé',
      val: fmtFCFA(stats.total),
      icon: DollarSign,
      color: 'indigo',
      sub: `${fmtFCFA(stats.total / 122)} par ménage (approx)`,
      trend: '+2.1%',
    },
    {
      label: "Main d'Œuvre",
      val: fmtFCFA(stats.teams + stats.supervision),
      icon: Users,
      color: 'blue',
      sub: 'Techniciens & Supervision',
      trend: 'Stable',
    },
    {
      label: 'Logistique',
      val: fmtFCFA(stats.logistics),
      icon: Truck,
      color: 'amber',
      sub: 'Véhicules & Carburant',
      trend: '-5.4%',
    },
    {
      label: 'Matériaux & Stock',
      val: !includeSupply ? 'FOURNI PAR MOQ' : fmtFCFA(stats.materials),
      icon: Package,
      color: !includeSupply ? 'amber' : 'emerald',
      sub: !includeSupply ? 'Valorisation exclue du total' : 'Achat à charge entrepreneur',
      trend: !includeSupply ? 'N/A' : '+1.8%',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
      {items.map((item, i) => (
        <div
          key={i}
          className={`border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 hover:shadow-indigo-100/50'}`}
        >
          <div
            className={`absolute top-0 right-0 p-8 opacity-5 text-indigo-500 group-hover:scale-110 transition-transform`}
          >
            <item.icon size={100} />
          </div>

          <div className="flex items-center justify-between mb-6">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
            >
              <item.icon size={24} />
            </div>
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100 shadow-sm'}`}
            >
              <TrendingUp
                size={12}
                className={item.trend.startsWith('+') ? 'text-emerald-500' : 'text-slate-400'}
              />
              <span
                className={`text-xs font-black ${item.trend.startsWith('+') ? 'text-emerald-500' : 'text-slate-400'}`}
              >
                {item.trend}
              </span>
            </div>
          </div>

          <h4
            className={`text-xs font-black uppercase tracking-[0.2em] mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
          >
            {item.label}
          </h4>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black tracking-tighter transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
              {item.val}
            </span>
          </div>
          <p
            className={`text-xs font-medium mt-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
          >
            {item.sub}
          </p>
        </div>
      ))}

      {/* Global Margin Card */}
      <div
        className={`md:col-span-2 lg:col-span-4 border rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center gap-10 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
      >
        <div
          className={`absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/5 to-transparent pointer-events-none`}
        />

        <div className="relative flex-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Target size={20} />
            </div>
            <h3
              className={`text-xl font-black italic tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
              Marge Prévisionnelle vs Devis
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <span
                className={`text-xs font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Plafond Devis HT
              </span>
              <span
                className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              >
                {fmtFCFA(devis.ceiling)}
              </span>
            </div>
            <div>
              <span
                className={`text-xs font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Total Réel Saisi
              </span>
              <span
                className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              >
                {fmtFCFA(devis.totalReal)}
              </span>
            </div>
            <div>
              <span
                className={`text-xs font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Marge Globale
              </span>
              <span
                className={`text-base font-bold tracking-tight ${devis.globalMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
              >
                {fmtFCFA(devis.globalMargin)}
              </span>
            </div>
            <div>
              <span
                className={`text-xs font-black uppercase tracking-widest block mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Objectif Marge
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-indigo-600 tracking-tighter">
                  {devis.marginPct.toFixed(1)}%
                </span>
                <ArrowUpRight className="text-emerald-500" size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-64 space-y-4">
          <div className="flex justify-between items-end mb-2">
            <span
              className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
            >
              Progression Budget
            </span>
            <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {Math.min(Math.round((devis.totalReal / devis.ceiling) * 100), 100)}%
            </span>
          </div>
          <div
            className={`h-4 border rounded-full overflow-hidden p-1 shadow-inner transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
          >
            <div
              className={`h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all duration-1000`}
              style={{ width: `${Math.min(Math.round((devis.totalReal / devis.ceiling) * 100), 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
