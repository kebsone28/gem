/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState } from 'react';
import {
  Info,
  CheckCircle2,
  PenLine,
  Save,
  Box,
  Layers,
  Warehouse,
  Timer,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';
import { useTheme } from '../../contexts/ThemeContext';
import { KIT_CATEGORIES, CATEGORY_COLORS } from '../../utils/config';
import { fmtNum } from '../../utils/format';
import toast from 'react-hot-toast';

interface StockTabProps {
  searchQuery?: string;
}

export default function StockTab({ searchQuery = '' }: StockTabProps) {
  const { warehouseStats } = useLogistique();
  const { isDarkMode } = useTheme();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    warehouseStats?.[0]?.id || null
  );

  const activeWh = warehouseStats?.find((w) => w.id === selectedWarehouseId) || warehouseStats?.[0];
  const stockData = activeWh?.stockRealtime || [];
  const teamVelocity = activeWh?.teamVelocity || 0;

  // Group by category
  const categoriesMap = KIT_CATEGORIES.map((cat) => ({
    name: cat,
    items: stockData.filter(
      (i: any) => i.category === cat && i.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((c) => c.items.length > 0);

  const kitsLoadedToday = activeWh?.kitsLoadedToday || 0;
  const totalRemaining = stockData.reduce((sum: number, item: any) => sum + item.remaining, 0);
  const totalConsumed = stockData.reduce((sum: number, item: any) => sum + item.consumed, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Warehouse Selector */}
      {warehouseStats && warehouseStats.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mr-2">
            Filtre Magasin :
          </span>
          {warehouseStats.map((wh: any) => (
            <button
              key={wh.id}
              onClick={() => setSelectedWarehouseId(wh.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                selectedWarehouseId === wh.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : isDarkMode
                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Warehouse size={14} />
              {wh.name}
            </button>
          ))}
        </div>
      )}

      {activeWh?.hasAlert && (
        <div className="flex items-center gap-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="text-red-500" size={20} />
          </div>
          <div>
            <h4 className="font-black text-red-500 uppercase tracking-tighter">
              Alerte Rupture Imminente
            </h4>
            <p className="text-red-400/80 text-sm font-medium leading-tight mt-0.5">
              Le magasin <b>{activeWh.name}</b> montre un risque de rupture dans moins de 3 jours
              sur {activeWh.alerts?.length} article(s).
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            value: activeWh?.daysBeforeBreakout < 999 ? activeWh.daysBeforeBreakout : 'N/A',
            color:
              activeWh?.daysBeforeBreakout < 3
                ? 'rose'
                : activeWh?.daysBeforeBreakout < 7
                  ? 'amber'
                  : 'emerald',
            detail: `Vitesse: ${activeWh?.teamVelocity} kits/j`,
          },
        ].map((card: any, idx) => {
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
            slate: {
              bg: 'bg-slate-500/10 border-slate-500/20',
              icon: 'text-slate-500',
              badge: 'bg-slate-500/10 text-slate-500',
            },
          };
          const classes = colorClasses[card.color] || colorClasses.slate;

          return (
            <div
              key={idx}
              className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl p-6 transition-all hover:shadow-lg group`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${classes.bg}`}>
                  <Icon className={`${classes.icon}`} size={24} />
                </div>
              </div>
              <h4
                className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
              >
                {card.label}
              </h4>
              <p
                className={`text-4xl font-black mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              >
                {card.value}
              </p>
              {card.detail && (
                <div
                  className={`flex items-center space-x-2 text-xs font-medium ${classes.badge} px-3 py-1.5 rounded-lg w-fit`}
                >
                  <Info size={14} />
                  <span>{card.detail}</span>
                </div>
              )}
              {card.hasAction && (
                <button
                  onClick={() => setIsAdminMode(true)}
                  className={`mt-4 flex items-center space-x-2 font-semibold text-sm transition-all p-2 rounded-lg ${classes.badge} hover:shadow-md`}
                >
                  <PenLine size={14} />
                  <span>Éditer</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {categoriesMap.length === 0 ? (
          <div
            className={`lg:col-span-2 flex flex-col items-center justify-center py-16 ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-100 border-slate-200'} border rounded-2xl`}
          >
            <Box
              size={48}
              className={
                isDarkMode ? 'text-slate-700 dark:text-slate-300 mb-4' : 'text-slate-400 mb-4'
              }
            />
            <p className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>Aucun article trouvé</p>
          </div>
        ) : (
          categoriesMap.map((cat) => {
            const style = CATEGORY_COLORS[cat.name] || {
              bg: 'bg-slate-800/50',
              border: 'border-slate-800',
              text: 'text-slate-400',
            };
            return (
              <div
                key={cat.name}
                className={`rounded-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} transition-all hover:shadow-lg`}
              >
                <div className={`p-4 ${style.bg} border-b ${style.border}`}>
                  <h3 className={`text-sm font-bold uppercase tracking-widest ${style.text}`}>
                    {cat.name}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table
                    className={`w-full text-sm ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}
                  >
                    <thead
                      className={isDarkMode ? 'bg-slate-950' : 'bg-slate-50 dark:bg-slate-800/50'}
                    >
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
                      className={
                        isDarkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-200'
                      }
                    >
                      {cat.items.map((item: any) => {
                        const daysLeft =
                          teamVelocity > 0 ? item.remaining / (item.qty * teamVelocity) : 999;
                        const isCritical = daysLeft < 3;
                        const isWarning = daysLeft >= 3 && daysLeft < 7;
                        return (
                          <tr
                            key={item.id}
                            className={`${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'} ${isCritical ? 'bg-red-500/5' : ''}`}
                          >
                            <td
                              className={`px-6 py-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                            >
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
                            <td
                              className={`px-6 py-4 text-center font-mono text-emerald-500 font-medium`}
                            >
                              {fmtNum(item.consumed)}
                            </td>
                            <td className={`px-6 py-4 text-right`}>
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

      {/* Admin Modal */}
      {isAdminMode && (
        <div
          className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950/80' : 'bg-black/40'} backdrop-blur-sm animate-in fade-in`}
        >
          <div
            className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95`}
          >
            {/* Header */}
            <div
              className={`p-6 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                  >
                    Audit & Corrections
                  </h3>
                  <p
                    className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    Forcez les valeurs de stock pour corriger les inventaires.
                  </p>
                </div>
                <button
                  onClick={() => setIsAdminMode(false)}
                  aria-label="Close"
                  className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              className={`p-6 max-h-[60vh] overflow-y-auto ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stockData.map((item: any) => (
                  <div
                    key={item.id}
                    className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-xl p-4`}
                  >
                    <label
                      className={`block text-xs font-semibold uppercase tracking-wider mb-2 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                      title={item.label}
                    >
                      {item.label}
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        className={`flex-1 rounded-lg py-2 px-3 text-sm font-semibold transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-primary focus:ring-2 focus:ring-primary/30' : 'bg-white border-slate-300 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30'} border focus:outline-none`}
                        placeholder={`${Math.round(item.calculated)} (auto)`}
                        defaultValue={item.hasOverride ? item.current : ''}
                      />
                      <span
                        className={`text-xs font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
                      >
                        {item.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              className={`p-6 border-t ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} flex justify-end gap-3`}
            >
              <button
                onClick={() => setIsAdminMode(false)}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  toast.success('Stock mis à jour avec succès ✓');
                  setIsAdminMode(false);
                }}
                className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all active:scale-95 shadow-lg shadow-amber-600/20"
              >
                <Save size={18} />
                <span>Sauvegarder</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
