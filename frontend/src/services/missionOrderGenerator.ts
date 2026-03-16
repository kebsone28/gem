import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logger from '../utils/logger';

export interface MissionMember {
    name: string;
    role: string;
    unit: string;
    dailyIndemnity: number;
    days: number;
}

export interface MissionReportDay {
    day: number;
    title: string;
    observation: string;
    isCompleted: boolean;
    photo?: string; // Base64
    location?: { lat: number; lng: number };
}

export interface MissionOrderData {
    orderNumber: string;
    date: string;
    region: string;
    startDate: string;
    endDate: string;
    itineraryAller: string;
    itineraryRetour: string;
    purpose: string;
    transport: string;
    members: MissionMember[];
    planning: string[]; // 6-day itinerary
    reportDays?: MissionReportDay[];
    reportObservations?: string;
    isCertified?: boolean;
    signatureImage?: string; // Base64 string
    features?: {
        map: boolean;
        expenses: boolean;
        inventory: boolean;
        ai: boolean;
    };
    expenses?: any[];
    fuelStats?: {
        kmStart: number;
        kmEnd: number;
        rate: number;
    };
    inventory?: any[];
}

const INDIGO = [67, 56, 202] as [number, number, number];
const DARK = [15, 23, 42] as [number, number, number];
const GRAY = [100, 116, 139] as [number, number, number];
const SUCCESS = [22, 163, 74] as [number, number, number];
const DANGER = [225, 29, 72] as [number, number, number];

const formatCurrency = (n: number): string => {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
};

export const generateMissionOrderPDF = async (data: MissionOrderData) => {
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    // ─────────────────────────────────────────────────────────────────
    // PAGE 1 : ORDRE DE MISSION
    // ─────────────────────────────────────────────────────────────────

    // Header
    doc.addImage('/logo-proquelec.png', 'PNG', 14, 14, 45, 12);
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dakar, le ${data.date}`, w - 14, 15, { align: 'right' });

    if (data.isCertified) {
        doc.setDrawColor(...SUCCESS);
        doc.setLineWidth(1);
        doc.roundedRect(w - 75, 25, 60, 15, 2, 2, 'D');
        doc.setTextColor(...SUCCESS);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('CERTIFIÉ CONFORME', w - 45, 35, { align: 'center' });
    }

    doc.setTextColor(...DARK);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`ORDRE DE MISSION N°${data.orderNumber} - PROQ`, w / 2, 40, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(w / 2 - 40, 42, w / 2 + 40, 42);

    // Members Table
    autoTable(doc, {
        startY: 55,
        head: [['N°', 'Prénoms et Noms', 'Fonction', 'Unité']],
        body: data.members.map((m, i) => [i + 1, m.name, m.role, m.unit]),
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: DARK, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 5 },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Sont autorisés à se rendre en mission :', 14, currentY);
    currentY += 10;

    const details = [
        ['Pays ou Région', `: ${data.region}`, 'Date', `: ${data.startDate}`],
        ['Itinéraire Aller', `: ${data.itineraryAller}`],
        ['Objet de la mission', `: ${data.purpose}`],
        ['Moyen de transport', `: ${data.transport}`],
        ['Itinéraire Retour', `: ${data.itineraryRetour}`],
        ['Moyen de transport', ': Même Moyen'],
        ['Leur retour est prévu le', `: ${data.endDate || 'À préciser'}`],
    ];

    details.forEach(row => {
        doc.setFont('helvetica', 'bold');
        doc.text(row[0], 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(row[1], 60, currentY);
        if (row[2]) {
            doc.setFont('helvetica', 'bold');
            doc.text(row[2], 120, currentY);
            doc.setFont('helvetica', 'normal');
            doc.text(row[3]!, 140, currentY);
        }
        currentY += 8;
    });

    currentY += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const note = "Le présent ordre de mission devra être présenté pour certification et restitué au Responsable Administratif & Financier par les intéressés dès leur retour.";
    doc.text(doc.splitTextToSize(note, w - 28), 14, currentY);

    currentY += 25;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Le Directeur Général', w - 60, currentY, { align: 'center' });

    currentY += 25;

    // ─────────────────────────────────────────────────────────────────
    // PAGE 2 : DÉCOMPTE FRAIS
    // ─────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('DECOMPTE FRAIS DE MISSION', w / 2, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`(${data.purpose})`, w / 2, 32, { align: 'center' });

    const totalFrais = data.members.reduce((sum, m) => sum + (m.dailyIndemnity * m.days), 0);

    autoTable(doc, {
        startY: 45,
        head: [['Bénéficiaire', 'Indemnité journalière', 'Nombre de jours', 'Total Indemnité']],
        body: [
            ...data.members.map(m => [
                m.name,
                formatCurrency(m.dailyIndemnity),
                m.days,
                formatCurrency(m.dailyIndemnity * m.days)
            ]),
            [{ content: 'Montant total en FCFA', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: formatCurrency(totalFrais), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]
        ],
        theme: 'grid',
        headStyles: { fillColor: INDIGO, textColor: [255, 255, 255] },
        styles: { fontSize: 10, cellPadding: 6 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Le Directeur Général', w - 60, currentY, { align: 'center' });

    // ─────────────────────────────────────────────────────────────────
    // PAGE 3 : PLANNING DÉTAILLÉ (Optimisée pour 3 pages max)
    // ─────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(...INDIGO);
    doc.rect(0, 0, w, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text('PLANNING DÉTAILLÉ DE LA MISSION', w / 2, 13, { align: 'center' });

    doc.setTextColor(...DARK);
    currentY = 30;

    data.planning.forEach((step) => {
        const title = step.split('\n')[0];
        const details = step.split('\n').slice(1).join('\n');

        // Compact Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...INDIGO);
        doc.text(title || '', 14, currentY);

        currentY += 5;
        // Compact Details
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...DARK);
        const splitDetails = doc.splitTextToSize(details, w - 28);
        doc.text(splitDetails, 14, currentY);

        currentY += (splitDetails.length * 4) + 4; // Espacement réduit entre jours
    });

    // Footer on all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text(`Document généré par - PROQUELEC - Page ${p}/${pageCount}`, w / 2, h - 10, { align: 'center' });
    }

    doc.save(`Ordre_Mission_${data.orderNumber.replace('/', '-')}.pdf`);
};

export const generateMissionReportPDF = async (data: MissionOrderData) => {
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    // Header logic (similar to order)
    doc.addImage('/logo-proquelec.png', 'PNG', 14, 14, 45, 12);
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.text(`Dakar, le ${new Date().toLocaleDateString('fr-FR')}`, w - 14, 15, { align: 'right' });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RAPPORT DE MISSION', w / 2, 40, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Réf: OM N°${data.orderNumber} - ${data.purpose}`, w / 2, 46, { align: 'center' });

    // Executive Summary Box
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.1);
    doc.roundedRect(14, 55, w - 28, 30, 2, 2, 'D');

    const completed = data.reportDays?.filter(d => d.isCompleted).length || 0;
    const total = data.reportDays?.length || 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    doc.setFont('helvetica', 'bold');
    doc.text('RÉSUMÉ D\'EXÉCUTION', 20, 62);
    doc.setFont('helvetica', 'normal');
    doc.text(`• Taux de complétion : ${pct}% (${completed}/${total} étapes réalisées)`, 20, 68);
    doc.text(`• Période : du ${data.startDate} au ${data.endDate}`, 20, 74);
    doc.text(`• Équipe : ${data.members[0]?.name} (Chef de mission) + ${data.members.length - 1} pers.`, 20, 80);

    // Detail Table
    autoTable(doc, {
        startY: 95,
        head: [['Jour', 'Activité prévue', 'Statut', 'Observations Terrain']],
        body: data.reportDays?.map(rd => [
            `J${rd.day}`,
            rd.title,
            rd.isCompleted ? (rd.location ? 'RÉALISÉ (GPS ✓)' : 'RÉALISÉ') : 'NON RÉALISÉ',
            rd.observation || '-'
        ]) || [],
        theme: 'grid',
        headStyles: { fillColor: DARK, textColor: [255, 255, 255] },
        columnStyles: {
            2: { fontStyle: 'bold', halign: 'center' },
            3: { cellWidth: 80, fontSize: 8 }
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
                const txt = data.cell.text[0];
                if (txt === 'RÉALISÉ') doc.setTextColor(...SUCCESS);
                else doc.setTextColor(...DANGER);
            }
        }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    // General Observation
    if (data.reportObservations) {
        if (currentY > h - 40) { doc.addPage(); currentY = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('OBSERVATIONS GÉNÉRALES ET RECOMMANDATIONS', 14, currentY);
        currentY += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const splitObs = doc.splitTextToSize(data.reportObservations, w - 28);
        doc.text(splitObs, 14, currentY);
        currentY += (splitObs.length * 5) + 15;
    }

    // Signatures
    if (currentY > h - 50) { doc.addPage(); currentY = 30; }

    doc.setFont('helvetica', 'bold');
    doc.text('Le Chef de Mission', 40, currentY, { align: 'center' });
    doc.text('Direction Technique (Visa)', w - 60, currentY, { align: 'center' });

    if (data.signatureImage) {
        try {
            // Affichage de la signature centrée sous le texte
            doc.addImage(data.signatureImage, 'PNG', 20, currentY + 2, 40, 20);
        } catch (e) {
            logger.error('Erreur lors de l\'ajout de la signature au PDF', e);
        }
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text(`Reporting System PROQUELEC - Page ${p}/${pageCount}`, w / 2, h - 10, { align: 'center' });
    }

    // Annex : Photos Gallery
    const photos = data.reportDays?.filter(rd => rd.photo) || [];
    if (photos.length > 0) {
        doc.addPage();
        currentY = 20;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...DARK);
        doc.text('ANNEXE : GALERIE PHOTOS TERRAIN', 14, currentY);
        currentY += 15;

        photos.forEach((p) => {
            if (currentY > h - 80) {
                doc.addPage();
                currentY = 20;
            }

            try {
                // Layout 2 photos per row or just list them with titles
                doc.setFontSize(9);
                doc.setTextColor(...DARK);
                doc.text(`Jour ${p.day} : ${p.title}`, 14, currentY);
                currentY += 5;

                // Add photo (keeping aspect ratio roughly)
                doc.addImage(p.photo!, 'JPEG', 14, currentY, 80, 60);
                currentY += 70;
            } catch (err) {
                logger.error('Error adding photo to PDF', err);
            }
        });
    }

    doc.save(`Rapport_Mission_${data.orderNumber.replace('/', '-')}.pdf`);
};
