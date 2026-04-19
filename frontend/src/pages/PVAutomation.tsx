import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, AlertTriangle, CheckCircle2, XCircle, Clock, Trash2, Mail,
  MessageSquare, Download, Search, Eye, Send, ShieldAlert,
  ShieldCheck, Scale, Bell, ExternalLink, Pen as PenTool, Database
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';

// --- Services & DB ---
import { db } from '../store/db';
import { PageContainer, PageHeader, ContentArea } from '@components';
import { TableRowSkeleton, CardSkeleton } from '../components/common/Skeleton';
import SignatureModal from '../components/common/SignatureModal';
import { usePermissions } from '../hooks/usePermissions';
import { dispatchPVAlerts } from '../services/alertTraceService';
import { createNotification } from '../services/notificationService';
import { alertsAPI } from '../services/alertsAPI';
import { PVAIEngine, PV_TEMPLATES, PV_DESCRIPTIONS } from '../services/ai/PVAIEngine';
import type { PVType } from '../services/ai/PVAIEngine';
import { PVRulesEngine } from '../services/ai/PVRulesEngine';
import { PVDocGenerator } from '../services/ai/PVDocGenerator';
import { audioService } from '../services/audioService';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { useAuthStore } from '../store/authStore';

// --- Constants & Types ---


const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-600', lightBg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', shadow: 'shadow-emerald-500/20' },
  red: { bg: 'bg-red-600', lightBg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', shadow: 'shadow-red-500/20' },
  orange: { bg: 'bg-orange-600', lightBg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', shadow: 'shadow-orange-500/20' },
  amber: { bg: 'bg-amber-600', lightBg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', shadow: 'shadow-amber-500/20' },
  blue: { bg: 'bg-blue-600', lightBg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', shadow: 'shadow-blue-500/20' },
  rose: { bg: 'bg-rose-600', lightBg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', shadow: 'shadow-rose-500/20' },
} as const;

const PV_ICONS: Record<PVType, any> = {
  PVR: CheckCircle2,
  PVNC: AlertTriangle,
  PVHSE: ShieldAlert,
  PVRET: Clock,
  PVRD: ShieldCheck,
  PVRES: Scale,
  PVINE: FileText
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

  const archivedPVsQuery = useLiveQuery(async () => {
    const all = await db.pvs.orderBy('createdAt').reverse().toArray();
    // Déduplication par [ménage + type] pour ne garder que le dernier état
    const latestMap = new Map();
    all.forEach(pv => {
      const key = `${pv.householdId}_${pv.type}`;
      if (!latestMap.has(key)) {
        latestMap.set(key, pv);
      }
    });
    return Array.from(latestMap.values());
  });
  const submissionsQuery = useLiveQuery(() => db.households.filter(h => !!h.koboData || h.status === 'WAITING_AUDIT').toArray());

  const isLoadingDB = archivedPVsQuery === undefined || submissionsQuery === undefined;
  const archivedPVs = archivedPVsQuery || [];
  const submissions = submissionsQuery || [];

  const getRecommendedType = useCallback((s: any): PVType => {
    return PVRulesEngine.evaluate(s);
  }, []);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      // Toujours inclure le ménage sélectionné pour éviter qu'il ne disparaisse pendant l'édition
      if (selectedSubmission && s.id === selectedSubmission.id) return true;
      
      const matchSearch = `${s.name} ${s.numeroordre} ${s.id}`.toLowerCase().includes(searchTerm.toLowerCase());
      if (selectedType === 'ALL') return matchSearch;
      return matchSearch && PVRulesEngine.evaluateAll(s).includes(selectedType as any);
    });
  }, [submissions, searchTerm, selectedType, selectedSubmission]);

  const [hseTeam, setHseTeam] = useState('');
  const [hseDescription, setHseDescription] = useState('');
  const teams = useLiveQuery(() => db.teams.toArray()) || [];

  const handleCreatePV = useCallback(async (type: PVType, submission: any) => {
    if (!submission) return;
    setIsGenerating(true);
    try {
      const currentUser = useAuthStore.getState().user;
      const issuerName = currentUser?.name || 'Système GEM';

      // Clé d'id unique par ménage+type pour éviter les doublons au clic répétitif
      const stableId = `${submission.id}_${type}`;

      const currentHseTeamName = teams.find(t => t.id === hseTeam)?.name || 'N/A';
      
      await db.pvs.put({
        id: stableId,
        householdId: submission.id,
        projectId: submission.projectId || 'N/A',
        type,
        content: `PV ${type} pour ${submission.name}`,
        createdBy: issuerName,
        createdAt: new Date().toISOString(),
        metadata: { 
          numeroordre: submission.numeroordre, 
          recommended: getRecommendedType(submission) === type,
          manualTeam: type === 'PVHSE' ? currentHseTeamName : undefined,
          manualDescription: type === 'PVHSE' ? hseDescription : undefined
        }
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
      }).catch(() => { });

      toast.success(`PV ${type} généré et envoyé`);
      setSelectedSubmission({ ...submission, activePVType: type, generatedPvId: stableId });
    } catch (err) {
      console.error('[PV_GEN_ERROR]', err);
      toast.error('Erreur de génération');
    } finally {
      setIsGenerating(false);
    }
  }, [getRecommendedType]);

  const handleExportGlobalDoc = async (type: string, pvs: any[]) => {
    if (pvs.length === 0) {
      toast.error("Aucun PV de ce type à exporter");
      return;
    }

    setIsGenerating(true);
    try {
      const tmpl = PV_TEMPLATES[type as PVType] || { title: "Export Global" };
      const households = await db.households.bulkGet(pvs.map(pv => pv.householdId));
      const totals = households.reduce((acc, h) => {
        if (!h) return acc;
        const source = { 
          ...(h.koboData || h.koboSync || {}), 
          ...(h.constructionData?.livreur || {}), 
          ...h.constructionData 
        };
        
        const c25 = Number(source.câble_2_5 || source['group_sy9vj14/Longueur_câble_2_5mm_Int_rieure'] || 0);
        const c15 = Number(source.câble_1_5 || source['group_sy9vj14/Longueur_câble_1_5mm_Int_rieure'] || 0);
        const tr4 = Number(source.tranchee_4 || source['group_sy9vj14/Longueur_Tranch_e_câble_arm_4mm'] || 0);

        acc.cable += (c25 + c15);
        acc.tranchee += tr4;
        return acc;
      }, { cable: 0, tranchee: 0 });

      const currentUser = useAuthStore.getState().user;

      // 🔐 Sécurité: QR Code Global
      const globalId = `GLOBAL-${type}-${Date.now()}`;
      const qrDataUrl = await QRCode.toDataURL(globalId, { margin: 1, scale: 4 });
      const qrBytes = new Uint8Array(window.atob(qrDataUrl.split(',')[1]).split('').map(c => c.charCodeAt(0)));

      // ✍️ Signatures (Persistées)
      let sigs: any[] = [];
      if (bossSignatureData) {
        const b = new Uint8Array(window.atob(bossSignatureData.split(',')[1]).split('').map(c => c.charCodeAt(0)));
        sigs.push(new ImageRun({ data: b, transformation: { width: 150, height: 50 }, type: 'png' }));
      }
      if (signatureData) {
        const b = new Uint8Array(window.atob(signatureData.split(',')[1]).split('').map(c => c.charCodeAt(0)));
        sigs.push(new ImageRun({ data: b, transformation: { width: 150, height: 50 }, type: 'png' }));
      }

      const doc = new Document({
        styles: { default: { document: { run: { font: "Segoe UI", size: 22 } } } },
        sections: [{
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "PROQUELEC - RÉCAPITULATIF GLOBAL", bold: true, size: 20, color: "64748b" }),
              ]
            }),
            new Paragraph({
              spacing: { before: 200, after: 400 },
              children: [
                new TextRun({ text: tmpl.title.toUpperCase(), bold: true, size: 36, color: "0f172a" }),
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({ text: "1. CONSTATS TECHNIQUES", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
            new Paragraph({ text: `Ce document certifie le traitement d'intégration ou d'audit pour un lot de dossiers sous le statut : ${tmpl.title.toUpperCase()}. Les vérifications de terrain ont été réalisées par les agents habilités et approuvées par le superviseur. Chaque dossier mentionné ci-dessous remplit les conditions de ce statut global.`, alignment: AlignmentType.JUSTIFIED }),

            new Paragraph({ text: "2. MATÉRIEL ASSOCIÉ", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
            new Paragraph({ text: "La liste du matériel précis (câbles, tranchées, équipements intérieurs) est documentée et cryptée dans chaque procès-verbal individuel. Ce rapport global certifie l'exécution des travaux et valide la prestation de manière groupée.", alignment: AlignmentType.JUSTIFIED }),

            new Paragraph({ text: "3. MÉNAGES CONCERNÉS & RÉFÉRENCES", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    new TableCell({ shading: { fill: "334155" }, margins: { top: 100, bottom: 100, left: 100 }, children: [new Paragraph({ children: [new TextRun({ text: "LOT N°", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "334155" }, margins: { top: 100, bottom: 100, left: 100 }, children: [new Paragraph({ children: [new TextRun({ text: "DATE VALIDATION", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "334155" }, margins: { top: 100, bottom: 100, left: 100 }, children: [new Paragraph({ children: [new TextRun({ text: "ÉMETTEUR GEM", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "334155" }, margins: { top: 100, bottom: 100, left: 100 }, children: [new Paragraph({ children: [new TextRun({ text: "RÉFÉRENCE PV INDIVIDUEL", color: "ffffff", bold: true })] })] }),
                  ]
                }),
                ...pvs.map(pv => {
                  const h = households.find(hh => hh?.id === pv.householdId);
                  return new TableRow({
                    children: [
                      new TableCell({ margins: { top: 100, bottom: 100, left: 100 }, children: [new Paragraph({ text: pv.metadata?.numeroordre || '-' })] }),
                      new TableCell({ margins: { top: 100, bottom: 100, left: 100 }, children: [new Paragraph({ text: format(new Date(pv.createdAt), 'dd/MM/yyyy HH:mm') })] }),
                      new TableCell({ margins: { top: 100, bottom: 100, left: 100 }, children: [new Paragraph({ text: pv.createdBy || 'N/A' })] }),
                      new TableCell({ margins: { top: 100, bottom: 100, left: 100 }, children: [new Paragraph({ children: [new TextRun({ text: h?.latitude ? `${h.latitude}, ${h.longitude}` : 'N/A' })] })] }),
                    ]
                  });
                })
              ]
            }),

            new Paragraph({ text: "4. RÉSUMÉ STATISTIQUE DU LOT", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ shading: { fill: "f8fafc" }, children: [new Paragraph({ children: [new TextRun({ text: "NOMBRE DE MÉNAGES", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: String(pvs.length), alignment: AlignmentType.CENTER })] }),
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ shading: { fill: "f8fafc" }, children: [new Paragraph({ children: [new TextRun({ text: "TAUX DE CONFORMITÉ (LOT)", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: type === 'PVR' ? '100% (Conforme)' : (['PVINE', 'PVHSE', 'PVRET'].includes(type)) ? 'N/A (Constat)' : '0% (Non Conforme)', alignment: AlignmentType.CENTER })] }),
                  ]
                })
              ]
            }),

            new Paragraph({ text: "5. CONSOLIDATION GLOBALE DES MATÉRIELS", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ children: [new TextRun({ text: "DESIGNATION DU MATÉRIEL", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TOTAL CUMULÉ DU LOT", color: "ffffff", bold: true })] })] }),
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: "Câble 2.5mm² (Intérieur)" })] }),
                    new TableCell({ children: [new Paragraph({ text: `${totals.cable.toFixed(2)} m`, alignment: AlignmentType.CENTER })] }),
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: "Tranchée / Câble Armé 4mm²" })] }),
                    new TableCell({ children: [new Paragraph({ text: `${totals.tranchee.toFixed(2)} m`, alignment: AlignmentType.CENTER })] }),
                  ]
                })
              ]
            }),

            new Paragraph({ text: "6. REGISTRE GÉOGRAPHIQUE & GPS", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ children: [new TextRun({ text: "LOT N°", color: "ffffff", bold: true })] })] }),
                    new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ children: [new TextRun({ text: "COORDONNÉES GPS (LAT, LON)", color: "ffffff", bold: true })] })] }),
                  ]
                }),
                ...pvs.map(pv => {
                  const h = households.find(hh => hh?.id === pv.householdId);
                  return new TableRow({
                    children: [
                      new TableCell({ margins: { left: 100 }, children: [new Paragraph({ children: [new TextRun({ text: pv.metadata?.numeroordre || '-' })] })] }),
                      new TableCell({ margins: { left: 100 }, children: [new Paragraph({ children: [new TextRun({ text: h?.latitude ? `${h.latitude}, ${h.longitude}` : 'Non géo-référencé', size: 16 })] })] }),
                    ]
                  });
                })
              ]
            }),

            new Paragraph({ text: "7. RECOMMANDATIONS & ACTIONS GLOBALES", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
            new Paragraph({ text: type === 'PVR' ? "• Validation du paiement prestataire pour l'intégralité de ces lots." : type === 'PVINE' ? "• Clôture administrative de masse. Aucune facturation n'est autorisée sur ces ménages." : "• Suivi des actions rectificatives selon les procédures contractuelles." }),
            new Paragraph({ text: "• Rattachement de ce bordereau récapitulatif aux pièces de conformité financières." }),

            new Paragraph({ text: "", spacing: { before: 800 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, insideVertical: { style: BorderStyle.NIL } },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "VISA DIRECTION", bold: true })], alignment: AlignmentType.CENTER }), ...(sigs[0] ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [sigs[0]] })] : [])] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "VISA PRESTATAIRE", bold: true })], alignment: AlignmentType.CENTER }), ...(sigs[1] ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [sigs[1]] })] : [])] })
                  ]
                })
              ]
            }),
            new Paragraph({ text: "", spacing: { before: 600 } }),
            new Paragraph({ children: [new TextRun({ text: "ANNEXE - DÉFINITIONS DES STATUTS", bold: true, size: 16, color: "64748b" })] }),
            ...Object.entries(PV_DESCRIPTIONS).map(([k, v]) => new Paragraph({
              children: [
                new TextRun({ text: `${k} : `, bold: true, size: 14, color: "94a3b8" }),
                new TextRun({ text: v as string, size: 14, color: "94a3b8" })
              ]
            }))
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `GEM_PV_GLOBAL_${type}_${Date.now()}.docx`);
      toast.success("PV Global généré !");
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'export global");
    } finally {
      setIsGenerating(false);
    }
  };

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

  const handleExportAnomalies = useCallback(async () => {
    const anomalyHouseholds = submissions.filter(h => (h.alerts || []).length > 0);
    if (anomalyHouseholds.length === 0) {
      toast.success("Aucune anomalie détectée ✓");
      return;
    }

    try {
      const data = anomalyHouseholds.map(h => ({
        'N° Ordre': h.numeroordre,
        'Nom': h.name,
        'Village': h.village,
        'Région': h.region,
        'Nb Alertes': h.alerts?.length || 0,
        'Détails Alertes': h.alerts?.map((a: any) => `[${a.type}] ${a.message}`).join(' | '),
        'Synchronisé': h.source === 'kobo' ? 'OUI' : 'NON'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Anomalies Terrain");
      XLSX.writeFile(wb, `GEM_Anomalies_Export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
      toast.success(`${anomalyHouseholds.length} anomalies exportées`);
    } catch (err) {
      toast.error("Échec de l'export des anomalies");
    }
  }, [submissions]);

  return {
    searchTerm, setSearchTerm, selectedType, setSelectedType,
    selectedSubmission, setSelectedSubmission, isGenerating,
    isSignatureOpen, setIsSignatureOpen, signatureData, setSignatureData,
    archivedPVs, filteredSubmissions, getRecommendedType, handleCreatePV, handleResetPVs, isLoadingDB,
    isBossSignatureOpen, setIsBossSignatureOpen, bossSignatureData, setBossSignatureData,
    handleExportGlobalDoc, handleExportAnomalies,
    hseTeam, setHseTeam, hseDescription, setHseDescription, teams
  };
}

export default function PVAutomation() {
  const logic = usePVAutomation();
  const { canEdit } = usePermissions();

  return (
    <PageContainer>
      <PageHeader title="Automatisation des Rapports" subtitle="Pilotage contractuel par IA" icon={FileText} />
      <ContentArea className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-4">
            <PVSubmissionsList logic={logic} />
          </div>
          <div className="xl:col-span-8">
            <PVGenerator logic={logic} />
          </div>
        </div>
        <PVStatsBoard 
          archivedPVs={logic.archivedPVs} 
          isLoadingDB={logic.isLoadingDB} 
        />
        <PVArchivePanel 
          logic={logic} 
          archivedPVs={logic.archivedPVs} 
        />
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
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={logic.searchTerm}
            onChange={(e) => logic.setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm outline-none"
          />
        </div>
        <button 
          onClick={logic.handleExportAnomalies}
          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl border border-rose-500/20 transition-all shadow-lg shadow-rose-950/20"
          title="Exporter les anomalies (Excel)"
        >
          <Database size={16} />
        </button>
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
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-black text-white truncate max-w-[150px]">{s.name || 'Ménage Inconnu'}</span>
                {s.alerts?.length > 0 && (
                  <div className="relative">
                    <AlertTriangle size={12} className="text-rose-500 animate-pulse" />
                  </div>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-500">{logic.getRecommendedType(s)}</span>
            </div>
            {/* PROGRESS INDICATORS */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1" title="Maçonnerie">
                <div className={`w-1.5 h-1.5 rounded-full ${s.koboSync?.maconOk ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                <span className="text-[8px] font-bold text-slate-500 uppercase">M</span>
              </div>
              <div className="flex items-center gap-1" title="Réseau">
                <div className={`w-1.5 h-1.5 rounded-full ${s.koboSync?.reseauOk ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                <span className="text-[8px] font-bold text-slate-500 uppercase">R</span>
              </div>
              <div className="flex items-center gap-1" title="Installation Intérieure">
                <div className={`w-1.5 h-1.5 rounded-full ${s.koboSync?.interieurOk ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                <span className="text-[8px] font-bold text-slate-500 uppercase">I</span>
              </div>
              <div className="flex items-center gap-1" title="Contrôle Audit">
                <div className={`w-1.5 h-1.5 rounded-full ${s.koboSync?.controleOk ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                <span className="text-[8px] font-bold text-slate-500 uppercase">C</span>
              </div>
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
      <div className="p-4 md:p-8 border-b border-white/5 flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="text-center lg:text-left w-full lg:w-auto">
          <h2 className="text-xl md:text-2xl font-black text-white truncate max-w-[250px] md:max-w-none">{logic.selectedSubmission.name}</h2>
          <p className="text-[10px] md:text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">LOT REF: {logic.selectedSubmission.numeroordre}</p>
        </div>
        <div className="flex flex-wrap justify-center lg:justify-end gap-2 w-full lg:w-auto">
          {(() => {
            const hasCriticalAlert = logic.selectedSubmission.alerts?.some((a: any) => 
               a.type === 'DOUBLON_DETECTE' || a.type === 'MISMATCH_GPS'
            );

            if (hasCriticalAlert) {
              return (
                <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-500">
                      <ShieldAlert size={18} />
                   </div>
                   <div className="text-left">
                      <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest italic leading-none">Blocage Sécurité</p>
                      <p className="text-[7px] font-bold text-rose-400/60 uppercase tracking-tighter">Arbitrage requis dans le Control Center</p>
                   </div>
                </div>
              );
            }

            return PVRulesEngine.evaluateAll(logic.selectedSubmission).map(type => {
              const tmpl = PV_TEMPLATES[type as PVType];
              if (!tmpl) return null;
              const Icon = PV_ICONS[type as PVType] || FileText;
              const colors = COLOR_MAP[tmpl.color as keyof typeof COLOR_MAP];
              const isSelected = logic.selectedSubmission.activePVType === type;
              return (
                <button
                  key={type}
                  onClick={() => logic.handleCreatePV(type as PVType, logic.selectedSubmission)}
                  disabled={logic.isGenerating || (type === 'PVHSE' && (!logic.hseTeam || !logic.hseDescription))}
                  title={tmpl.title}
                  className={`flex-1 sm:flex-none px-3 md:px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all duration-300 ${isSelected ? `${colors.bg} text-white ${colors.shadow} scale-105` : 'bg-slate-800/50 text-slate-400 hover:text-white'} ${(type === 'PVHSE' && (!logic.hseTeam || !logic.hseDescription)) ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
                >
                  {['PVR', 'PVNC'].includes(type) ? 'PV' : 'Rapport'} {type}
                </button>
              );
            });
          })()}
          <button
            onClick={() => logic.handleResetPVs(logic.selectedSubmission.id)}
            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
            title="Remettre à zéro l'historique de ce lot"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="p-4 md:p-8 min-h-[300px] md:min-h-[400px]">
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
    setIsDownloading(true);
    try {
      await PVDocGenerator.generateIndividualDoc(submission, type, {
        prestataire: logic.signatureData,
        boss: logic.bossSignatureData
      });
      toast.success("Rapport téléchargé");
    } catch (err) {
      toast.error("Erreur de téléchargement");
    } finally {
      setIsDownloading(false);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-10 font-mono text-xs text-slate-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
        <div className="text-center border-b border-white/10 pb-6 md:pb-8 mb-6 md:mb-8">
          <h3 className="text-sm md:text-lg font-black text-white uppercase tracking-[0.2em] md:tracking-[0.4em]">{tmpl.title}</h3>
          <p className="opacity-40 mt-3 font-mono text-[10px] md:text-xs">HASH SERIAL: {aiContent.referenceContractuelle}</p>
        </div>
        <div className="space-y-6">
          {/* 🛡️ ÉDITEUR MANUEL HSE */}
          {type === 'PVHSE' && (
            <div className="p-4 md:p-6 bg-red-600/10 border border-red-500/20 rounded-2xl md:rounded-3xl space-y-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="text-red-500" size={18} />
                <h4 className="text-white font-black uppercase text-[10px]">Information Incident HSE</h4>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] text-slate-500 font-bold uppercase mb-2 block tracking-widest">Équipe en cause</label>
                  <select 
                    value={logic.hseTeam}
                    onChange={(e) => logic.setHseTeam(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white text-[11px] outline-none focus:border-red-500/50 transition-all font-bold"
                  >
                    <option value="">-- Sélectionner l'équipe --</option>
                    {logic.teams?.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-slate-500 font-bold uppercase mb-2 block tracking-widest">Description des faits</label>
                  <textarea 
                    value={logic.hseDescription}
                    onChange={(e) => logic.setHseDescription(e.target.value)}
                    placeholder="Détaillez le manquement HSE constaté..."
                    className="w-full h-24 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-[11px] outline-none focus:border-red-500/50 transition-all resize-none font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {!logic.hseDescription && type !== 'PVHSE' && (
            <div><p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase mb-2">Description des constats (IA Engine)</p><p className="italic leading-relaxed text-xs md:text-sm whitespace-pre-wrap">"{aiContent.description}"</p></div>
          )}
          
          {(type === 'PVHSE' && logic.hseDescription) && (
             <div><p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase mb-2">Aperçu du Constat Manuel</p><p className="italic leading-relaxed text-xs md:text-sm whitespace-pre-wrap text-red-400">"{logic.hseDescription}"</p></div>
          )}
          {!!aiContent.photos?.length && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {aiContent.photos.map((url, i) => (
                <div key={i} className="group relative aspect-square rounded-xl overflow-hidden border border-white/5 bg-slate-800">
                  <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={`Anomalie ${i+1}`} onError={(e) => (e.currentTarget.src = 'https://placehold.co/400x400/1e293b/64748b?text=Image+Kobo')} />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => window.open(url, '_blank')} className="p-2 bg-white/20 backdrop-blur-md rounded-lg text-white"><Eye size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {!!aiContent.checklist?.length && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-3">Checklist d'Audit Technique</p>
              <div className="grid grid-cols-1 gap-2">
                {aiContent.checklist.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] border-b border-white/5 pb-2 last:border-0">
                    <span className="text-slate-400">{c.point}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white/60 font-mono text-[9px] bg-slate-800 px-2 py-0.5 rounded italic">{c.status}</span>
                      {c.conforme ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-rose-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pt-6">
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase mb-2">Signature Direction</p>
              {logic.bossSignatureData ? (
                <div className="h-16 flex items-center justify-center bg-white/5 rounded-xl border border-emerald-500/20 px-4"><img src={logic.bossSignatureData} className="max-h-12 invert opacity-90 object-contain" alt="Visa Direction" /></div>
              ) : (
                <button onClick={() => logic.setIsBossSignatureOpen(true)} className="w-full h-16 flex items-center justify-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl font-black uppercase text-[10px] transition-all border border-emerald-500/20"><PenTool size={14} /> Visa Direction</button>
              )}
            </div>
            <div><p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase mb-2">Signature Prestataire</p>
              {logic.signatureData ? (
                <div className="h-16 flex items-center justify-center bg-white/5 rounded-xl border border-blue-500/20 px-4"><img src={logic.signatureData} className="max-h-12 invert opacity-90 object-contain" alt="Signature" /></div>
              ) : (
                <button onClick={() => logic.setIsSignatureOpen(true)} className="w-full h-16 flex items-center justify-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl font-black uppercase text-[10px] transition-all border border-blue-500/20"><PenTool size={14} /> Apposez votre visa</button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleDownload}
          aria-label="Télécharger le document"
          className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 text-[10px] md:text-xs uppercase tracking-widest shadow-xl shadow-blue-900/20"
        >
          <Download size={18} /> Télécharger
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
          title="Partager par WhatsApp"
          className="w-full sm:w-auto px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-emerald-900/20 text-[10px] md:text-xs"
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
    <div className="space-y-4 mt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatWidget label="État Global" value={stats.statusLabel} color={stats.statusColor} icon={ShieldCheck} isString />
        <StatWidget label="Total Archivé" value={stats.total} color="blue" icon={FileText} />
        <StatWidget label="Incidents HSE" value={stats.hse} color="red" icon={ShieldAlert} />
        <StatWidget label="Délais/Retards" value={stats.delay} color="amber" icon={Clock} />
      </div>

      <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">Qualité de Service</p>
            <h4 className="text-white font-black text-sm md:text-base italic uppercase tracking-wider">Répartition Contractuelle</h4>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase">Généré le {format(new Date(), 'dd/MM/yy')}</p>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{stats.total} Documents</p>
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div 
            style={{ width: `${(archivedPVs.filter(pv => pv.type === 'PVR').length / (stats.total || 1)) * 100}%` }} 
            className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000" 
          />
          <div 
            style={{ width: `${(archivedPVs.filter(pv => pv.type === 'PVNC').length / (stats.total || 1)) * 100}%` }} 
            className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all duration-1000" 
          />
          <div 
            style={{ width: `${(archivedPVs.filter(pv => pv.type === 'PVINE').length / (stats.total || 1)) * 100}%` }} 
            className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)] transition-all duration-1000" 
          />
          <div 
            style={{ width: `${(archivedPVs.filter(pv => ['PVHSE', 'PVRET'].includes(pv.type)).length / (stats.total || 1)) * 100}%` }} 
            className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)] transition-all duration-1000" 
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5">
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Conformes</span></div>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Réserves</span></div>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Inéligibles</span></div>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /> <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Critiques</span></div>
        </div>
      </div>
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = (filtered: any[]) => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(p => p.id)));
  };

  const handleBulkDownload = async () => {
    const selected = archivedPVs.filter(pv => selectedIds.has(pv.id));
    if (selected.length === 0) return toast.error("Aucune sélection");
    
    toast(`Préparation de ${selected.length} rapports...`, { icon: 'ℹ️' });
    for (const pv of selected) {
      const sub = await db.households.get(pv.householdId);
      if (sub) {
        await PVDocGenerator.generateIndividualDoc(sub, pv.type as any, {
          prestataire: logic.signatureData,
          boss: logic.bossSignatureData
        });
        await new Promise(r => setTimeout(r, 400));
      }
    }
    toast.success("Téléchargement massif terminé");
  };

  const handleExportExcel = () => {
    const data = archivedPVs.map(pv => ({
      "ID PV": pv.id,
      "Type": pv.type,
      "Réf Ménage": pv.householdId,
      "N° Lot": pv.metadata?.numeroordre || '-',
      "Émis Par": pv.createdBy,
      "Date": format(new Date(pv.createdAt), 'dd/MM/yyyy HH:mm')
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registre_PV");
    XLSX.writeFile(workbook, `GEM_Registre_PV_${new Date().getTime()}.xlsx`);
    toast.success("Excel généré avec succès");
  };

  return (
    <div className="mt-12 bg-slate-950 border border-white/5 rounded-[1.5rem] md:rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      <div className="p-4 md:p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center bg-gradient-to-b from-white/5 to-transparent gap-4">
        <div className="text-center sm:text-left">
          <h3 className="text-base md:text-lg font-black text-white uppercase tracking-widest">Registre de Traçabilité</h3>
          <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3 mt-4">
            <div className="flex bg-slate-900 border border-white/10 p-1.5 rounded-2xl">
              {(['ALL', 'PVR', 'PVNC', 'PVINE'] as const).map(type => {
                const labels: Record<string, string> = { ALL: 'TOUS', PVR: 'RECEPTION', PVNC: 'NC/RÉSERVES', PVINE: 'INÉLIGIBLES' };
                return (
                  <button
                    key={type}
                    onClick={() => logic.setSelectedType(type)}
                    className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all tracking-widest ${logic.selectedType === type ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {labels[type]}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => logic.handleExportGlobalDoc(logic.selectedType === 'ALL' ? 'PVR' : logic.selectedType, archivedPVs.filter(p => logic.selectedType === 'ALL' || p.type === logic.selectedType))}
              disabled={logic.isGenerating}
              className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50"
              title="Génération Global"
            >
              {logic.isGenerating ? <Clock className="animate-spin" size={14} /> : <FileText size={14} />} 
              <span className="hidden xs:inline">
                {['PVR', 'PVNC'].includes(logic.selectedType) ? 'PV Global' : 'Rapport Global'} 
                {logic.selectedType !== 'ALL' ? ` (${logic.selectedType})` : ''}
              </span>
            </button>

            <button
              onClick={async () => {
                const filtered = archivedPVs.filter(p => logic.selectedType === 'ALL' || p.type === logic.selectedType);
                if (filtered.length === 0) return toast.error("Rien à télécharger");
                toast(`Démarrage du téléchargement groupé (${filtered.length} fichiers)...`, { icon: 'ℹ️' });
                
                for (const pv of filtered) {
                  const sub = logic.filteredSubmissions.find((s: any) => s.id === pv.householdId);
                  if (sub) {
                    try {
                      await PVDocGenerator.generateIndividualDoc(sub, pv.type, {
                        prestataire: logic.signatureData,
                        boss: logic.bossSignatureData
                      });
                      // Petit délai pour éviter de bloquer le navigateur
                      await new Promise(r => setTimeout(r, 400));
                    } catch (e) {
                      console.error("Erreur bulk download", e);
                    }
                  }
                }
                toast.success("Téléchargement groupé terminé");
              }}
              className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-indigo-500 hover:text-white transition-all"
            >
              <Download size={14} /> <span className="hidden xs:inline">Tout Télécharger</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all"
            >
              <Download size={14} /> <span className="hidden xs:inline">Excel</span>
            </button>

            <button
              onClick={async () => {
                const currentUser = useAuthStore.getState().user;
                const privilegedRoles = ['ADMIN_PROQUELEC', 'CHEF_PROJET'];
                const isPrivileged = privilegedRoles.includes(currentUser?.role || '');
                if (!isPrivileged) return toast.error("Action réservée aux Responsables");

                const pass = window.prompt("VEUILLEZ SAISIR VOTRE MOT DE PASSE POUR VIDER L'ARCHIVE :");
                if (!pass) return;

                if (window.confirm("ÊTES-VOUS CERTAIN ? Cette action va supprimer TOUS les rapports archivés du projet.")) {
                  await db.pvs.clear();
                  toast.success("L'archive a été entièrement vidée");
                }
              }}
              className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
            >
              <Trash2 size={14} /> <span className="hidden xs:inline">Vider Tout</span>
            </button>
          </div>
        </div>
      </div>
      {/* 🛠️ Actions de Sélection Massive */}
      {selectedIds.size > 0 && (
        <div className="mx-4 md:mx-8 mt-4 p-3 bg-blue-600 rounded-2xl flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 ml-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-xs">
              {selectedIds.size}
            </div>
            <p className="text-white text-[10px] md:text-xs font-black uppercase italic tracking-widest">Éléments sélectionnés</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (window.confirm(`Voulez-vous appliquer votre signature et re-générer ces ${selectedIds.size} rapports ?`)) {
                   await handleBulkDownload();
                }
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-950 rounded-xl text-[10px] font-black uppercase hover:bg-white/90 transition-all shadow-xl active:scale-95"
            >
              <ShieldCheck size={14} className="text-blue-600" /> Signer & Exporter
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 text-white/80 hover:text-white text-[10px] font-black uppercase"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full text-left text-xs border-separate border-spacing-y-2 min-w-[600px]">
          <thead className="text-slate-600 font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-[8px] md:text-[9px]">
            <tr>
              <th className="px-4 py-4 w-10">
                <input 
                  type="checkbox" 
                  checked={selectedIds.size > 0 && selectedIds.size === archivedPVs.filter(p => logic.selectedType === 'ALL' || p.type === logic.selectedType).length}
                  onChange={() => handleSelectAll(archivedPVs.filter(p => logic.selectedType === 'ALL' || p.type === logic.selectedType))}
                  className="rounded border-white/10 bg-slate-800 text-blue-500 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 md:px-6 py-4">Type</th>
              <th className="px-4 md:px-6 py-4">Lot ID</th>
              <th className="px-4 md:px-6 py-4 hidden sm:table-cell">Émetteur</th>
              <th className="px-4 md:px-6 py-4">Date</th>
              <th className="px-4 md:px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {archivedPVs.filter(p => logic.selectedType === 'ALL' || p.type === logic.selectedType).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((pv, idx) => {
              const isLatest = idx === 0;
              const isSelected = selectedIds.has(pv.id);
              return (
                <tr key={pv.id} className={`${isLatest ? 'bg-white/[0.05] border-l-2 border-blue-500' : 'bg-white/[0.01] hover:bg-white/[0.03]'} ${isSelected ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : ''} transition-all`}>
                  <td className="px-4 py-4 border-y border-l border-white/5">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => handleToggleSelect(pv.id)}
                      className="rounded border-white/10 bg-slate-800 text-blue-500 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 border-y border-white/5">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg font-black text-[9px] border ${isLatest ? 'bg-white/5 text-white' : 'bg-slate-800/20 text-slate-500'}`}>
                      {PV_TEMPLATES[pv.type as PVType]?.title || pv.type} {isLatest && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />}
                    </span>
                  </td>
                  <td className={`px-6 py-4 border-y border-white/5 font-black ${isLatest ? 'text-white' : 'text-slate-500'}`}>{pv.metadata?.numeroordre || '—'}</td>
                  <td className="px-6 py-4 border-y border-white/5 text-slate-400 italic">By {pv.createdBy || 'Système'}</td>
                  <td className="px-6 py-4 border-y border-white/5 text-slate-500">{format(new Date(pv.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-6 py-4 border-y border-r border-white/5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={async () => {
                          const submission = await db.households.get(pv.householdId);
                          if (submission) {
                            logic.setSelectedSubmission({ ...submission, activePVType: pv.type });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        title="Visualiser"
                        className={`p-2 rounded-xl transition-all ${isLatest ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        onClick={async () => {
                          const sub = await db.households.get(pv.householdId);
                          if (sub) {
                            PVDocGenerator.generateIndividualDoc(sub, pv.type, {
                              prestataire: logic.signatureData,
                              boss: logic.bossSignatureData
                            });
                          }
                        }}
                        title="Télécharger ce rapport"
                        className="p-2 rounded-xl bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        <Download size={14} />
                      </button>

                      <button
                        onClick={async () => {
                          const currentUser = useAuthStore.getState().user;
                          const privilegedRoles = ['ADMIN_PROQUELEC', 'CHEF_PROJET'];
                          const isPrivileged = privilegedRoles.includes(currentUser?.role || '');
                          
                          if (!isPrivileged) {
                            return toast.error("Action réservée aux Administrateurs ou Chefs de Projet");
                          }

                          const pass = window.prompt(`[SÉCURITÉ] Confirmation requise pour ${currentUser?.name}.\nVeuillez saisir votre MOT DE PASSE pour supprimer ce rapport :`);
                          if (!pass) return;
                          
                          if (window.confirm("Êtes-vous ABSOLUMENT certain ? Cette suppression est définitive pour l'audit.")) {
                            await db.pvs.delete(pv.id);
                            toast.success("Rapport supprimé par l'autorité compétente");
                          }
                        }}
                        title="Supprimer (Réservé Admin/Chef Projet)"
                        className="p-2 rounded-xl bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
