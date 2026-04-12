import { TrendingUp, Activity, AlertTriangle, Zap, Timer } from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';
import { useTheme } from '../../contexts/ThemeContext';

interface AgentsTabProps {
  searchQuery?: string;
}

export default function AgentsTab({ searchQuery = '' }: AgentsTabProps) {
  const { agents } = useLogistique();
  const { isDarkMode } = useTheme();

  const filteredAgents =
    agents?.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  const activeAnomalies =
    filteredAgents?.flatMap((a) => {
      const list = [];
      if (a.status === 'Inactif') {
        list.push({
          type: 'danger',
          msg: `L'agent ${a.name} est inactif depuis plus de ${a.daysSince} jours.`,
          icon: AlertTriangle,
          color: 'rose',
        });
      }
      if (a.avgTime > 45) {
        list.push({
          type: 'warning',
          msg: `Temps moyen excessif (${a.avgTime} min) pour ${a.name}.`,
          icon: Timer,
          color: 'amber',
        });
      }
      if (a.status === 'Actif' && a.visits < 5) {
        list.push({
          type: 'info',
          msg: `Volume de visites anormalement faible (${a.visits}) pour l'agent actif ${a.name}.`,
          icon: Activity,
          color: 'blue',
        });
      }
      return list;
    }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Actif':
        return isDarkMode
          ? 'bg-emerald-500/10 text-emerald-500'
          : 'bg-emerald-100 text-emerald-700';
      case 'Ralenti':
        return isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-100 text-amber-700';
      default:
        return isDarkMode ? 'bg-rose-500/10 text-rose-500' : 'bg-rose-100 text-rose-700';
    }
  };

  const getAnomalyColors = (color: string) => {
    const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      rose: {
        bg: isDarkMode ? 'bg-rose-500/5' : 'bg-rose-50',
        border: isDarkMode ? 'border-rose-500/20' : 'border-rose-200',
        text: isDarkMode ? 'text-rose-400/80' : 'text-rose-700',
        icon: isDarkMode ? 'text-rose-500' : 'text-rose-600',
      },
      amber: {
        bg: isDarkMode ? 'bg-amber-500/5' : 'bg-amber-50',
        border: isDarkMode ? 'border-amber-500/20' : 'border-amber-200',
        text: isDarkMode ? 'text-amber-400/80' : 'text-amber-700',
        icon: isDarkMode ? 'text-amber-500' : 'text-amber-600',
      },
      blue: {
        bg: isDarkMode ? 'bg-blue-500/5' : 'bg-blue-50',
        border: isDarkMode ? 'border-blue-500/20' : 'border-blue-200',
        text: isDarkMode ? 'text-blue-400/80' : 'text-blue-700',
        icon: isDarkMode ? 'text-blue-500' : 'text-blue-600',
      },
    };
    return colorMap[color] || colorMap.rose;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Left Column: Performance Table */}
      <div className="lg:col-span-2 space-y-6">
        <div
          className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl overflow-hidden transition-all hover:shadow-lg`}
        >
          <div
            className={`p-6 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} flex justify-between items-center`}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <TrendingUp size={20} className="text-primary" />
              </div>
              <div>
                <h3
                  className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                >
                  Performances Agents
                </h3>
                <p
                  className={`text-xs font-medium mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
                >
                  Temps réel
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table
              className={`w-full text-sm ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}
            >
              <thead className={isDarkMode ? 'bg-slate-950' : 'bg-slate-50 dark:bg-slate-800/50'}>
                <tr>
                  <th
                    className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    Agent
                  </th>
                  <th
                    className={`px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    Visites
                  </th>
                  <th
                    className={`px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    Tps Moyen
                  </th>
                  <th
                    className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    Lastée
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
                {filteredAgents.length > 0 ? (
                  filteredAgents.map((a, i) => (
                    <tr
                      key={i}
                      className={isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}
                    >
                      <td
                        className={`px-6 py-4 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                      >
                        {a.name}
                      </td>
                      <td
                        className={`px-6 py-4 text-center ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black ${isDarkMode ? 'bg-slate-800 text-primary' : 'bg-slate-100 text-primary'}`}
                        >
                          {a.visits}
                        </span>
                      </td>
                      <td className={`px-6 py-4`}>
                        <div className="flex flex-col items-center gap-2">
                          <span
                            className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                          >
                            {a.avgTime}m
                          </span>
                          <div
                            className={`w-16 h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}
                          >
                            <div
                              className="h-full bg-gradient-to-r from-primary to-blue-400"
                              style={{ width: `${Math.min(a.avgTime * 2, 100)}%` }}
                              /* eslint-disable-line no-inline-styles */
                            />
                          </div>
                        </div>
                      </td>
                      <td
                        className={`px-6 py-4 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
                      >
                        {a.lastDate ? new Date(a.lastDate).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className={`px-6 py-4 text-right`}>
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg font-semibold text-xs ${getStatusColor(a.status)}`}
                        >
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={`px-6 py-16 text-center`}>
                      <p className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>
                        Aucun agent trouvé
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Anomalies */}
      <div className="space-y-6">
        <div
          className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl overflow-hidden transition-all hover:shadow-lg`}
        >
          <div
            className={`p-6 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} relative`}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Anomalies
              </h3>
            </div>
          </div>
          <div className={`p-6 space-y-3 max-h-[500px] overflow-y-auto`}>
            {activeAnomalies.length > 0 ? (
              activeAnomalies.map((anom, i) => {
                const colors = getAnomalyColors(anom.color);
                const Icon = anom.icon;
                return (
                  <div
                    key={i}
                    className={`${colors.bg} border ${colors.border} p-4 rounded-xl flex items-start gap-3`}
                  >
                    <Icon size={18} className={`${colors.icon} mt-0.5 shrink-0`} />
                    <p className={`text-xs ${colors.text} leading-relaxed font-medium`}>
                      {anom.msg}
                    </p>
                  </div>
                );
              })
            ) : (
              <div
                className={`flex flex-col items-center justify-center py-12 text-center ${isDarkMode ? 'text-slate-600' : 'text-slate-500'}`}
              >
                <Zap
                  size={32}
                  className={`mb-3 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}
                />
                <p className="text-sm font-semibold">Aucune anomalie</p>
                <p className="text-xs">Les agents fonctionnent normalement</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
