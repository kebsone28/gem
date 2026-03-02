import { useState } from 'react';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface DataPoint {
    week: string;
    planned: number;
    actual: number;
}

// 12 weeks of simulated cost tracking (FCFA in millions)
const DATA: DataPoint[] = [
    { week: 'S1', planned: 12.5, actual: 11.8 },
    { week: 'S2', planned: 25.0, actual: 24.2 },
    { week: 'S3', planned: 38.0, actual: 40.1 },
    { week: 'S4', planned: 52.0, actual: 50.5 },
    { week: 'S5', planned: 67.0, actual: 63.8 },
    { week: 'S6', planned: 83.0, actual: 85.2 },
    { week: 'S7', planned: 98.5, actual: 95.0 },
    { week: 'S8', planned: 115.0, actual: 112.6 },
    { week: 'S9', planned: 132.0, actual: 135.4 },
    { week: 'S10', planned: 148.0, actual: 144.9 },
    { week: 'S11', planned: 165.0, actual: 170.2 },
    { week: 'S12', planned: 180.0, actual: 178.8 },
];

const W = 600;
const H = 200;
const PAD = { top: 20, right: 20, bottom: 32, left: 48 };

const toX = (i: number, total: number) =>
    PAD.left + (i / (total - 1)) * (W - PAD.left - PAD.right);

const toY = (val: number, min: number, max: number) =>
    H - PAD.bottom - ((val - min) / (max - min)) * (H - PAD.top - PAD.bottom);

const buildPath = (points: { x: number; y: number }[]) => {
    if (!points.length) return '';
    return points.reduce((acc, p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        const prev = points[i - 1];
        const cx = (prev.x + p.x) / 2;
        return `${acc} C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`;
    }, '');
};

export default function SparklineChart() {
    const { isDarkMode } = useTheme();
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const allVals = DATA.flatMap(d => [d.planned, d.actual]);
    const min = Math.min(...allVals) * 0.95;
    const max = Math.max(...allVals) * 1.05;

    const plannedPts = DATA.map((d, i) => ({ x: toX(i, DATA.length), y: toY(d.planned, min, max) }));
    const actualPts = DATA.map((d, i) => ({ x: toX(i, DATA.length), y: toY(d.actual, min, max) }));

    const plannedPath = buildPath(plannedPts);
    const actualPath = buildPath(actualPts);

    const areaPlanned = `${plannedPath} L ${plannedPts[plannedPts.length - 1].x} ${H - PAD.bottom} L ${plannedPts[0].x} ${H - PAD.bottom} Z`;
    const areaActual = `${actualPath}  L ${actualPts[actualPts.length - 1].x}  ${H - PAD.bottom} L ${actualPts[0].x}  ${H - PAD.bottom} Z`;

    const lastActual = DATA[DATA.length - 1].actual;
    const lastPlanned = DATA[DATA.length - 1].planned;
    const deltaSign = lastActual <= lastPlanned ? 'positive' : 'negative';

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
        val: min + t * (max - min),
        y: toY(min + t * (max - min), min, max),
    }));

    return (
        <div className={`border rounded-[2.5rem] p-8 shadow-2xl transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-xl text-white">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <h3 className={`font-black text-base tracking-tight uppercase italic ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            Évolution des Coûts — 12 Semaines
                        </h3>
                        <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Prévisionnel vs Réel (M FCFA)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Legend */}
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-0.5 bg-indigo-400/60 border-dashed border-t border-indigo-400/60" />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Prévisionnel</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-0.5 bg-emerald-500" />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Réel</span>
                    </div>

                    {/* Delta badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-xs ${deltaSign === 'positive'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                        {deltaSign === 'positive' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                        {Math.abs(((lastActual - lastPlanned) / lastPlanned) * 100).toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* SVG Chart */}
            <div className="relative w-full overflow-x-auto">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full min-w-[320px]"
                    onMouseLeave={() => setHoveredIdx(null)}
                >
                    <defs>
                        <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Y grid lines */}
                    {yTicks.map((t, i) => (
                        <g key={i}>
                            <line
                                x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
                                stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} strokeWidth="1"
                            />
                            <text
                                x={PAD.left - 6} y={t.y + 4}
                                textAnchor="end" fontSize="9"
                                fill={isDarkMode ? '#475569' : '#94a3b8'}
                                fontWeight="700"
                            >
                                {Math.round(t.val)}M
                            </text>
                        </g>
                    ))}

                    {/* Area fills */}
                    <path d={areaPlanned} fill="url(#gradPlanned)" />
                    <path d={areaActual} fill="url(#gradActual)" />

                    {/* Lines */}
                    <path d={plannedPath} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="5 3" />
                    <path d={actualPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Interactive hit areas per segment */}
                    {DATA.map((_d, i) => {
                        const x = actualPts[i].x;
                        const segW = (W - PAD.left - PAD.right) / (DATA.length - 1);
                        return (
                            <rect
                                key={i}
                                x={x - segW / 2} y={PAD.top}
                                width={segW} height={H - PAD.top - PAD.bottom}
                                fill="transparent"
                                onMouseEnter={() => setHoveredIdx(i)}
                            />
                        );
                    })}

                    {/* Hover indicator */}
                    {hoveredIdx !== null && (() => {
                        const d = DATA[hoveredIdx];
                        const ax = actualPts[hoveredIdx].x;
                        const ay = actualPts[hoveredIdx].y;
                        const py = plannedPts[hoveredIdx].y;
                        return (
                            <g>
                                {/* vertical guide */}
                                <line x1={ax} y1={PAD.top} x2={ax} y2={H - PAD.bottom}
                                    stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="1" strokeDasharray="4 2" />

                                {/* Actual dot */}
                                <circle cx={ax} cy={ay} r="5" fill="#10b981" stroke={isDarkMode ? '#0f172a' : '#fff'} strokeWidth="2" />
                                {/* Planned dot */}
                                <circle cx={ax} cy={py} r="4" fill="#818cf8" stroke={isDarkMode ? '#0f172a' : '#fff'} strokeWidth="2" />

                                {/* Tooltip box */}
                                {(() => {
                                    const tooltipX = Math.min(ax, W - 140);
                                    const tooltipY = Math.max(ay - 70, PAD.top);
                                    return (
                                        <g>
                                            <rect
                                                x={tooltipX - 4} y={tooltipY - 4}
                                                width="138" height="62"
                                                rx="8"
                                                fill={isDarkMode ? '#1e293b' : '#f8fafc'}
                                                stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                                                strokeWidth="1"
                                            />
                                            <text x={tooltipX + 6} y={tooltipY + 12} fontSize="10" fontWeight="900"
                                                fill={isDarkMode ? '#94a3b8' : '#64748b'}>
                                                Semaine {d.week}
                                            </text>
                                            <circle cx={tooltipX + 8} cy={tooltipY + 26} r="3" fill="#10b981" />
                                            <text x={tooltipX + 16} y={tooltipY + 30} fontSize="10" fontWeight="700"
                                                fill="#10b981">
                                                Réel : {d.actual}M
                                            </text>
                                            <circle cx={tooltipX + 8} cy={tooltipY + 44} r="3" fill="#818cf8" />
                                            <text x={tooltipX + 16} y={tooltipY + 48} fontSize="10" fontWeight="700"
                                                fill="#818cf8">
                                                Prévu : {d.planned}M
                                            </text>
                                        </g>
                                    );
                                })()}
                            </g>
                        );
                    })()}

                    {/* X axis labels */}
                    {DATA.map((d, i) => (
                        <text
                            key={i}
                            x={actualPts[i].x} y={H - 6}
                            textAnchor="middle" fontSize="9"
                            fill={isDarkMode ? '#475569' : '#94a3b8'}
                            fontWeight="700"
                        >
                            {d.week}
                        </text>
                    ))}
                </svg>
            </div>

            {/* Footer summary */}
            <div className={`flex items-center justify-between mt-4 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    Données hebdomadaires cumulées · Mise à jour automatique
                </span>
                <div className="flex items-center gap-4">
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Total Prévu</span>
                        <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{lastPlanned}M FCFA</p>
                    </div>
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Total Réel</span>
                        <p className={`text-sm font-black ${deltaSign === 'positive' ? 'text-emerald-500' : 'text-rose-500'}`}>{lastActual}M FCFA</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
