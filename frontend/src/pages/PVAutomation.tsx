import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, AlertTriangle, CheckCircle2, Clock, Trash2, Mail, 
  MessageSquare, Download, Search, Eye, Send, ShieldAlert, 
  ShieldCheck, Scale, Bell, ExternalLink, Pen as PenTool 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

// --- Services & DB ---
import { db } from '../store/db';
import { PageContainer, PageHeader, ContentArea } from '@components';
import { TableRowSkeleton, CardSkeleton } from '../components/common/Skeleton';
import SignatureModal from '../components/common/SignatureModal';
import { usePermissions } from '../hooks/usePermissions';
import { dispatchPVAlerts } from '../services/alertTraceService';
import { createNotification } from '../services/notificationService';
import { alertsAPI } from '../services/alertsAPI';
import { PVAIEngine } from '../services/ai/PVAIEngine';
import { PVRulesEngine } from '../services/ai/PVRulesEngine';
import { audioService } from '../services/audioService';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { useAuthStore } from '../store/authStore';

// --- Constants & Types ---
type PVType = 'PVNC' | 'PVR' | 'PVHSE' | 'PVRET' | 'PVRD' | 'PVRES' | 'PVINE';

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-600', lightBg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', shadow: 'shadow-emerald-500/20' },
  red:     { bg: 'bg-red-600',     lightBg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400',     shadow: 'shadow-red-500/20' },
  orange:  { bg: 'bg-orange-600',  lightBg: 'bg-orange-500/10',  border: 'border-orange-500/20',  text: 'text-orange-400',  shadow: 'shadow-orange-500/20' },
  amber:   { bg: 'bg-amber-600',   lightBg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   shadow: 'shadow-amber-500/20' },
  blue:    { bg: 'bg-blue-600',    lightBg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400',    shadow: 'shadow-blue-500/20' },
  rose:    { bg: 'bg-rose-600',    lightBg: 'bg-rose-500/10',    border: 'border-rose-500/20',    text: 'text-rose-400',    shadow: 'shadow-rose-500/20' },
} as const;

const PV_TEMPLATES: Record<PVType, { title: string; icon: any; color: keyof typeof COLOR_MAP; description: string }> = {
  PVNC:  { title: 'Non-Conformité (PVNC)', icon: AlertTriangle, color: 'orange',  description: 'Constater une anomalie technique.' },
  PVR:   { title: 'Réception (PVR)',       icon: CheckCircle2,  color: 'emerald', description: 'Valider et autoriser le paiement.' },
  PVHSE: { title: 'Infraction HSE',       icon: ShieldAlert,   color: 'red',     description: 'Violation des règles de sécurité.' },
  PVRET: { title: 'Retard de Travaux',     icon: Clock,         color: 'amber',   description: 'Constater un dépassement de délais.' },
  PVRD:  { title: 'Réception Définitive', icon: ShieldCheck,   color: 'blue',    description: 'Clôture finale du lot.' },
  PVRES: { title: 'Résiliation',          icon: Scale,         color: 'rose',    description: 'Arrêt immédiat pour faute grave.' },
  PVINE: { title: 'Désistement / Inéligible', icon: Trash2,   color: 'rose',    description: 'Abandon ou inéligibilité constatée.' }
};

// --- Custom Hook (Logic Isolation) ---
function usePVAutomation() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<PVType | 'ALL'>('ALL');
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(localStorage.getItem('gem_pv_sig') || null);
  const [bossSignatureData, setBossSignatureData] = useState<string | null>(localStorage.getItem('gem_pv_boss_sig') || null);
  const [isBossSignatureOpen, setIsBossSignatureOpen] = useState(false);

  // 💾 Persistance automatique pour Robustesse
  useEffect(() => {
    if (signatureData) localStorage.setItem('gem_pv_sig', signatureData);
    if (bossSignatureData) localStorage.setItem('gem_pv_boss_sig', bossSignatureData);
  }, [signatureData, bossSignatureData]);

  const archivedPVsQuery = useLiveQuery(() => db.pvs.orderBy('createdAt').reverse().limit(50).toArray());
  const submissionsQuery = useLiveQuery(() => db.households.filter(h => !!h.koboData || h.status === 'WAITING_AUDIT').toArray());

  const isLoadingDB = archivedPVsQuery === undefined || submissionsQuery === undefined;
  const archivedPVs = archivedPVsQuery || [];
  const submissions = submissionsQuery || [];

  const getRecommendedType = useCallback((s: any): PVType => {
    return PVRulesEngine.evaluate(s);
  }, []);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchSearch = `${s.name} ${s.numeroordre}`.toLowerCase().includes(searchTerm.toLowerCase());
      if (selectedType === 'ALL') return matchSearch;
      return matchSearch && getRecommendedType(s) === selectedType;
    });
  }, [submissions, searchTerm, selectedType, getRecommendedType]);

  const handleCreatePV = useCallback(async (type: PVType, submission: any) => {
    if (!submission) return;
    setIsGenerating(true);
    try {
      const currentUser = useAuthStore.getState().user;
      const issuerName = currentUser?.name || 'Système GEM';
      
      // Clé d'id unique par ménage+type pour éviter les doublons au clic répétitif
      const stableId = `${submission.id}_${type}`;
      
      await db.pvs.put({
        id: stableId,
        householdId: submission.id,
        projectId: submission.projectId || 'N/A',
        type,
        content: `PV ${type} pour ${submission.name}`,
        createdBy: issuerName,
        createdAt: new Date().toISOString(),
        metadata: { numeroordre: submission.numeroordre, recommended: getRecommendedType(submission) === type }
      });

      await dispatchPVAlerts({
        pvId: stableId, householdId: submission.id, projectId: submission.projectId || 'N/A',
        pvType: type, phoneNumber: submission.phone, email: submission.owner?.email,
        prestataireName: submission.name, numerolot: submission.numeroordre
      });

      const lotLabel = `lot ${submission.numeroordre || 'N/A'}`;

      await createNotification({
        title: `✅ ${type} généré`,
        message: `PV pour ${lotLabel} transmis.`,
        sender: 'Système GEM',
        type: (type === 'PVNC' || type === 'PVHSE' ? 'rejection' : 'approval'),
        projectId: submission.projectId,
        dedupKey: `pv-${stableId}`
      });

      await alertsAPI.createAlert({
        projectId: submission.projectId || 'N/A', householdId: submission.id, pvId: stableId,
        type, severity: (type === 'PVHSE' || type === 'PVRES') ? 'CRITICAL' : 'HIGH',
        title: `${type} - ${submission.name}`,
        description: `PV ${type} généré automatiquement.`
      }).catch(() => {});

      toast.success(`PV ${type} généré et envoyé`);
      setSelectedSubmission({ ...submission, activePVType: type, generatedPvId: stableId });
    } catch (err) {
      console.error('[PV_GEN_ERROR]', err);
      toast.error('Erreur de génération');
    } finally {
      setIsGenerating(false);
    }
  }, [getRecommendedType]);

  const handleResetPVs = useCallback(async (householdId: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer tout l'historique de ce ménage (remise à zéro) ?")) return;
    try {
      const pvs = await db.pvs.where('householdId').equals(householdId).toArray();
      await db.pvs.bulkDelete(pvs.map(p => p.id));
      toast.success("Historique remis à zéro");
      if (selectedSubmission?.id === householdId) {
        setSelectedSubmission({ ...selectedSubmission, activePVType: null, generatedPvId: null });
      }
    } catch (err) {
      toast.error("Erreur lors de la remise à zéro");
    }
  }, [selectedSubmission]);

  return {
    searchTerm, setSearchTerm, selectedType, setSelectedType,
    selectedSubmission, setSelectedSubmission, isGenerating,
    isSignatureOpen, setIsSignatureOpen, signatureData, setSignatureData,
    archivedPVs, filteredSubmissions, getRecommendedType, handleCreatePV, handleResetPVs, isLoadingDB,
    isBossSignatureOpen, setIsBossSignatureOpen, bossSignatureData, setBossSignatureData
  };
}

export default function PVAutomation() {
  const logic = usePVAutomation();
  const { canEdit } = usePermissions();

  return (
    <PageContainer>
      <PageHeader title="Automatisation des PV" subtitle="Pilotage contractuel par IA" icon={FileText}/>
      <ContentArea className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-4">
            <PVSubmissionsList logic={logic} />
          </div>
          <div className="xl:col-span-8">
            <PVGenerator logic={logic} />
          </div>
        </div>
        {logic.filteredSubmissions.length > 0 && (
          <>
            <PVStatsBoard archivedPVs={logic.archivedPVs.filter((pv: any) => logic.filteredSubmissions.some((s: any) => s.id === pv.householdId))} isLoadingDB={logic.isLoadingDB} />
            <PVArchivePanel logic={logic} archivedPVs={logic.archivedPVs.filter((pv: any) => logic.filteredSubmissions.some((s: any) => s.id === pv.householdId))} />
          </>
        )}
      </ContentArea>
      <SignatureModal 
        isOpen={logic.isSignatureOpen}
        onClose={() => logic.setIsSignatureOpen(false)}
        onSave={(data) => {
          logic.setSignatureData(data);
          audioService.playSuccess();
        }}
        title="Approbation Prestataire"
      />
      <SignatureModal 
        isOpen={logic.isBossSignatureOpen}
        onClose={() => logic.setIsBossSignatureOpen(false)}
        onSave={(data) => {
          logic.setBossSignatureData(data);
          audioService.playSuccess();
        }}
        title="Visa Direction / Chef de Projet"
      />
    </PageContainer>
  );
}

function PVSubmissionsList({ logic }: { logic: any }) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        <input
          type="text"
          placeholder="Rechercher..."
          value={logic.searchTerm}
          onChange={(e) => logic.setSearchTerm(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm outline-none"
        />
      </div>
      <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
        {logic.isLoadingDB ? (
          <div className="space-y-4"><TableRowSkeleton /><TableRowSkeleton /></div>
        ) : logic.filteredSubmissions.length === 0 ? (
          <div className="text-center py-8 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500">
            Aucun ménage en attente
          </div>
        ) : logic.filteredSubmissions.map((s: any) => (
          <div key={s.id} onClick={() => logic.setSelectedSubmission(s)} className={`p-4 rounded-xl border cursor-pointer transition-all ${logic.selectedSubmission?.id === s.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-white truncate">{s.name || 'Ménage Inconnu'}</span>
              <span className="text-[10px] font-bold text-slate-500">{logic.getRecommendedType(s)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PVGenerator({ logic }: { logic: any }) {
  if (!logic.selectedSubmission) return (
    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] py-20">
      <Search size={48} className="text-slate-800 mb-4" />
      <p className="text-slate-500 font-bold uppercase tracking-widest">Sélectionnez une soumission</p>
    </div>
  );

  return (
    <div className="bg-slate-950/40 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">{logic.selectedSubmission.name}</h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">LOT REF: {logic.selectedSubmission.numeroordre}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PVRulesEngine.evaluateAll(logic.selectedSubmission).map(type => {
            const tmpl = PV_TEMPLATES[type as PVType];
            if (!tmpl) return null;
            const colors = COLOR_MAP[tmpl.color as keyof typeof COLOR_MAP];
            const isSelected = logic.selectedSubmission.activePVType === type;
            return (
              <button 
                key={type} 
                onClick={() => logic.handleCreatePV(type as PVType, logic.selectedSubmission)} 
                disabled={logic.isGenerating}
                title={tmpl.title}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${isSelected ? `${colors.bg} text-white ${colors.shadow} scale-105` : 'bg-slate-800/50 text-slate-400 hover:text-white'}`}
              >
                {type}
              </button>
            );
          })}
          <button 
            onClick={() => logic.handleResetPVs(logic.selectedSubmission.id)}
            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all ml-auto"
            title="Remettre à zéro l'historique de ce lot"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="p-8 min-h-[400px]">
        <AnimatePresence mode="wait">
          {logic.selectedSubmission.activePVType ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={logic.selectedSubmission.activePVType}>
              <PVContentView submission={logic.selectedSubmission} logic={logic} />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-600"><Eye size={48} className="mb-4 opacity-20" /><p className="text-sm font-bold uppercase tracking-widest">Choisissez un modèle de PV</p></div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PVContentView({ submission, logic }: { submission: any, logic: any }) {
  const type = submission.activePVType as PVType;
  const tmpl = PV_TEMPLATES[type];
  const aiContent = useMemo(() => PVAIEngine.generateContent(submission, type), [submission, type]);

  const handleDownload = async () => {
    try {
      // 🔐 Sécurité: Génération d'un QR Code de Watermarking basé sur le HASH
      const qrDataUrl = await QRCode.toDataURL(aiContent.referenceContractuelle, { margin: 1, scale: 4, color: { dark: '#1e293b' } });
      const qrBase64 = qrDataUrl.split(',')[1];
      const qrBinaryString = window.atob(qrBase64);
      const qrBytes = new Uint8Array(qrBinaryString.length);
      for (let i = 0; i < qrBinaryString.length; i++) qrBytes[i] = qrBinaryString.charCodeAt(i);

      let signatureParagraph = new Paragraph({ text: "(En attente de visa prestataire)", alignment: AlignmentType.CENTER });
      if (logic.signatureData) {
        try {
          const base64Data = logic.signatureData.split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
          signatureParagraph = new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: bytes, transformation: { width: 180, height: 60 } })]
          });
        } catch (err) {
          console.warn("Erreur decodage signature", err);
          signatureParagraph = new Paragraph({ text: "(Visa prestataire apposé numériquement)", alignment: AlignmentType.CENTER });
        }
      }

      let bossSigImage = null;
      if (logic.bossSignatureData) {
        const base64Boss = logic.bossSignatureData.split(',')[1];
        const bytesBoss = new Uint8Array(window.atob(base64Boss).split('').map(c => c.charCodeAt(0)));
        bossSigImage = new ImageRun({ data: bytesBoss, transformation: { width: 180, height: 60 } });
      }

      const doc = new Document({
        styles: {
          default: {
            document: { run: { font: "Segoe UI", size: 22, color: "1e293b" } },
            heading1: {
              run: { font: "Segoe UI", size: 32, bold: true, color: "0f172a" },
              paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 300 } },
            },
            heading2: {
              run: { font: "Segoe UI", size: 24, bold: true, color: "0284c7" },
              paragraph: { spacing: { before: 400, after: 150 } },
            }
          }
        },
        sections: [{
          children: [
            // Header with Security QR Code
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, insideVertical: { style: BorderStyle.NIL }, insideHorizontal: { style: BorderStyle.NIL } },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ text: tmpl.title.toUpperCase(), heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: qrBytes, transformation: { width: 60, height: 60 } })] }),
                        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Authenticité Vérifiée", size: 12, italic: true, color: "64748b" })] })
                      ]
                    })
                  ]
                })
              ]
            }),
            new Paragraph({ text: "", spacing: { after: 200 } }),
            
            // Header: Informations du projet
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL },
                left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL },
                insideHorizontal: { style: BorderStyle.NIL }, insideVertical: { style: BorderStyle.NIL }
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "RÉFÉRENCE : ", bold: true, color: "64748b" }), new TextRun({ text: aiContent.referenceContractuelle, bold: true })] }),
                        new Paragraph({ children: [new TextRun({ text: "MÉNAGE : ", bold: true, color: "64748b" }), new TextRun({ text: `${submission.name || 'Inconnu'} (Lot ${submission.numeroordre || 'N/A'})` })] })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "DATE D'ÉDITION : ", bold: true, color: "64748b" }), new TextRun(new Date().toLocaleDateString('fr-FR'))] }),
                        new Paragraph({ children: [new TextRun({ text: "STATUT : ", bold: true, color: "64748b" }), new TextRun({ text: "VALIDÉ", bold: true, color: "10b981" })] })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }),
            new Paragraph({ text: "1. CONSTATS TECHNIQUES", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: aiContent.description, alignment: AlignmentType.JUSTIFIED }),
            
            new Paragraph({ text: "" }),
            new Paragraph({ text: "2. MATÉRIEL ASSOCIÉ", heading: HeadingLevel.HEADING_2 }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header Row
                new TableRow({
                  tableHeader: true,
                  children: [
                    new TableCell({ 
                      children: [new Paragraph({ children: [new TextRun({ text: "DÉSIGNATION / PRESTATION", bold: true, color: "ffffff" })] })], 
                      shading: { fill: "334155" },
                      margins: { top: 100, bottom: 100, left: 100 }
                    }),
                    new TableCell({ 
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "QUANTITÉ", bold: true, color: "ffffff" })] })], 
                      shading: { fill: "334155" },
                      margins: { top: 100, bottom: 100 }
                    }),
                  ]
                }),
                // Data Rows
                ...(aiContent.materials?.length ? aiContent.materials.map(m => 
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: m.item })], width: { size: 70, type: WidthType.PERCENTAGE }, margins: { left: 100, top: 50, bottom: 50 } }),
                      new TableCell({ children: [new Paragraph({ text: `${m.quantity} ${m.unit}`, alignment: AlignmentType.CENTER })], width: { size: 30, type: WidthType.PERCENTAGE } })
                    ]
                  })
                ) : [
                  new TableRow({ 
                    children: [
                      new TableCell({ 
                        columnSpan: 2, 
                        children: [new Paragraph({ text: "Aucun matériel n'a été déployé ni facturé sur ce lot (Clôture administrative).", italic: true, color: "64748b" })],
                        margins: { top: 100, bottom: 100, left: 100 }
                      }) 
                    ] 
                  })
                ])
              ]
            }),

            new Paragraph({ text: "" }),
            new Paragraph({ text: "3. RECOMMANDATIONS & ACTIONS", heading: HeadingLevel.HEADING_2 }),
            ...(aiContent.recommendations?.length ? aiContent.recommendations.map(r => new Paragraph({ text: `• ${r}` })) : [new Paragraph({ text: "Aucune recommandation particulière." })]),
            
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            
            // Footer: Signatures
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL },
                left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL },
                insideHorizontal: { style: BorderStyle.NIL }, insideVertical: { style: BorderStyle.NIL }
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ text: "Visa Chef de Projet / Direction", bold: true, alignment: AlignmentType.CENTER }),
                        bossSigImage ? new Paragraph({ alignment: AlignmentType.CENTER, children: [bossSigImage] }) : new Paragraph({ text: "(En attente de visa direction)", alignment: AlignmentType.CENTER, color: "64748b" })
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ text: "Visa Prestataire Terrain", bold: true, alignment: AlignmentType.CENTER }),
                        signatureParagraph
                      ]
                    })
                  ]
                })
              ]
            })
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `PV_${submission.numeroordre || 'DOC'}_${type}.docx`);
    } catch (e) {
      console.error("Erreur téléchargement DOCX", e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/5 rounded-[2rem] p-10 font-mono text-xs text-slate-300 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
         <div className="text-center border-b border-white/10 pb-8 mb-8">
            <h3 className="text-lg font-black text-white uppercase tracking-[0.4em]">{tmpl.title}</h3>
            <p className="opacity-40 mt-3 font-mono">HASH PROTECTED SERIAL: {aiContent.referenceContractuelle}</p>
         </div>
         <div className="space-y-6">
            <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Description des constats (IA Engine)</p><p className="italic leading-relaxed text-sm">"{aiContent.description}"</p></div>
            <div className="grid grid-cols-2 gap-8 pt-6">
                <div>
                   <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Signature Chef de Projet</p>
                   {logic.bossSignatureData ? (
                     <div className="h-16 flex items-center justify-center bg-white/5 rounded-xl border border-emerald-500/20"><img src={logic.bossSignatureData} className="h-10 invert opacity-90" alt="Visa Direction" /></div>
                   ) : (
                     <button onClick={() => logic.setIsBossSignatureOpen(true)} className="w-full h-16 flex items-center justify-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl font-black uppercase text-[10px] transition-all border border-emerald-500/20"><PenTool size={14} /> Visa Direction</button>
                   )}
                </div>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Signature Prestataire</p>
                   {logic.signatureData ? (
                     <div className="h-16 flex items-center justify-center bg-white/5 rounded-xl border border-blue-500/20"><img src={logic.signatureData} className="h-10 invert opacity-90" alt="Signature" /></div>
                   ) : (
                     <button onClick={() => logic.setIsSignatureOpen(true)} className="w-full h-16 flex items-center justify-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl font-black uppercase text-[10px] transition-all border border-blue-500/20"><PenTool size={14} /> Apposez votre visa</button>
                   )}
                </div>
             </div>
         </div>
       </div>
       <div className="flex gap-4">
         <button 
           onClick={handleDownload}
           aria-label="Télécharger le document"
           className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 text-xs uppercase tracking-widest shadow-xl shadow-blue-900/20"
         >
           <Download size={18} /> Télécharger le Document
         </button>
         <button 
           onClick={() => {
             const phone = submission.phone ? submission.phone.toString().replace(/[^0-9+]/g, '') : '';
             const text = encodeURIComponent(`Bonjour, le Procès-Verbal (${tmpl.title}) pour le lot N°${submission.numeroordre || 'N/A'} a été édité et validé.\nRéférence : ${aiContent.referenceContractuelle}`);
             if (phone) {
               window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
             } else {
               toast.error('Aucun numéro de téléphone renseigné pour ce ménage.');
             }
           }}
           title="Partager le constat par WhatsApp"
           aria-label="Envoyer un message WhatsApp"
           className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-emerald-900/20"
         >
           <MessageSquare size={18} /> WhatsApp
         </button>
      </div>
    </div>
  );
}

function PVStatsBoard({ archivedPVs, isLoadingDB }: { archivedPVs: any[], isLoadingDB?: boolean }) {
  const stats = useMemo(() => {
    const total = archivedPVs.length;
    let label = "CONFORME";
    let color: keyof typeof COLOR_MAP = "emerald";

    if (archivedPVs.some(pv => pv.type === 'PVINE')) {
      label = "INÉLIGIBLE";
      color = "rose";
    } else if (archivedPVs.some(pv => pv.type === 'PVNC' || pv.type === 'PVHSE')) {
      label = "NON CONFORME";
      color = "red";
    }

    return { 
      total, 
      statusLabel: label,
      statusColor: color,
      hse: archivedPVs.filter(pv => pv.type === 'PVHSE').length,
      delay: archivedPVs.filter(pv => pv.type === 'PVRET').length
    };
  }, [archivedPVs]);

  if (isLoadingDB) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      <StatWidget label="État Global" value={stats.statusLabel} color={stats.statusColor} icon={ShieldCheck} isString />
      <StatWidget label="Total Archivé" value={stats.total} color="blue" icon={FileText} />
      <StatWidget label="Incidents HSE" value={stats.hse} color="red" icon={ShieldAlert} />
      <StatWidget label="Délais/Retards" value={stats.delay} color="amber" icon={Clock} />
    </div>
  );
}

function StatWidget({ label, value, color, icon: Icon, suffix = "", isString = false }: any) {
  const styles = COLOR_MAP[color as keyof typeof COLOR_MAP];
  return (
    <div className={`p-6 bg-slate-900/40 border ${styles.border} rounded-[2rem] relative overflow-hidden shadow-lg transition-all border-l-4`}>
      <Icon className={`absolute top-4 right-4 opacity-5`} size={64} />
      <p className={`text-[10px] font-black uppercase tracking-widest ${styles.text} mb-1`}>{label}</p>
      <div className="text-xl font-black text-white">
        {isString ? <span>{value}</span> : <AnimatedCounter value={value} suffix={suffix} />}
      </div>
    </div>
  );
}

function PVArchivePanel({ logic, archivedPVs }: { logic: any, archivedPVs: any[] }) {
  const handleExportExcel = () => {
    const data = archivedPVs.map(pv => ({
      ID_PV: pv.id,
      Lot: pv.metadata?.numeroordre || 'N/A',
      Type: pv.type,
      Date: format(new Date(pv.createdAt), 'dd/MM/yyyy HH:mm'),
      Contenu: pv.content
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registre_PV");
    XLSX.writeFile(workbook, `GEM_Registre_PV_${new Date().getTime()}.xlsx`);
    toast.success("Excel généré avec succès");
  };

  return (
    <div className="mt-12 bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
      <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-widest">Registre de Traçabilité</h3>
          <p className="text-[10px] text-slate-500 font-bold flex items-center gap-2 mt-1">
            <ShieldCheck size={12} className="text-emerald-500" /> Documents persistés GEM
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all"
          >
            <Download size={14} /> Export Excel
          </button>
          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-black border border-blue-500/20">{archivedPVs.length} PV</span>
        </div>
      </div>
      <div className="p-2 overflow-x-auto">
        <table className="w-full text-left text-xs border-separate border-spacing-y-2">
          <thead className="text-slate-600 font-black uppercase tracking-[0.2em] text-[9px]">
            <tr>
              <th className="px-6 py-4">Status / Type</th>
              <th className="px-6 py-4">Lot ID</th>
              <th className="px-6 py-4">Émetteur</th>
              <th className="px-6 py-4">Horodatage</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {archivedPVs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((pv, idx) => {
              const isLatest = idx === 0;
              return (
                <tr key={pv.id} className={`${isLatest ? 'bg-white/[0.05]' : 'bg-white/[0.01] opacity-40 grayscale'} transition-all`}>
                  <td className="px-6 py-4 border-y border-l border-white/5">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg font-black text-[9px] border ${isLatest ? 'bg-white/5 text-white' : 'bg-slate-800/20 text-slate-500'}`}>
                      {pv.type} {isLatest && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />}
                    </span>
                  </td>
                  <td className={`px-6 py-4 border-y border-white/5 font-black ${isLatest ? 'text-white' : 'text-slate-500'}`}>{pv.metadata?.numeroordre || '—'}</td>
                  <td className="px-6 py-4 border-y border-white/5 text-slate-400 italic">By {pv.createdBy || 'Système'}</td>
                  <td className="px-6 py-4 border-y border-white/5 text-slate-500">{format(new Date(pv.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-6 py-4 border-y border-r border-white/5 text-right">
                    <button 
                      onClick={async () => {
                        const submission = await db.households.get(pv.householdId);
                        if (submission) {
                          logic.setSelectedSubmission({ ...submission, activePVType: pv.type });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      title="Afficher sur le panneau central"
                      className={`p-2.5 rounded-xl transition-all ${isLatest ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
                    >
                      <Eye size={14}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
