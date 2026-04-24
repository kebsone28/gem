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

interface TeamLedgerTabProps {
  searchQuery?: string;
}

export default function TeamLedgerTab({ searchQuery = '' }: TeamLedgerTabProps) {
  const { teams, grappesConfig } = useLogistique();
  const { isDarkMode } = useTheme();

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [isSizingOpen, setIsSizingOpen] = useState(false);

  const allGrappes = useMemo(() => (grappesConfig as any)?.grappes || [], [grappesConfig]);
  const combinedSearch = `${searchQuery} ${localSearchQuery}`.trim().toLowerCase();

  const activeTeamsWithAssignments = useMemo(() => {
    return (teams || [])
      .filter((team) => team.status === 'active' || String(team.status) === 'disponible')
      .map((team) => {
        const assignedGrappes = allGrappes.filter((grappe: any) => grappe.id === team.grappeId);
        const totalHouseholds = assignedGrappes.reduce(
          (sum: number, grappe: any) => sum + (grappe.householdsCount || grappe.nb_menages || 0),
          0
        );

        return {
          ...team,
          assignedGrappes,
          totalHouseholds,
        };
      })
      .filter(
        (team) =>
          !combinedSearch ||
          team.name.toLowerCase().includes(combinedSearch) ||
          (team.role || '').toLowerCase().includes(combinedSearch)
      );
  }, [teams, allGrappes, combinedSearch]);

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
      grappes: teamData.assignedGrappes.map((grappe: any) => ({
        nom: grappe.nom || grappe.name || 'Grappe Inconnue',
        householdsCount: grappe.householdsCount || grappe.nb_menages || 0,
      })),
      totalHouseholds: teamData.totalHouseholds,
      projectDeadline: '3 Mois',
    };

    generateTeamHandoverPDF(pdfData);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div
        className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-2xl overflow-hidden transition-all hover:shadow-lg`}
      >
        <div
          className={`p-4 sm:p-6 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} flex flex-col gap-4`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-500/10 rounded-xl shrink-0">
                <FileText size={20} className="text-indigo-500" />
              </div>
              <div>
                <h3 className={`text-lg sm:text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Registre des Affectations
                </h3>
                <p
                  className={`text-xs font-medium mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
                >
                  Consultez et imprimez les ordres de mission terrain
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsSizingOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-sm rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 border border-blue-400/20 w-full sm:w-auto"
            >
              <Bot size={16} />
              Auto-Scale IA
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Filtre local équipe ou rôle..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className={`px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors w-full md:w-auto md:min-w-[280px] ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-white placeholder-slate-600'
                  : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-800 placeholder-slate-400'
              }`}
            />
            {searchQuery && (
              <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                Filtre global actif: <span className="font-semibold">{searchQuery}</span>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 p-4 md:hidden">
          {activeTeamsWithAssignments.length > 0 ? (
            activeTeamsWithAssignments.map((team) => {
              const hasAssignment = team.assignedGrappes.length > 0;
              return (
                <article
                  key={team.id}
                  className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-2xl p-4 space-y-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {team.name}
                      </p>
                      <p
                        className={`text-xs mt-1 font-semibold uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
                      >
                        {team.role || 'Générique'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${hasAssignment ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') : isDarkMode ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}
                    >
                      {hasAssignment ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}
                      {hasAssignment ? 'Déployé' : 'En base'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {hasAssignment ? (
                      team.assignedGrappes.map((grappe: any) => (
                        <span
                          key={grappe.id || grappe.nom || grappe.name}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
                        >
                          <Activity
                            size={12}
                            className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}
                          />
                          {grappe.nom || grappe.name}
                        </span>
                      ))
                    ) : (
                      <span
                        className={`text-xs italic ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}
                      >
                        Aucune zone assignée
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
                    <span className={isDarkMode ? 'text-slate-500 text-xs uppercase font-bold' : 'text-slate-600 text-xs uppercase font-bold'}>
                      Foyers cibles
                    </span>
                    <span
                      className={`font-black text-lg ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}
                    >
                      {hasAssignment ? team.totalHouseholds : '-'}
                    </span>
                  </div>

                  <button
                    onClick={() => handlePrintPDF(team)}
                    disabled={!hasAssignment}
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${
                      hasAssignment
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {hasAssignment ? <Download size={14} /> : <Printer size={14} />}
                    Ordre PDF
                  </button>
                </article>
              );
            })
          ) : (
            <div className="px-4 py-10 text-center text-slate-500">Aucune équipe trouvée.</div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className={`w-full text-sm ${isDarkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
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
                activeTeamsWithAssignments.map((team) => {
                  const hasAssignment = team.assignedGrappes.length > 0;
                  return (
                    <tr
                      key={team.id}
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
                            {team.assignedGrappes.map((grappe: any, index: number) => (
                              <span
                                key={grappe.id || index}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
                              >
                                <Activity
                                  size={12}
                                  className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}
                                />
                                {grappe.nom || grappe.name}
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
                          <span className="text-slate-400">-</span>
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

      <TeamSizingModal
        isOpen={isSizingOpen}
        onClose={() => setIsSizingOpen(false)}
        totalHouseholds={teams ? 2500 : 0}
      />
    </div>
  );
}
