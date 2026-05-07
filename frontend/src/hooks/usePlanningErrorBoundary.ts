import React, { useCallback, useState } from 'react';
import { planningErrorHandler, PlanningErrorType, ErrorSeverity } from '../services/errorHandling/PlanningErrorHandler';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  isRecovering: boolean;
  retryCount: number;
}

interface UsePlanningErrorBoundaryOptions {
  maxRetries?: number;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onRecovery?: () => void;
  component?: string;
}

export const usePlanningErrorBoundary = (options: UsePlanningErrorBoundaryOptions = {}) => {
  const {
    maxRetries = 3,
    onError,
    onRecovery,
    component = 'PlanningComponent'
  } = options;

  const [state, setState] = useState<ErrorBoundaryState>({
    hasError: false,
    error: null,
    errorInfo: null,
    isRecovering: false,
    retryCount: 0,
  });

  const handleError = useCallback(async (error: Error, errorInfo: React.ErrorInfo) => {
    setState(prev => ({
      ...prev,
      hasError: true,
      error,
      errorInfo,
      isRecovering: false,
    }));

    const planningError = planningErrorHandler.createError(
      PlanningErrorType.CALCULATION_ERROR,
      `Erreur dans ${component}: ${error.message}`,
      {
        severity: ErrorSeverity.HIGH,
        technicalMessage: error.stack,
        context: {
          component,
          errorBoundary: true,
          errorInfo,
          retryCount: state.retryCount,
        },
        actionable: state.retryCount < maxRetries,
        suggestedAction: state.retryCount < maxRetries 
          ? 'Cliquez sur "Réessayer" pour tenter une récupération automatique'
          : 'Contactez le support technique',
      }
    );

    await planningErrorHandler.handleError(planningError);

    onError?.(error, errorInfo);
  }, [component, maxRetries, onError, state.retryCount]);

  const handleReset = useCallback(async () => {
    if (state.retryCount >= maxRetries) {
      return;
    }

    setState(prev => ({
      ...prev,
      isRecovering: true,
      retryCount: prev.retryCount + 1,
    }));

    try {
      await new Promise(resolve => setTimeout(resolve, 1000 * state.retryCount));
      
      setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRecovering: false,
        retryCount: state.retryCount + 1,
      });

      onRecovery?.();
    } catch (recoveryError) {
      await planningErrorHandler.handleError(
        planningErrorHandler.createError(
          PlanningErrorType.CALCULATION_ERROR,
          `Échec de la récupération automatique dans ${component}`,
          {
            severity: ErrorSeverity.HIGH,
            technicalMessage: recoveryError instanceof Error ? recoveryError.stack : String(recoveryError),
            context: { component, originalError: state.error },
          }
        )
      );
    }
  }, [state.retryCount, maxRetries, component, onRecovery, state.error]);

  const handleFallback = useCallback(() => {
    setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      retryCount: 0,
    });
  }, []);

  return {
    hasError: state.hasError,
    error: state.error,
    errorInfo: state.errorInfo,
    isRecovering: state.isRecovering,
    retryCount: state.retryCount,
    canRetry: state.retryCount < maxRetries,
    handleError,
    handleReset,
    handleFallback,
  };
};

interface ErrorFallbackProps {
  error: Error | null;
  retryCount: number;
  canRetry: boolean;
  isRecovering: boolean;
  onRetry: () => void;
  onFallback: () => void;
  component?: string;
}

export const PlanningErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  retryCount,
  canRetry,
  isRecovering,
  onRetry,
  onFallback,
  component = 'PlanningComponent'
}) => {
  return React.createElement('div', {
    className: 'min-h-[400px] flex items-center justify-center bg-gray-900 rounded-xl border border-red-500/20'
  }, [
    React.createElement('div', {
      key: 'content',
      className: 'max-w-md text-center p-8'
    }, [
      React.createElement('div', {
        key: 'icon',
        className: 'mb-6'
      }, [
        React.createElement('div', {
          key: 'circle',
          className: 'w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4'
        }, [
          React.createElement('svg', {
            key: 'svg',
            className: 'w-8 h-8 text-red-500',
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24'
          }, [
            React.createElement('path', {
              key: 'path',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeWidth: 2,
              d: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            })
          ])
        ])
      ]),
      
      React.createElement('h3', {
        key: 'title',
        className: 'text-xl font-bold text-white mb-2'
      }, 'Une erreur est survenue'),
      
      React.createElement('p', {
        key: 'subtitle',
        className: 'text-gray-400 mb-4'
      }, `Le composant ${component} a rencontré une erreur inattendue.`),
      
      error && React.createElement('div', {
        key: 'error-details',
        className: 'bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4'
      }, [
        React.createElement('p', {
          key: 'error-message',
          className: 'text-red-400 text-sm font-mono'
        }, error.message)
      ]),
      
      retryCount > 0 && React.createElement('div', {
        key: 'retry-info',
        className: 'bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4'
      }, [
        React.createElement('p', {
          key: 'retry-text',
          className: 'text-amber-400 text-sm'
        }, `Tentative ${retryCount}/${3} de récupération`)
      ])
    ]),

    React.createElement('div', {
      key: 'actions',
      className: 'flex flex-col gap-3'
    }, [
      canRetry && React.createElement('button', {
        key: 'retry-btn',
        onClick: onRetry,
        disabled: isRecovering,
        className: 'px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2'
      }, [
        isRecovering ? [
          React.createElement('div', {
            key: 'spinner',
            className: 'w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'
          }),
          React.createElement('span', { key: 'recovering-text' }, 'Récupération en cours...')
        ] : [
          React.createElement('svg', {
            key: 'refresh-icon',
            className: 'w-4 h-4',
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24'
          }, [
            React.createElement('path', {
              key: 'refresh-path',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeWidth: 2,
              d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
            })
          ]),
          React.createElement('span', { key: 'retry-text' }, 'Réessayer')
        ]
      ]),
      
      React.createElement('button', {
        key: 'fallback-btn',
        onClick: onFallback,
        className: 'px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors'
      }, 'Revenir à l\'état normal')
    ]),

    React.createElement('div', {
      key: 'help-text',
      className: 'mt-6 text-xs text-gray-500'
    }, 'Si le problème persiste, contactez le support technique avec les détails de l\'erreur.')
  ]);
};

interface PlanningErrorBoundaryWrapperProps {
  children: React.ReactNode;
  options?: UsePlanningErrorBoundaryOptions;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

export const PlanningErrorBoundaryWrapper: React.FC<PlanningErrorBoundaryWrapperProps> = ({
  children,
  options,
  fallback: CustomFallback = PlanningErrorFallback
}) => {
  const errorBoundary = usePlanningErrorBoundary(options);

  if (errorBoundary.hasError) {
    return React.createElement(CustomFallback, {
      error: errorBoundary.error,
      retryCount: errorBoundary.retryCount,
      canRetry: errorBoundary.canRetry,
      isRecovering: errorBoundary.isRecovering,
      onRetry: errorBoundary.handleReset,
      onFallback: errorBoundary.handleFallback,
      component: options?.component
    });
  }

  return React.createElement(React.Fragment, null, children);
};
