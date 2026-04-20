/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { useState, useEffect } from 'react';
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
  Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as missionApprovalService from '../services/missionApprovalService';
import { PageContainer, PageHeader } from '../components';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureModal from '../components/common/SignatureModal';
import { fmtFCFA } from '../utils/format';
import { syncEventBus } from '../utils/syncEventBus';
import { generateMissionOrderPDF } from '../services/missionOrderGenerator';
import StockMonitorWidget from '../components/logistique/StockMonitorWidget';

export default function Approbation() {
  const { user } = useAuth();
  const [pendingMissions, setPendingMissions] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBudgetCertified: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<any | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // ── ROLES & PERMISSIONS (VERSION ENTERPRISE) ──
  const userRole = (user?.role || 'USER').toUpperCase();
  const roleMetrics = {
    isAdmin: ['ADMIN', 'ADMIN_PROQUELEC'].includes(userRole),
    isDG: userRole === 'DG_PROQUELEC',
    isDirector: userRole === 'DIRECTEUR_TECHNIQUE',
    isAccountant: ['COMPTABLE', 'FINANCE'].includes(userRole),
    isProjectManager: ['CHEF_PROJET', 'PROJECT_MANAGER'].includes(userRole)
  };

  const isAdmin = roleMetrics.isAdmin || roleMetrics.isDG;
  const isDirector = roleMetrics.isDirector || roleMetrics.isDG;
  const isAccountant = roleMetrics.isAccountant;
  const isProjectManager = roleMetrics.isProjectManager;

  const canDelete = isAdmin || isDirector;

  // Role mapping for approval workflow levels
  const roleMapping: Record<string, string> = {
    DG_PROQUELEC: 'DIRECTEUR',
    ADMIN_PROQUELEC: 'ADMIN',
    CHEF_PROJET: 'CHEF_PROJET',
    COMPTABLE: 'COMPTABLE',
    DIRECTEUR_TECHNIQUE: 'DIRECTEUR'
  };

  const workflowRole = roleMapping[userRole] || userRole;

  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, archive: 0 });

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      // Optimized : Single fetch for current mode
      const result = await missionApprovalService.getPendingApprovals(isArchiveMode) as any;
      
      const missions = result.missions || [];
      setPendingMissions(missions);
      setStats(result.stats || { totalBudgetCertified: 0 });
      
      // Update metrics based on loaded data
      setCounts(prev => ({
        ...prev,
        [isArchiveMode ? 'archive' : 'pending']: missions.length
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
  }, [isArchiveMode]);

  useEffect(() => {
    // 🔄 Auto-synchronisation intelligente du composant d'Approbation
    const handleSync = () => {
      fetchPending();
    };

    const unsubSaved = syncEventBus.subscribe('mission:saved', handleSync);
    const unsubNotification = syncEventBus.subscribe('notification', handleSync);

    return () => {
      unsubSaved();
      unsubNotification();
    };
  }, [isArchiveMode]); // On recommence pour garantir que le fetch lit bien `isArchiveMode` actuel

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement la soumission "${title}" ?`
      )
    )
      return;

    try {
      await missionApprovalService.deleteMission(id);
      toast.success('Soumission supprimée');
      if (selectedMission?.id === id) {
        setSelectedMission(null);
      }
      fetchPending();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeleteAll = async () => {
    const count = pendingMissions.length;
    const msg = `⚠️ ATTENTION CRITIQUE : Vous êtes sur le point de supprimer ${count} dossiers EN ATTENTE D'APPROBATION.

Ces missions n'ont pas encore été validées ni rejetées. Si vous videz la liste :
1. Elles disparaîtront définitivement du système.
2. Les techniciens ne recevront aucun feedback automatique.
3. Cette action est IRREVERSIBLE.

Êtes-vous certain de vouloir "Vider la liste" maintenant ?`;

    if (!window.confirm(msg)) return;

    try {
      const promises = pendingMissions.map((m) => missionApprovalService.deleteMission(m.id));
      await Promise.all(promises);
      toast.success(`${count} soumissions ont été supprimées`);
      setSelectedMission(null);
      fetchPending();
    } catch (error) {
      toast.error('Erreur lors de la suppression groupée');
    }
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
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Empreinte Numérique (SHA-256)</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black">CERTIFIÉ GEM</span>
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
                  await generateMissionOrderPDF({
                    ...selectedMission.data,
                    orderNumber: selectedMission.orderNumber,
                    isCertified: true,
                    integrityHash: workflow?.integrityHash
                  });
                  toast.success("Document exporté");
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
              const isDone = step.status === 'APPROVED' || step.status === 'approuvee';
              return (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/2 border border-white/5">
                  <div className={`mt-1 p-2 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                    {isDone ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-white uppercase italic">{step.label || step.role}</span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase">{step.decidedAt ? new Date(step.decidedAt).toLocaleDateString() : '--/--/----'}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic mb-2">
                      {step.comment || "Aucune observation formulée."}
                    </p>
                    {step.signature && (
                       <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 border border-white/5">
                          <PenTool size={10} className="text-emerald-500" />
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Signature Électronique Vérifiée</span>
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
            {currentStep?.label || currentStep?.role}). Vous pourrez intervenir
            une fois cette étape validée.
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
              Votre validation apposera votre signature électronique
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Observations ou motifs (Requis pour un rejet)..."
            className="w-full bg-slate-950/50 border border-white/5 rounded-3xl p-6 text-white text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none resize-none transition-all placeholder:text-slate-700"
            rows={3}
          />

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
              disabled={isAiLoading}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-2xl transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50"
            >
              <Sparkles size={18} className={isAiLoading ? 'animate-spin' : ''} />
              {isAiLoading ? 'Audit...' : 'Audit IA Strategique'}
            </button>

            <button
              onClick={() => {
                setDecisionType('reject');
                setIsSignatureModalOpen(true);
              }}
              className="flex-1 px-8 py-4 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-500/20 rounded-2xl transition-all font-black text-xs uppercase tracking-widest"
            >
              Rejeter
            </button>

            <button
              onClick={() => {
                setDecisionType('approve');
                setIsSignatureModalOpen(true);
              }}
              className="flex-[2] flex items-center justify-center gap-3 px-8 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] transition-all shadow-xl shadow-emerald-600/20"
            >
              <CheckCircle2 size={18} />
              Certifier la Mission
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
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Rapport du Mentor IA</span>
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
    try {
      let result: any = null;

      if (decisionType === 'approve') {
        result = await missionApprovalService.approveMissionStep(
          selectedMission.id,
          workflowRole as any,
          comment,
          signatureData
        );
      } else {
        await missionApprovalService.rejectMission(selectedMission.id, workflowRole as any, comment);
      }

      // 1. Unify selectedMission update (Avoid double renders and inconsistencies)
      const finalOrderNumber = result?.orderNumber || selectedMission.orderNumber;
      const finalStatus = decisionType === 'approve' ? 'approuvee' : 'rejetee';

      setSelectedMission((prev: any) => ({
        ...prev,
        status: finalStatus,
        orderNumber: finalOrderNumber,
        isCertified: decisionType === 'approve',
        updatedAt: new Date().toISOString()
      }));

      // 2. Email automation with REAL latest ID (Phase 4 protection)
      if (decisionType === 'approve') {
        try {
          await generateMissionOrderPDF({
            ...selectedMission.data,
            orderNumber: finalOrderNumber,
            signatureImage: signatureData,
            integrityHash: result?.integrityHash
          });
          // notify via logic or api
        } catch (pdfErr) {
          console.error("PDF Fail but mission approved", pdfErr);
        }
      }

      toast.success(decisionType === 'approve' ? 'Mission certifiée et enregistrée' : 'Mission rejetée');
      fetchPending();
      setIsSignatureModalOpen(false);
    } catch (error: any) {
      toast.error('Une erreur est survenue lors de la décision');
    }
  };

  if (isLoading && pendingMissions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
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
            value: pendingMissions.filter((m) => {
              const days = m.startDate
                ? Math.ceil((new Date(m.startDate).getTime() - Date.now()) / 86400000)
                : 99;
              return days <= 3;
            }).length,
            sub: 'départ dans ≤ 3 jours',
            icon: <AlertTriangle size={18} />,
            color: 'rose',
          },
          {
            label: 'Coût Moyen',
            value:
              pendingMissions.length > 0
                ? fmtFCFA(
                    Math.round(
                      pendingMissions.reduce((s, m) => s + (m.budget || 0), 0) /
                        pendingMissions.length
                    )
                  )
                : '—',
            sub: 'par mission',
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

          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                {isArchiveMode ? 'Archives Certifiées' : 'Soumissions Reçues'}
              </h3>
              <button
                onClick={() => {
                  setSelectedMission(null);
                  setIsArchiveMode(!isArchiveMode);
                }}
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border transition-all w-fit flex items-center gap-3
                                     ${
                                       isArchiveMode
                                         ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                         : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                     }`}
              >
                <span>{isArchiveMode ? '← Voir en attente' : '📂 Voir les archives'}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${
                  isArchiveMode ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                }`}>
                  {isArchiveMode ? counts.pending : counts.archive}
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {canDelete && !isArchiveMode && (
                <button
                  onClick={handleDeleteAll}
                  disabled={pendingMissions.length === 0}
                  title={
                    pendingMissions.length > 0
                      ? 'Tout supprimer définitivement'
                      : 'La liste est déjà vide'
                  }
                  className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all shadow-lg
                                        ${
                                          pendingMissions.length > 0
                                            ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/20'
                                            : 'bg-slate-900 text-slate-600 border border-white/5 opacity-50 cursor-not-allowed'
                                        }`}
                >
                  Vider
                </button>
              )}
              <button
                title="Actualiser la liste"
                onClick={fetchPending}
                className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
              >
                <ClipboardList size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {pendingMissions.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/2">
                <CheckCircle2 size={48} className="mx-auto text-emerald-500/20 mb-4" />
                <p className="text-slate-500 font-bold text-xs uppercase italic">
                  Aucune mission {isArchiveMode ? 'archivée' : 'en attente'}
                </p>
              </div>
            ) : (
              pendingMissions.map((mission) => {
                    const budget = mission.budget || 0;
                    const days = mission.data?.members?.[0]?.days || 1;
                    const isUrgent = days <= 3;
                    const score = Math.min(10, (budget / 500000) + (isUrgent ? 3 : 0));

                    return (
                      <motion.div
                        key={mission.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          setSelectedMission(mission);
                          setAiAnalysis(null);
                        }}
                        className={`group p-6 rounded-[2.5rem] border transition-all cursor-pointer relative overflow-hidden ${
                          selectedMission?.id === mission.id
                            ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-900/40 ring-4 ring-blue-500/20'
                            : 'bg-slate-900/40 border-white/5 hover:border-blue-500/30 hover:bg-slate-900/60'
                        }`}
                      >
                        {/* Background Urgency Glow */}
                        {isUrgent && selectedMission?.id !== mission.id && (
                          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-2xl rounded-full" />
                        )}

                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              {isUrgent && (
                                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-500 text-[8px] font-black uppercase tracking-widest border border-rose-500/20 animate-pulse">
                                  Urgent
                                </span>
                              )}
                              <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${
                                selectedMission?.id === mission.id ? 'text-white/60' : 'text-slate-500'
                              }`}>
                                ID: {mission.id.substring(0, 8)}
                              </span>
                            </div>
                            <h3 className={`text-sm font-black uppercase tracking-tight italic ${
                              selectedMission?.id === mission.id ? 'text-white' : 'text-slate-200'
                            }`}>
                              {mission.title || mission.data?.purpose || 'Mission sans titre'}
                            </h3>
                          </div>
                          
                          <div className={`text-right ${selectedMission?.id === mission.id ? 'text-white' : 'text-emerald-500'}`}>
                            <div className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-0.5">Budget</div>
                            <div className="text-sm font-black tracking-tighter">{fmtFCFA(budget)}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2">
                             <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                               selectedMission?.id === mission.id ? 'bg-white/10 text-white' : 'bg-slate-950/50 text-slate-400 border border-white/5'
                             }`}>
                               <Users size={10} />
                               {mission.data?.members?.length || 0} Pers.
                             </div>
                             <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                               selectedMission?.id === mission.id ? 'bg-white/10 text-white' : 'bg-slate-950/50 text-slate-400 border border-white/5'
                             }`}>
                               <Calendar size={10} />
                               {days} Jours
                             </div>
                          </div>
                          
                          {/* Scoring Tooltip-like Badge */}
                          <div className={`flex items-center gap-1.5 ${selectedMission?.id === mission.id ? 'text-white/40' : 'text-slate-700'}`}>
                             <TrendingUp size={10} />
                             <span className="text-[9px] font-black">SCORE: {score.toFixed(1)}</span>
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
                      { (selectedMission.budget || 0) > 2000000 && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-[8px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                          <AlertTriangle size={10} />
                          Risque Budgétaire Élevé
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-8 relative z-10">
                    <p className="text-slate-400 text-[11px] leading-relaxed font-medium italic opacity-70">
                      "{selectedMission.description || selectedMission.data?.purpose || 'Aucune description détaillée.'}"
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
                            <div key={i} className="p-4 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 transition-all">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase tracking-widest border border-indigo-500/20">
                                  Jour {i + 1}
                                </div>
                                <h5 className="text-[11px] font-black text-white uppercase truncate">{title}</h5>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-snug line-clamp-2 italic">{description || 'Aucun détail précisé pour cette journée.'}</p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-2 p-8 rounded-[2rem] border-2 border-dashed border-white/5 text-center">
                          <Clock size={24} className="mx-auto text-slate-700 mb-2 opacity-30" />
                          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Aucun planning détaillé renseigné</p>
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
    </PageContainer>
  );
}
