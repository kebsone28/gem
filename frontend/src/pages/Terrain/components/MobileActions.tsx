import React from 'react';
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
  return (
    <div className="md:hidden flex flex-col gap-2 mt-2">
      {/* View Mode Switchers */}
      {showListToggle && (
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#050F1F] border border-white/10 shadow-xl w-full">
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
        </div>
      )}

      {/* Advanced Tools (Toolbar) */}
      {showAdvancedTools && (
        <div className="rounded-2xl bg-[#050F1F]/80 backdrop-blur-xl border border-white/10 shadow-xl p-2 overflow-hidden">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.14em] px-1 mb-1.5">
            Outils avancés
          </div>
          <div className="overflow-x-auto overflow-y-hidden scrollbar-hide pb-1">
            <div className="pointer-events-auto w-max min-w-full px-0.5">
              <MapToolbar onRecenter={onRecenter} features={mapToolbarFeatures} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(MobileActions);
