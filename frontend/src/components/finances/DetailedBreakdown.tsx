import { ArrowDownRight } from 'lucide-react';
import { useFinances } from '../../hooks/useFinances';
import { useTheme } from '../../contexts/ThemeContext';
import { fmtFCFA } from '../../utils/format';

export default function DetailedBreakdown({ stats }: { stats: any }) {
  const { duration, householdsCount } = useFinances();
  const { isDarkMode } = useTheme();

  return (
    <div
      className={`border rounded-[2.5rem] overflow-hidden shadow-2xl h-full flex flex-col transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
    >
      <div
        className={`p-8 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-10 transition-all ${isDarkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-100/80 border-slate-200'}`}
      >
        <h3
          className={`text-xs font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
        >
          Postes de Dépense Détaillés
        </h3>
        <div className="text-xs font-black text-indigo-600 bg-indigo-600/10 px-3 py-1 rounded-full uppercase border border-indigo-600/20 tracking-widest">
          Estimation Pro
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr
              className={`${isDarkMode ? 'border-b border-slate-800/50' : 'border-b border-slate-100'}`}
            >
              <th
                className={`px-8 py-5 text-xs font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Désignation
              </th>
              <th
                className={`px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Base / Unité
              </th>
              <th
                className={`px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Montant (FCFA)
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/30' : 'divide-slate-50'}`}>
            {/* 1. Technical Teams */}
            <SectionHeader title="Équipes Techniques" total={stats.teams} isDarkMode={isDarkMode} />
            <DataItem
              label="Équipes Maçons"
              base="Par jour / éq."
              val={stats.teams * 0.4}
              isDarkMode={isDarkMode}
            />
            <DataItem
              label="Équipes Réseau"
              base="Par jour / éq."
              val={stats.teams * 0.35}
              isDarkMode={isDarkMode}
            />
            <DataItem
              label="Équipes Intérieur"
              base="Par jour / éq."
              val={stats.teams * 0.25}
              isDarkMode={isDarkMode}
            />

            {/* 2. Logistics */}
            <SectionHeader
              title="Logistique & Transport"
              total={stats.logistics}
              isDarkMode={isDarkMode}
            />
            <DataItem
              label="Location Véhicules"
              base={`${duration} jours`}
              val={stats.logistics * 0.7}
              isDarkMode={isDarkMode}
            />
            <DataItem
              label="Carburant (estimé)"
              base="Forfaitaire"
              val={stats.logistics * 0.3}
              isDarkMode={isDarkMode}
            />

            {/* 3. Materials */}
            <SectionHeader
              title="Matériaux (BOM)"
              total={stats.materials}
              isDarkMode={isDarkMode}
            />
            <DataItem
              label="Kits Branchement (Type 1/2)"
              base={`${householdsCount} ménages`}
              val={stats.materials * 0.8}
              isDarkMode={isDarkMode}
            />
            <DataItem
              label="Matériel Réseau"
              base="Poste forfaitaire"
              val={stats.materials * 0.2}
              isDarkMode={isDarkMode}
            />

            {/* 4. Support */}
            <SectionHeader
              title="Supervision & Support"
              total={stats.supervision}
              isDarkMode={isDarkMode}
            />
            <DataItem
              label="Superviseurs Terrain"
              base="Ratio 1:10"
              val={stats.supervision * 0.6}
              isDarkMode={isDarkMode}
            />
            <DataItem
              label="Chef de Projet"
              base="Mensuel"
              val={stats.supervision * 0.4}
              isDarkMode={isDarkMode}
            />
          </tbody>
        </table>
      </div>

      <div
        className={`p-8 border-t transition-all ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-100/80 border-slate-100'}`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-[13px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
          >
            TOTAL BUDGET
          </span>
          <span className="text-2xl font-black text-indigo-600 tracking-tighter">
            {fmtFCFA(stats.total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  total,
  isDarkMode,
}: {
  title: string;
  total: number;
  isDarkMode: boolean;
}) {
  return (
    <tr className={isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50 dark:bg-slate-800/50'}>
      <td
        className={`px-8 py-4 font-black text-xs uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
      >
        {title}
      </td>
      <td className="px-8 py-4 text-right"></td>
      <td
        className={`px-8 py-4 text-right font-black text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
      >
        {fmtFCFA(total)}
      </td>
    </tr>
  );
}

function DataItem({
  label,
  base,
  val,
  isDarkMode,
}: {
  label: string;
  base: string;
  val: number;
  isDarkMode: boolean;
}) {
  return (
    <tr
      className={`group transition-colors ${isDarkMode ? 'hover:bg-slate-800/20' : 'hover:bg-indigo-50/30'}`}
    >
      <td className="px-8 py-4 flex items-center gap-2">
        <ArrowDownRight
          size={12}
          className={`transition-colors ${isDarkMode ? 'text-slate-600 group-hover:text-indigo-500' : 'text-slate-300 group-hover:text-indigo-600'}`}
        />
        <span
          className={`font-bold text-xs tracking-tight transition-colors ${isDarkMode ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-500 group-hover:text-slate-900'}`}
        >
          {label}
        </span>
      </td>
      <td
        className={`px-8 py-4 text-right font-medium text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
      >
        {base}
      </td>
      <td
        className={`px-8 py-4 text-right font-bold text-xs tabular-nums ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
      >
        {fmtFCFA(val)}
      </td>
    </tr>
  );
}
