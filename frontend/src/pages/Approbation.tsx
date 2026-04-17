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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as missionApprovalService from '../services/missionApprovalService';
import { PageContainer, PageHeader } from '../components';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureModal from '../components/common/SignatureModal';
import { fmtFCFA } from '../utils/format';
import { syncEventBus } from '../utils/syncEventBus';

export default function Approbation() {
  const { user } = useAuth();
  const [pendingMissions, setPendingMissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<any | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');

  const roleStr = String(user?.role || '').toUpperCase();
  const nameStr = String(user?.name || '').toUpperCase();
  const emailStr = String(user?.email || '').toLowerCase();

  // Robust detection matching Sidebar.tsx logic
  const isAdmin =
    roleStr.includes('ADMIN') || nameStr.includes('ADMIN') || emailStr.includes('admin');
  const isDirector =
    roleStr.includes('DG') || roleStr.includes('DIR') || nameStr.includes('DIRECTEUR');
  const isAccountant = roleStr.includes('COMPTABLE') || roleStr.includes('FINANCE');
  const isProjectManager =
    roleStr.includes('CHEF') || roleStr.includes('PROJECT') || roleStr.includes('CP');

  const canDelete = isAdmin || isDirector;

  // Role mapping for approval workflow levels
  const roleMapping: Record<string, any> = {
    DG_PROQUELEC: 'DIRECTEUR',
    ADMIN_PROQUELEC: 'ADMIN',
    CHEF_PROJET: 'CHEF_PROJET',
    COMPTABLE: 'COMPTABLE',
  };

  // Si pas dans le mapping, on essaie de deviner ou on garde le rôle brut
  let workflowRole = roleMapping[roleStr] || roleStr || 'ADMIN';
  if (isProjectManager && !roleStr.includes('CHEF_PROJET')) workflowRole = 'CHEF_PROJET';
  if (isAccountant && !roleStr.includes('COMPTABLE')) workflowRole = 'COMPTABLE';

  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, archive: 0 });

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      // Fetch both for accurate counters
      const [missions, otherMissions] = await Promise.all([
        missionApprovalService.getPendingApprovals(isArchiveMode),
        missionApprovalService.getPendingApprovals(!isArchiveMode)
      ]);

      setPendingMissions(missions);
      setCounts({
        pending: isArchiveMode ? otherMissions.length : missions.length,
        archive: isArchiveMode ? missions.length : otherMissions.length
      });

      // Maintain selection if possible, otherwise select first or none
      setSelectedMission(prevSelected => {
        if (prevSelected && missions.some(m => m.id === prevSelected.id)) {
          return missions.find(m => m.id === prevSelected.id);
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

  const handleDecision = async (signatureData?: string) => {
    if (!selectedMission) return;

    try {
      if (decisionType === 'approve') {
        await missionApprovalService.approveMissionStep(
          selectedMission.id,
          workflowRole,
          comment,
          signatureData
        );
        toast.success('Mission approuvée avec succès');
      } else {
        if (!comment) {
          toast.error('Un motif de rejet est requis pour le DG');
          return;
        }
        await missionApprovalService.rejectMissionStep(selectedMission.id, workflowRole, comment);
        toast.success('Mission rejetée');
      }

      // Clean up and refresh
      setComment('');
      setDecisionType(null);
      setSelectedMission(null);
      fetchPending();
    } catch (error) {
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
            label: 'Budget Total',
            value: fmtFCFA(pendingMissions.reduce((s, m) => s + (m.budget || 0), 0)),
            sub: 'engagements en cours',
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
              pendingMissions.map((m) => (
                <button
                  key={m.id}
                  title={`Voir détails de : ${m.title}`}
                  onClick={() => setSelectedMission(m)}
                  className={`w-full text-left p-6 rounded-[2rem] border transition-all duration-300 group
                                        ${
                                          selectedMission?.id === m.id
                                            ? (isArchiveMode
                                                ? 'bg-emerald-600 border-emerald-500 shadow-emerald-500/20'
                                                : 'bg-blue-600 border-blue-500 shadow-blue-500/20') +
                                              ' shadow-xl text-white'
                                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10'
                                        }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`p-2.5 rounded-xl ${selectedMission?.id === m.id ? 'bg-white/20' : isArchiveMode ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}
                    >
                      <FileText size={18} />
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const daysLeft = m.startDate
                          ? Math.ceil((new Date(m.startDate).getTime() - Date.now()) / 86400000)
                          : 99;
                        return !isArchiveMode && daysLeft <= 3 ? (
                          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/20">
                            Urgent
                          </span>
                        ) : null;
                      })()}
                      <div
                        className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${selectedMission?.id === m.id ? 'bg-white/20 text-white' : isArchiveMode ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}
                      >
                        {isArchiveMode
                          ? m.orderNumber || 'CERTIFIÉE'
                          : m.approvalWorkflow?.currentStep
                            ? `Étape ${m.approvalWorkflow.currentStep}`
                            : 'Soumis'}
                      </div>
                    </div>
                  </div>
                  <h4 className="font-black text-sm mb-1 truncate uppercase tracking-tight italic">
                    {m.title || 'Sans titre'}
                  </h4>
                  <p className={`text-[10px] font-bold mb-4 opacity-60`}>
                    Par {m.user?.name || 'Inconnu'}
                  </p>

                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-80">
                    <div className="flex items-center gap-1.5">
                      <DollarSign size={12} />
                      {fmtFCFA(m.budget || 0)}
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Calendar size={12} />
                      {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                    {canDelete && (
                      <button
                        onClick={(e) => handleDelete(e, m.id, m.title)}
                        className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all ml-2"
                        title="Supprimer définitivement cette soumission"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </button>
              ))
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
                <div className="glass-card !p-10 !rounded-[3rem] border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />

                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10 relative z-10">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">
                          Stratégie & Objectifs
                        </span>
                      </div>
                      <h2 className="text-3xl font-black text-white italic tracking-tighter mb-4 uppercase">
                        {selectedMission.title}
                      </h2>
                      <p className="text-slate-400 text-sm leading-relaxed max-w-2xl bg-white/5 p-6 rounded-3xl border border-white/5 font-medium italic">
                        "{selectedMission.description || 'Aucune description fournie.'}"
                      </p>
                    </div>

                    <div className="w-full md:w-auto space-y-4">
                      <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 text-right min-w-[240px]">
                        <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest block mb-2">
                          Budget Prévisionnel
                        </span>
                        <span className="text-3xl font-black text-white tracking-tighter">
                          {fmtFCFA(selectedMission.budget || 0)}
                        </span>
                      </div>
                      <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 text-right min-w-[240px]">
                        <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest block mb-2">
                          Budget Prévisionnel
                        </span>
                        <span className="text-3xl font-black text-white tracking-tighter">
                          {fmtFCFA(selectedMission.budget || 0)}
                        </span>
                      </div>
                    </div>
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
                              className="flex items-center gap-3 p-4 bg-white/2 rounded-2xl border border-white/5"
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
                      <div className="p-6 rounded-3xl bg-white/2 border border-white/5 space-y-4">
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedMission.data?.planning?.length > 0 ? (
                        selectedMission.data.planning.map((step: string, i: number) => {
                          const lines = step.split('\n');
                          const title = lines[0] || `Jour ${i + 1}`;
                          const description = lines.slice(1).join('\n');
                          
                          return (
                            <div key={i} className="p-6 rounded-[2rem] bg-white/2 border border-white/5 hover:bg-white/5 transition-all group">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">
                                  Jour {i + 1}
                                </div>
                                <h5 className="text-[11px] font-black text-white uppercase truncate">{title}</h5>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic line-clamp-3 group-hover:line-clamp-none transition-all">
                                {description || 'Aucun détail précisé pour cette journée.'}
                              </p>
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

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 relative z-10">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-indigo-400" />
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                          Objet de la Mission
                        </h4>
                      </div>
                      <div className="p-6 rounded-3xl bg-white/2 border border-white/5">
                        <p className="text-xs font-bold text-white italic leading-relaxed">
                          "{selectedMission.data?.purpose || 'Non spécifié'}"
                        </p>
                      </div>
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center gap-3">
                        <ClipboardList size={16} className="text-amber-400" />
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                          Observations de Terrain
                        </h4>
                      </div>
                      <div className="p-6 rounded-3xl bg-white/2 border border-white/5 min-h-[100px]">
                        <p className="text-xs font-medium text-slate-400 leading-relaxed italic">
                          {selectedMission.data?.reportObservations ||
                            'Aucune observation particulière rattachée.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── SYSTÈME D'APPROBATION ou STATUS ARCHIVE ── */}
                  {isArchiveMode ? (
                    <div className="p-10 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-500/20 relative z-10 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-4 ring-8 ring-emerald-500/5">
                        <CheckCircle2 size={32} />
                      </div>
                      <h4 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">
                        Mission Certifiée & Clôturée
                      </h4>
                      <p className="text-xs font-bold text-emerald-500/80 uppercase tracking-[0.2em] mb-4">
                        Numéro d'Ordre Officiel : {selectedMission.orderNumber}
                      </p>
                      <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/5 text-[10px] font-medium text-slate-400 italic">
                        Cette mission a été validée le{' '}
                        {selectedMission.updatedAt
                          ? new Date(selectedMission.updatedAt).toLocaleDateString()
                          : 'N/A'}
                        . Tous les documents sont opposables.
                      </div>
                    </div>
                  ) : (
                    (() => {
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

                            <div className="flex flex-col md:flex-row gap-6">
                              <button
                                onClick={() => {
                                  setDecisionType('approve');
                                  setIsSignatureModalOpen(true);
                                }}
                                className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] transition-all shadow-xl shadow-emerald-600/20 group"
                              >
                                <CheckCircle2
                                  size={18}
                                  className="group-hover:scale-110 transition-transform"
                                />
                                Approuver la Mission
                              </button>
                              <button
                                onClick={() => {
                                  setDecisionType('reject');
                                  handleDecision();
                                }}
                                className="px-8 py-5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] transition-all"
                              >
                                Rejeter
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
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
