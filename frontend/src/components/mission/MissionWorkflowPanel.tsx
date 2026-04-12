import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  MissionApprovalWorkflow,
  MissionApprovalStep,
} from '../../constants/approvalConstants';
import {
  calculateApprovalProgress,
  getNextPendingStep,
  ROLE_LABELS,
} from '../../constants/approvalConstants';

interface MissionWorkflowPanelProps {
  workflow: MissionApprovalWorkflow | null;
  onSubmitForApproval: () => void;
  isSubmitting: boolean;
  isAdmin?: boolean;
}

export const MissionWorkflowPanel: React.FC<MissionWorkflowPanelProps> = ({
  workflow,
  onSubmitForApproval,
  isSubmitting,
}) => {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (!workflow) {
    return (
      <div className="glass-card !p-8 !rounded-[2.5rem] text-center space-y-4">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl inline-block">
          <AlertCircle size={24} className="text-indigo-600 dark:text-indigo-500 mx-auto" />
        </div>
        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
          Workflow Non Initialisé
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Soumettez la mission pour lancer le processus d'approbation sur le serveur
        </p>
        <button
          onClick={onSubmitForApproval}
          disabled={isSubmitting}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
        >
          {isSubmitting ? 'Soumission...' : 'Soumettre pour Approbation'}
        </button>
      </div>
    );
  }

  const progress = calculateApprovalProgress(workflow.steps);
  const nextStep = getNextPendingStep(workflow.steps);
  const isApproved = workflow.overallStatus === 'approved';

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'APPROUVE':
        return <CheckCircle2 size={20} className="text-emerald-500" />;
      case 'rejected':
      case 'REJETE':
        return <AlertCircle size={20} className="text-rose-500" />;
      default:
        return <AlertCircle size={20} className="text-slate-400 opacity-30" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progression Globale */}
      <div className="glass-card !p-6 !rounded-[2rem] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">
            État Approbations
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest text-white ${
              workflow.overallStatus === 'approved'
                ? 'bg-emerald-500'
                : workflow.overallStatus === 'rejected'
                  ? 'bg-rose-500'
                  : workflow.overallStatus === 'executed'
                    ? 'bg-amber-500'
                    : 'bg-slate-500'
            }`}
          >
            {workflow.overallStatus === 'approved'
              ? 'APPROUVÉE'
              : workflow.overallStatus === 'rejected'
                ? 'REJETÉE'
                : workflow.overallStatus === 'executed'
                  ? 'EXÉCUTÉE'
                  : 'EN ATTENTE'}
          </span>
        </div>

        {/* Barre Progression */}
        <div className="space-y-2">
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                workflow.overallStatus === 'approved'
                  ? 'bg-emerald-500'
                  : workflow.overallStatus === 'rejected'
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs font-bold text-right text-slate-500 dark:text-slate-400">
            {progress.toFixed(0)}% validé
          </div>
        </div>

        {/* Prochain Approbateur */}
        {nextStep && !isApproved && (
          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
            <p className="text-xs font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-1">
              ⏳ En Attente
            </p>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
              {nextStep.label || ROLE_LABELS[nextStep.role]}
            </p>
          </div>
        )}

        {isApproved && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-500" />
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-500">
              ✓ Mission Certifiée : {workflow.orderNumber}
            </span>
          </div>
        )}
      </div>

      {/* Timeline Approbations */}
      <div className="glass-card !p-6 !rounded-[2rem] space-y-4">
        <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">
          Historique Approbations
        </h3>

        <div className="space-y-3">
          {workflow.steps.map((step: MissionApprovalStep, index: number) => (
            <div key={step.role} className="relative">
              {/* Connecteur */}
              {index < workflow.steps.length - 1 && (
                <div className="absolute left-10 top-12 w-0.5 h-8 bg-slate-200 dark:bg-slate-700" />
              )}

              {/* Étape */}
              <div
                onClick={() => setExpandedStep(expandedStep === step.role ? null : step.role)}
                className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl hover:border-slate-300 dark:hover:border-white/10 transition-all text-left cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">{getStepIcon(step.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-black text-slate-900 dark:text-white text-sm">
                        {step.label || ROLE_LABELS[step.role]}
                      </h4>
                      {expandedStep === step.role ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                      {step.status === 'approved' || step.status === 'APPROUVE'
                        ? '✓ Approuvé'
                        : step.status === 'rejected' || step.status === 'REJETE'
                          ? '✗ Rejeté'
                          : 'En attente'}
                    </p>
                    {step.approvedAt && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Par: {step.approvedBy || 'Utilisateur'} •{' '}
                        {new Date(step.approvedAt).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Détails Expandus */}
                {expandedStep === step.role && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 space-y-3">
                    {step.comments && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">
                          Commentaire / Raison
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-bold">
                          {step.comments}
                        </p>
                      </div>
                    )}

                    {/* Actions Approbation (Si c'est l'étape courante on peut rediriger vers l'onglet Approbation) */}
                    {nextStep?.role === step.role && !isApproved && (
                      <div className="p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-center">
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mb-3">
                          Action Requise
                        </p>
                        <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-4 px-4">
                          Utilisez l'onglet 'APPROBATIONS' en haut de la page pour valider cette
                          étape avec votre signature.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
