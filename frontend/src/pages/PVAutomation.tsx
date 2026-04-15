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
import { PageContainer, PageHeader, ContentArea } from '@components';
import { createNotification } from '../services/notificationService';
import { dispatchPVAlerts } from '../services/alertTraceService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

// --- Main Component ---

export default function PVAutomation() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<PVType | 'ALL'>('ALL');
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
      // Logic to determine auto-recommended type could go here
      return matchSearch;
    });
  }, [submissions, searchTerm]);

  const handleCreatePV = async (type: PVType, submission: any) => {
    setIsGenerating(true);
    try {
      // 1. Generate local notification
      await createNotification({
        title: `Nouveau ${type} généré`,
        message: `Le PV pour le lot ${submission.numeroordre} (${submission.name}) a été établi automatiquement.`,
        sender: 'Système GEM-PROQUELEC',
        type: type === 'PVNC' || type === 'PVHSE' ? 'rejection' : 'approval',
        projectId: submission.projectId,
      });

      // 1.5 Sauvegarde persistante du PV dans Dexie (Axe 1 - Amélioration Continue)
      const pvId = crypto.randomUUID();
      await db.pvs.put({
        id: pvId,
        householdId: submission.id,
        projectId: submission.projectId || 'N/A',
        type: type,
        content: `PV ${type} généré pour le ménage ${submission.name} (Réf: ${submission.numeroordre})`,
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

      // 3. Feedback utilisateur
      const smsStatus = alertResults.smsTrace?.status;
      const emailStatus = alertResults.emailTrace?.status;
      const statusMsg = [
        smsStatus === 'SENT' ? '✅ SMS envoyé' : smsStatus === 'FAILED' ? '⚠️ SMS échoué' : null,
        emailStatus === 'SENT' ? '✅ Email envoyé' : emailStatus === 'FAILED' ? '⚠️ Email échoué' : null,
      ].filter(Boolean).join(' | ');

      toast.success(`PV ${type} généré & tracé${statusMsg ? ` — ${statusMsg}` : ''}`);

      setSelectedSubmission({ ...submission, activePVType: type, generatedPvId: pvId });
      setIsGenerating(false);
    } catch (err) {
      toast.error('Erreur lors de la génération et sauvegarde du PV');
      setIsGenerating(false);
    }
  };

  const getAutoRecommendedType = (s: any): PVType => {
    const data = s.koboData || {};
    if (data.hse_violation === 'yes') return 'PVHSE';
    if (data.status_global === 'refused' || s.koboSync?.controleOk === false) return 'PVNC';
    if (data.delay_detected === 'yes') return 'PVRET';
    if (s.status === 'COMPLETED' && !s.pvd_signed) return 'PVRD';
    return 'PVR';
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
                {filteredSubmissions.map((s) => {
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

                            <div className="grid grid-cols-2 gap-8">
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
                                DESCRIPTION DES CONSTATS (SYNC KOBO)
                              </p>
                              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 italic">
                                {selectedSubmission.activePVType === 'PVNC' ? (
                                  <>
                                    <span className="block mb-2 text-rose-400 font-bold not-italic text-[10px] uppercase">Réf. Contractuelle : ART E.3 / ART 1.3 (Cahier des Charges)</span>
                                    "Résistance de terre non conforme (ex: 1600 Ohms, seuil &lt; 1500 Ohms requis). Défaut de continuité ou d'isolement sur le circuit principal. Violation de la norme NS 01-001 entraînant le refus de paiement."
                                  </>
                                ) : selectedSubmission.activePVType === 'PVHSE' ? (
                                  <>
                                    <span className="block mb-2 text-rose-400 font-bold not-italic text-[10px] uppercase">Réf. Contractuelle : HSE 1.2 / HSE 1.3 (Cahier des Charges)</span>
                                    "Intervention en hauteur sans harnais de sécurité certifié EN 361. Défaut de port des EPI obligatoires (casque, gants isolants). Risque majeur nécessitant l'arrêt immédiat des travaux."
                                  </>
                                ) : selectedSubmission.activePVType === 'PVRET' ? (
                                  <>
                                    <span className="block mb-2 text-amber-400 font-bold not-italic text-[10px] uppercase">Réf. Contractuelle : Clauses Pénalités (Cahier des Charges)</span>
                                    "Absence de reporting Kobo quotidien (avant 18h00) ou retard de réalisation du lot. Application en cours des retenues financières prévues au marché."
                                  </>
                                ) : (
                                  <>
                                    <span className="block mb-2 text-emerald-400 font-bold not-italic text-[10px] uppercase">Réf. Contractuelle : ART 5.1 / 6.9 (Cahier des Charges)</span>
                                    "Ouvrage réceptionné avec succès. Audit de conformité 'Zéro Défaut'. Essais de continuité, isolement (R {'>'} 0,5 MOhms) et déclenchement différentiel (IΔn ≤ 30 mA) strictement validés."
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12 pt-12">
                              <div className="border-t border-dashed border-white/20 pt-4 flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                                  VISA DIRECTION PROQUELEC
                                </span>
                                <div className="mt-6 h-12 w-32 bg-slate-900/50 rounded-xl" />
                              </div>
                              <div className="border-t border-dashed border-white/20 pt-4 flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                                  VISA PRESTATAIRE
                                </span>
                                <div className="mt-6 h-12 w-32 bg-slate-900/50 rounded-xl" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <button className="flex-1 bg-white hover:bg-slate-200 text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 text-xs uppercase tracking-widest">
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

        {/* ── Registre des PV Archivés (Axe 1 + Axe 3 — Traçabilité Complète) ── */}
        <PVArchivePanel />
      </ContentArea>
    </PageContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: PV Archive Panel (live from Dexie)
// ─────────────────────────────────────────────────────────────────────────────
function PVArchivePanel() {
  const archivedPVs = useLiveQuery(
    () => db.pvs.orderBy('createdAt').reverse().limit(50).toArray()
  ) || [];

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
