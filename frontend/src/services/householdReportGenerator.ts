/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const INDIGO = [30, 58, 138] as [number, number, number];
const GRAY = [100, 116, 139] as [number, number, number];
const RED = [220, 38, 38] as [number, number, number];

const today = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

function drawHeader(doc: jsPDF, title: string, household: any) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, w, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PROQUELEC - GEM SaaS', 14, 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Projet : ${household.projectName || 'Electrification Rurale'}`, 14, 22);
  doc.text(`Ménage : ${household.numeroordre || household.id}`, 14, 28);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), w - 14, 20, { align: 'right' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date d'édition : ${today()}`, w - 14, 28, { align: 'right' });
}

function drawFooter(doc: jsPDF) {
  const h = doc.internal.pageSize.getHeight();
  const w = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Document généré par GEM SaaS - PROQUELEC. Confidentiel.', 14, h - 10);
  doc.text(`Page 1 / 1`, w - 14, h - 10, { align: 'right' });
}

const resolveName = (h: any) => {
    if (h.name) return h.name;
    if (h.owner?.name) return h.owner.name;
    if (h.owner?.nom) return h.owner.nom;
    return 'Inconnu';
};

// 1. LIVRAISON
export const generateLivraisonPDF = (household: any) => {
  const doc = new jsPDF();
  const rawStatus = (household.status || '').toLowerCase();
  
  // Detection plus précise : doit contenir 'éligible' ET 'non', mais SURTOUT PAS 'encore'
  const isIneligible = (rawStatus.includes('iné') || rawStatus.includes('ine') || (rawStatus.includes('non') && rawStatus.includes('élig'))) 
                       && !rawStatus.includes('encore');
  
  const title = isIneligible ? 'ATTESTATION D\'INÉLIGIBILITÉ' : 'BON DE LIVRAISON & MARQUAGE';
  drawHeader(doc, title, household);
  
  const statusColor = isIneligible ? RED : INDIGO;

  // Clean location string
  const locParts = [household.region, household.departement, household.village].filter(p => p && p !== 'null' && p !== 'undefined');
  const locationStr = locParts.length > 0 ? locParts.join(' / ') : 'Non précisée';

  autoTable(doc, {
    startY: 48,
    head: [['Information', 'Détail']],
    body: [
      ['Client', resolveName(household)],
      ['Téléphone', household.phone || 'N/A'],
      ['Localisation', locationStr],
      ['Statut Éligibilité', { 
          content: isIneligible ? 'NON ÉLIGIBLE' : 'ÉLIGIBLE', 
          styles: { textColor: statusColor, fontStyle: 'bold' } 
      }],
      ['Kit Matériel', isIneligible ? 'NON APPLICABLE' : (household.koboSync?.kitType || 'Standard')],
      ['Marquage terrain', household.koboSync?.marquageOk ? 'EFFECTUÉ' : 'NON EFFECTUÉ'],
    ],
    theme: 'striped',
    headStyles: { fillColor: statusColor, cellPadding: 5 },
    styles: { cellPadding: 4, fontSize: 10 }
  });

  if (isIneligible) {
    const reasons = household.alerts?.filter((a: any) => a.type === 'ALERTE_KOBO' || a.message.toLowerCase().includes('desistement') || a.message.toLowerCase().includes('ineligible')) || [];
    doc.setTextColor(...RED);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('MOTIFS D\'INÉLIGIBILITÉ :', 14, (doc as any).lastAutoTable.finalY + 15);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (reasons.length > 0) {
        reasons.forEach((r: any, i: number) => {
            doc.text(`- ${r.message.replace('❌ DÉFAUT : ', '')}`, 18, (doc as any).lastAutoTable.finalY + 23 + (i * 6));
        });
    } else {
        doc.text('- Information non précisée dans le formulaire', 18, (doc as any).lastAutoTable.finalY + 23);
    }
  }

  drawFooter(doc);
  doc.save(`${isIneligible ? 'Ineligibilite' : 'Livraison'}_${household.numeroordre || household.id}.pdf`);
};

// 2. MAÇONNERIE
export const generateMaconneriePDF = (household: any) => {
  const doc = new jsPDF();
  drawHeader(doc, 'PV de Réalisation Maçonnerie', household);
  
  const problems = household.alerts?.filter((a: any) => a.message.toLowerCase().includes('maçon')) || [];
  
  autoTable(doc, {
    startY: 45,
    head: [['Point de contrôle', 'État']],
    body: [
      ['Disponibilité du Kit', household.constructionData?.macon?.kit_disponible === 'oui' ? 'OUI' : 'NON'],
      ['Type de Mur', household.constructionData?.macon?.type_mur || 'N/A'],
      ['Validation Mur', household.koboSync?.maconOk ? 'CONFORME' : 'NON CONFORME'],
    ],
    theme: 'grid',
    headStyles: { fillColor: INDIGO }
  });

  if (problems.length > 0) {
    doc.setTextColor(...RED);
    doc.setFontSize(10);
    doc.text('ANOMALIES DÉTECTÉES :', 14, (doc as any).lastAutoTable.finalY + 15);
    problems.forEach((p: any, i: number) => {
        doc.text(`- ${p.message}`, 20, (doc as any).lastAutoTable.finalY + 22 + (i * 7));
    });
  }

  drawFooter(doc);
  doc.save(`Maconnerie_${household.numeroordre || household.id}.pdf`);
};

// 3. RÉSEAU
export const generateBranchementPDF = (household: any) => {
  const doc = new jsPDF();
  drawHeader(doc, 'Fiche de Branchement Réseau', household);
  
  autoTable(doc, {
    startY: 45,
    head: [['Paramètre Réseau', 'Valeur']],
    body: [
      ['Vérification Mur', household.constructionData?.reseau?.verif_mur === 'conforme' ? 'OK' : 'NON CONFORME'],
      ['État Branchement', household.constructionData?.reseau?.etat || 'N/A'],
      ['Observations Techniques', household.constructionData?.reseau?.observations_techniques || 'NÉANT'],
    ],
    theme: 'striped',
    headStyles: { fillColor: INDIGO }
  });

  drawFooter(doc);
  doc.save(`Branchement_${household.numeroordre || household.id}.pdf`);
};

// 4. INTÉRIEUR
export const generateInstallationPDF = (household: any) => {
  const doc = new jsPDF();
  drawHeader(doc, 'PV d\'Installation Intérieure', household);
  
  autoTable(doc, {
    startY: 45,
    head: [['Composant', 'État']],
    body: [
      ['Vérification Branchement', household.constructionData?.interieur?.verif_branchement === 'conforme' ? 'OK' : 'NC'],
      ['Installation Intérieure', household.constructionData?.interieur?.etat || 'En cours'],
      ['Validation Électricien', household.koboSync?.interieurOk ? 'OUI' : 'NON'],
    ],
    theme: 'grid',
    headStyles: { fillColor: INDIGO }
  });

  drawFooter(doc);
  doc.save(`Installation_${household.numeroordre || household.id}.pdf`);
};

// 5. CONTRÔLE FINAL (CONFORMITÉ)
export const generateConformiteFinalPDF = (household: any) => {
  const doc = new jsPDF();
  drawHeader(doc, 'CERTIFICAT DE CONFORMITÉ FINAL', household);
  
  const techAlerts = household.alerts?.filter((a: any) => a.type === 'DEFAUT_TECHNIQUE') || [];
  
  autoTable(doc, {
    startY: 45,
    head: [['Section Audit', 'Résultat']],
    body: [
      ['Conformité Branchement (NF C14-100)', household.koboSync?.branchementOk ? '✅ CONFORME' : '❌ NON CONFORME'],
      ['Conformité Intérieure (NS 01 001)', household.koboSync?.interieurOk ? '✅ CONFORME' : '❌ NON CONFORME'],
      ['Validation Contrôleur Final', household.koboSync?.controleOk ? '✅ VALIDÉ' : '⏳ EN ATTENTE'],
    ],
    theme: 'grid',
    headStyles: { fillColor: INDIGO }
  });

  if (techAlerts.length > 0) {
    doc.setTextColor(...RED);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DÉTAILS DES NON-CONFORMITÉS :', 14, (doc as any).lastAutoTable.finalY + 15);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    techAlerts.forEach((a: any, i: number) => {
        doc.text(a.message, 18, (doc as any).lastAutoTable.finalY + 23 + (i * 6));
    });
  } else if (household.koboSync?.controleOk) {
    doc.setTextColor(5, 150, 105); // GREEN
    doc.setFontSize(14);
    doc.text('INSTALLATION VALIDÉE SANS RÉSERVES', 105, (doc as any).lastAutoTable.finalY + 25, { align: 'center' });
  }

  drawFooter(doc);
  doc.save(`Conformite_${household.numeroordre || household.id}.pdf`);
};
