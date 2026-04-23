/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { useLogistique } from '../../hooks/useLogistique';
import {
  FileText,
  Printer,
  ShieldCheck,
  Download,
  Activity,
  CheckCircle2,
  Bot,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { generateTeamHandoverPDF } from '../../utils/pdfHandoverGenerator';
import { TeamSizingModal } from './TeamSizingModal';

export default function TeamLedgerTab() {
  const { teams, grappesConfig } = useLogistique();
  const { isDarkMode } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSizingOpen, setIsSizingOpen] = useState(false);

  const allGrappes = useMemo(() => (grappesConfig as any)?.grappes || [], [grappesConfig]);

  const activeTeamsWithAssignments = useMemo(() => {
    return (
      (teams || [])
        .filter((t) => t.status === 'active' || String(t.status) === 'disponible')
        .map((t) => {
          // Determine assigned grappes. Currently based on team.grappeId
          const assignedGrappes = allGrappes.filter((g: any) => g.id === t.grappeId);

          // Derived stats
          const totalHouseholds = assignedGrappes.reduce(
            (sum: number, g: any) => sum + (g.householdsCount || g.nb_menages || 0),
            0
          );

          return {
            ...t,
            assignedGrappes,
            totalHouseholds,
          };
        })
        // Optionally filter only teams with assignments or let user see all to know who is idle
        // .filter(t => t.assignedGrappes.length > 0)
        .filter(
          (t) =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.role || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
    );
  }, [teams, allGrappes, searchQuery]);

  const handlePrintPDF = (teamData: any) => {
    if (teamData.assignedGrappes.length === 0) {
      alert("Cette équipe n'a aucune affectation pour le moment.");
      return;
    }

    const pdfData = {
      teamName: teamData.name,
      teamRole: teamData.role || 'Générique',
      region:
        teamData.region?.name ||
        teamData.region ||
        teamData.assignedGrappes[0]?.region ||
        'Non Spécifiée',
      grappes: teamData.assignedGrappes.map((g: any) => ({
        nom: g.nom || g.name || 'Grappe Inconnue',
        householdsCount: g.householdsCount || g.nb_menages || 0,
      })),
      totalHouseholds: teamData.totalHouseholds,
      projectDeadline: '3 Mois', // TODO: Dynamically source from project specs
    };

    generateTeamHandoverPDF(pdfData);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div
        className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl overflow-hidden transition-all hover:shadow-lg`}
      >
        <div
          className={`p-6 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} flex justify-between items-center flex-wrap gap-4`}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 rounded-xl">
              <FileText size={20} className="text-indigo-500" />
            </div>
            <div>
              <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Registre des Affectations (Ordres de Mission)
              </h3>
              <p
                className={`text-xs font-medium mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
              >
                Consultez et imprimez les carnets de terrain
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setIsSizingOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm rounded-xl font-bold transition-all shadow-md flex items-center gap-2 border border-blue-400/20"
            >
              <Bot size={16} /> Auto-Scale IA
            </button>
            <input
              type="text"
              placeholder="Rechercher équipe ou rôle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`px-4 py-2 text-sm rounded-xl border outline-none transition-colors w-full md:w-auto ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-white placeholder-slate-600'
                  : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            className={`w-full text-sm ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}
          >
            <thead className={isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}>
              <tr>
                <th
                  className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Équipe & Rôle
                </th>
                <th
                  className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Affectations (Grappes)
                </th>
                <th
                  className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Cible (Foyers)
                </th>
                <th
                  className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Statut
                </th>
                <th
                  className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Action (Remise)
                </th>
              </tr>
            </thead>
            <tbody
              className={isDarkMode ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200'}
            >
              {activeTeamsWithAssignments.length > 0 ? (
                activeTeamsWithAssignments.map((team, idx) => {
                  const hasAssignment = team.assignedGrappes.length > 0;
                  return (
                    <tr
                      key={team.id || idx}
                      className={`${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-6 py-4">
                        <div
                          className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                        >
                          {team.name}
                        </div>
                        <div
                          className={`text-xs mt-1 font-semibold uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
                        >
                          {team.role || 'Générique'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {hasAssignment ? (
                          <div className="flex flex-col gap-1">
                            {team.assignedGrappes.map((g: any, i: number) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
                              >
                                <Activity
                                  size={12}
                                  className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}
                                />
                                {g.nom || g.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span
                            className={`text-xs italic ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}
                          >
                            Aucune zone assignée
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {hasAssignment ? (
                          <span
                            className={`font-black text-lg ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}
                          >
                            {team.totalHouseholds}
                          </span>
                        ) : (
                          <span className={`text-slate-400`}>-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${hasAssignment ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') : isDarkMode ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}
                        >
                          {hasAssignment ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}
                          {hasAssignment ? 'Déployé' : 'En base'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handlePrintPDF(team)}
                          disabled={!hasAssignment}
                          title="Générer l'ordre de mission PDF"
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                            hasAssignment
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 active:scale-95'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                          }`}
                        >
                          {hasAssignment ? <Download size={14} /> : <Printer size={14} />}
                          Ordre PDF
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Aucune équipe trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Auto-Sizing IA */}
      <TeamSizingModal
        isOpen={isSizingOpen}
        onClose={() => setIsSizingOpen(false)}
        totalHouseholds={teams ? 2500 : 0 /* Fallback, would ideal measure from global query */}
      />
    </div>
  );
}
