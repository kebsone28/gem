// Utilitaire pour générer un PDF complet avec les diagrammes Gantt
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function generatePlanningPDF(params: any, result: any, ganttContainer: HTMLElement | null) {
  const sy = result.synthese;
  const finOk = sy.dureeMois <= (params.dureeObjectifMois || 2) * 1.05;
  const date = new Date().toISOString().split('T')[0];

  // Create PDF in landscape mode
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Set title and header
  doc.setFontSize(18);
  doc.setTextColor('#1E3A5F');
  doc.text('Planning Global des Travaux — PROQUELEC', 20, 20);
  
  doc.setFontSize(10);
  doc.setTextColor('#646464');
  doc.text(`Kaffrine & Tambacounda — 3 536 ménages — ${new Date().toLocaleDateString('fr-FR')}`, 20, 28);

  // KPIs
  const kpiData = [
    { label: 'Durée travaux', value: `${sy.dureeMois} mois`, color: finOk ? '#22c55e' : '#dc2626' },
    { label: 'Fin estimée', value: sy.finGlobal ? String(sy.finGlobal) : '', color: '#1E3A5F' },
    { label: 'Électriciens', value: String(sy.totalElec), color: '#2E86AB' },
    { label: 'Surplus', value: `${sy.surplus >= 0 ? '+' : ''}${sy.surplus}`, color: sy.surplus >= 0 ? '#22c55e' : '#dc2626' }
  ];

  let yPos = 40;
  kpiData.forEach((kpi, index) => {
    const xPos = 20 + (index * 50);
    doc.setFillColor(kpi.color);
    doc.rect(xPos, yPos, 45, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, xPos + 22.5, yPos + 8, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, xPos + 22.5, yPos + 15, { align: 'center' });
  });

  yPos += 30;

  // Alerts
  if (result.alertes.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor('#1E3A5F');
    doc.text('⚠ Alertes', 20, yPos);
    yPos += 8;
    
    result.alertes.forEach(alert => {
      doc.setFillColor(alert.sev === 'high' ? '#FEE2E2' : '#FEF3C7');
      doc.rect(20, yPos, 250, 10, 'F');
      doc.setDrawColor(alert.sev === 'high' ? '#dc2626' : '#f59e0b');
      doc.setLineWidth(0.5);
      doc.line(20, yPos, 20, yPos + 10);
      doc.setTextColor('#1E3A5F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${alert.region} — ${alert.msg}`, 25, yPos + 6);
      yPos += 12;
    });
  }

  // Formation table
  doc.setFontSize(12);
  doc.setTextColor('#1E3A5F');
  doc.text('Formation', 20, yPos);
  yPos += 8;

  const formationData = result.formation.map(f => [
    f.region,
    `Session ${f.session}`,
    String(f.debut),
    String(f.fin),
    String(f.participants)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Région', 'Session', 'Début', 'Fin', 'Participants']],
    body: formationData,
    theme: 'grid',
    headStyles: { fillColor: '#1E3A5F', textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // Planning table
  doc.setFontSize(12);
  doc.setTextColor('#1E3A5F');
  doc.text('Planning par phase', 20, yPos);
  yPos += 8;

  const planningData = [];
  for (const [region, rd] of Object.entries(result.regions)) {
    const phases = [
      { phase: 'Maçonnerie', debut: rd.macon.debut, fin: rd.macon.fin, eq: rd.macon.equipes },
      { phase: 'Installation', debut: rd.install.debut, fin: rd.install.fin, eq: rd.install.equipes },
      { phase: 'Réseau BT', debut: rd.reseau.debut, fin: rd.reseau.fin, eq: rd.reseau.equipes },
      { phase: 'Contrôle', debut: rd.controle.debut, fin: rd.controle.fin, eq: rd.controle.equipes },
      { phase: 'Réception', debut: rd.reception.debut, fin: rd.reception.fin, eq: '-' }
    ];
    
    phases.forEach((p, i) => {
      planningData.push([
        i === 0 ? `${region}\n(${rd.menages} mén.)` : '',
        p.phase,
        String(p.debut),
        String(p.fin),
        String(p.eq)
      ]);
    });
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Région', 'Phase', 'Début', 'Fin', 'Équipes']],
    body: planningData,
    theme: 'grid',
    headStyles: { fillColor: '#1E3A5F', textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // Gantt charts
  doc.setFontSize(12);
  doc.setTextColor('#1E3A5F');
  doc.text('Diagrammes Gantt', 20, yPos);
  yPos += 8;

  if (ganttContainer) {
    const ganttSvgs = ganttContainer.querySelectorAll('svg');
    if (ganttSvgs.length > 0) {
      // For each Gantt, add a note that they are available in the app
      doc.setFontSize(9);
      doc.setTextColor('#646464');
      doc.text(`${ganttSvgs.length} diagramme(s) Gantt disponible(s) dans l'onglet "Gantt" de l'application.`, 20, yPos);
      doc.text('Utilisez l\'onglet Gantt pour voir les diagrammes interactifs complets.', 20, yPos + 5);
    } else {
      doc.setFontSize(9);
      doc.setTextColor('#646464');
      doc.text('Aucun diagramme Gantt disponible. Utilisez l\'assistant IA pour générer le planning.', 20, yPos);
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor('#646464');
    doc.text('Les diagrammes Gantt interactifs sont disponibles dans l\'onglet "Gantt" de l\'application.', 20, yPos);
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor('#969696');
    doc.text(
      `PROQUELEC — Document confidentiel | Généré le ${new Date().toLocaleDateString('fr-FR')} | Page ${i}/${pageCount}`,
      20,
      290,
      { align: 'left' }
    );
  }

  // Save PDF
  doc.save(`Planning_PROQUELEC_${date}.pdf`);
}