import React from 'react';
import { XCircle, Clock, MessageSquare, ShieldCheck, User } from 'lucide-react';

interface MissionApprovalStatusBannerProps {
  workflow: any;
}

export const MissionApprovalStatusBanner: React.FC<MissionApprovalStatusBannerProps> = ({ workflow }) => {
  if (!workflow) return null;

  const isApproved = workflow.overallStatus === 'approved';
  const isRejected = workflow.overallStatus === 'rejected';
  
  // Find the last decided step to show feedback
  const decidedSteps = [...(workflow.steps || [])]
    .filter(s => s.status === 'APPROUVE' || s.status === 'REJETE' || s.status === 'approved' || s.status === 'rejected')
    .sort((a, b) => new Date(b.decidedAt || 0).getTime() - new Date(a.decidedAt || 0).getTime());

  const lastStep = decidedSteps[0];

  if (!lastStep && !isApproved && !isRejected) {
    return (
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Clock className="text-indigo-500" size={20} />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Status de Validation</h4>
            <p className="text-sm font-bold text-slate-700 dark:text-indigo-200">En attente de validation par la direction</p>
          </div>
        </div>
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
          Étape {workflow.currentStep || 1} / 1
        </div>
      </div>
    );
  }

  const bgColor = isApproved ? 'bg-emerald-500/10 border-emerald-500/20' : isRejected ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20';
  const textColor = isApproved ? 'text-emerald-500' : isRejected ? 'text-rose-500' : 'text-amber-500';
  const Icon = isApproved ? ShieldCheck : isRejected ? XCircle : Clock;

  return (
    <div className={`${bgColor} border rounded-[2rem] p-6 mb-8 relative overflow-hidden group`}>
      {/* Decorative background icon */}
      <Icon className={`absolute -right-4 -bottom-4 w-32 h-32 ${textColor} opacity-5 -rotate-12`} />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl ${isApproved ? 'bg-emerald-500/20' : isRejected ? 'bg-rose-500/20' : 'bg-amber-500/20'} flex items-center justify-center shadow-xl`}>
            <Icon className={textColor} size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${textColor}`}>
                {isApproved ? 'Mission Approuvée' : isRejected ? 'Mission Rejetée' : 'Validation en cours'}
              </h4>
              {workflow.orderNumber && isApproved && (
                <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter shadow-lg">
                  N° {workflow.orderNumber}
                </span>
              )}
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {isApproved ? 'Votre ordre de mission est certifié' : isRejected ? 'La mission nécessite des corrections' : 'En attente de signature finale'}
            </p>
          </div>
        </div>

        {lastStep && (
          <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[300px]">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={14} className={textColor} />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dernier Commentaire</span>
            </div>
            <p className={`text-xs font-bold italic mb-3 ${isRejected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
              "{lastStep.comment || 'Aucune observation particulière.'}"
            </p>
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-2">
               <div className="flex items-center gap-1.5">
                  <User size={12} className="text-slate-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{lastStep.decidedBy || lastStep.role}</span>
               </div>
               <span className="text-[9px] font-bold text-slate-400">
                  {lastStep.decidedAt ? new Date(lastStep.decidedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
               </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
