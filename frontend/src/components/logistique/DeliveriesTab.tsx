import {
  History,
  Calendar,
  User,
  Search,
  Filter,
  Truck,
  Hammer,
  Zap,
  HardHat,
  ClipboardCheck,
  Smartphone,
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';
import { useTheme } from '../../contexts/ThemeContext';

interface DeliveriesTabProps {
  searchQuery?: string;
}

export default function DeliveriesTab({ searchQuery = '' }: DeliveriesTabProps) {
  const { households, koboStats } = useLogistique();
  const { isDarkMode } = useTheme();
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const trackingList =
    households?.filter(
      (h) =>
        (h.delivery?.date || h.koboSync) &&
        (!normalizedSearch ||
          h.id.toLowerCase().includes(normalizedSearch) ||
          h.delivery?.agent?.toLowerCase().includes(normalizedSearch) ||
          h.region?.toLowerCase().includes(normalizedSearch))
    ) || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div
          className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl p-6 transition-all hover:shadow-lg`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              Kits Préparés (Kobo)
            </h3>
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Smartphone size={20} className="text-blue-500" />
            </div>
          </div>
          <p className={`text-4xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {koboStats?.totalPreparateurKits || 0}
          </p>
          <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            Synchronisé depuis les tablettes en temps réel
          </p>
        </div>

        <div
          className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl p-6 transition-all hover:shadow-lg`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              Câbles Livrés
            </h3>
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <Zap size={20} className="text-emerald-500" />
            </div>
          </div>
          <p className={`text-4xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {(koboStats?.câbleInt25Total || 0) + (koboStats?.câbleInt15Total || 0)} m
          </p>
          <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
            Cumul 2.5mm + 1.5mm
          </p>
        </div>
      </div>

      <div
        className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-2xl p-4 flex flex-col items-stretch gap-4 transition-all md:flex-row md:items-center md:justify-between`}
      >
        <div className="flex flex-col items-stretch gap-3 md:min-w-[280px] md:flex-1 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
            />
            <input
              type="text"
              placeholder="Recherche pilotée par la barre globale"
              className={`w-full pl-12 pr-4 py-2.5 rounded-lg border font-medium transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-primary focus:ring-2 focus:ring-primary/30' : 'bg-white border-slate-300 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30'} focus:outline-none`}
              value={searchQuery}
              readOnly
            />
          </div>
          <div
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border md:justify-start ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-600'}`}
          >
            <Calendar size={16} />
            <span className="text-xs font-semibold whitespace-nowrap">Derniers 30j</span>
          </div>
        </div>
        <button
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
        >
          <Filter size={16} />
          <span className="text-xs">Filtres</span>
        </button>
      </div>

      <div className="space-y-4 md:hidden">
        {trackingList.map((delivery) => {
          const phases = [
            { label: 'Livreur', ok: !!delivery.koboSync?.livreurDate || !!delivery.delivery?.date, icon: Truck },
            { label: 'Maçon', ok: !!delivery.koboSync?.maconOk, icon: Hammer },
            { label: 'Réseau', ok: !!delivery.koboSync?.reseauOk, icon: Zap },
            { label: 'Intérieur', ok: !!delivery.koboSync?.interieurOk, icon: HardHat },
            { label: 'Contrôle', ok: !!delivery.koboSync?.controleOk, icon: ClipboardCheck },
          ];
          const finalOk = delivery.koboSync?.controleOk || delivery.status === 'Conforme';

          return (
            <article
              key={delivery.id}
              className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl p-4 space-y-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`font-mono text-xs font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                  >
                    {delivery.id}
                  </p>
                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {delivery.delivery?.agent || 'Livreur non renseigné'}
                  </p>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    {delivery.region || 'Région non renseignée'}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs ${finalOk ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-100 text-emerald-700') : isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-100 text-amber-700'}`}
                >
                  {finalOk ? '✓ Approuvé' : '⏳ En cours'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {phases.map((phase) => {
                  const PhaseIcon = phase.icon;
                  return (
                    <div
                      key={phase.label}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${phase.ok ? (isDarkMode ? 'border-slate-700 bg-slate-800/80 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700') : isDarkMode ? 'border-slate-800 bg-slate-950/50 text-slate-600' : 'border-slate-200 bg-slate-50/70 text-slate-400'}`}
                    >
                      <PhaseIcon size={14} />
                      <span className="text-xs font-semibold">{phase.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                {(delivery.koboSync?.câbleInt25 || 0) > 0 && (
                  <span
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-mono ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
                  >
                    2.5: {delivery.koboSync?.câbleInt25}m
                  </span>
                )}
                {(delivery.koboSync?.tranchee4 || 0) > 0 && (
                  <span
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-mono ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
                  >
                    Tr: {delivery.koboSync?.tranchee4}m
                  </span>
                )}
                {!delivery.koboSync?.câbleInt25 && !delivery.koboSync?.tranchee4 && (
                  <span className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    Aucun matériau remonté
                  </span>
                )}
              </div>
            </article>
          );
        })}

        {trackingList.length === 0 && (
          <div
            className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl px-6 py-12 text-center`}
          >
            <History
              size={28}
              className={`mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}
            />
            <p className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Aucune livraison
            </p>
          </div>
        )}
      </div>

      <div
        className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} hidden border rounded-2xl overflow-hidden transition-all hover:shadow-lg md:block`}
      >
        <div className="overflow-x-auto">
          <table
            className={`w-full text-sm ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}
          >
            <thead className={isDarkMode ? 'bg-slate-950' : 'bg-slate-50 dark:bg-slate-800/50'}>
              <tr>
                <th
                  className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Ménage
                </th>
                <th
                  className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Livreur
                </th>
                <th
                  className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Phases Déploiement
                </th>
                <th
                  className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Matériaux
                </th>
                <th
                  className={`px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Statut
                </th>
              </tr>
            </thead>
            <tbody
              className={isDarkMode ? 'divide-y divide-slate-800' : 'divide-y divide-slate-200'}
            >
              {trackingList.map((delivery) => {
                const phases = [
                  { label: 'Livreur', ok: !!delivery.koboSync?.livreurDate || !!delivery.delivery?.date, icon: Truck },
                  { label: 'Maçon', ok: !!delivery.koboSync?.maconOk, icon: Hammer },
                  { label: 'Réseau', ok: !!delivery.koboSync?.reseauOk, icon: Zap },
                  { label: 'Intérieur', ok: !!delivery.koboSync?.interieurOk, icon: HardHat },
                  { label: 'Contrôle', ok: !!delivery.koboSync?.controleOk, icon: ClipboardCheck },
                ];
                const finalOk = delivery.koboSync?.controleOk || delivery.status === 'Conforme';

                return (
                  <tr
                    key={delivery.id}
                    className={isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}
                  >
                    <td className={`px-6 py-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      <div className="flex flex-col">
                        <span
                          className={`font-mono text-xs font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                        >
                          {delivery.id}
                        </span>
                        <span
                          className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
                        >
                          {delivery.region}
                        </span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'}`}
                        >
                          <User
                            size={14}
                            className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}
                          />
                        </div>
                        <span className="text-xs font-semibold">{delivery.delivery?.agent || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {phases.map((phase) => {
                          const PhaseIcon = phase.icon;
                          return (
                            <div
                              key={phase.label}
                              title={phase.label + (phase.ok ? ' (Fait)' : ' (Attente)')}
                              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${phase.ok ? (isDarkMode ? 'bg-slate-800 border-slate-700 shadow-sm opacity-100' : 'bg-slate-100 border-slate-300 opacity-100') : isDarkMode ? 'bg-slate-950/50 border-slate-800 opacity-40 grayscale' : 'bg-slate-50 border-slate-200 opacity-40 grayscale'}`}
                            >
                              <PhaseIcon size={13} />
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {(delivery.koboSync?.câbleInt25 || 0) > 0 && (
                          <span
                            className={`text-xs px-2 py-1 rounded font-mono w-fit ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
                          >
                            2.5: {delivery.koboSync?.câbleInt25}m
                          </span>
                        )}
                        {(delivery.koboSync?.tranchee4 || 0) > 0 && (
                          <span
                            className={`text-xs px-2 py-1 rounded font-mono w-fit ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
                          >
                            Tr: {delivery.koboSync?.tranchee4}m
                          </span>
                        )}
                        {!delivery.koboSync?.câbleInt25 && !delivery.koboSync?.tranchee4 && (
                          <span
                            className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}
                          >
                            —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs ${finalOk ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-100 text-emerald-700') : isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-100 text-amber-700'}`}
                      >
                        {finalOk ? '✓ Approuvé' : '⏳ En cours'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {trackingList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div
                        className={`p-4 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
                      >
                        <History
                          size={32}
                          className={
                            isDarkMode ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'
                          }
                        />
                      </div>
                      <div>
                        <p
                          className={`font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                        >
                          Aucune livraison
                        </p>
                        <p
                          className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-500'}`}
                        >
                          Aucun ménage avec livraison trouvé
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
