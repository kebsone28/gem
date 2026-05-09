/**
 * 📋 WorkflowStepper - Composant d'affichage des étapes du workflow
 * Affiche les 4 étapes du processus d'entraînement supervisé
 */

import React from 'react';

const WORKFLOW_STEPS = [
  'Générer la réponse actuelle',
  'Reprendre la réponse comme base',
  'Mémoriser la correction',
  'Tester le remplacement',
];

interface WorkflowStepperProps {
  className?: string;
}

export default function WorkflowStepper({ className = '' }: WorkflowStepperProps) {
  return (
    <div className={`rounded-[1.25rem] border border-white/8 bg-slate-900/55 px-4 py-3 ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        Parcours conseillé
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {WORKFLOW_STEPS.map((step, index) => (
          <div key={step} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-[10px] font-black text-cyan-100">
              {index + 1}
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-300">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
