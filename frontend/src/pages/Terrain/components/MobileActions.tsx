import React, { useState } from 'react';
import { X } from 'lucide-react';
import { MapToolbar } from '../../../components/terrain/MapToolbar';

interface MobileActionsProps {
  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;
  showListToggle: boolean;
  showAdvancedTools: boolean;
  onRecenter: () => void;
  mapToolbarFeatures?: any;
}

const MobileActions: React.FC<MobileActionsProps> = ({
  viewMode,
  onViewModeChange,
  showListToggle,
  showAdvancedTools,
  onRecenter,
  mapToolbarFeatures,
}) => {
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  return (
    <div className="md:hidden flex flex-col gap-2 mt-2">
      {/* View Mode Switchers */}
      {(showListToggle || showAdvancedTools) && (
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#050F1F] border border-white/10 shadow-xl w-full">
          {showListToggle && (
            <>
          <button
            onClick={() => onViewModeChange('map')}
            className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition ${
              viewMode === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            Carte
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition ${
              viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            Liste
          </button>
            </>
          )}
          {showAdvancedTools && (
            <button
              type="button"
              onClick={() => setIsToolsOpen(true)}
              className="flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 transition hover:bg-white/5 hover:text-blue-200"
            >
              Outils
            </button>
          )}
        </div>
      )}

      {/* Advanced Tools (Toolbar) */}
      {showAdvancedTools && (
        <>
          {isToolsOpen && (
            <div className="fixed inset-0 z-[3300] flex items-end bg-black/55 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
              <button
                type="button"
                aria-label="Fermer les outils terrain"
                className="absolute inset-0 cursor-default"
                onClick={() => setIsToolsOpen(false)}
              />
              <div className="relative w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">
                      Outils terrain
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      Carte, couches, itinéraire, grappes et exports.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsToolsOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300"
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="max-h-[48dvh] overflow-y-auto p-4">
                  <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-2 scrollbar-hide">
                    <div className="w-max min-w-full">
                      <MapToolbar onRecenter={onRecenter} features={mapToolbarFeatures} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default React.memo(MobileActions);
