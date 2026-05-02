/**
 * TerrainErrorBoundary.tsx
 * Error boundary specialized for the Terrain module.
 * Catches unhandled React rendering errors and displays a recovery UI
 * instead of a full blank screen, keeping field agents productive.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, MapPin } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error UI to identify which section crashed */
  sectionName?: string;
  /** If true, renders a compact inline error (for panels), else full-page */
  compact?: boolean;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class TerrainErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erreur inconnue',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev, could be forwarded to Sentry in prod
    console.error(`[TerrainErrorBoundary] Error in "${this.props.sectionName}":`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { sectionName = 'Module Terrain', compact = false } = this.props;

    if (compact) {
      // ── Inline compact error (for panels/sidebars) ──────────────────────
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 border border-rose-500/30">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">
              Erreur dans {sectionName}
            </p>
            <p className="text-[9px] text-slate-500 mt-1 max-w-[220px] leading-relaxed">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all active:scale-95"
          >
            <RefreshCw size={11} /> Réessayer
          </button>
        </div>
      );
    }

    // ── Full-page error (for the map container) ─────────────────────────
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#050F1F]">
        <div className="flex flex-col items-center gap-6 p-10 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl text-center max-w-sm shadow-2xl">
          {/* Icon */}
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
              <MapPin size={36} className="text-rose-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-rose-500 border-2 border-[#050F1F] flex items-center justify-center">
              <AlertTriangle size={12} className="text-white" />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">
              Module Terrain Hors Service
            </p>
            <h2 className="text-xl font-black text-white uppercase tracking-tight leading-tight">
              {sectionName} a rencontré<br />une erreur critique
            </h2>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-2 font-mono bg-black/30 px-3 py-2 rounded-xl border border-white/5">
              {this.state.errorMessage}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col w-full gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95 shadow-lg shadow-blue-600/30"
            >
              <RefreshCw size={14} /> Relancer le composant
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all active:scale-95"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default TerrainErrorBoundary;
