import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Mail,
  MessageSquare,
  Download,
  Search,
  Filter,
  Eye,
  Send,
  ShieldAlert,
  ShieldCheck,
  Scale,
  Bell,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContainer, PageHeader, ContentArea, ActionBar } from '@components';
import Skeleton, { TableRowSkeleton, CardSkeleton } from '@components/common/Skeleton';
import { createNotification } from '../services/notificationService';
import { dispatchPVAlerts } from '../services/alertTraceService';
import alertsAPI from '../services/alertsAPI';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePermissions } from '../hooks/usePermissions';
import { audioService } from '../services/audioService';
import { PVAIEngine } from '../services/ai/PVAIEngine';
import type { PVType as PVAIType } from '../services/ai/PVAIEngine';
import SignatureModal from '../components/common/SignatureModal';
import { PenTool } from 'lucide-react';

// --- Utilities ---

/**
 * Formate l'étiquette d'un lot de manière propre (sans null/undefined)
 */
const formatLotLabel = (lotId?: string | null, lotName?: string | null): string => {
  const id = lotId ?? 'N/A';
  if (!lotName || lotName.trim() === '') {
    return `lot ${id}`;
  }
  return `lot ${id} (${lotName.trim()})`;
};

/**
 * Construit une notification CONSOLIDÉE intelligente (1 action métier = 1 notif)
 * Gère: succès complet / warning (SMS échoué) / erreur (PV échoué)
 */
const buildConsolidatedNotification = (
  type: PVType,
  lotLabel: string,
  smsStatus?: string,
  emailStatus?: string
) => {
  const isSmsSent = smsStatus === 'SENT';
  const isEmailSent = emailStatus === 'SENT';
  const isSmsOrEmailFailed = smsStatus === 'FAILED' || emailStatus === 'FAILED';

  // 🟢 Succès complet
  if (isSmsSent || isEmailSent) {
    return {
      title: `✅ ${type} généré et envoyé`,
      message: `Le PV pour le ${lotLabel} a été généré et transmis avec succès.`,
      type: type === 'PVNC' || type === 'PVHSE' ? 'rejection' : 'approval',
      dedupKey: `pv-${type}-${lotLabel}`,
    };
  }

  // 🟡 Warning: PV généré mais communication échouée
  if (isSmsOrEmailFailed) {
    return {
      title: `⚠️ ${type} généré, transmission échouée`,
      message: `Le PV pour le ${lotLabel} a été généré mais l'envoi SMS/Email a échoué.`,
      type: 'rejection',
      dedupKey: `pv-${type}-${lotLabel}`,
    };
  }

  // 🟠 Par défaut: juste généré
  return {
    title: `${type} généré`,
    message: `Le PV pour le ${lotLabel} a été établi.`,
    type: (type === 'PVNC' || type === 'PVHSE' ? 'rejection' : 'approval') as 'approval' | 'rejection' | 'system',
    dedupKey: `pv-${type}-${lotLabel}`,
  };
};

// --- Types & Interfaces ---

type PVType = 'PVNC' | 'PVR' | 'PVHSE' | 'PVRET' | 'PVRD' | 'PVRES';

interface PVTemplate {
  type: PVType;
  title: string;
  icon: any;
  color: string;
  description: string;
}

const PV_TEMPLATES: Record<PVType, PVTemplate> = {
  PVNC: {
    type: 'PVNC',
    title: 'Non-Conformité (PVNC)',
    icon: AlertTriangle,
    color: 'orange',
    description: 'Constater une anomalie technique ou réglementaire.',
  },
  PVR: {
    type: 'PVR',
    title: 'Réception (PVR)',
    icon: CheckCircle2,
    color: 'emerald',
    description: 'Valider la conformité et autoriser le paiement.',
  },
  PVHSE: {
    type: 'PVHSE',
    title: 'Infraction HSE',
    icon: ShieldAlert,
    color: 'red',
    description: 'Violation des règles de sécurité sur le chantier.',
  },
  PVRET: {
    type: 'PVRET',
    title: 'Retard de Travaux',
    icon: Clock,
    color: 'amber',
    description: 'Constater un dépassement des délais contractuels.',
  },
  PVRD: {
    type: 'PVRD',
    title: 'Réception Définitive',
    icon: ShieldCheck,
    color: 'blue',
    description: 'Clôture finale après levée des réserves.',
  },
  PVRES: {
    type: 'PVRES',
    title: 'Résiliation (Faute Grave)',
    icon: Scale,
    color: 'rose',
    description: 'Arrêt immédiat du lot pour manquement grave.',
  },
};

export const getAutoRecommendedType = (s: any): PVType => {
  const data = s.koboData || {};
  if (data.hse_violation === 'yes') return 'PVHSE';
  if (data.status_global === 'refused' || s.koboSync?.controleOk === false) return 'PVNC';
  if (data.delay_detected === 'yes') return 'PVRET';
  if (s.status === 'COMPLETED' && !s.pvd_signed) return 'PVRD';
  return 'PVR';
};

// --- Main Component ---

export default function PVAutomation() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<PVType | 'ALL'>('ALL');
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const digitalHash = useMemo(() => {
    if (!selectedSubmission) return null;
    return `GEM-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  }, [selectedSubmission]);

  const archivedPVs = useLiveQuery(
    () => db.pvs.orderBy('createdAt').reverse().limit(50).toArray()
  ) || [];

  // Fetch Kobo submissions (simulated through households with status 'WAITING_AUDIT' or with koboData)
  const submissions =
    useLiveQuery(() =>
      db.households.filter((h) => !!h.koboData || h.status === 'WAITING_AUDIT').toArray()
    ) || [];

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchSearch = (s.name || s.numeroordre || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      
      // Appliquer le filtre par type si un type spécifique est sélectionné
      if (selectedType !== 'ALL') {
        const recommendedType = getAutoRecommendedType(s);
        return matchSearch && recommendedType === selectedType;
      }
      
      return matchSearch;
    });
  }, [submissions, searchTerm, selectedType]);

  const handleCreatePV = async (type: PVType, submission: any) => {
    setIsGenerating(true);
    try {
      const lotLabel = formatLotLabel(submission.numeroordre, submission.name);

      // 1. Sauvegarde persistante du PV dans Dexie (Axe 1 - Amélioration Continue)
      const pvId = crypto.randomUUID();
      const householdLabel = submission.name ?? 'N/A';
      await db.pvs.put({
        id: pvId,
        householdId: submission.id,
        projectId: submission.projectId || 'N/A',
        type: type,
        content: `PV ${type} généré pour le ménage ${householdLabel} (Réf: ${submission.numeroordre})`,
        createdAt: new Date().toISOString(),
        metadata: {
          koboSubmissionId: submission.koboSubmissionId,
          numeroordre: submission.numeroordre,
          recommended: getAutoRecommendedType(submission) === type
        }
      });

      // 2. Alertes traçables SMS + Email (Axe 3 — Traçabilité des Alertes)
      const ownerData = typeof submission.owner === 'object' ? submission.owner : {};
      const alertResults = await dispatchPVAlerts({
        pvId,
        householdId: submission.id,
        projectId: submission.projectId || 'N/A',
        pvType: type,
        phoneNumber: submission.phone || ownerData.phone,
        email: ownerData.email,
        prestataireName: submission.name || ownerData.name,
        numerolot: submission.numeroordre,
      });

      // 3. Créer UNE SEULE notification CONSOLIDÉE (fusion intelligente) au lieu de 2
      const smsStatus = alertResults.smsTrace?.status;
      const emailStatus = alertResults.emailTrace?.status;
      const notifData = buildConsolidatedNotification(type, lotLabel, smsStatus, emailStatus);

      await createNotification({
        title: notifData.title,
        message: notifData.message,
        sender: 'Système GEM-PROQUELEC',
        type: notifData.type,
        projectId: submission.projectId,
        // 🔑 Clé de déduplication: évite les doublons métier
        dedupKey: notifData.dedupKey,
      });

      // 4. Créer une alerte backend (Flux d'Alertes Finalisé)
      try {
        const severityMap = {
          PVHSE: 'CRITICAL',
          PVRES: 'CRITICAL',
          PVNC: 'HIGH',
          PVRET: 'HIGH',
          PVR: 'LOW',
          PVRD: 'MEDIUM',
        };

        await alertsAPI.createAlert({
          projectId: submission.projectId || 'N/A',
          householdId: submission.id,
          pvId,
          type,
          severity: severityMap[type as keyof typeof severityMap] || 'MEDIUM',
          title: `${type} généré pour ${submission.name || 'Ménage inconnu'}`,
          description: `Un procès-verbal de type ${type} a été automatiquement généré pour le ménage.`,
          recommendedAction: 'Consulter le PV et signer électroniquement dans votre espace GEM.',
          metadata: {
            numeroordre: submission.numeroordre,
            prestataireName: submission.name,
            smsStatus,
            emailStatus,
          },
        });
      } catch (alertErr) {
        console.error('Erreur lors de la création de l\'alerte backend:', alertErr);
        // Ne pas bloquer le flux si l'alerte échoue
      }

      // 5. Feedback utilisateur via toast (court et concis)
      const statusMsg = [
        smsStatus === 'SENT' ? '✅ SMS' : smsStatus === 'FAILED' ? '⚠️ SMS échoué' : null,
        emailStatus === 'SENT' ? '✅ Email' : emailStatus === 'FAILED' ? '⚠️ Email échoué' : null,
      ].filter(Boolean).join(' + ');

      toast.success(`PV ${type} généré${statusMsg ? ` (${statusMsg})` : ''}`);

      setSelectedSubmission({ ...submission, activePVType: type, generatedPvId: pvId });
      setIsGenerating(false);
    } catch (err) {
      toast.error('Erreur lors de la génération et sauvegarde du PV');
      setIsGenerating(false);
    }
  };



  return (
    <PageContainer>
      <PageHeader
        title="Automatisation des PV"
        subtitle="Génération intelligente basée sur les données Kobo"
        icon={FileText}
        actions={
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                Kobo Sync: OK
              </span>
            </div>
            <button 
              className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-all"
              title="Notifications"
              aria-label="Voir les notifications"
            >
              <Bell size={18} className="text-slate-400" />
            </button>
          </div>
        }
      />

      <ContentArea className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column: Submissions List */}
          <div className="xl:col-span-4 space-y-4">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
              <div className="relative mb-4">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Rechercher un ménage ou lot..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                {(Object.keys(PV_TEMPLATES) as PVType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type === selectedType ? 'ALL' : type)}
                    title={`Filtrer la liste pour n'afficher que les ${PV_TEMPLATES[type].title}`}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      selectedType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {submissions.length === 0 ? (
                  <>
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                  </>
                ) : filteredSubmissions.map((s) => {
                  const recommended = getAutoRecommendedType(s);
                  const isSelected = selectedSubmission?.id === s.id;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => setSelectedSubmission(s)}
                      className={`group p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-white/5 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs font-black text-white uppercase tracking-tight line-clamp-1">
                            {s.name || 'Ménage Inconnu'}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500">
                            {s.numeroordre || 'SANS NUMÉRO'}
                          </p>
                        </div>
                        <div
                          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            recommended === 'PVR'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : recommended === 'PVNC'
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {recommended}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        <p className="text-[10px] text-slate-500 italic">
                          Dernière sync :{' '}
                          {s.updatedAt
                            ? format(new Date(s.updatedAt), 'dd MMM HH:mm', { locale: fr })
                            : 'N/A'}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Generation & Preview */}
          <div className="xl:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              {selectedSubmission ? (
                <motion.div
                  key={selectedSubmission.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-950/40 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                >
                  {/* Header Area */}
                  <div className="p-8 border-b border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30 shadow-inner">
                          <FileText className="text-blue-400" size={32} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white tracking-tight">
                            {selectedSubmission.name}
                          </h2>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-bold text-slate-500">
                              REF: {selectedSubmission.numeroordre}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest group cursor-help flex items-center gap-1">
                              Saisie Kobo #{selectedSubmission.koboSubmissionId || '000'}
                              <ExternalLink size={10} />
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {Object.values(PV_TEMPLATES).map((tmpl) => {
                          const Icon = tmpl.icon;
                          return (
                            <button
                              key={tmpl.type}
                              onClick={() => handleCreatePV(tmpl.type, selectedSubmission)}
                              disabled={isGenerating}
                              title={tmpl.description}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                isGenerating
                                  ? 'opacity-50 cursor-not-allowed'
                                  : selectedSubmission.activePVType === tmpl.type
                                    ? `bg-${tmpl.color}-600 text-white shadow-lg shadow-${tmpl.color}-500/20`
                                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white border border-white/5'
                              }`}
                            >
                              <Icon size={14} />
                              {tmpl.type}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* PV Content / Preview */}
                  <div className="p-8">
                    {selectedSubmission.activePVType ? (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Status Alert Banner */}
                        <div
                          className={`p-6 rounded-2xl border flex items-center gap-4 ${
                            PV_TEMPLATES[selectedSubmission.activePVType as PVType].color ===
                            'emerald'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              PV_TEMPLATES[selectedSubmission.activePVType as PVType].color ===
                              'emerald'
                                ? 'bg-emerald-500/20'
                                : 'bg-rose-500/20'
                            }`}
                          >
                            <Bell className="animate-bounce" size={24} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-black uppercase tracking-widest">
                              Actions Automatisées Déclenchées
                            </p>
                            <div className="flex flex-wrap gap-4 mt-2">
                              <span className="flex items-center gap-2 text-[10px] font-bold opacity-70">
                                <Mail size={12} /> Email de notification envoyé
                              </span>
                              <span className="flex items-center gap-2 text-[10px] font-bold opacity-70">
                                <MessageSquare size={12} /> SMS de rappel expédié
                              </span>
                              <span className="flex items-center gap-2 text-[10px] font-bold opacity-70">
                                <ShieldCheck size={12} /> Inscription au registre GEM
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Document Content Mockup */}
                        <div className="bg-white/5 border border-white/5 rounded-[2rem] p-10 font-mono text-xs leading-relaxed text-slate-300 relative group">
                          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"
                              title="Copier le texte"
                            >
                              <Send size={14} />
                            </button>
                          </div>
                          <div className="max-w-3xl mx-auto space-y-6">
                            <div className="text-center border-b border-white/10 pb-6 mb-8">
                              <h3 className="text-lg font-black text-white uppercase tracking-[0.4em]">
                                {PV_TEMPLATES[selectedSubmission.activePVType as PVType].title}
                              </h3>
                              <p className="text-[10px] text-slate-500 mt-2 font-display">
                                Réf: {selectedSubmission.activePVType}-
                                {format(new Date(), 'yyyyMMdd')}-
                                {selectedSubmission.id.slice(0, 4).toUpperCase()}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <p className="font-bold text-slate-500 uppercase">DATE & HEURE</p>
                                <p className="text-white">
                                  {format(new Date(), 'dd/MM/yyyy HH:mm')}
                                </p>
                              </div>
                              <div>
                                <p className="font-bold text-slate-500 uppercase">LIEU / GPS</p>
                                <p className="text-white">
                                  {selectedSubmission.location?.coordinates?.join(', ') ||
                                    '14.7167, -17.4677'}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="font-bold text-slate-500 uppercase mb-2">
                                DESCRIPTION DES CONSTATS (GÉNÉRÉ PAR IA GEM-MINT)
                              </p>
                              <div className="bg-slate-950 p-6 rounded-[1.5rem] border border-white/5 relative group/ai overflow-hidden">
                                {/* AI Glow effect */}
                                <div className="absolute inset-0 bg-blue-500/5 blur-xl opacity-0 group-hover/ai:opacity-100 transition-opacity rounded-[1.5rem]" />
                                
                                {/* Scanning Laser Effect */}
                                <motion.div 
                                  initial={{ top: '-100%' }}
                                  animate={{ top: '100%' }}
                                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent z-20 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                />

                                <div className="relative z-10 space-y-4">
                                  {(() => {
                                    const aiContent = PVAIEngine.generateContent(
                                      selectedSubmission, 
                                      selectedSubmission.activePVType as PVType
                                    );
                                    return (
                                      <>
                                        <div className="flex items-center gap-2 mb-3">
                                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                            Réf : {aiContent.referenceContractuelle}
                                          </span>
                                        </div>
                                        
                                        <p className="text-slate-300 italic leading-relaxed">
                                          "{aiContent.description}"
                                        </p>

                                        <div className="pt-4 border-t border-white/5">
                                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                            Recommandations Automatisées
                                          </p>
                                          <ul className="space-y-1">
                                            {aiContent.recommendations.map((rec, i) => (
                                              <li key={i} className="flex items-start gap-2 text-[10px] text-slate-400">
                                                <span className="text-blue-500 mt-1">•</span>
                                                {rec}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>

                                        {aiContent.materials && (
                                          <div className="pt-4 border-t border-white/5">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
                                              Logistique : Matériaux Consommés
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              {aiContent.materials.map((m, i) => (
                                                <div key={i} className="flex justify-between items-center bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                                  <span className="text-[9px] text-slate-400">{m.item}</span>
                                                  <span className="text-[10px] font-black text-blue-400">{m.quantity} {m.unit}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Signature Area */}
                            <div className="pt-6 border-t border-white/5">
                              <div className="flex items-center justify-between mb-4">
                                <p className="font-bold text-slate-500 uppercase">
                                  Signature & Approbation
                                </p>
                                {!signatureData && (
                                  <button
                                    onClick={() => setIsSignatureOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl transition-all active:scale-95 text-xs font-black uppercase tracking-widest border border-blue-500/20"
                                  >
                                    <PenTool size={14} /> Signer le document
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <div className="space-y-4">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">VISA DIRECTION PROQUELEC</span>
                                  <div className="h-20 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center justify-center">
                                    <ShieldCheck className="text-emerald-500/20" size={32} />
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">VISA PRESTATAIRE</span>
                                  {signatureData ? (
                                    <div className="relative h-20 bg-white/5 rounded-2xl border border-blue-500/20 overflow-hidden flex items-center justify-center group/sig">
                                      <img src={signatureData} alt="Signature" className="h-12 object-contain invert" />
                                      <div className="absolute top-1 right-1 bg-emerald-500 text-white p-0.5 rounded-full">
                                        <CheckCircle2 size={8} />
                                      </div>
                                      <button 
                                        onClick={() => setSignatureData(null)}
                                        title="Supprimer la signature"
                                        aria-label="Supprimer la signature"
                                        className="absolute inset-0 bg-slate-900/80 flex items-center justify-center opacity-0 group-hover/sig:opacity-100 transition-opacity"
                                      >
                                        <Trash2 size={14} className="text-rose-500" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="h-20 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center text-slate-700 italic text-[9px]">
                                      En attente...
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Legal Value / Hash */}
                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between opacity-50">
                              <div className="flex flex-col">
                                <span className="text-[8px] text-slate-500 font-black uppercase">Hash de Sécurité</span>
                                <span className="text-[9px] font-mono text-slate-400">{digitalHash}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[8px] text-slate-500 font-black uppercase">Horodatage</span>
                                <span className="text-[9px] text-slate-400 block">{format(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <button 
                            className="flex-1 bg-white hover:bg-slate-200 text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 text-xs uppercase tracking-widest"
                            title="Télécharger le dossier complet au format PDF ou Word"
                          >
                            <Download size={18} />
                            Télécharger PDF / DOCX
                          </button>
                          <button
                            onClick={() => toast.success('Relance envoyée par WhatsApp')}
                            title="Relancer par WhatsApp"
                            aria-label="Envoyer une relance WhatsApp"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                          >
                            <MessageSquare size={18} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-6">
                          <Eye className="text-slate-700" size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-500">
                          Choisissez un modèle de PV
                        </h3>
                        <p className="text-sm text-slate-600 max-w-sm mt-2">
                          Sélectionnez l'un des types de documents ci-dessus pour générer
                          automatiquement le PV basé sur les données Kobo de ce lot.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[3rem]">
                  <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center mb-8">
                    <Search size={48} className="text-indigo-500/30" />
                  </div>
                  <h3 className="text-2xl font-black text-white/20 uppercase tracking-[0.2em]">
                    Sélectionnez une soumission
                  </h3>
                  <p className="text-slate-600 mt-4 text-center max-w-md">
                    Parcourez la liste à gauche pour voir les derniers rapports de contrôle
                    synchronisés et agir immédiatement.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Section Statistiques & Pilotage (Piste 3 — Reporting Premium) ── */}
        <PVStatsBoard archivedPVs={archivedPVs} />

        <PVArchivePanel archivedPVs={archivedPVs} />
      </ContentArea>

      <SignatureModal 
        isOpen={isSignatureOpen}
        onClose={() => setIsSignatureOpen(false)}
        onSave={(data) => {
          setSignatureData(data);
          audioService.playSuccess();
        }}
        title="Approbation Technique GEM-MINT"
      />
    </PageContainer>
  );
}

import { AnimatedCounter } from '../components/common/AnimatedCounter';

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: PV Stats Board (KPIs)
// ─────────────────────────────────────────────────────────────────────────────
function PVStatsBoard({ archivedPVs }: { archivedPVs: any[] }) {
  const stats = useMemo(() => {
    const total = archivedPVs.length;
    const nc = archivedPVs.filter(pv => pv.type === 'PVNC').length;
    const conformity = total > 0 ? Math.round(((total - nc) / total) * 100) : 100;
    const hse = archivedPVs.filter(pv => pv.type === 'PVHSE').length;
    const delay = archivedPVs.filter(pv => pv.type === 'PVRET').length;

    return { total, conformity, hse, delay };
  }, [archivedPVs]);

  if (archivedPVs.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      {/* Widget 1: Conformité */}
      <motion.div
        whileHover={{ y: -8, scale: 1.02 }}
        className="bg-slate-900/40 backdrop-blur-xl border border-emerald-500/20 p-6 rounded-[2rem] relative overflow-hidden group shadow-lg hover:shadow-emerald-500/10 transition-all"
      >
        <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-all duration-700 scale-100 group-hover:scale-125">
          <ShieldCheck size={64} className="text-emerald-500" />
        </div>
        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Taux de Conformité</p>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-black text-white">
            <AnimatedCounter value={stats.conformity} suffix="%" />
          </span>
          <span className="text-[10px] font-bold text-emerald-400 mb-1">Norme NS 01-001</span>
        </div>
        <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${stats.conformity}%` }}
            className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
          />
        </div>
      </motion.div>

      {/* Widget 2: Volume Production */}
      <motion.div
        whileHover={{ y: -8, scale: 1.02 }}
        className="bg-slate-900/40 backdrop-blur-xl border border-blue-500/20 p-6 rounded-[2rem] relative overflow-hidden group shadow-lg hover:shadow-blue-500/10 transition-all"
      >
        <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-all duration-700 scale-100 group-hover:scale-125">
          <FileText size={64} className="text-blue-500" />
        </div>
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Total PV Générés</p>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-black text-white">
            <AnimatedCounter value={stats.total} />
          </span>
          <span className="text-[10px] font-bold text-blue-400 mb-1">Documents archivés</span>
        </div>
        <div className="mt-4 flex gap-1">
          {[...Array(12)].map((_, i) => (
            <div key={i} className={`h-4 flex-1 rounded-sm ${i < (stats.total % 12) ? 'bg-blue-500' : 'bg-slate-800'}`} />
          ))}
        </div>
      </motion.div>

      {/* Widget 3: Alertes HSE */}
      <motion.div
        whileHover={{ y: -5 }}
        className="bg-slate-900/40 backdrop-blur-xl border border-rose-500/20 p-6 rounded-[2rem] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <ShieldAlert size={64} className="text-rose-500" />
        </div>
        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Incidents HSE</p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black text-white">{stats.hse}</span>
          <span className="text-[10px] font-bold text-rose-400 mb-1">Action requise</span>
        </div>
        <p className="mt-4 text-[9px] text-slate-500 leading-tight">
          Violation du périmètre de sécurité ou défaut d'EPI constaté.
        </p>
      </motion.div>

      {/* Widget 4: Délais & Retards */}
      <motion.div
        whileHover={{ y: -5 }}
        className="bg-slate-900/40 backdrop-blur-xl border border-amber-500/20 p-6 rounded-[2rem] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Clock size={64} className="text-amber-500" />
        </div>
        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Défauts de Cadence</p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black text-white">{stats.delay}</span>
          <span className="text-[10px] font-bold text-amber-400 mb-1">PV de retard</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-800 rounded-full" />
          <Scale size={14} className="text-slate-600" />
          <div className="flex-1 h-1 bg-slate-800 rounded-full" />
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: PV Archive Panel (live from Dexie)
// ─────────────────────────────────────────────────────────────────────────────
function PVArchivePanel({ archivedPVs }: { archivedPVs: any[] }) {
  const typeStyles: Record<string, { bg: string; text: string; border: string }> = {
    PVNC:  { bg: 'bg-orange-500/10', text: 'text-orange-400',  border: 'border-orange-500/20' },
    PVR:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    PVHSE: { bg: 'bg-red-500/10',    text: 'text-red-400',     border: 'border-red-500/20' },
    PVRET: { bg: 'bg-amber-500/10',  text: 'text-amber-400',   border: 'border-amber-500/20' },
    PVRD:  { bg: 'bg-blue-500/10',   text: 'text-blue-400',    border: 'border-blue-500/20' },
    PVRES: { bg: 'bg-rose-500/10',   text: 'text-rose-400',    border: 'border-rose-500/20' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className="mt-12 group/panel"
    >
      <div className="relative overflow-hidden bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl">
        {/* Glow Ambient */}
        <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover/panel:opacity-100 transition-opacity duration-1000" />
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-gradient-to-b from-white/2 to-transparent">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 flex items-center justify-center border border-blue-500/20 shadow-inner group-hover/panel:scale-110 transition-transform duration-700">
              <FileText size={24} className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-[0.2em]">
                Registre de Traçabilité Juridique
              </h3>
              <p className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-2">
                <ShieldCheck size={12} className="text-emerald-500" />
                Derniers {archivedPVs.length} documents persistés · Horodatage Firebase/Dexie sécurisé
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 px-6 py-3 bg-slate-950/50 rounded-2xl border border-white/5">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Archivé</p>
              <p className="text-xl font-black text-white mt-0.5">{archivedPVs.length}</p>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="flex items-center gap-3">
              <div className="relative flex">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-25" />
              </div>
              <span className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em]">Live Feed</span>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="p-2">
          {archivedPVs.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar rounded-2xl">
              <table className="w-full text-left border-separate border-spacing-y-2 px-4">
                <thead>
                  <tr className="text-[10px] font-black text-slate-600 uppercase tracking-[0.25em]">
                    <th className="px-6 py-4">Status / Type</th>
                    <th className="px-6 py-4">Ménage Soumission</th>
                    <th className="px-6 py-4">Séquence Temporelle</th>
                    <th className="px-6 py-4">Verification Audit</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="space-y-4">
                  {archivedPVs.map((pv, idx) => {
                    const styles = typeStyles[pv.type] || { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700' };
                    const isRecommended = pv.metadata?.recommended === true;
                    
                    return (
                      <motion.tr
                        key={pv.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group/row bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-all duration-300"
                      >
                        <td className="px-6 py-5 first:rounded-l-2xl border-y border-l border-white/5 group-hover/row:border-blue-500/30">
                          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black border transition-all duration-500 shadow-lg ${styles.bg} ${styles.text} ${styles.border} group-hover/row:scale-105`}>
                            <div className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse`} />
                            {pv.type}
                          </span>
                        </td>
                        <td className="px-6 py-5 border-y border-white/5 group-hover/row:border-blue-500/30">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
                               {pv.metadata?.numeroordre?.slice(-2) || '??'}
                            </div>
                            <div>
                              <p className="font-black text-white text-xs tracking-tight group-hover/row:text-blue-400 transition-colors">
                                {pv.metadata?.numeroordre || '—'}
                              </p>
                              <p className="text-[10px] font-bold text-slate-600 font-mono mt-0.5 opacity-50">
                                ID: {pv.householdId.slice(0, 12)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 border-y border-white/5 group-hover/row:border-blue-500/30">
                          <div className="flex items-center gap-3">
                            <Clock size={12} className="text-blue-500/50" />
                            <div>
                              <p className="text-slate-300 text-xs font-bold">
                                {format(new Date(pv.createdAt), 'dd MMMM yyyy', { locale: fr })}
                              </p>
                              <p className="text-slate-600 text-[10px] font-black uppercase mt-0.5">
                                à {format(new Date(pv.createdAt), 'HH:mm:ss')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 border-y border-white/5 group-hover/row:border-blue-500/30">
                          {isRecommended ? (
                            <div className="flex items-center gap-2 text-emerald-400">
                              <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                <CheckCircle2 size={12} />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest">Validé</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-amber-500">
                              <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                <AlertTriangle size={12} />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest italic opacity-70">Exception Audit</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 last:rounded-r-2xl border-y border-r border-white/5 group-hover/row:border-blue-500/30 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              className="p-2.5 bg-slate-800 hover:bg-blue-600 rounded-xl text-slate-400 hover:text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 active:scale-90"
                              title="Voir les détails"
                              aria-label="Voir les détails du PV"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all duration-300 active:scale-90"
                              title="Télécharger"
                              aria-label="Télécharger le document PV"
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
                <FileText size={64} className="text-slate-800 relative z-10 mb-6" />
              </div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-600">
                Aucune archive disponible
              </p>
              <p className="text-[10px] text-slate-700 font-bold max-w-xs mt-3 leading-relaxed">
                Le système attend la première génération de PV pour initialiser la chaîne de blocs locale.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
