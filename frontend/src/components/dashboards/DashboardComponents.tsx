import React from 'react';
import {
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle2,
    Info,
    AlertTriangle,
    ArrowRight
} from 'lucide-react';

/* ─────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────── */
type StatusType = 'success' | 'warning' | 'danger' | 'info';

export const StatusBadge: React.FC<{ status: StatusType; label?: string }> = ({ status, label }) => {
    const styles = {
        success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        warning: 'bg-amber-50 text-amber-700 border-amber-100',
        danger: 'bg-rose-50 text-rose-700 border-rose-100',
        info: 'bg-blue-50 text-blue-700 border-blue-100',
    };

    const icons = {
        success: <CheckCircle2 size={14} />,
        warning: <AlertTriangle size={14} />,
        danger: <AlertCircle size={14} />,
        info: <Info size={14} />,
    };

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wider ${styles[status]}`}>
            {icons[status]}
            {label || status}
        </div>
    );
};

/* ─────────────────────────────────────────────
   PROGRESS BAR
───────────────────────────────────────────── */
interface ProgressBarProps {
    label: string;
    count?: string;
    percentage: number;
    status?: StatusType;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ label, count, percentage, status = 'info' }) => {
    const barColors = {
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-rose-500',
        info: 'bg-blue-600',
    };

    return (
        <div className="w-full space-y-2 py-2">
            <div className="flex justify-between items-end">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-tight">{label}</span>
                <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{percentage}%</span>
                    {count && <span className="ml-2 text-[10px] text-gray-400 font-medium">({count})</span>}
                </div>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-700 ease-out rounded-full ${barColors[status]}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   KPI CARD (WITH SPARKLINE)
───────────────────────────────────────────── */
interface KPICardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isUp: boolean;
        label: string;
    };
    sparkline?: number[]; // Values for a simple SVG chart
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, icon, trend, sparkline }) => {
    return (
        <div className="bg-white p-5 rounded-[14px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition-colors text-gray-400 group-hover:text-blue-600">
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-0.5 text-[11px] font-bold ${trend.isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {trend.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {trend.value}%
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</h3>
                <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>

                {trend && (
                    <p className="text-[10px] text-gray-500 font-medium mt-1">
                        {trend.label}
                    </p>
                )}
            </div>

            {sparkline && (
                <div className="mt-4 h-8 flex items-end gap-0.5">
                    {sparkline.map((h, i) => (
                        <div
                            key={i}
                            className="flex-1 bg-gray-100 rounded-t-sm group-hover:bg-blue-100 transition-colors"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────
   ACTION BAR
───────────────────────────────────────────── */
export const ActionBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex flex-wrap gap-3 items-center bg-gray-50/50 p-2 rounded-xl border border-gray-100/50">
        {children}
    </div>
);

/* ─────────────────────────────────────────────
   ACTIVITY FEED
───────────────────────────────────────────── */
interface Activity {
    id: string;
    type: StatusType;
    message: string;
    time: string;
}

export const ActivityFeed: React.FC<{ activities: Activity[] }> = ({ activities }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Dernières Activités</h3>
            <button className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                VOIR TOUT <ArrowRight size={10} />
            </button>
        </div>
        <div className="space-y-3">
            {activities.map((activity) => (
                <div key={activity.id} className="flex gap-3 items-start p-3 rounded-lg hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-100">
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${activity.type === 'success' ? 'bg-emerald-500' :
                            activity.type === 'warning' ? 'bg-amber-500' :
                                activity.type === 'danger' ? 'bg-rose-500' : 'bg-blue-500'
                        }`} />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 line-clamp-2">{activity.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium tracking-tight uppercase">{activity.time}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

/* ─────────────────────────────────────────────
   ALERT PANEL
───────────────────────────────────────────── */
export const AlertPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Alertes Critiques</h3>
        {children}
    </div>
);
