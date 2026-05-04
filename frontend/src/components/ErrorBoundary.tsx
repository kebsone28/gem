
/**
 * ErrorBoundary — Global error boundary
 * Catches uncaught render errors and displays a recovery UI.
 */

import React from 'react';
import logger from '../utils/logger';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('[ErrorBoundary] Uncaught error', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div role="alert" className="error-boundary-screen">
          <div className="error-boundary-icon">⚠️</div>
          <h1 className="error-boundary-title">
            Une erreur inattendue s'est produite
          </h1>
          <p className="error-boundary-message">
            {this.state.error?.message ?? 'Erreur inconnue'}
          </p>
          <div className="error-boundary-actions">
            <button
              onClick={this.handleReset}
              className="error-boundary-btn-primary"
            >
              Réessayer
            </button>
            <button
              onClick={() => window.location.reload()}
              className="error-boundary-btn-secondary"
            >
              Recharger la page
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="error-boundary-stack">
              {this.state.error?.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
