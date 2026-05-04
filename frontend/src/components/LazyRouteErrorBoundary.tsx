import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import logger from '../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  isRecovering: boolean;
}

function isDynamicImportFailure(error: Error | null) {
  const message = error?.message?.toLowerCase() ?? '';

  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('importing a module script failed')
  );
}

export class LazyRouteErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    isRecovering: false,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error, isRecovering: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('[LazyRouteErrorBoundary] Page load failed', error, info);
  }

  private clearLazyRetryFlags() {
    if (typeof window === 'undefined') {
      return;
    }

    const keysToClear: string[] = [];

    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith('lazy:')) {
        keysToClear.push(key);
      }
    }

    keysToClear.forEach((key) => window.sessionStorage.removeItem(key));
  }

  private async clearBrowserRuntimeCache() {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
    } catch (error) {
      logger.warn('[LazyRouteErrorBoundary] Cache cleanup failed during recovery', error);
    }
  }

  private handleReload = async () => {
    this.setState({ isRecovering: true });
    this.clearLazyRetryFlags();
    await this.clearBrowserRuntimeCache();
    window.location.reload();
  };

  private handleGoToDashboard = () => {
    this.clearLazyRetryFlags();
    window.location.assign('/dashboard');
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const dynamicImportFailure = isDynamicImportFailure(this.state.error);
    const title = dynamicImportFailure
      ? 'Impossible de charger cette page'
      : "Une erreur s'est produite pendant l'ouverture de la page";
    const description = dynamicImportFailure
      ? 'Le module de cette page n’a pas pu être chargé. Cela arrive souvent après un redémarrage de Vite ou quand le navigateur garde une ancienne version en cache.'
      : this.state.error.message || 'Une erreur inattendue a interrompu le chargement de la page.';

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-slate-950/40 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent px-8 py-8 border-b border-slate-800">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 text-xl font-bold">
              !
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-tight text-white">{title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{description}</p>
          </div>

          <div className="px-8 py-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 text-sm text-slate-300">
              <p className="font-semibold text-slate-100">Actions recommandées</p>
              <p className="mt-2">
                Recharge l’application pour retélécharger la page. Si le problème persiste,
                reviens au tableau de bord puis réessaie.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={this.handleReload}
                disabled={this.state.isRecovering}
                className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
              >
                {this.state.isRecovering ? 'Nettoyage...' : "Recharger l'application"}
              </button>
              <button
                onClick={this.handleGoToDashboard}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Retour au tableau de bord
              </button>
            </div>

            {import.meta.env.DEV && (
              <pre className="mt-6 overflow-auto rounded-2xl border border-rose-500/20 bg-rose-950/20 px-4 py-4 text-xs leading-5 text-rose-200">
                {this.state.error.stack || this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }
}
