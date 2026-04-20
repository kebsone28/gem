/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { remoteLogger } from '../../utils/remoteLogger';

interface Props {
  children?: ReactNode;
  title?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * COMPOSANT : WidgetErrorBoundary
 * Encapsule un widget pour éviter qu'un crash local ne fasse tomber toute l'application.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    remoteLogger.error(`Widget Crash: ${this.props.title || 'Unknown'}`, error, {
      componentStack: errorInfo.componentStack
    });
    console.error(`Widget Crash: ${this.props.title || 'Unknown'}`, error);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="glass-card !bg-rose-500/5 !border-rose-500/20 p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[200px]">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center">
            <AlertTriangle className="text-rose-500" size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-rose-500 uppercase tracking-widest mb-1">
               Composant Indisponible
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-rose-200/60 font-medium max-w-[200px] mx-auto">
              Une erreur interne est survenue dans ce module ({this.props.title}).
            </p>
          </div>
          <button 
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white text-[10px] font-black rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
          >
            <RefreshCcw size={12} />
            RÉESSAYER
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
