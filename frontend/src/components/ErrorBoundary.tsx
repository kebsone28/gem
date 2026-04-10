/**
 * ErrorBoundary — Global error boundary
 * Catches uncaught render errors and displays a recovery UI.
 */

import React from 'react';

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
        console.error('❌ [ErrorBoundary] Uncaught error:', error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div
                    role="alert"
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#0D1E35',
                        color: '#fff',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        padding: '2rem',
                        gap: '1rem',
                        textAlign: 'center',
                    }}
                >
                    <div style={{ fontSize: '3rem' }}>⚠️</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                        Une erreur inattendue s'est produite
                    </h1>
                    <p style={{ color: '#94a3b8', maxWidth: '480px', margin: 0, fontSize: '0.9rem' }}>
                        {this.state.error?.message ?? 'Erreur inconnue'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                        <button
                            onClick={this.handleReset}
                            style={{
                                padding: '0.625rem 1.25rem',
                                borderRadius: '0.5rem',
                                background: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            Réessayer
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '0.625rem 1.25rem',
                                borderRadius: '0.5rem',
                                background: 'transparent',
                                color: '#94a3b8',
                                border: '1px solid #334155',
                                cursor: 'pointer',
                            }}
                        >
                            Recharger la page
                        </button>
                    </div>
                    {import.meta.env.DEV && (
                        <pre
                            style={{
                                marginTop: '1.5rem',
                                background: '#1e293b',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.75rem',
                                color: '#f87171',
                                maxWidth: '640px',
                                overflow: 'auto',
                                textAlign: 'left',
                            }}
                        >
                            {this.state.error?.stack}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
