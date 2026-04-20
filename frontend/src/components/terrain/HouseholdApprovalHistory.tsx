/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, Shield, AlertCircle, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import type { HouseholdApprovalHistory as HouseholdApprovalHistoryType } from '../../services/householdApprovalService';
import {
  getApprovalHistory,
  approveHouseholdStep,
  rejectHouseholdStep,
  calculateApprovalProgress,
  canApproveStep,
} from '../../services/householdApprovalService';
import logger from '../../utils/logger';

interface HouseholdApprovalHistoryComponentProps {
  householdId: string;
  userRole?: string;
  isAdmin?: boolean;
}

const roleLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CHEF_PROJET: {
    label: 'Chef de Projet',
    icon: <AlertCircle size={16} />,
    color: 'bg-blue-500',
  },
  ADMIN: {
    label: 'Administrateur',
    icon: <Shield size={16} />,
    color: 'bg-purple-500',
  },
  DIRECTEUR: {
    label: 'Directeur',
    icon: <Check size={16} />,
    color: 'bg-emerald-500',
  },
};

export const HouseholdApprovalHistory: React.FC<HouseholdApprovalHistoryComponentProps> = ({
  householdId,
  userRole,
  isAdmin = false,
}) => {
  const [history, setHistory] = useState<HouseholdApprovalHistoryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Valide que l'ID est un UUID (pas un ID numérique Kobo legacy)
  const isValidUUID = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const loadHistory = useCallback(
    async (signal?: AbortSignal) => {
      if (!isValidUUID(householdId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getApprovalHistory(householdId);
        if (signal?.aborted) return;
        if (data) {
          setHistory(data);
        }
      } catch (err) {
        if (signal?.aborted) return;
        logger.error('Failed to load approval history:', err);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [householdId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory]);

  const handleApprove = async (role: 'CHEF_PROJET' | 'ADMIN' | 'DIRECTEUR') => {
    if (!history) return;

    setApproving(role);
    try {
      const updated = await approveHouseholdStep(householdId, role, comment || undefined);
      if (updated) {
        setHistory(updated);
        setComment('');
        setExpandedStep(null);
        toast.success(`✅ ${role} approuvé!`);
      }
    } catch (err) {
      toast.error("❌ Erreur lors de l'approbation");
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (role: 'CHEF_PROJET' | 'ADMIN' | 'DIRECTEUR') => {
    if (!comment.trim()) {
      toast.error('Veuillez entrer une raison de rejet');
      return;
    }

    setApproving(role);
    try {
      const updated = await rejectHouseholdStep(householdId, role, comment);
      if (updated) {
        setHistory(updated);
        setComment('');
        setExpandedStep(null);
        toast.success(`⛔ ${role} rejeté`);
      }
    } catch (err) {
      toast.error('❌ Erreur lors du rejet');
    } finally {
      setApproving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin">
          <Clock size={24} className="text-slate-500" />
        </div>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="p-6 rounded-3xl text-center bg-white/5 border border-white/5 shadow-inner">
        <p className="text-sm font-black uppercase tracking-widest text-slate-500">
          Aucun historique d'approbation trouvé
        </p>
      </div>
    );
  }

  const progress = calculateApprovalProgress(history);

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300/30">
            Progression Approbation
          </span>
          <span className="text-sm font-black text-blue-400">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-white/5 border border-white/5 shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
          />
        </div>
      </div>

      {/* Steps Timeline */}
      <div className="space-y-4">
        {history.steps.map((step, idx) => {
          const config = roleLabels[step.role];
          const isExpanded = expandedStep === step.role;
          const canApprove = canApproveStep(userRole, step, isAdmin);

          let statusStyles = 'bg-white/5 border-white/5';
          if (step.status === 'approved') statusStyles = 'bg-emerald-500/10 border-emerald-500/20';
          if (step.status === 'rejected') statusStyles = 'bg-rose-500/10 border-rose-500/20';

          return (
            <motion.div
              key={step.role}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-3xl overflow-hidden border transition-all ${statusStyles}`}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedStep(isExpanded ? null : step.role)}
                className={`w-full p-5 flex items-center justify-between transition-all ${
                  canApprove && step.status === 'pending' ? 'hover:bg-white/5 cursor-pointer' : ''
                }`}
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${config.color}`}
                  >
                    {step.status === 'approved' ? (
                      <Check size={24} />
                    ) : step.status === 'rejected' ? (
                      <X size={24} />
                    ) : (
                      config.icon
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight text-white">
                      {config.label}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                      {step.status === 'approved' && step.approvedAt && (
                        <span className="text-emerald-400/80">
                          ✅ Approuvé - {new Date(step.approvedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                      {step.status === 'rejected' && (
                        <span className="text-rose-400/80">❌ Rejeté</span>
                      )}
                      {step.status === 'pending' && <span>⏳ En attente</span>}
                    </p>
                  </div>
                </div>

                {step.approvedBy && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 border border-blue-600/20">
                    {step.approvedBy}
                  </span>
                )}
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5 p-6 space-y-6 bg-slate-900/30"
                  >
                    {/* Comments */}
                    {step.comments && (
                      <div className="p-5 rounded-2xl flex gap-4 bg-white/5 border border-white/5">
                        <MessageCircle size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-slate-300 italic leading-relaxed">
                          {step.comments}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {canApprove && step.status === 'pending' && (
                      <div className="space-y-4">
                        <div className="relative">
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Ajouter une observation ou recommandation..."
                            className="w-full p-5 rounded-2xl text-sm bg-slate-950 border border-white/10 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-600"
                            rows={3}
                          />
                          <div className="absolute bottom-3 right-4 text-[10px] font-black text-slate-700">
                            {comment.length}/200
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleReject(step.role as any)}
                            disabled={approving === step.role || !comment.trim()}
                            className="flex-1 h-14 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-black text-xs uppercase transition-all disabled:opacity-30 flex items-center justify-center gap-2 border border-rose-500/20"
                          >
                            <X size={18} />
                            Rejeter
                          </button>
                          <button
                            onClick={() => handleApprove(step.role as any)}
                            disabled={approving === step.role}
                            className="flex-1 h-14 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white font-black text-xs uppercase transition-all disabled:opacity-30 flex items-center justify-center gap-2 border border-emerald-500/20"
                          >
                            {approving === step.role ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <Check size={18} />
                                Approuver
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Admin Override Info */}
                    {isAdmin && !canApprove && (
                      <div className="p-4 rounded-xl flex gap-3 text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        <Shield size={16} className="flex-shrink-0" />
                        <span>Mode Administrateur: Action disponible sur l'étape suivante</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Overall Status */}
      <div
        className={`p-6 rounded-[2rem] border-2 transition-all ${
          history.overallStatus === 'approved'
            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
            : 'bg-white/5 border-white/10'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl ${
              history.overallStatus === 'approved'
                ? 'bg-emerald-500 shadow-emerald-500/20'
                : 'bg-slate-700 shadow-slate-900/50'
            }`}
          >
            {history.overallStatus === 'approved' ? <Check size={28} /> : <Clock size={28} />}
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-tighter text-white">
              {history.overallStatus === 'approved' ? 'Audit Complété ✓' : 'Workflow en cours'}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
              Dernière mise à jour: {new Date(history.updatedAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      </div>

      {/* Reload Button */}
      <button
        onClick={() => loadHistory()}
        disabled={loading}
        className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5 active:scale-95 disabled:opacity-50"
      >
        🔄 Rafraîchir l'historique
      </button>
    </div>
  );
};

export default HouseholdApprovalHistory;
