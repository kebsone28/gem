import { useState } from 'react';
import {
  Info,
  CheckCircle2,
  Box,
  Layers,
  Warehouse,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';
import { useTheme } from '../../contexts/ThemeContext';
import { KIT_CATEGORIES, CATEGORY_COLORS } from '../../utils/config';
import { fmtNum } from '../../utils/format';

interface StockTabProps {
  searchQuery?: string;
}

interface StockRealtimeItem {
  id: string;
  label: string;
  category: string;
  unit: string;
  qty: number;
  initial: number;
  consumed: number;
  remaining: number;
}

interface WarehouseStockView {
  id: string;
  name: string;
  hasAlert?: boolean;
  alerts?: Array<unknown>;
  stockRealtime?: StockRealtimeItem[];
  kitsLoadedToday?: number;
  kitsConsumed?: number;
  teamVelocity?: number;
  daysBeforeBreakout?: number;
}

export default function StockTab({ searchQuery = '' }: StockTabProps) {
  const { warehouseStats } = useLogistique();
  const { isDarkMode } = useTheme();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    warehouseStats?.[0]?.id || null
  );

  const typedWarehouseStats = (warehouseStats || []) as WarehouseStockView[];
  const activeWh =
    typedWarehouseStats.find((warehouse) => warehouse.id === selectedWarehouseId) ||
    typedWarehouseStats[0];
  const stockData = activeWh?.stockRealtime || [];
  const teamVelocity = activeWh?.teamVelocity || 0;
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const categoriesMap = KIT_CATEGORIES.map((categoryName) => ({
    name: categoryName,
    items: stockData.filter(
      (item) =>
        item.category === categoryName &&
        (!normalizedSearch || item.label.toLowerCase().includes(normalizedSearch))
    ),
  })).filter((category) => category.items.length > 0);

  const kitsLoadedToday = activeWh?.kitsLoadedToday || 0;
  const totalRemaining = stockData.reduce((sum, item) => sum + item.remaining, 0);
  const totalConsumed = stockData.reduce((sum, item) => sum + item.consumed, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {typedWarehouseStats.length > 0 && (
        <div className="space-y-3">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            Filtre Magasin
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {typedWarehouseStats.map((warehouse) => (
              <button
                key={warehouse.id}
                onClick={() => setSelectedWarehouseId(warehouse.id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  selectedWarehouseId === warehouse.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : isDarkMode
                      ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Warehouse size={14} />
                <span>{warehouse.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeWh?.hasAlert && (
        <div className="flex items-start gap-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="text-red-500" size={20} />
          </div>
          <div>
            <h4 className="font-black text-red-500 uppercase tracking-tighter">
              Alerte Rupture Imminente
            </h4>
            <p className="text-red-400/80 text-sm font-medium leading-tight mt-0.5">
              Le magasin <b>{activeWh.name}</b> montre un risque de rupture dans moins de 3 jours
              sur {activeWh.alerts?.length || 0} article(s).
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Layers,
            label: "Kits Chargés (Aujourd'hui)",
            value: kitsLoadedToday,
            color: 'blue',
            detail: 'Total équipe, matin',
          },
          {
            icon: CheckCircle2,
            label: 'Matériel Consommé',
            value: fmtNum(Math.round(totalConsumed)),
            color: 'emerald',
            detail: `${activeWh?.kitsConsumed || 0} ménages conformes`,
          },
          {
            icon: Box,
            label: 'Stock Réel Restant',
            value: fmtNum(Math.round(totalRemaining)),
            color: activeWh?.hasAlert ? 'rose' : 'indigo',
            detail: 'Avant épuisement',
          },
          {
            icon: Timer,
            label: 'Jours Restants',
            value:
              typeof activeWh?.daysBeforeBreakout === 'number' && activeWh.daysBeforeBreakout < 999
                ? activeWh.daysBeforeBreakout
                : 'N/A',
            color:
              (activeWh?.daysBeforeBreakout || 0) < 3
                ? 'rose'
                : (activeWh?.daysBeforeBreakout || 0) < 7
                  ? 'amber'
                  : 'emerald',
            detail: `Vitesse: ${activeWh?.teamVelocity || 0} kits/j`,
          },
        ].map((card) => {
          const Icon = card.icon;
          const colorClasses: Record<string, { bg: string; icon: string; badge: string }> = {
            blue: {
              bg: 'bg-blue-500/10 border-blue-500/20',
              icon: 'text-blue-500',
              badge: 'bg-blue-500/10 text-blue-500',
            },
            emerald: {
              bg: 'bg-emerald-500/10 border-emerald-500/20',
              icon: 'text-emerald-500',
              badge: 'bg-emerald-500/10 text-emerald-500',
            },
            amber: {
              bg: 'bg-amber-500/10 border-amber-500/20',
              icon: 'text-amber-500',
              badge: 'bg-amber-500/10 text-amber-500',
            },
            indigo: {
              bg: 'bg-indigo-500/10 border-indigo-500/20',
              icon: 'text-indigo-500',
              badge: 'bg-indigo-500/10 text-indigo-500',
            },
            rose: {
              bg: 'bg-rose-500/10 border-rose-500/20',
              icon: 'text-rose-500',
              badge: 'bg-rose-500/10 text-rose-500',
            },
          };
          const classes = colorClasses[card.color];

          return (
            <div
              key={card.label}
              className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl p-5 transition-all hover:shadow-lg group`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${classes.bg}`}>
                  <Icon className={classes.icon} size={22} />
                </div>
              </div>
              <h4
                className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
              >
                {card.label}
              </h4>
              <p className={`text-3xl sm:text-4xl font-black mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {card.value}
              </p>
              <div
                className={`flex items-center space-x-2 text-xs font-medium ${classes.badge} px-3 py-1.5 rounded-lg w-fit`}
              >
                <Info size={14} />
                <span>{card.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {categoriesMap.length === 0 ? (
          <div
            className={`xl:col-span-2 flex flex-col items-center justify-center py-16 ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-100 border-slate-200'} border rounded-2xl`}
          >
            <Box
              size={48}
              className={isDarkMode ? 'text-slate-700 dark:text-slate-300 mb-4' : 'text-slate-400 mb-4'}
            />
            <p className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>Aucun article trouvé</p>
          </div>
        ) : (
          categoriesMap.map((category) => {
            const style = CATEGORY_COLORS[category.name] || {
              bg: 'bg-slate-800/50',
              border: 'border-slate-800',
              text: 'text-slate-400',
            };
            return (
              <div
                key={category.name}
                className={`rounded-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} transition-all hover:shadow-lg`}
              >
                <div className={`p-4 ${style.bg} border-b ${style.border}`}>
                  <h3 className={`text-sm font-bold uppercase tracking-widest ${style.text}`}>
                    {category.name}
                  </h3>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                  {category.items.map((item) => {
                    const daysLeft = teamVelocity > 0 ? item.remaining / (item.qty * teamVelocity) : 999;
                    const isCritical = daysLeft < 3;
                    const isWarning = daysLeft >= 3 && daysLeft < 7;
                    return (
                      <div
                        key={item.id}
                        className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl p-4 space-y-3`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {item.label}
                            </p>
                            <p className={`text-xs font-mono mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                              {item.unit} | {item.qty} par kit
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-lg font-black ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
                            >
                              {fmtNum(item.remaining)}
                            </p>
                            {teamVelocity > 0 && (
                              <p
                                className={`text-[11px] font-bold uppercase mt-1 ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-500'}`}
                              >
                                ~ {Math.round(daysLeft)} jours
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className={`text-[11px] uppercase font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                              Chargé
                            </p>
                            <p className={`font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {fmtNum(item.initial)}
                            </p>
                          </div>
                          <div>
                            <p className={`text-[11px] uppercase font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                              Consommé
                            </p>
                            <p className="font-mono text-emerald-500 font-medium">{fmtNum(item.consumed)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className={`w-full text-sm ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                    <thead className={isDarkMode ? 'bg-slate-950' : 'bg-slate-50 dark:bg-slate-800/50'}>
                      <tr>
                        <th
                          className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                          Article
                        </th>
                        <th
                          className={`px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                          Chargé
                        </th>
                        <th
                          className={`px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                          Consommé
                        </th>
                        <th
                          className={`px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                          Stock Réel
                        </th>
                      </tr>
                    </thead>
                    <tbody
                      className={isDarkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-200'}
                    >
                      {category.items.map((item) => {
                        const daysLeft = teamVelocity > 0 ? item.remaining / (item.qty * teamVelocity) : 999;
                        const isCritical = daysLeft < 3;
                        const isWarning = daysLeft >= 3 && daysLeft < 7;
                        return (
                          <tr
                            key={item.id}
                            className={`${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'} ${isCritical ? 'bg-red-500/5' : ''}`}
                          >
                            <td className={`px-6 py-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              <div className="flex flex-col">
                                <span className="font-semibold">{item.label}</span>
                                <span
                                  className={`text-xs font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
                                >
                                  {item.unit} | {item.qty} par kit
                                </span>
                              </div>
                            </td>
                            <td
                              className={`px-6 py-4 text-center font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                            >
                              {fmtNum(item.initial)}
                            </td>
                            <td className="px-6 py-4 text-center font-mono text-emerald-500 font-medium">
                              {fmtNum(item.consumed)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span
                                  className={`text-lg font-black ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
                                >
                                  {fmtNum(item.remaining)}
                                </span>
                                {teamVelocity > 0 && (
                                  <span
                                    className={`text-xs font-bold uppercase mt-1 ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-500'}`}
                                  >
                                    ~ {Math.round(daysLeft)} jours ref.
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
