import React from 'react';
import { XCircle, Clock, MessageSquare, ShieldCheck, User, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLabels } from '@contexts/LabelsContext';

interface MissionApprovalStatusBannerProps {
  workflow: any;
  resourceName?: string;
}

export const MissionApprovalStatusBanner: React.FC<MissionApprovalStatusBannerProps> = ({
  workflow,
  resourceName = 'mission',
}) => {
  const { getLabel } = useLabels();
  if (!workflow) return null;

  const isApproved = workflow.overallStatus === 'approved';
  const isRejected = workflow.overallStatus === 'rejected';

  const labelValidated   = getLabel(`${resourceName}.validated`,        'Mission Officielle');
  const labelRejected    = getLabel(`${resourceName}.rejected`,         'Mission Rejetée');
  const labelPending     = getLabel(`${resourceName}.pending_approval`, 'Validation en cours');
  const labelSuccessDesc = getLabel(`${resourceName}.validation_success_desc`, "Votre ordre de mission est certifié et archivé");
  const labelFailureDesc = getLabel(`${resourceName}.validation_failure_desc`, "Des corrections sont nécessaires");
  const labelPendingDesc = getLabel(`${resourceName}.validation_pending_desc`, "En attente de validation finale");

  const decidedSteps = [...(workflow.steps || workflow.approvalSteps || [])]
    .filter((s) => ['APPROUVE', 'REJETE', 'approved', 'rejected'].includes(s.status))
    .sort((a, b) => {
      const tB = new Date(b.updatedAt || b.approvedAt || b.decidedAt || 0).getTime();
      const tA = new Date(a.updatedAt || a.approvedAt || a.decidedAt || 0).getTime();
      return tB - tA;
    });

  const lastStep = decidedSteps[0];

  /* palette */
  const palette = isApproved
    ? { bg: 'bg-emerald-500/8 border-emerald-500/20', glow: 'bg-emerald-500/12', text: 'text-emerald-400', iconBg: 'bg-emerald-500/15', dot: 'bg-emerald-500', tag: 'bg-emerald-500 text-white', Icon: ShieldCheck }
    : isRejected
    ? { bg: 'bg-rose-500/8 border-rose-500/20', glow: 'bg-rose-500/12', text: 'text-rose-400', iconBg: 'bg-rose-500/15', dot: 'bg-rose-500', tag: 'bg-rose-500 text-white', Icon: XCircle }
    : { bg: 'bg-amber-500/8 border-amber-500/20', glow: 'bg-amber-500/12', text: 'text-amber-400', iconBg: 'bg-amber-500/15', dot: 'bg-amber-400', tag: 'bg-amber-500 text-white', Icon: isRejected ? AlertCircle : Clock };

  const label = isApproved ? labelValidated : isRejected ? labelRejected : labelPending;
  const desc  = isApproved ? labelSuccessDesc : isRejected ? labelFailureDesc : labelPendingDesc;

  /* Pending with no decided steps = simplified banner */
  if (!lastStep && !isApproved && !isRejected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/8 border border-indigo-500/20 mb-4"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
          <Clock size={16} className="text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Validation en cours</p>
          <p className="text-[11px] font-semibold text-slate-400">En attente de validation par la direction ou l'administration</p>
        </div>
        <span className="shrink-0 text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
          En attente
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border ${palette.bg} p-5 mb-4`}
    >
      {/* Decorative glow */}
      <div className={`absolute -right-6 -top-6 w-28 h-28 ${palette.glow} blur-3xl rounded-full pointer-events-none`} />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">

        {/* Icon + label */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div className={`w-11 h-11 rounded-2xl ${palette.iconBg} border border-white/[0.07] flex items-center justify-center shrink-0`}>
            <palette.Icon size={20} className={palette.text} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${palette.text}`}>{label}</span>
              {workflow.orderNumber && isApproved && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg shadow-md ${palette.tag}`}>
                  N° {workflow.orderNumber}
                </span>
              )}
            </div>
            <p className="text-[13px] font-black text-white tracking-tight">{desc}</p>
          </div>
        </div>

        {/* Last comment card */}
        {lastStep && (
          <div className="w-full sm:w-auto sm:min-w-[260px] bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.07] p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare size={11} className={palette.text} />
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Dernier commentaire</span>
            </div>
            <p className={`text-[11px] font-semibold italic mb-3 leading-relaxed ${isRejected ? 'text-rose-400' : 'text-slate-400'}`}>
              "{lastStep.reasonIfRejected || lastStep.comment || lastStep.comments || 'Aucune observation particulière.'}"
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-white/[0.07] flex items-center justify-center">
                  <User size={8} className="text-slate-500" />
                </div>
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                  {lastStep.approvedBy || lastStep.roleName || lastStep.role || '—'}
                </span>
              </div>
              <span className="text-[8px] text-slate-700 font-bold">
                {(lastStep.updatedAt || lastStep.approvedAt)
                  ? new Date(lastStep.updatedAt || lastStep.approvedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                  : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
