/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HandoverData {
  teamName: string;
  teamRole: string;
  region: string;
  grappes: { nom: string; householdsCount: number }[];
  totalHouseholds: number;
  projectDeadline?: string;
}

export const generateTeamHandoverPDF = (data: HandoverData) => {
  // A4 layout, default portrait
  const doc = new jsPDF('p', 'mm', 'a4');

  // Add corporate header / Logo space
  doc.setFillColor(30, 58, 138); // Indigo/Blue corporate color
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDRE DE MISSION', 14, 20);

  // Subheader with metadata
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(12);
  doc.text(`ÉQUIPE: ${data.teamName.toUpperCase()}`, 14, 45);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const today = new Date().toLocaleDateString('fr-FR');
  doc.text(`Spécialité : ${data.teamRole}`, 14, 52);
  doc.text(`Région d'affectation : ${data.region}`, 14, 58);
  doc.text(`Date d'émission : ${today}`, 14, 64);
  if (data.projectDeadline) {
    doc.text(`Échéance Projet : ${data.projectDeadline}`, 14, 70);
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RÉCAPITULATIF DES OBJECTIFS', 14, 85);

  // Prepare table data
  const tableBody = data.grappes.map((g, index) => [
    (index + 1).toString(),
    g.nom,
    data.region,
    g.householdsCount.toString(),
  ]);

  // Insert AutoTable
  autoTable(doc, {
    startY: 90,
    head: [['N°', 'Identifiant Grappe', 'Région', 'Nombre de Foyers']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    foot: [['', 'TOTAL', '', data.totalHouseholds.toString()]],
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
  });

  // Signatures Area
  const finalY = (doc as any).lastAutoTable.finalY || 150;

  if (finalY + 50 > 280) {
    doc.addPage();
  }

  doc.setFontSize(10);
  doc.text('Lu et approuvé. Bon pour exécution de la mission.', 14, finalY + 20);

  // Boxes for signature
  doc.rect(14, finalY + 30, 80, 30); // Chef de projet box
  doc.text('Le Chef de Projet', 16, finalY + 35);

  doc.rect(116, finalY + 30, 80, 30); // Team box
  doc.text("Le Chef d'Équipe (Signature et Date)", 118, finalY + 35);

  // Save PDF
  const safeName = data.teamName.replace(/\s+/g, '_').toLowerCase();
  doc.save(`ordre_mission_${safeName}_${Date.now()}.pdf`);
};
