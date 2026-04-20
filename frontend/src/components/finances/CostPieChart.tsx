/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useTheme } from '../../contexts/ThemeContext';

export default function CostPieChart({ stats }: { stats: any }) {
  const { isDarkMode } = useTheme();
  const data = [
    { label: "Main d'Œuvre", val: stats.teams + stats.supervision, color: '#2e96db' },
    { label: 'Logistique', val: stats.logistics, color: '#f59e0b' },
    { label: 'Matériaux', val: stats.materials, color: '#10b981' },
  ];

  const total = data.reduce((sum, item) => sum + item.val, 0);
  
  if (total === 0) {
    return (
      <div className={`border rounded-[2.5rem] p-10 h-full flex items-center justify-center shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <p className="text-slate-500 font-medium">Aucune donnée financière disponible.</p>
      </div>
    );
  }

  let currentAngle = 0;

  return (
    <div
      className={`border rounded-[2.5rem] p-10 h-full flex flex-col shadow-2xl relative overflow-hidden group transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
    >
      <div
        className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl transition-all ${isDarkMode ? 'bg-indigo-500/5 group-hover:bg-indigo-500/10' : 'bg-indigo-50 group-hover:bg-indigo-100'}`}
      />

      <h3
        className={`text-xs font-black uppercase tracking-[0.3em] mb-12 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
      >
        Répartition des Coûts
      </h3>

      <div className="flex-1 flex flex-col items-center justify-center relative scale-110">
        <svg viewBox="0 0 100 100" className="w-64 h-64 transform -rotate-90">
          {data.map((item, i) => {
            const percentage = (item.val / total) * 100;
            const dashArray = `${percentage} ${100 - percentage}`;
            const dashOffset = -currentAngle;
            currentAngle += percentage;

            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={item.color}
                strokeWidth="10"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                className={`transition-all duration-1000 cursor-pointer ${isDarkMode ? 'hover:stroke-white' : 'hover:stroke-slate-900'}`}
              />
            );
          })}
          <circle
            cx="50"
            cy="50"
            r="30"
            fill={isDarkMode ? '#0f172a' : '#ffffff'}
            className="transition-all duration-500"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
          >
            Global
          </span>
          <span
            className={`text-2xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
          >
            100%
          </span>
        </div>
      </div>

      <div className="mt-12 space-y-3">
        {data.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-950/50 border-slate-800/50 group-hover:border-slate-800' : 'bg-slate-50 border-slate-100 group-hover:border-slate-200'}`}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full shadow-sm dark:shadow-none"
                data-color={item.color}
                ref={(el) => {
                  if (el) el.style.backgroundColor = item.color;
                }}
              />
              <span
                className={`font-bold text-xs tracking-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
              >
                {item.label}
              </span>
            </div>
            <span className={`font-black text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {((item.val / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
