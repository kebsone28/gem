import React, { useState, useCallback, useRef } from 'react';
import type {
  Menage, LotKey, StatusValue, RegionSummary,
  EntrepreneurConfig, LotMode, Village, GpsEntry,
} from '../types';
import { STATUS_MAP } from '../constants';
import * as api from '../hooks/carto_grappes.service';


interface DossiersViewProps {
  menages: Menage[];
  entries: Record<number, { A: { status: StatusValue; justif: string }; B: { status: StatusValue; justif: string }; C: { status: StatusValue; justif: string }; conforme: boolean; obs: string }>;
  getEntry: (ordre: number) => { A: { status: StatusValue; justif: string }; B: { status: StatusValue; justif: string }; C: { status: StatusValue; justif: string }; conforme: boolean; obs: string };
  selectedLot: LotKey;
  regionSummaries: RegionSummary[];
  globalSummary: { total: number; fait: number; enCours: number; bloque: number; nonFait: number; pct: number };
  entrepreneurConfig: EntrepreneurConfig;
  lotModes: Record<LotKey, LotMode>;
  getEntrepreneur: (lot: LotKey, region: string, grappe: number) => { entreprise: string; societe: string; telephone: string; email: string; adresse: string };
  villages: Village[];
  gps: GpsEntry;
  onImportGlobalBackup?: (backup: any) => boolean;
}

function fmtFCFA(n: number): string {
  return n.toLocaleString('fr-FR');
}

function conformeFor(entry: { A: { status: StatusValue }; B: { status: StatusValue }; C: { status: StatusValue }; conforme: boolean }, lot: LotKey): boolean {
  return entry[lot].status === 'fait';
}

const DossiersView: React.FC<DossiersViewProps> = React.memo(({
  menages, getEntry, regionSummaries, globalSummary,
  entrepreneurConfig, lotModes, villages, gps,
  getEntrepreneur, onImportGlobalBackup, selectedLot,
}) => {
  const [exporting, setExporting] = useState<string | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<string>('');
  const backupInputRef = React.useRef<HTMLInputElement>(null);

  // Create a map of village to its computed grappe from menages data
  const villageGrappeMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    menages.forEach(m => {
      const key = `${m.region}|${m.village}`;
      if (map[key] === undefined) {
        map[key] = m.grappe;
      }
    });
    return map;
  }, [menages]);

  // Helper function to get computed grappe for a menage
  const getComputedGrappe = React.useCallback((region: string, village: string, defaultGrappe: number): number => {
    return villageGrappeMap[`${region}|${village}`] || defaultGrappe;
  }, [villageGrappeMap]);

  // ── Exportation sauvegarde JSON globale ──────────────────────────────────
  const exportGlobalBackup = useCallback(() => {
    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      source: 'GED OS — Carto Grappes — Sauvegarde Globale',
      entrepreneurConfig,
      lotModes,
      villages,
      gps,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CartoGrappes_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entrepreneurConfig, lotModes, villages, gps]);

  const handleImportBackupFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (onImportGlobalBackup) {
          const ok = onImportGlobalBackup(data);
          if (!ok) alert('Format de sauvegarde invalide ou version incompatible.');
          else alert('✅ Sauvegarde importée avec succès. Rechargez la page si besoin.');
        }
      } catch {
        alert('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [onImportGlobalBackup]);

  const exportExcel = useCallback(async () => {
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const header = ['N° Ordre','Nom','Téléphone','Village','Commune','Région','Grappe',
        'Statut Lot A','Commentaire A','Date MAJ A',
        'Statut Lot B','Commentaire B','Date MAJ B',
        'Statut Lot C','Commentaire C','Date MAJ C',
        'Conforme'];
      
      const rows = menages.map(m => {
        const entry = getEntry(m.ordre);
        const computedGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);
        return [
          m.ordre, m.nom, m.tel, m.village, m.commune || '', m.region, computedGrappe,
          STATUS_MAP[entry.A.status]?.label || entry.A.status, entry.A.justif || '', entry.A.updatedAt || '',
          STATUS_MAP[entry.B.status]?.label || entry.B.status, entry.B.justif || '', entry.B.updatedAt || '',
          STATUS_MAP[entry.C.status]?.label || entry.C.status, entry.C.justif || '', entry.C.updatedAt || '',
          entry.conforme ? 'Oui' : 'Non',
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws['!cols'] = [9,28,14,20,18,14,8,14,24,16,14,24,16,14,24,16,8].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, 'Suivi PROQUELEC');

      // Keep the résumé sheet too
      const summaryRows = regionSummaries.map(r => ({
        'Région': r.region, 'Total': r.total, 'Fait': r.fait, 'En cours': r.enCours,
        'Bloqué': r.bloque, 'Non fait': r.nonFait, '%': `${r.pct}%`,
      }));
      summaryRows.push({
        'Région': 'TOTAL', 'Total': globalSummary.total, 'Fait': globalSummary.fait,
        'En cours': globalSummary.enCours, 'Bloqué': globalSummary.bloque,
        'Non fait': globalSummary.nonFait, '%': `${globalSummary.pct}%`,
      });
      const wsSum = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSum, 'Résumé');

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Suivi_PROQUELEC_${date}.xlsx`);
    } finally {
      setExporting(null);
    }
  }, [menages, getEntry, regionSummaries, globalSummary, getComputedGrappe]);

  const exportPDF = useCallback(async () => {
    setExporting('pdf');
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new jsPDF('l', 'mm', 'a4');
      const autoTable = autoTableModule.default;

      doc.setFontSize(16);
      doc.text('Cartographie Grappes — Bordereau', 14, 15);
      doc.setFontSize(10);
      doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${menages.length} ménages`, 14, 22);

      const body = menages.map(m => {
        const entry = getEntry(m.ordre);
        const computedGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);
        return [
          m.ordre, m.nom, m.tel, m.village, computedGrappe,
          STATUS_MAP[entry.A.status]?.label || entry.A.status,
          STATUS_MAP[entry.B.status]?.label || entry.B.status,
          STATUS_MAP[entry.C.status]?.label || entry.C.status,
          entry.conforme ? 'Oui' : 'Non',
        ];
      });

      autoTable(doc, {
        startY: 28,
        head: [['#', 'Nom', 'Tél', 'Village', 'G', 'Lot A', 'Lot B', 'Lot C', 'Conforme']],
        body,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const date = new Date().toISOString().split('T')[0];
      doc.save(`CartoGrappes_Bordereau_${date}.pdf`);
    } finally {
      setExporting(null);
    }
  }, [menages, getEntry, getComputedGrappe]);

  const exportPDFByGrappe = useCallback(async (grappeKey: string) => {
    setExporting(`pdf_${grappeKey}`);
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new jsPDF('l', 'mm', 'a4');
      const autoTable = autoTableModule.default;
      const grpMenages = menages.filter(m => {
        const computedGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);
        return `${m.region}_${computedGrappe}` === grappeKey;
      });

      doc.setFontSize(14);
      doc.text(`Grappe ${grappeKey} — ${grpMenages.length} ménages`, 14, 15);

      const body = grpMenages.map(m => {
        const entry = getEntry(m.ordre);
        return [
          m.ordre, m.nom, m.tel, m.village,
          STATUS_MAP[entry.A.status]?.label || entry.A.status,
          STATUS_MAP[entry.B.status]?.label || entry.B.status,
          STATUS_MAP[entry.C.status]?.label || entry.C.status,
          entry.conforme ? 'Oui' : 'Non',
        ];
      });

      autoTable(doc, {
        startY: 22,
        head: [['#', 'Nom', 'Tél', 'Village', 'Lot A', 'Lot B', 'Lot C', 'Conforme']],
        body,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 41, 59] },
      });

      const date = new Date().toISOString().split('T')[0];
      doc.save(`CartoGrappes_${grappeKey}_${date}.pdf`);
    } finally {
      setExporting(null);
    }
  }, [menages, getEntry, getComputedGrappe]);

  const exportFinancialExcel = useCallback(async () => {
    setExporting('financier');
    try {
      const XLSX = await import('xlsx');

      const BAREME = { A: 15000, B: 25000, C: 10000 };

      const detailRows: Array<{
        'Ordre': number;
        'Nom': string;
        'Village': string;
        'Region': string;
        'Grappe': number;
        'Lot A': string;
        'Lot B': string;
        'Lot C': string;
        'Conforme': string;
        'Montant': number;
      }> = [];

      const grappeMap = new Map<string, {
        region: string;
        grappe: number;
        totalMenages: number;
        conformesA: number;
        conformesB: number;
        conformesC: number;
        totalConformes: number;
      }>();

      for (const m of menages) {
        const entry = getEntry(m.ordre);
        const confA = conformeFor(entry, 'A');
        const confB = conformeFor(entry, 'B');
        const confC = conformeFor(entry, 'C');
        const conforme = entry.conforme;
        const montant = (confA ? BAREME.A : 0) + (confB ? BAREME.B : 0) + (confC ? BAREME.C : 0);
        const computedGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);

        detailRows.push({
          'Ordre': m.ordre,
          'Nom': m.nom,
          'Village': m.village,
          'Region': m.region,
          'Grappe': computedGrappe,
          'Lot A': confA ? 'Conforme' : 'Non conforme',
          'Lot B': confB ? 'Conforme' : 'Non conforme',
          'Lot C': confC ? 'Conforme' : 'Non conforme',
          'Conforme': conforme ? 'Oui' : 'Non',
          'Montant': montant,
        });

        const key = `${m.region}_${computedGrappe}`;
        if (!grappeMap.has(key)) {
          grappeMap.set(key, {
            region: m.region,
            grappe: computedGrappe,
            totalMenages: 0,
            conformesA: 0,
            conformesB: 0,
            conformesC: 0,
            totalConformes: 0,
          });
        }
        const g = grappeMap.get(key)!;
        g.totalMenages++;
        if (confA) g.conformesA++;
        if (confB) g.conformesB++;
        if (confC) g.conformesC++;
        if (conforme) g.totalConformes++;
      }

      const summaryRows: Array<{
        'Region': string;
        'Grappe': number;
        'Total Menages': number;
        'Conformes Lot A': number;
        'Conformes Lot B': number;
        'Conformes Lot C': number;
        'Total Conformes': number;
        'Montant Lot A': string;
        'Montant Lot B': string;
        'Montant Lot C': string;
        'Total FCFA': string;
      }> = [];

      let grandTotalMenages = 0;
      let grandConfA = 0;
      let grandConfB = 0;
      let grandConfC = 0;
      let grandTotalConf = 0;
      let grandMontantA = 0;
      let grandMontantB = 0;
      let grandMontantC = 0;
      let grandMontant = 0;

      for (const [, g] of grappeMap) {
        const mA = g.conformesA * BAREME.A;
        const mB = g.conformesB * BAREME.B;
        const mC = g.conformesC * BAREME.C;
        const totalG = mA + mB + mC;

        summaryRows.push({
          'Region': g.region,
          'Grappe': g.grappe,
          'Total Menages': g.totalMenages,
          'Conformes Lot A': g.conformesA,
          'Conformes Lot B': g.conformesB,
          'Conformes Lot C': g.conformesC,
          'Total Conformes': g.totalConformes,
          'Montant Lot A': fmtFCFA(mA),
          'Montant Lot B': fmtFCFA(mB),
          'Montant Lot C': fmtFCFA(mC),
          'Total FCFA': fmtFCFA(totalG),
        });

        grandTotalMenages += g.totalMenages;
        grandConfA += g.conformesA;
        grandConfB += g.conformesB;
        grandConfC += g.conformesC;
        grandTotalConf += g.totalConformes;
        grandMontantA += mA;
        grandMontantB += mB;
        grandMontantC += mC;
        grandMontant += totalG;
      }

      summaryRows.push({
        'Region': 'TOTAL',
        'Grappe': 0,
        'Total Menages': grandTotalMenages,
        'Conformes Lot A': grandConfA,
        'Conformes Lot B': grandConfB,
        'Conformes Lot C': grandConfC,
        'Total Conformes': grandTotalConf,
        'Montant Lot A': fmtFCFA(grandMontantA),
        'Montant Lot B': fmtFCFA(grandMontantB),
        'Montant Lot C': fmtFCFA(grandMontantC),
        'Total FCFA': fmtFCFA(grandMontant),
      });

      const wb = XLSX.utils.book_new();

      const wsResume = XLSX.utils.json_to_sheet(summaryRows);
      wsResume['!cols'] = [
        { wch: 14 }, { wch: 8 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsResume, 'Resume');

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [
        { wch: 6 }, { wch: 25 }, { wch: 18 }, { wch: 14 },
        { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 10 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `CartoGrappes_Financier_${date}.xlsx`);
    } finally {
      setExporting(null);
    }
  }, [menages, getEntry, getComputedGrappe]);

  const printFinancialReport = useCallback(() => {
    const BAREME = { A: 15000, B: 25000, C: 10000 };
    
    let totalA = 0, totalB = 0, totalC = 0;
    const bodyRows = menages.map(m => {
      const entry = getEntry(m.ordre);
      const confA = entry.A.status === 'fait';
      const confB = entry.B.status === 'fait';
      const confC = entry.C.status === 'fait';
      const montant = (confA ? BAREME.A : 0) + (confB ? BAREME.B : 0) + (confC ? BAREME.C : 0);
      if (confA) totalA += BAREME.A;
      if (confB) totalB += BAREME.B;
      if (confC) totalC += BAREME.C;
      return `<tr>
        <td style="text-align:center;font-weight:600">${m.ordre}</td>
        <td>${m.nom}</td>
        <td>${m.village}</td>
        <td>${m.region}</td>
        <td style="text-align:center">${m.grappe}</td>
        <td style="text-align:center;color:${confA ? '#16a34a' : '#dc2626'}">${confA ? '✓' : '—'}</td>
        <td style="text-align:center;color:${confB ? '#16a34a' : '#dc2626'}">${confB ? '✓' : '—'}</td>
        <td style="text-align:center;color:${confC ? '#16a34a' : '#dc2626'}">${confC ? '✓' : '—'}</td>
        <td style="text-align:right;font-weight:600">${montant > 0 ? montant.toLocaleString('fr-FR') + ' FCFA' : '—'}</td>
      </tr>`;
    }).join('');

    const grandTotal = totalA + totalB + totalC;

    const html = `<!DOCTYPE html><html><head><title>Rapport Financier</title>
    <style>
      @media print { body { margin: 0; font-size: 9pt; } .no-print { display: none !important; } }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1e293b; }
      .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; }
      .header h1 { font-size: 18px; color: #1e3a5f; }
      .header p { font-size: 11px; color: #64748b; margin-top: 4px; }
      .summary { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
      .summary .card { flex: 1; min-width: 140px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
      .summary .card .val { font-size: 20px; font-weight: 700; color: #1e3a5f; }
      .summary .card .lbl { font-size: 10px; color: #64748b; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
      td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) { background: #f8fafc; }
      .total-row { background: #e2e8f0 !important; font-weight: 700; }
      .btn-print { display: block; margin: 0 auto 16px; padding: 8px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
      .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #94a3b8; }
    </style></head><body>
    <div class="no-print"><button class="btn-print" onclick="window.print()">🖨 Imprimer</button></div>
    <div class="header">
      <h1>Rapport Financier — Cartographie Grappes</h1>
      <p>PROQUELEC — ${menages.length} ménages — Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    </div>
    <div class="summary">
      <div class="card"><div class="val">${totalA.toLocaleString('fr-FR')}</div><div class="lbl">Lot A (FCFA)</div></div>
      <div class="card"><div class="val">${totalB.toLocaleString('fr-FR')}</div><div class="lbl">Lot B (FCFA)</div></div>
      <div class="card"><div class="val">${totalC.toLocaleString('fr-FR')}</div><div class="lbl">Lot C (FCFA)</div></div>
      <div class="card" style="background:#1e3a5f;color:white"><div class="val" style="color:white">${grandTotal.toLocaleString('fr-FR')}</div><div class="lbl" style="color:#94a3b8">Total FCFA</div></div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Nom</th><th>Village</th><th>Région</th><th>G</th>
        <th>Lot A</th><th>Lot B</th><th>Lot C</th><th>Montant</th>
      </tr></thead>
      <tbody>${bodyRows}
        <tr class="total-row"><td colspan="8" style="text-align:right">TOTAL GÉNÉRAL</td><td style="text-align:right">${grandTotal.toLocaleString('fr-FR')} FCFA</td></tr>
      </tbody>
    </table>
    <div class="footer">GED OS — Cartographie & Suivi des Grappes</div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }, [menages, getEntry]);

  const exportConfigJSON = useCallback(async () => {
    setExporting('config');
    try {
      const [settingsResult, planningResult, alertsResult] = await Promise.allSettled([
        api.fetchSettings(),
        api.fetchPlanningParams(),
        api.fetchAlertsConfig(),
      ]);

      const config = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        source: 'GED OS — Carto Grappes — Config',
        entrepreneurConfig,
        lotModes,
        settings: settingsResult.status === 'fulfilled' ? settingsResult.value : {},
        planningParams: planningResult.status === 'fulfilled' ? planningResult.value : {},
        alertConfig: alertsResult.status === 'fulfilled' ? alertsResult.value : {},
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CartoGrappes_Config_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }, [entrepreneurConfig, lotModes]);

const printVillageFiche = useCallback(() => {
    if (!selectedVillage) return;

    const [region, villageName] = selectedVillage.split('|||');
    const villageMenages = menages.filter(m => m.region === region && m.village === villageName);
    const computedGrappe = getComputedGrappe(region, villageName, villageMenages[0]?.grappe || 0);

    const rows = villageMenages.map(m => {
      const entry = getEntry(m.ordre);
      const menageGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);
      return '<tr><td style="text-align:center;font-weight:600">' + m.ordre + '</td><td>' + m.nom + '</td><td>' + m.tel + '</td><td style="text-align:center">' + m.village + '</td><td style="text-align:center">' + menageGrappe + '</td><td style="text-align:center">' + (STATUS_MAP[entry.A.status]?.label || entry.A.status) + '</td><td style="text-align:center">' + (STATUS_MAP[entry.B.status]?.label || entry.B.status) + '</td><td style="text-align:center">' + (STATUS_MAP[entry.C.status]?.label || entry.C.status) + '</td><td style="text-align:center;font-weight:600;color:' + (entry.conforme ? '#16a34a' : '#dc2626') + '">' + (entry.conforme ? 'Oui' : 'Non') + '</td><td style="text-align:right">' + (entry.obs || '—') + '</td></tr>';
    }).join('');

    const grappeStr = String(computedGrappe);
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const countStr = String(villageMenages.length);
    const footerStr = 'GED OS — Cartographie & Suivi des Grappes — ' + villageName + ', ' + region;

    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Fiche Village — ' + villageName + ' (' + region + ')</title><style>@media print{body{margin:0;font-size:10pt}.no-print{display:none!important}table{page-break-inside:avoid}}*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Arial,sans-serif;padding:24px;color:#1e293b}.header{text-align:center;margin-bottom:20px;border-bottom:3px solid #1e3a5f;padding-bottom:12px}.header h1{font-size:18px;color:#1e3a5f;margin-bottom:4px}.header p{font-size:12px;color:#64748b}.meta{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:12px}.meta span{font-weight:600}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#1e3a5f;color:white;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}tr:hover{background:#eff6ff}.footer{margin-top:16px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}.btn-print{display:block;margin:0 auto 16px;padding:8px 24px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600}.btn-print:hover{background:#1d4ed8}</style></head><body><div class="no-print"><button class="btn-print" onclick="window.print()">🖨 Imprimer</button></div><div class="header"><h1>Fiche Village — ' + villageName + '</h1><p>Region: ' + region + ' — Grappe ' + grappeStr + ' — ' + countStr + ' menages</p></div><div class="meta"><div>Generee le <span>' + dateStr + '</span></div><div>PROQUELEC — Cartographie & Suivi des Grappes</div></div><table><thead><tr><th>#</th><th>Nom</th><th>Telephone</th><th>Village</th><th>Grappe</th><th>Lot A</th><th>Lot B</th><th>Lot C</th><th>Conforme</th><th>Observations</th></tr></thead><tbody>' + (rows || '<tr><td colspan="10" style="text-align:center;padding:16px;color:#94a3b8;">Aucun menage dans ce village</td></tr>') + '</tbody></table><div class="footer">' + footerStr + '</div></body></html>';

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }, [selectedVillage, menages, getEntry, getComputedGrappe]);

  const exportAllDossiersZip = useCallback(async () => {
    setExporting('zip');
    try {
      const [
        fflateLib,
        { wPara: para, wHeading: heading, wTable: tbl, wCell: cell, wBullet: bullet, generateContratDocxRich },
        { sortByNearestNeighbor: sortNN },
      ] = await Promise.all([
        import('fflate'),
        import('../engine/docxEngine'),
        import('../engine/excelEngine'),
      ]);

      const zipFiles: Record<string, Uint8Array> = {};
      const date = new Date().toISOString().slice(0, 10);
      let totalCount = 0;
      let failedDossiers: string[] = [];
      const totalExpected = regionSummaries.reduce((sum, r) => sum + r.grappes.filter(g => g.total > 0).length, 0);

      console.log('[exportAllDossiersZip] Debug info:');
      console.log('- regionSummaries:', regionSummaries);
      console.log('- totalExpected (grappes avec ménages):', totalExpected);
      console.log('- menages count:', menages.length);

      // ── Regroupement par prestataire (entreprise) ────────────────────────
      const prestataireMap = new Map<string, {
        entreprise: string;
        lots: Map<string, { lot: LotKey; region: string; grappe: number; menages: typeof menages }>;
      }>();

      for (const r of regionSummaries) {
        for (const g of r.grappes.filter(gr => gr.total > 0)) {
          const region = r.region;
          const grappe = parseInt(g.key.split('_')[1]);
          
          console.log(`- Traitement grappe: ${region}_${grappe}, ménages: ${g.total}`);
          
          for (const lot of ['A', 'B', 'C'] as LotKey[]) {
            const ent = getEntrepreneur(lot, region, grappe);
            const lotKey = `Lot${lot}_${region}_G${grappe}`;
            
            console.log(`  - Lot ${lot}: entrepreneur =`, ent);
            
            if (!prestataireMap.has(ent.entreprise)) {
              prestataireMap.set(ent.entreprise, {
                entreprise: ent.entreprise,
                lots: new Map(),
              });
            }
            
            const grpMenages = menages.filter(m => {
              const computedGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);
              return m.region === region && computedGrappe === grappe;
            });
            
            console.log(`  - Lot ${lot}: ménages filtrés = ${grpMenages.length}`);
            
            prestataireMap.get(ent.entreprise)!.lots.set(lotKey, {
              lot,
              region,
              grappe,
              menages: grpMenages,
            });
          }
        }
      }

      console.log('- prestataireMap size:', prestataireMap.size);
      console.log('- Détails prestataireMap:');
      prestataireMap.forEach((data, entreprise) => {
        console.log(`  Entreprise: ${entreprise}, lots: ${data.lots.size}`);
        data.lots.forEach((lotData, key) => {
          console.log(`    ${key}: ${lotData.menages.length} ménages`);
        });
      });

      // ── Fonction utilitaire locale pour générer DOCX ─────────────────────
      const generateLocalDocxBlob = async (bodyXml: string): Promise<Blob> => {
        console.log('generateLocalDocxBlob called with bodyXml length:', bodyXml.length);
        
        const hasExistingSectPr = bodyXml.indexOf('<w:sectPr>') !== -1;
        const sectPr = hasExistingSectPr ? '' : '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/></w:sectPr>';
        
        const documentXml = 
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
          'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
          'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
          'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
          '<w:body>' + bodyXml + sectPr + '</w:body></w:document>';
        
        console.log('documentXml length:', documentXml.length);
        
        const headerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr>' +
          '<w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E3A5F"/></w:rPr>' +
          '<w:t xml:space="preserve">CONTRAT DE PRESTATION DE SERVICES \u2013 PROQUELEC</w:t></w:r></w:p>' +
          '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>' +
          '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="2D3748"/></w:rPr>' +
          '<w:t xml:space="preserve">Association pour la Promotion de la Qualit\u00e9 des Installations \u00c9lectriques Int\u00e9rieures</w:t></w:r></w:p>' +
          '</w:hdr>';
        
        const footerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>' +
          '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="2D3748"/></w:rPr>' +
          '<w:t xml:space="preserve">Si\u00e8ge social : Immeuble Coumba Castel, 12 rue Saint-Michel, 4e \u00e9tage</w:t></w:r></w:p>' +
          '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="20" w:after="20"/></w:pPr>' +
          '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="2D3748"/></w:rPr>' +
          '<w:t xml:space="preserve">BP : 32\u2009037 Dakar \u2013 T\u00e9l. : (+221) 33\u2009848 68 55 \u2013 NINEA 0191403 0B9</w:t></w:r></w:p>' +
          '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="20" w:after="40"/></w:pPr>' +
          '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="2D3748"/></w:rPr>' +
          '<w:t xml:space="preserve">Site Web: www.proquelec.sn \u2013 Email: proquelec@proquelec.sn</w:t></w:r></w:p>' +
          '</w:ftr>';
        
        // Numbering XML pour les puces
        const NUMBERING_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:abstractNum w:abstractNumId="1">' +
          '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
          '<w:lvlText w:val="-"/><w:lvlJc w:val="left"/>' +
          '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>' +
          '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr></w:lvl>' +
          '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
          '<w:lvlText w:val="-"/><w:lvlJc w:val="left"/>' +
          '<w:pPr><w:ind w:left="1080" w:hanging="360"/></w:pPr>' +
          '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr></w:lvl>' +
          '<w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
          '<w:lvlText w:val="-"/><w:lvlJc w:val="left"/>' +
          '<w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>' +
          '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr></w:lvl>' +
          '</w:abstractNum>' +
          '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>' +
          '</w:numbering>';
        
        const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
          '<Override PartName="/word/header.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
          '<Override PartName="/word/footer.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
          '</Types>';
        
        const RELS_MAIN = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>';
        
        const RELS_DOC = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId999" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
          '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header.xml"/>' +
          '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer.xml"/>' +
          '</Relationships>';
        
        // Création des fichiers avec fflate
        const files: Record<string, Uint8Array> = {
          '[Content_Types].xml': fflateLib.strToU8(CONTENT_TYPES),
          '_rels/.rels': fflateLib.strToU8(RELS_MAIN),
          'word/document.xml': fflateLib.strToU8(documentXml),
          'word/_rels/document.xml.rels': fflateLib.strToU8(RELS_DOC),
          'word/numbering.xml': fflateLib.strToU8(NUMBERING_XML),
          'word/header.xml': fflateLib.strToU8(headerXml),
          'word/footer.xml': fflateLib.strToU8(footerXml)
        };
        
        console.log('Files created:', Object.keys(files).length);
        console.log('Document XML size:', files['word/document.xml'].length);
        
        // Compression avec fflate
        const zipped = fflateLib.zipSync(files, { level: 6 });
        
        console.log('Zipped size:', zipped.length);
        
        return new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      };

      const buildXml = (bodyXml: string): string => {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:body>' + bodyXml + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>' +
          '</w:document>';
      };

      const xmlEscape = (s: unknown): string => {
        if (typeof s !== 'string') return String(s);
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
      };

      // ── Génération des dossiers par prestataire ───────────────────────────────
      let currentCount = 0;
      for (const [entreprise, data] of prestataireMap) {
        const entrepriseFolderName = entreprise.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');

        for (const [lotKey, lotData] of data.lots) {
          currentCount++;
          const folderName = `Lot${lotData.lot}_${lotData.region}_G${lotData.grappe}`;

          try {
            // ── Tri géographique par plus proche voisin ────────────────────────
            let sortedMenages = lotData.menages;
            try {
              sortedMenages = sortNN(lotData.menages, gps) as typeof menages;
            } catch { /* fallback: ordre naturel */ }

            // ── Génération du dossier de grappe enrichi ────────────────────────
            const bodyParts: string[] = [];
            bodyParts.push(para({
              text: `DOSSIER COMPLET — ${lotData.region} — Grappe ${lotData.grappe} — Lot ${lotData.lot}`,
              bold: true, size: 28, color: '1E3A5F',
              spacingBefore: 120, spacingAfter: 80,
            }));
            bodyParts.push(para({
              text: `${sortedMenages.length} ménages — Généré le ${new Date().toLocaleDateString('fr-FR')}`,
              size: 20, color: '64748B', spacingBefore: 40, spacingAfter: 120,
            }));

            // Tableau header
            const headerRow =
              cell('N°', { widthPct: 600, valueBold: true, fill: '1E3A5F', size: 19 }) +
              cell('Nom', { widthPct: 2000, valueBold: true, fill: '1E3A5F', size: 19 }) +
              cell('Village', { widthPct: 1500, valueBold: true, fill: '1E3A5F', size: 19 }) +
              cell('Lot A', { widthPct: 1000, valueBold: true, fill: '1E3A5F', size: 19 }) +
              cell('Lot B', { widthPct: 1000, valueBold: true, fill: '1E3A5F', size: 19 }) +
              cell('Lot C', { widthPct: 1000, valueBold: true, fill: '1E3A5F', size: 19 }) +
              cell('✓', { widthPct: 400, valueBold: true, fill: '1E3A5F', size: 19 });

            const tableRows = [headerRow];
            for (const m of sortedMenages) {
              const e = getEntry(m.ordre);
              const rowBg = e.conforme ? 'F0FDF4' : undefined;
              tableRows.push(
                cell(String(m.ordre), { widthPct: 600, fill: rowBg, size: 19 }) +
                cell(m.nom, { widthPct: 2000, fill: rowBg, size: 19 }) +
                cell(m.village, { widthPct: 1500, fill: rowBg, size: 19 }) +
                cell(STATUS_MAP[e.A.status]?.label || e.A.status, { widthPct: 1000, fill: rowBg, size: 19 }) +
                cell(STATUS_MAP[e.B.status]?.label || e.B.status, { widthPct: 1000, fill: rowBg, size: 19 }) +
                cell(STATUS_MAP[e.C.status]?.label || e.C.status, { widthPct: 1000, fill: rowBg, size: 19 }) +
                cell(e.conforme ? '✓' : '—', { widthPct: 400, fill: rowBg, size: 19 }),
              );
            }
            bodyParts.push(tbl(tableRows, [570, 1904, 1428, 952, 952, 952, 380]));

            const dossierBlob = await generateLocalDocxBlob(bodyParts.join(''));
            const dossierBuffer = await dossierBlob.arrayBuffer();
            console.log('Dossier blob size:', dossierBuffer.byteLength, 'for', folderName);
            console.log('Dossier body parts length:', bodyParts.length);
            zipFiles[`${entrepriseFolderName}/${folderName}/Dossier_${lotData.region}_Grappe_${lotData.grappe}_Lot${lotData.lot}.docx`] = new Uint8Array(dossierBuffer);
            totalCount++;

            // ── Contrat légal complet du lot/grappe ───────────────────────────
            const ent = getEntrepreneur(lotData.lot, lotData.region, lotData.grappe);
            const now = new Date();
            const contratNum = `PROQUELEC-LOT${lotData.lot}-${lotData.region}-${lotData.grappe}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
            const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
            
            // Utiliser la fonction generateContratDocxRich pour générer le contrat complet
            const contratBlob = await generateContratDocxRich({
              lot: lotData.lot,
              contratNumber: contratNum,
              date: dateStr,
              entreprise: ent.entreprise,
              region: lotData.region,
              grappe: String(lotData.grappe),
              nbMenages: sortedMenages.length,
              montant: '', // Non utilisé pour les contrats
              prestataireData: ent,
              grappesData: [{ region: lotData.region, grappe: lotData.grappe, nbMenages: sortedMenages.length }]
            });
            
            const contratBuffer = await contratBlob.arrayBuffer();
            console.log('Contrat blob size:', contratBuffer.byteLength, 'for', folderName);
            zipFiles[`${entrepriseFolderName}/${folderName}/Contrat_Lot${lotData.lot}_${lotData.region}_G${lotData.grappe}.docx`] = new Uint8Array(contratBuffer);
            totalCount++;

            // ── Mise à jour de la progression ─────────────────────────────────
            setExporting(`zip_${currentCount}/${totalExpected}`);

          } catch (error) {
            console.error(`Erreur génération dossier ${folderName}:`, error);
            failedDossiers.push(`${folderName}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      if (totalCount === 0) { 
        alert('Aucun dossier à générer'); 
        setExporting(null); 
        return; 
      }

      // Compression avec fflate
      const zipped = fflateLib.zipSync(zipFiles, { level: 6 });
      const blob = new Blob([zipped], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dossiers_Prestataires_${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      // ── Rapport d'erreurs ───────────────────────────────────────────────
      if (failedDossiers.length > 0) {
        alert(`Génération terminée. ${totalCount} dossiers générés avec succès.\n\nDossiers échoués (${failedDossiers.length}):\n${failedDossiers.join('\n')}`);
      } else {
        alert(`Génération terminée avec succès. ${totalCount} dossiers générés.`);
      }
    } finally {
      setExporting(null);
    }
  }, [menages, getEntry, getEntrepreneur, gps, getComputedGrappe, regionSummaries, selectedLot]);

  const getGrappeColor = useCallback((region: string, grappe: number) => {
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];
    const hash = (region + grappe).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, []);

  const generateContratSeul = useCallback(async (lot: string, region: string, grappe: number, ent: any) => {
    setExporting(`contrat_${lot}_${region}_${grappe}`);
    try {
      const { generateContratDocxRich } = await import('../engine/docxEngine');
      const grpMenages = menages.filter(m => {
        const computedGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);
        return m.region === region && computedGrappe === grappe;
      });
      const now = new Date();
      const contratNum = `PROQUELEC-LOT${lot}-${region}-${grappe}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
      const BAREME: Record<LotKey, number> = { A: 15000, B: 25000, C: 10000 };
      
      const blob = await generateContratDocxRich({
        lot,
        region,
        grappe,
        entreprise: ent.entreprise,
        societe: ent.societe,
        telephone: ent.telephone,
        email: ent.email,
        adresse: ent.adresse,
        nbMenages: grpMenages.length,
        contratNumber: contratNum,
        date: now.toISOString().split('T')[0],
        montant: `${BAREME[lot as LotKey].toLocaleString('fr-FR')} FCFA`,
      });
      const filename = `Contrat_Lot${lot}_${region}_G${grappe}.docx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }, [menages, getComputedGrappe]);

  const generateDossierComplet = useCallback(async (lot: string, region: string, grappe: number, ent: any) => {
    setExporting(`dossier_${lot}_${region}_${grappe}`);
    try {
      const { generateDossierCompletDocx } = await import('../engine/docxEngine');
      let grpMenages;
      if (lot === 'A') {
        grpMenages = menages.map(m => ({
          ordre: m.ordre,
          nom: m.nom,
          tel: m.tel || '',
          village: m.village,
          commune: m.commune,
          region: m.region,
          grappe: m.grappe,
        }));
      } else {
        grpMenages = menages.filter(m => {
          const cGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);
          return m.region === region && cGrappe === grappe;
        }).map(m => ({
          ordre: m.ordre,
          nom: m.nom,
          tel: m.tel || '',
          village: m.village,
          commune: m.commune,
          region: m.region,
          grappe: getComputedGrappe(m.region, m.village, m.grappe || 0),
        }));
      }
      
      const blob = await generateDossierCompletDocx(lot as 'A' | 'B' | 'C', region, grappe, grpMenages, ent);
      const filename = `Dossier_Lot${lot}_${region}_G${grappe}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }, [menages, getComputedGrappe]);

  const handleExportAdminDossier = useCallback(async () => {
    setExporting('admin');
    try {
      const { generateDossierAdminDocx } = await import('../engine/docxEngine');
      
      // Sélectionner la première grappe disponible pour l'exemple
      const firstRegion = regionSummaries[0]?.region || 'Kaffrine';
      const firstGrappe = regionSummaries[0]?.grappes[0]?.total > 0 
        ? parseInt(regionSummaries[0].grappes[0].key.split('_')[1])
        : 1;
      const firstLot = selectedLot || 'A';
      const ent = getEntrepreneur(firstLot as LotKey, firstRegion, firstGrappe);
      
      // Filtrer les ménages pour cette grappe
      const grpMenages = menages.filter(m => {
        const cGrappe = getComputedGrappe(m.region, m.village, m.grappe || 0);
        return m.region === firstRegion && cGrappe === firstGrappe;
      });
      
      const blob = await generateDossierAdminDocx(
        firstLot as 'A' | 'B' | 'C',
        firstRegion,
        firstGrappe,
        grpMenages,
        ent,
        gps
      );
      
      const filename = `Dossier_Admin_${firstLot}_${firstRegion}_G${firstGrappe}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }, [selectedLot, regionSummaries, menages, getEntrepreneur, getComputedGrappe, gps]);

  const villageOptions = (() => {
    const seen = new Set<string>();
    const opts: { key: string; label: string }[] = [];
    for (const m of menages) {
      const k = `${m.region}|||${m.village}`;
      if (!seen.has(k)) {
        seen.add(k);
        opts.push({ key: k, label: `${m.village} (${m.region})` });
      }
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  })();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <style>{`
        @media print {
          .dossiers-toolbar { display: none !important; }
          body { font-size: 10pt; }
        }
        .dossier-btn-contrat { position: relative; }
        .dossier-btn-contrat .spinner { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .dossier-btn-contrat.loading .btn-text { opacity: 0; }
        .dossier-btn-contrat.loading .spinner { display: block; }
        @keyframes spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
      `}</style>
      
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Dossiers Prestataires (générés à la demande)</h3>
        <p className="text-xs text-slate-500 mb-5">
          Chaque dossier est généré au moment du clic, à partir des données actuelles (entrepreneurs, grappes). Toute modification faite dans l'onglet Administration est immédiatement reflétée dans les dossiers téléchargés.
        </p>
        <p className="text-xs text-slate-500 mb-5">
          <strong>Deux options :</strong> "Dossier Complet" = 4 documents (Lettre de Mission, Ordre de Service, Fiche de Saisie, Liste Nominative) — "Contrat Seul" = contrat individuel par LOT.
        </p>
        <p className="text-xs text-blue-600 mb-5">
          <strong>Remarque :</strong> Tous les exports utilisent les grappes calculées configurées dans les vues cartographiques.
        </p>

        <div className="dossiers-toolbar flex flex-wrap gap-3 mb-6">
          <button
            onClick={exportExcel}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#14283F] disabled:opacity-50 transition-colors"
          >
            {exporting === 'excel' ? (
              <span className="animate-pulse">Exportation...</span>
            ) : (
              <>📤 Exporter le suivi complet (.xlsx)</>
            )}
          </button>
          <button
            onClick={exportFinancialExcel}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#2E86AB] rounded-lg hover:bg-[#1E5A7A] disabled:opacity-50 transition-colors"
          >
            {exporting === 'financier' ? (
              <span className="animate-pulse">Exportation...</span>
            ) : (
              <>🧮 Financier Excel</>
            )}
          </button>
          <button
            onClick={printFinancialReport}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#14283F] disabled:opacity-50 transition-colors"
          >
            🖨 Rapport Financier
          </button>
          <button
            onClick={exportPDF}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#14283F] disabled:opacity-50 transition-colors"
          >
            {exporting === 'pdf' ? (
              <span className="animate-pulse">Exportation...</span>
            ) : (
              <>📄 Export PDF complet</>
            )}
          </button>
          <button
            onClick={exportConfigJSON}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#6B4E9C] rounded-lg hover:bg-[#573F80] disabled:opacity-50 transition-colors"
          >
            {exporting === 'config' ? (
              <span className="animate-pulse">Exportation...</span>
            ) : (
              <>⚙️ Config JSON</>
            )}
          </button>
          <button
            onClick={exportAllDossiersZip}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#27AE60] rounded-lg hover:bg-[#1E8449] disabled:opacity-50 transition-colors"
          >
            {exporting?.startsWith('zip_') ? (
              <span className="animate-pulse">Génération {exporting.replace('zip_', '')}...</span>
            ) : exporting === 'zip' ? (
              <span className="animate-pulse">Génération ZIP...</span>
            ) : (
              <>📁 Télécharger tous les dossiers par prestataire (.zip)</>
            )}
          </button>

          <button
            onClick={exportGlobalBackup}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#B7791F] rounded-lg hover:bg-[#966F1A] disabled:opacity-50 transition-colors"
            title="Exporte la configuration complète (villages, GPS, entrepreneurs) en JSON"
          >
            💾 Sauvegarde JSON
          </button>
          <button
            onClick={handleExportAdminDossier}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#8E44AD] rounded-lg hover:bg-[#6C3483] disabled:opacity-50 transition-colors"
            title="Dossier complet avec documents internes (Lettre de mission, Fiches qualité, Liste GPS) - Admin uniquement"
          >
            🔐 Dossier Admin
          </button>
          <label
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#2E86AB] rounded-lg hover:bg-[#1E5A7A] cursor-pointer transition-colors"
            title="Restaure une sauvegarde JSON exportée précédemment"
          >
            📂 Restaurer JSON
            <input
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleImportBackupFile}
            />
          </label>
        </div>

        {/* Lot A - Préparation globale */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Lot A — Préparation globale</h3>
          <div className="space-y-3">
            {regionSummaries.flatMap(r =>
              r.grappes.filter(g => g.total > 0).map(g => {
                const region = r.region;
                const grappe = parseInt(g.key.split('_')[1]);
                const ent = getEntrepreneur('A', region, grappe);
                const color = getGrappeColor(region, grappe);
                return (
                  <div key={`lotA-${g.key}`} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                    <div className="w-32 text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: color }}></span>
                      {region} — Grappe {grappe}
                    </div>
                    <div className="flex-1 text-xs text-slate-600">
                      {ent.entreprise} {ent.societe ? `(${ent.societe})` : ''} — {ent.telephone || '—'} — {g.total} ménages
                    </div>
                    <button
                      onClick={() => generateDossierComplet('A', region, grappe, ent)}
                      disabled={!!exporting}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#14283F] disabled:opacity-50 transition-colors"
                    >
                      📄 Dossier Complet
                    </button>
                    <button
                      onClick={() => generateContratSeul('A', region, grappe, ent)}
                      disabled={!!exporting}
                      className="dossier-btn-contrat px-4 py-2 text-xs font-semibold text-white bg-[#E67E22] rounded-lg hover:bg-[#D35400] disabled:opacity-50 transition-colors"
                    >
                      <span className="btn-text">📸 Contrat Seul</span>
                      <span className="spinner"></span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lot B - Installation intérieure */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Lot B — Installation intérieure</h3>
          <div className="space-y-3">
            {regionSummaries.flatMap(r =>
              r.grappes.filter(g => g.total > 0).map(g => {
                const region = r.region;
                const grappe = parseInt(g.key.split('_')[1]);
                const ent = getEntrepreneur('B', region, grappe);
                const color = getGrappeColor(region, grappe);
                return (
                  <div key={`lotB-${g.key}`} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                    <div className="w-32 text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: color }}></span>
                      {region} — Grappe {grappe}
                    </div>
                    <div className="flex-1 text-xs text-slate-600">
                      {ent.entreprise} — {ent.telephone || '—'} — {g.total} ménages
                    </div>
                    <button
                      onClick={() => generateDossierComplet('B', region, grappe, ent)}
                      disabled={!!exporting}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#14283F] disabled:opacity-50 transition-colors"
                    >
                      📄 Dossier Complet
                    </button>
                    <button
                      onClick={() => generateContratSeul('B', region, grappe, ent)}
                      disabled={!!exporting}
                      className="dossier-btn-contrat px-4 py-2 text-xs font-semibold text-white bg-[#E67E22] rounded-lg hover:bg-[#D35400] disabled:opacity-50 transition-colors"
                    >
                      <span className="btn-text">📸 Contrat Seul</span>
                      <span className="spinner"></span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lot C - Raccordement */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Lot C — Raccordement</h3>
          <div className="space-y-3">
            {regionSummaries.flatMap(r =>
              r.grappes.filter(g => g.total > 0).map(g => {
                const region = r.region;
                const grappe = parseInt(g.key.split('_')[1]);
                const ent = getEntrepreneur('C', region, grappe);
                const color = getGrappeColor(region, grappe);
                return (
                  <div key={`lotC-${g.key}`} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                    <div className="w-32 text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: color }}></span>
                      {region} — Grappe {grappe}
                    </div>
                    <div className="flex-1 text-xs text-slate-600">
                      {ent.entreprise} — {ent.telephone || '—'} — {g.total} ménages
                    </div>
                    <button
                      onClick={() => generateDossierComplet('C', region, grappe, ent)}
                      disabled={!!exporting}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#14283F] disabled:opacity-50 transition-colors"
                    >
                      📄 Dossier Complet
                    </button>
                    <button
                      onClick={() => generateContratSeul('C', region, grappe, ent)}
                      disabled={!!exporting}
                      className="dossier-btn-contrat px-4 py-2 text-xs font-semibold text-white bg-[#E67E22] rounded-lg hover:bg-[#D35400] disabled:opacity-50 transition-colors"
                    >
                      <span className="btn-text">📸 Contrat Seul</span>
                      <span className="spinner"></span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Fiche Village */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Fiche Village (Impression)</h3>
          <div className="flex items-center gap-3">
            <select
              value={selectedVillage}
              onChange={e => setSelectedVillage(e.target.value)}
              className="flex-1 px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white font-medium"
            >
              <option value="">— Sélectionner un village —</option>
              {villageOptions.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={printVillageFiche}
              disabled={!!exporting || !selectedVillage}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#14283F] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              🖨 Fiche Village
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DossiersView;
