import React from 'react';
import { Wifi } from 'lucide-react';
import GisHealthWidget from '../../components/terrain/GisHealthWidget';

interface BottomBarProps {
    filteredCount: number;
    totalCount?: number;       // Total in DB (may differ from viewport)
    isOfflineMode: boolean;
    auditResult: any;
    onFlyTo: (lng: number, lat: number) => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ filteredCount, totalCount, isOfflineMode, auditResult, onFlyTo }) => {
    // If viewport loading is active, filteredCount < totalCount
    const isViewportFiltered = totalCount !== undefined && filteredCount < totalCount;

    return (
        <div className="absolute bottom-6 left-1/2 z-10 flex max-w-[calc(100%-3rem)] -translate-x-1/2 items-center justify-center gap-4 pointer-events-none">
            <div className="pointer-events-auto">
                <div className="flex items-center gap-4 bg-[#050F1F] border border-white/10 p-2 rounded-2xl shadow-2xl">
                    <GisHealthWidget result={auditResult} isDarkMode onFlyTo={onFlyTo} />
                </div>
            </div>

            <div className="flex items-center gap-4 pointer-events-auto">
                <div className="flex items-center gap-3 p-2 rounded-full bg-[#050F1F] border border-white/10 shadow-xl">
                    {/* Viewport count */}
                    <span className="text-[10px] font-black px-3 py-1 text-blue-100 bg-blue-500/20 rounded-full tracking-widest uppercase">
                        {filteredCount.toLocaleString()} {isViewportFiltered ? 'DANS VIEWPORT' : 'POINTS VISIBLES'}
                    </span>

                    {/* Total in DB — only shown when viewport loading is active */}
                    {isViewportFiltered && totalCount !== undefined && (
                        <span className="text-[10px] font-black px-3 py-1 text-slate-400 bg-slate-500/10 rounded-full tracking-widest uppercase border border-slate-700/40">
                            {totalCount.toLocaleString()} TOTAL
                        </span>
                    )}

                    <div
                        className={`flex items-center gap-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                            isOfflineMode ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'
                        }`}
                    >
                        <Wifi size={10} />
                        {isOfflineMode ? 'Hors-Ligne' : 'Connecté'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(BottomBar);
