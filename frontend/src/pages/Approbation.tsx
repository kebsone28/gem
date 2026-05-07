/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  ClipboardList,
  PenTool,
  DollarSign,
  Users,
  Calendar,
  FileText,
  MapPin,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Clock,
  Banknote,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as missionApprovalService from '../services/missionApprovalService';
import { PageContainer, PageHeader } from '../components';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureModal from '../components/common/SignatureModal';
import { fmtFCFA } from '../utils/format';
import { syncEventBus, SYNC_EVENTS } from '../utils/syncEventBus';
import StockMonitorWidget from '../components/logistique/StockMonitorWidget';
import logger from '../utils/logger';
import { normalizeMissionApprovalRole } from '../utils/roleUtils';
import { usePermissions } from '../hooks/usePermissions';
import {
  getMissionStartInDays,
  isMissionUrgent,
  summarizeDeleteSettlements,
} from './approbationUtils';

const REJECTION_CATEGORIES = [
  { value: 'DONNEES_INCOMPLETES', label: 'Données incomplètes' },
  { value: 'BUDGET_INCOHERENT', label: 'Budget incohérent' },
  { value: 'MISSION_HORS_PERIMETRE', label: 'Mission hors périmètre' },
  { value: 'PLANNING_INCOHERENT', label: 'Planning incohérent' },
  { value: 'JUSTIFICATIFS_MANQUANTS', label: 'Justificatifs manquants' },
  { value: 'AUTRE', label: 'Autre motif' },
];

export default function Approbation() {
  const { user } = useAuth();
  const { peut, PERMISSIONS } = usePermissions();
  const [pendingMissions, setPendingMissions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalBudgetCertified: 0,
    sla: {
      avgPendingHours: 0,
      overOneHour: 0,
      over24Hours: 0,
      avgApprovalHours: 0,
      measuredApproved: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<any | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [rejectionCategory, setRejectionCategory] = useState('DONNEES_INCOMPLETES');
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'urgent'>('all');
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDecisionSubmitting, setIsDecisionSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [failedDeleteIds, setFailedDeleteIds] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<
    | { mode: 'single'; missionId: string; title: string }
    | { mode: 'bulk'; count: number }
    | null
  >(null);

  // ── ROLES & PERMISSIONS (VERSION ENTERPRISE) ──
  const userRole = (user?.role || 'USER').toUpperCase();
  const normalizedWorkflowRole = normalizeMissionApprovalRole(userRole) || userRole;
  const roleMetrics = {
    isAdmin: normalizedWorkflowRole === 'ADMIN',
    isDG: userRole === 'DG_PROQUELEC',
    isDirector: normalizedWorkflowRole === 'DIRECTEUR',
    isAccountant: ['COMPTABLE', 'FINANCE'].includes(userRole),
    isProjectManager: ['CHEF_PROJET', 'PROJECT_MANAGER'].includes(userRole),
  };

  const isAdmin = roleMetrics.isAdmin || roleMetrics.isDG;
  const isDirector = roleMetrics.isDirector || roleMetrics.isDG;
  const isAccountant = roleMetrics.isAccountant;
  const isProjectManager = roleMetrics.isProjectManager;

  const canDelete = isAdmin || isDirector;

  // Role mapping for approval workflow levels
  const workflowRole = normalizedWorkflowRole;

  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, archive: 0 });
  const isValidator = peut(PERMISSIONS.VALIDER_MISSION) || isAdmin || isDirector;

  const fetchPending = async (silent = false) => {
    if (!isValidator) {
      setPendingMissions([]);
      setSelectedMission(null);
      setIsLoading(false);
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      // Optimized : Single fetch for current mode
      const result = (await missionApprovalService.getPendingApprovals(isArchiveMode)) as any;

      const missions = result.missions || [];
      setPendingMissions(missions);
      setStats(
        result.stats || {
          totalBudgetCertified: 0,
          sla: {
            avgPendingHours: 0,
            overOneHour: 0,
            over24Hours: 0,
            avgApprovalHours: 0,
            measuredApproved: 0,
          },
        }
      );

      // Update metrics based on loaded data
      setCounts((prev) => ({
        ...prev,
        [isArchiveMode ? 'archive' : 'pending']: missions.length,
      }));

      // Maintain selection if possible
      setSelectedMission((prevSelected: any) => {
        if (prevSelected && missions.some((m: any) => m.id === prevSelected.id)) {
          return missions.find((m: any) => m.id === prevSelected.id);
        }
        return missions.length > 0 ? missions[0] : null;
      });
    } catch (error) {
      toast.error('Erreur lors du chargement des approbations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, [isArchiveMode, isValidator]);

  useEffect(() => {
    if (!isValidator) return;
    const interval = window.setInterval(() => fetchPending(true), 10000);
    return () => window.clearInterval(interval);
  }, [isArchiveMode, isValidator]);

  useEffect(() => {
    // 🔄 Auto-synchronisation intelligente du composant d'Approbation
    const handleSync = () => {
      fetchPending(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchPending(true);
    };

    const handleFocus = () => fetchPending(true);

    const unsubSaved = syncEventBus.subscribe(SYNC_EVENTS.MISSION_SAVED, handleSync);
    const unsubSubmitted = syncEventBus.subscribe(SYNC_EVENTS.MISSION_SUBMITTED, handleSync);
    const unsubUpdated = syncEventBus.subscribe(SYNC_EVENTS.MISSION_UPDATED, handleSync);
    const unsubCertified = syncEventBus.subscribe(SYNC_EVENTS.MISSION_CERTIFIED, handleSync);
    const unsubNotification = syncEventBus.subscribe('notification', handleSync);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubSaved();
      unsubSubmitted();
      unsubUpdated();
      unsubCertified();
      unsubNotification();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isArchiveMode, isValidator]); // On recommence pour garantir que le fetch lit bien `isArchiveMode` actuel

  const filteredMissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pendingMissions.filter((mission) => {
      const missionText = [
        mission.title,
        mission.description,
        mission.orderNumber,
        mission.user?.name,
        mission.data?.purpose,
        mission.data?.region,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !q || missionText.includes(q);
      const startDays = getMissionStartInDays(mission.startDate);
      const matchesUrgency = urgencyFilter === 'all' || startDays <= 3;
      return matchesSearch && matchesUrgency;
    });
  }, [pendingMissions, search, urgencyFilter]);

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setConfirmDialog({ mode: 'single', missionId: id, title });
  };

  const executeBulkDelete = async () => {
    const count = pendingMissions.length;
    if (count === 0) return;
    setIsDeleting(true);
    try {
      const chunkSize = 20;
      let successCount = 0;
      const failedIdsAggregate: string[] = [];
      const actionId = globalThis.crypto?.randomUUID?.() || `bulk-delete-${Date.now()}`;

      for (let i = 0; i < pendingMissions.length; i += chunkSize) {
        const chunk = pendingMissions.slice(i, i + chunkSize);
        const chunkIds = chunk.map((m: any) => m.id);
        const results = await Promise.allSettled(
          chunk.map((m) => missionApprovalService.deleteMission(m.id))
        );
        const summary = summarizeDeleteSettlements(chunkIds, results);
        successCount += summary.successCount;
        failedIdsAggregate.push(...summary.failedIds);
      }

      if (successCount > 0) {
        toast.success(`${successCount} soumission(s) ont été supprimées`);
      }
      if (failedIdsAggregate.length > 0) {
        toast.error(
          `${failedIdsAggregate.length} suppression(s) ont échoué (droits ou statut non brouillon côté serveur).`
        );
      }
      setFailedDeleteIds(failedIdsAggregate);
      logger.info('[Approbation] bulk delete summary', {
        actionId,
        requested: count,
        succeeded: successCount,
        failed: failedIdsAggregate.length,
      });
      setSelectedMission(null);
      await fetchPending();
    } catch (error) {
      toast.error('Erreur lors de la suppression groupée');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    const count = pendingMissions.length;
    if (count === 0) return;
    setConfirmDialog({ mode: 'bulk', count });
  };

  // ── RENDERS HELPERS (CLEAN CODE) ──
  const renderArchiveStatus = () => {
    if (!selectedMission) return null;
    const workflow = selectedMission.approvalWorkflow;
    const steps = workflow?.approvalSteps || [];

    return (
      <div className="space-y-6 relative z-10">
        <div className="p-8 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Sceau d'intégrité en arrière-plan */}
          <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12">
            <ShieldCheck size={120} />
          </div>

          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-6 ring-8 ring-emerald-500/5 shadow-inner">
            <CheckCircle2 size={40} />
          </div>

          <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">
            Mission Certifiée & Sécurisée
          </h4>

          <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-6 shadow-lg shadow-emerald-500/20">
            <Sparkles size={12} /> Doc. Officiel : {selectedMission.orderNumber}
          </div>

          {/* SHA-256 Integrity Badge */}
          {workflow?.integrityHash && (
            <div className="w-full max-w-md p-4 bg-slate-950/80 rounded-2xl border border-white/5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                  Empreinte Numérique (SHA-256)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black">
                  CERTIFIÉ GEM
                </span>
              </div>
              <code className="text-[10px] text-emerald-400 font-mono break-all opacity-80">
                {workflow.integrityHash}
              </code>
            </div>
          )}

          <div className="flex gap-4 w-full max-w-md">
            <button
              onClick={async () => {
                try {
                  await missionApprovalService.downloadCertifiedMissionDocument(
                    selectedMission.id,
                    `Ordre_Mission_${selectedMission.orderNumber || selectedMission.id}.pdf`
                  );
                  toast.success('Document certifié téléchargé');
                } catch (e) {
                  toast.error("Erreur d'exportation");
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all active:scale-95 shadow-xl"
            >
              <FileText size={16} /> Rapport PDF
            </button>
          </div>
        </div>

        {/* Validation Timeline Card */}
        <div className="glass-card !p-8 !rounded-[2.5rem] border-white/5">
          <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <ClipboardList size={14} className="text-indigo-400" />
            Chaîne de Responsabilité (Audit de Signature)
          </h5>

          <div className="space-y-4">
            {steps.map((step: any, i: number) => {
              const normalizedStatus = step.status?.toString().toUpperCase();
              const isDone = normalizedStatus === 'APPROVED' || normalizedStatus === 'APPROUVE';
              const isRejected = normalizedStatus === 'REJECTED' || normalizedStatus === 'REJETE';
              return (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white/2 border border-white/5"
                >
                  <div
                    className={`mt-1 p-2 rounded-xl ${
                      isDone
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : isRejected
                          ? 'bg-rose-500/10 text-rose-500'
                          : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 size={16} />
                    ) : isRejected ? (
                      <AlertTriangle size={16} />
                    ) : (
                      <Clock size={16} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-white uppercase italic">
                        {step.label || step.role}
                      </span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase">
                        {step.decidedAt
                          ? new Date(step.decidedAt).toLocaleDateString()
                          : '--/--/----'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic mb-2">
                      {step.comment || 'Aucune observation formulée.'}
                    </p>
                    {step.signature && (
                      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 border border-white/5">
                        <PenTool size={10} className="text-emerald-500" />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                          Signature Électronique Vérifiée
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderApprovalPanel = () => {
    if (!selectedMission) return null;
    const workflow = selectedMission.approvalWorkflow;
    const currentStep = workflow?.approvalSteps?.find(
      (s: any) => s.sequence === workflow.currentStep
    );
    const isMyTurn = currentStep?.role === workflowRole || isAdmin;

    if (!isMyTurn) {
      return (
        <div className="p-10 rounded-[2.5rem] bg-amber-500/5 border border-amber-500/20 relative z-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mb-4">
            <Clock size={32} />
          </div>
          <h4 className="text-sm font-black text-white uppercase italic mb-2">
            En attente d'une autre validation
          </h4>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-xs">
            Cette mission est actuellement à l'étape {workflow?.currentStep} (
            {currentStep?.label || currentStep?.role}). Vous pourrez intervenir dès que cette
            validation Direction / Administration sera disponible.
          </p>
        </div>
      );
    }

    return (
      <div className="p-10 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-500">
            <PenTool size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-tight italic">
              Panel de Décision ({currentStep?.label || workflowRole})
            </h4>
            <p className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">
              La validation finale attribuera le numéro officiel de mission
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Observations de validation ou motif détaillé de rejet..."
            className="w-full bg-slate-950/50 border border-white/5 rounded-3xl p-6 text-white text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none resize-none transition-all placeholder:text-slate-700"
            rows={3}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                Catégorie si rejet
              </span>
              <select
                value={rejectionCategory}
                onChange={(e) => setRejectionCategory(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                {REJECTION_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Règle décision
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Le rejet exige un motif clair. La validation enregistre la signature, le rôle,
                l’heure et l’empreinte d’intégrité côté serveur.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <button
              onClick={async () => {
                setIsAiLoading(true);
                try {
                  const result = await missionApprovalService.analyzeMissionIA(selectedMission.id);
                  setAiAnalysis(result);
                } catch (e) {
                  toast.error("Échec de l'analyse IA");
                } finally {
                  setIsAiLoading(false);
                }
              }}
              disabled={isAiLoading || isDecisionSubmitting}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-2xl transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50"
            >
              <Sparkles size={18} className={isAiLoading ? 'animate-spin' : ''} />
              {isAiLoading ? 'Audit...' : 'Audit IA Strategique'}
            </button>

            <button
              onClick={() => {
                if (comment.trim().length < 8) {
                  toast.error('Indiquez un motif de rejet plus précis.');
                  return;
                }
                setDecisionType('reject');
                setIsSignatureModalOpen(true);
              }}
              disabled={isDecisionSubmitting}
              className="flex-1 px-8 py-4 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-500/20 rounded-2xl transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50"
            >
              Rejeter
            </button>

            <button
              onClick={() => {
                setDecisionType('approve');
                setIsSignatureModalOpen(true);
              }}
              disabled={isDecisionSubmitting}
              className="flex-[2] flex items-center justify-center gap-3 px-8 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              {isDecisionSubmitting ? 'Traitement...' : 'Valider la Mission'}
            </button>
          </div>

          {aiAnalysis && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-8 rounded-[2.5rem] bg-indigo-600/5 border border-indigo-500/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap size={60} className="text-indigo-400" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Sparkles size={16} className="text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                  Rapport du Mentor IA
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed text-indigo-100/80 italic">
                {aiAnalysis.analysis}
              </p>
              <button
                onClick={() => setAiAnalysis(null)}
                className="mt-4 text-[9px] font-black uppercase text-indigo-500/50 hover:text-indigo-500"
              >
                Fermer l'analyse
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  };

  const handleDecision = async (signatureData?: string) => {
    if (!selectedMission) return;
    setIsDecisionSubmitting(true);
    try {
      let result: any = null;
      const actionId = globalThis.crypto?.randomUUID?.() || `approval-decision-${Date.now()}`;
      const idempotencyKey = `approval:${selectedMission.id}:${decisionType}:${actionId}`;

      if (decisionType === 'approve') {
        result = await missionApprovalService.approveMissionStep(
          selectedMission.id,
          workflowRole as any,
          comment,
          signatureData,
          undefined,
          idempotencyKey
        );
      } else {
        if (comment.trim().length < 8) {
          toast.error('Indiquez un motif de rejet plus précis.');
          return;
        }
        await missionApprovalService.rejectMission(
          selectedMission.id,
          workflowRole as any,
          comment.trim(),
          rejectionCategory,
          idempotencyKey
        );
      }

      // 1. Unify selectedMission update (Avoid double renders and inconsistencies)
      const finalOrderNumber = result?.orderNumber || selectedMission.orderNumber;
      const finalStatus = decisionType === 'approve' ? 'approuvee' : 'rejetee';

      setSelectedMission((prev: any) => ({
        ...prev,
        status: finalStatus,
        orderNumber: finalOrderNumber,
        isCertified: decisionType === 'approve',
        updatedAt: new Date().toISOString(),
      }));

      // 2. Email automation with REAL latest ID (Phase 4 protection)
      if (decisionType === 'approve') {
        try {
          await missionApprovalService.downloadCertifiedMissionDocument(
            selectedMission.id,
            `Ordre_Mission_${finalOrderNumber || selectedMission.id}.pdf`
          );
        } catch (pdfErr) {
          logger.warn('[Approbation] Certified PDF download failed after approval', pdfErr);
        }
      }

      toast.success(
        decisionType === 'approve' ? 'Mission certifiée et enregistrée' : 'Mission rejetée'
      );
      logger.info('[Approbation] decision submitted', {
        actionId,
        missionId: selectedMission.id,
        decisionType,
        role: workflowRole,
      });
      fetchPending();
      setIsSignatureModalOpen(false);
      setComment('');
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Une erreur est survenue lors de la décision';
      toast.error(message);
    } finally {
      setIsDecisionSubmitting(false);
    }
  };

  if (isLoading && pendingMissions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isValidator) {
    return (
      <PageContainer className="min-h-screen bg-slate-950 py-8">
        <PageHeader
          title="Validation des Missions"
          subtitle="ACCÈS RÉSERVÉ À LA DIRECTION ET À L’ADMINISTRATION"
          icon={<ShieldCheck size={24} className="text-emerald-500" />}
        />
        <div className="mt-8 glass-card !p-8 !rounded-[2rem] border-amber-500/20 bg-amber-500/5 text-center">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-400">
            Accès restreint
          </p>
          <p className="mt-3 text-sm text-slate-300">
            Les missions peuvent être soumises par les équipes, mais la validation finale est
            réservée au directeur ou à l’administrateur.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      <PageHeader
        title="Cockpit Direction Générale"
        subtitle="TABLEAU DE BORD DE CERTIFICATION"
        icon={<ShieldCheck size={24} className="text-emerald-500" />}
      />

      {/* ── KPI BAR DG ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[
          {
            label: 'En attente',
            value: pendingMissions.length,
            sub: 'missions à certifier',
            icon: <Clock size={18} />,
            color: 'amber',
          },
          {
            label: 'Engagements',
            value: fmtFCFA(stats.totalBudgetCertified),
            sub: 'total missions certifiées',
            icon: <Banknote size={18} />,
            color: 'blue',
          },
          {
            label: 'Urgentes',
            value: pendingMissions.filter((m) => isMissionUrgent(m.startDate)).length,
            sub: 'départ dans ≤ 3 jours',
            icon: <AlertTriangle size={18} />,
            color: 'rose',
          },
          {
            label: 'SLA validation',
            value: `${stats.sla?.avgPendingHours || 0}h`,
            sub: `${stats.sla?.overOneHour || 0} relance(s) horaire`,
            icon: <TrendingUp size={18} />,
            color: 'emerald',
          },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`glass-card !p-6 !rounded-3xl border-white/5 flex items-center gap-4`}
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0
                            ${
                              kpi.color === 'amber'
                                ? 'bg-amber-500/10 text-amber-500'
                                : kpi.color === 'blue'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : kpi.color === 'rose'
                                    ? 'bg-rose-500/10 text-rose-500'
                                    : 'bg-emerald-500/10 text-emerald-500'
                            }`}
            >
              {kpi.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">
                {kpi.label}
              </div>
              <div className="text-lg font-black text-white tracking-tight truncate">
                {kpi.value}
              </div>
              <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                {kpi.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 mt-8">
        {/* ── COLONNE GAUCHE: LISTE DES SOUMISSIONS ── */}
        <div className="xl:col-span-4 space-y-6">
          <StockMonitorWidget />

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-3 shadow-xl shadow-slate-950/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.26em] text-blue-300">
                  Validation missions
                </p>
                <h3 className="mt-1 text-lg font-black uppercase leading-tight tracking-tight text-white">
                  {isArchiveMode ? 'Archives' : 'Soumissions'}
                </h3>
                <p className="mt-0.5 text-[10px] font-bold text-slate-500">
                  {filteredMissions.length}/{pendingMissions.length} visible(s)
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {canDelete && !isArchiveMode && (
                  <button
                    onClick={handleDeleteAll}
                    disabled={pendingMissions.length === 0 || isDeleting}
                    title={
                      pendingMissions.length > 0
                        ? 'Tout supprimer définitivement'
                        : 'La liste est déjà vide'
                    }
                    className={`h-9 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest transition-all
                      ${
                        pendingMissions.length > 0
                          ? 'border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                          : 'border border-white/5 bg-slate-900 text-slate-600 opacity-50 cursor-not-allowed'
                      }`}
                  >
                    {isDeleting ? 'Suppression...' : 'Vider'}
                  </button>
                )}
                <button
                  title="Actualiser la liste"
                  onClick={() => fetchPending()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200 transition-all hover:bg-blue-500/20"
                >
                  <ClipboardList size={15} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setSelectedMission(null);
                  setIsArchiveMode(!isArchiveMode);
                }}
                className={`flex h-10 min-w-0 items-center gap-2 rounded-2xl border px-3 text-[10px] font-black uppercase tracking-[0.18em] transition-all
                  ${
                    isArchiveMode
                      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  }`}
              >
                <span>{isArchiveMode ? 'En attente' : 'Archives'}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${
                    isArchiveMode
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  }`}
                >
                  {isArchiveMode ? counts.pending : counts.archive}
                </span>
              </button>

              <button
                onClick={() => setUrgencyFilter((prev) => (prev === 'urgent' ? 'all' : 'urgent'))}
                aria-pressed={urgencyFilter === 'urgent'}
                className={`h-10 rounded-2xl border px-3 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                  urgencyFilter === 'urgent'
                    ? 'border-rose-400/40 bg-rose-500 text-white shadow-lg shadow-rose-600/20'
                    : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                Urgentes
              </button>
            </div>

            <div className="mt-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher mission, demandeur, région..."
                className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-[12px] font-bold text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[66vh] overflow-y-auto pr-1.5 custom-scrollbar">
            {filteredMissions.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.03] py-12 text-center">
                <CheckCircle2 size={34} className="mx-auto mb-3 text-emerald-500/25" />
                <p className="text-slate-500 font-bold text-xs uppercase italic">
                  Aucune mission {isArchiveMode ? 'archivée' : 'en attente'}
                </p>
              </div>
            ) : (
              filteredMissions.map((mission) => {
                const budget = mission.budget || 0;
                const days = getMissionStartInDays(mission.startDate);
                const isUrgent = isMissionUrgent(mission.startDate);
                const score = Math.min(10, budget / 500000 + (isUrgent ? 3 : 0));

                return (
                  <motion.div
                    key={mission.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      setSelectedMission(mission);
                      setAiAnalysis(null);
                      setComment('');
                      setRejectionCategory('DONNEES_INCOMPLETES');
                    }}
                    className={`approval-mission-card group rounded-[1.55rem] border p-3.5 transition-all cursor-pointer relative overflow-hidden ${
                      selectedMission?.id === mission.id
                        ? 'border-blue-400/70 bg-blue-600/95 shadow-xl shadow-blue-950/40 ring-2 ring-blue-300/20'
                        : 'border-white/10 bg-slate-950/55 hover:border-blue-400/35 hover:bg-slate-900/70'
                    }`}
                  >
                    {/* Background Urgency Glow */}
                    {isUrgent && selectedMission?.id !== mission.id && (
                      <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-rose-500/10 blur-2xl" />
                    )}

                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          {isUrgent && (
                            <span className="rounded-full border border-rose-400/25 bg-rose-500/20 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest text-rose-100">
                              Urgent
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.2em] ${
                              selectedMission?.id === mission.id
                                ? 'bg-white/10 text-white/70'
                                : 'bg-white/[0.04] text-slate-500'
                            }`}
                          >
                            ID: {mission.id.substring(0, 8)}
                          </span>
                        </div>
                        <h3
                          className={`approval-mission-title text-[13px] font-black uppercase leading-snug tracking-tight ${
                            selectedMission?.id === mission.id ? 'text-white' : 'text-slate-200'
                          }`}
                        >
                          {mission.title || mission.data?.purpose || 'Mission sans titre'}
                        </h3>
                      </div>

                      <div
                        className={`shrink-0 rounded-2xl border px-3 py-2 text-right ${
                          selectedMission?.id === mission.id
                            ? 'border-white/15 bg-white/10 text-white'
                            : 'border-emerald-400/15 bg-emerald-500/10 text-emerald-300'
                        }`}
                      >
                        <div className="text-[7px] font-black uppercase tracking-[0.2em] opacity-60">
                          Budget
                        </div>
                        <div className="text-[12px] font-black leading-tight">
                          {fmtFCFA(budget)}
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 mt-3 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <div
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${
                            selectedMission?.id === mission.id
                              ? 'bg-white/10 text-white'
                              : 'bg-slate-950/60 text-slate-400 border border-white/5'
                          }`}
                        >
                          <Users size={10} />
                          {mission.data?.members?.length || 0} Pers.
                        </div>
                        <div
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${
                            selectedMission?.id === mission.id
                              ? 'bg-white/10 text-white'
                              : 'bg-slate-950/60 text-slate-400 border border-white/5'
                          }`}
                        >
                          <Calendar size={10} />
                          {days} Jours
                        </div>
                      </div>

                      {/* Scoring Tooltip-like Badge */}
                      <div
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 ${
                          selectedMission?.id === mission.id
                            ? 'bg-white/10 text-white/70'
                            : 'bg-white/[0.03] text-slate-500'
                        }`}
                      >
                        <TrendingUp size={10} />
                        <span className="text-[8px] font-black">{score.toFixed(1)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* ── COLONNE DROITE: DECISION HUB ── */}
        <div className="xl:col-span-8">
          <AnimatePresence mode="wait">
            {selectedMission ? (
              <motion.div
                key={selectedMission.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* ── PANNEAU STRATÉGIE & BUDGET ── */}
                <div className="glass-card !p-6 !rounded-[2rem] border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />

                  <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6 relative z-10 border-b border-white/5 pb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                          Objectif Strategique
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase line-clamp-2">
                        {selectedMission.title}
                      </h2>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-right min-w-[200px]">
                      <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest block mb-1">
                        Budget Global
                      </span>
                      <span className="text-2xl font-black text-white tracking-tighter">
                        {fmtFCFA(selectedMission.budget || 0)}
                      </span>
                      {(selectedMission.budget || 0) > 2000000 && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-[8px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                          <AlertTriangle size={10} />
                          Risque Budgétaire Élevé
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-8 relative z-10">
                    <p className="text-slate-400 text-[11px] leading-relaxed font-medium italic opacity-70">
                      "
                      {selectedMission.description ||
                        selectedMission.data?.purpose ||
                        'Aucune description détaillée.'}
                      "
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 relative z-10">
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Users size={16} className="text-blue-500" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">
                          Composition de l'équipe
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {(selectedMission.data?.members || []).map((m: any, i: number) => {
                          const memberTotal = (m.dailyIndemnity || 0) * (m.days || 1);
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-3 p-2 bg-white/2 rounded-xl border border-white/5"
                            >
                              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-[10px] flex-shrink-0">
                                {(m.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-black text-white truncate">
                                  {m.name}
                                </div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                  {m.role} · {m.days || 1}j
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-[10px] font-black text-emerald-400">
                                  {fmtFCFA(memberTotal)}
                                </div>
                                <div className="text-[8px] text-slate-600">
                                  {fmtFCFA(m.dailyIndemnity || 0)}/j
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {selectedMission.data?.members &&
                          selectedMission.data.members.length > 0 && (
                            <div className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl mt-2">
                              <span className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest">
                                Total Indemnités
                              </span>
                              <span className="text-sm font-black text-emerald-400">
                                {fmtFCFA(
                                  (selectedMission.data.members as any[]).reduce(
                                    (s: number, m: any) =>
                                      s + (m.dailyIndemnity || 0) * (m.days || 1),
                                    0
                                  )
                                )}
                              </span>
                            </div>
                          )}
                        {(!selectedMission.data?.members ||
                          selectedMission.data.members.length === 0) && (
                          <p className="text-[10px] text-slate-600 italic">
                            Aucun missionnaire listé
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <MapPin size={16} className="text-amber-500" />
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">
                          Calendrier & Itinéraire
                        </h4>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/2 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Départ
                          </span>
                          <span className="text-xs font-black text-white">
                            {selectedMission.startDate
                              ? new Date(selectedMission.startDate).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                            Impact Budget
                          </span>
                        </div>
                        <div className="flex items-end justify-between">
                          <span className="text-xl font-black text-white">
                            {fmtFCFA(
                              (selectedMission.data?.members || []).reduce(
                                (s: number, m: any) => s + (m.dailyIndemnity || 0) * (m.days || 1),
                                0
                              )
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Retour Prévu
                          </span>
                          <span className="text-xs font-black text-white">
                            {selectedMission.endDate
                              ? new Date(selectedMission.endDate).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            Trajet
                          </p>
                          <p className="text-xs font-bold text-white italic">
                            {selectedMission.data?.itineraryAller || 'Non spécifié'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 📅 SECTION PLANNING DÉTAILLÉ */}
                  <div className="mb-10 relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <Calendar size={18} className="text-indigo-400" />
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">
                        Déroulement de la Mission (Planning Jour par Jour)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedMission.data?.planning?.length > 0 ? (
                        selectedMission.data.planning.map((step: string, i: number) => {
                          const lines = step.split('\n');
                          const title = lines[0] || `Jour ${i + 1}`;
                          const description = lines.slice(1).join('\n');

                          return (
                            <div
                              key={i}
                              className="p-4 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 transition-all"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <div className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase tracking-widest border border-indigo-500/20">
                                  Jour {i + 1}
                                </div>
                                <h5 className="text-[11px] font-black text-white uppercase truncate">
                                  {title}
                                </h5>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-snug line-clamp-2 italic">
                                {description || 'Aucun détail précisé pour cette journée.'}
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-2 p-8 rounded-[2rem] border-2 border-dashed border-white/5 text-center">
                          <Clock size={24} className="mx-auto text-slate-700 mb-2 opacity-30" />
                          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                            Aucun planning détaillé renseigné
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── SYSTÈME D'APPROBATION ou STATUS ARCHIVE ── */}
                  {isArchiveMode ? renderArchiveStatus() : renderApprovalPanel()}
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-20 glass-card">
                <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center text-slate-700 mb-8">
                  <ShieldCheck size={48} />
                </div>
                <h3 className="text-xl font-black text-slate-600 uppercase tracking-tighter italic mb-2">
                  Sélectionnez une mission
                </h3>
                <p className="text-xs text-slate-500 font-bold max-w-xs leading-relaxed uppercase tracking-widest opacity-60">
                  Utilisez la liste de gauche pour examiner les demandes en attente de votre
                  expertise décisionnelle.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleDecision}
        title="Signature Électronique"
      />
      {failedDeleteIds.length > 0 && (
        <div className="mt-4 glass-card !rounded-2xl !p-4 border-rose-500/20 bg-rose-500/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">
            Suppressions en échec ({failedDeleteIds.length})
          </p>
          <p className="mt-2 text-xs text-slate-300 break-all">{failedDeleteIds.join(', ')}</p>
        </div>
      )}
      {confirmDialog && (
        <div className="fixed inset-0 z-[4500] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setConfirmDialog(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">
              Confirmation requise
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              {confirmDialog.mode === 'single'
                ? `Supprimer définitivement "${confirmDialog.title}" ?`
                : `Supprimer ${confirmDialog.count} mission(s) en attente. Cette action est irréversible.`}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-300"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  const dialog = confirmDialog;
                  setConfirmDialog(null);
                  if (!dialog) return;
                  if (dialog.mode === 'single') {
                    const actionId =
                      globalThis.crypto?.randomUUID?.() || `single-delete-${Date.now()}`;
                    try {
                      await missionApprovalService.deleteMission(dialog.missionId);
                      toast.success('Soumission supprimée');
                      logger.info('[Approbation] single delete success', {
                        actionId,
                        missionId: dialog.missionId,
                      });
                      if (selectedMission?.id === dialog.missionId) {
                        setSelectedMission(null);
                      }
                      await fetchPending();
                    } catch {
                      toast.error('Erreur lors de la suppression');
                      logger.warn('[Approbation] single delete failed', {
                        actionId,
                        missionId: dialog.missionId,
                      });
                    }
                    return;
                  }
                  await executeBulkDelete();
                }}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
