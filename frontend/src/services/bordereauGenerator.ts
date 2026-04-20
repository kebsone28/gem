/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface GrappeData {
  id: string;
  name: string;
  region: string;
  householdCount: number;
  electrified: number;
  teams: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  households: Array<{
    id: string;
    numeroordre?: string;
    name?: string;
    phone?: string;
    village?: string;
    departement?: string;
    status: string;
    owner?: Record<string, unknown>;
    location?: Record<string, unknown>;
    latitude?: number;
    longitude?: number;
    koboData?: Record<string, unknown>;
    koboSync?: Record<string, unknown>;
  }>;
}

/**
 * Robustly resolves the name of a household
 */
const resolveName = (h: Record<string, unknown>): string => {
  if (h.name && h.name.trim()) return h.name.trim();
  if (h.owner) {
    if (typeof h.owner === 'string' && h.owner.trim()) return h.owner.trim();
    if (h.owner.nom && h.owner.nom.trim()) return h.owner.nom.trim();
    if (h.owner.name && h.owner.name.trim()) return h.owner.name.trim();
    if (h.owner.fullname && h.owner.fullname.trim()) return h.owner.fullname.trim();
  }
  // Kobo fallbacks
  const kobo = h.koboData || h.koboSync || {};
  if (kobo.nom_complet) return kobo.nom_complet;
  if (kobo.nom) return kobo.nom;
  if (kobo.owner_name) return kobo.owner_name;

  return 'Inconnu';
};

/**
 * Robustly resolves the village
 */
const resolveVillage = (h: Record<string, unknown>): string => {
  if (h.village && h.village.trim()) return h.village.trim();
  const kobo = h.koboData || h.koboSync || {};
  if (kobo.village) return kobo.village;
  if (kobo.commune) return kobo.commune;
  return 'Non spécifié';
};

/**
 * Extract coordinates
 */
const resolveGPS = (h: Record<string, unknown>): { lat: string; lon: string } => {
  let lat = h.latitude;
  let lon = h.longitude;

  if (!lat || !lon) {
    if (h.location?.coordinates) {
      lon = h.location.coordinates[0];
      lat = h.location.coordinates[1];
    }
  }

  return {
    lat: lat ? Number(lat).toFixed(6) : '-',
    lon: lon ? Number(lon).toFixed(6) : '-',
  };
};

const INDIGO: [number, number, number] = [79, 70, 229];
const SLATE_800: [number, number, number] = [30, 41, 59];

/**
 * Génère le fichier PDF pour une grappe donnée
 */
export const generateGrappePDF = (grappe: GrappeData, projectName: string = 'Projet GEM') => {
  // Landscape A4 pour plus d'espace sur les colonnes
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const dateStr = format(new Date(), 'dd MMMM yyyy HH:mm', { locale: fr });

  // HEADER
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, 297, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BORDEREAU TECHNIQUE', 14, 20);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Grappe : ${grappe.name} | Région : ${grappe.region}`, 14, 30);

  doc.setFontSize(10);
  doc.text(dateStr, 283, 20, { align: 'right' });
  doc.text(projectName, 283, 30, { align: 'right' });

  let currentY = 50;

  // KPI SECTION
  doc.setTextColor(...SLATE_800);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Récapitulatif de la Grappe', 14, currentY);
  currentY += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Ménages: ${grappe.householdCount}`, 14, currentY);
  doc.text(`Électrifiés (Terminés): ${grappe.electrified}`, 80, currentY);
  const percent =
    grappe.householdCount > 0 ? Math.round((grappe.electrified / grappe.householdCount) * 100) : 0;
  doc.text(`Progression: ${percent}%`, 160, currentY);
  currentY += 8;

  // TEAMS
  const teamList =
    grappe.teams?.length > 0
      ? grappe.teams.map((t) => `${t.name} (${t.type})`).join(', ')
      : 'Aucune équipe affectée';
  doc.setFont('helvetica', 'bold');
  doc.text(`Équipes Affectées: `, 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(teamList, 50, currentY);

  currentY += 15;

  // TABLE
  const tableData = (grappe.households || []).map((h, index) => {
    const coords = resolveGPS(h);
    return [
      index + 1,
      h.numeroordre || h.id?.substring(0, 8) || 'N/A',
      resolveName(h),
      resolveVillage(h),
      coords.lat,
      coords.lon,
      h.phone || h.koboSync?.tel || h.owner?.telephone || '-',
      h.status === 'completed' || h.status === 'Terminé'
        ? 'Terminé'
        : h.status === 'in_progress'
          ? 'En Cours'
          : 'Planifié',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        '#',
        'ID B.',
        'Nom du Ménage / Propriétaire',
        'Village',
        'Lat.',
        'Long.',
        'Téléphone',
        'Statut',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: INDIGO,
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 15 },
      2: { cellWidth: 'auto' },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 25 },
      7: { halign: 'center', cellWidth: 22 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 15, left: 10, right: 10, bottom: 20 },
  });

  // FOOTER (Page numbers are handled automatically by jsPDF if implemented globally but we'll leave it simple)

  // Save
  const safeName = grappe.name.replace(/[^a-z0-9]/gi, '_');
  doc.save(`Bordereau_Grappe_${safeName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

/**
 * Génère le fichier Excel (XLSX) pour une grappe donnée
 */
export const generateGrappeExcel = (grappe: GrappeData) => {
  // Preparer les données du tableau
  const teamNames = grappe.teams?.map((t) => t.name).join(', ') || '-';

  const tableData = (grappe.households || []).map((h, index) => {
    const coords = resolveGPS(h);
    return {
      'N°': index + 1,
      'ID Borne': h.numeroordre || h.id,
      'Nom du Propriétaire': resolveName(h),
      Village: resolveVillage(h),
      Latitude: coords.lat === '-' ? null : Number(coords.lat),
      Longitude: coords.lon === '-' ? null : Number(coords.lon),
      Téléphone: h.phone || h.koboSync?.tel || h.owner?.telephone || '-',
      'Équipes Affectées': teamNames,
      Région: grappe.region,
      Grappe: grappe.name,
      Statut:
        h.status === 'completed' || h.status === 'Terminé'
          ? 'Terminé'
          : h.status === 'in_progress'
            ? 'En Cours'
            : 'Planifié',
    };
  });

  // Créer un WorkSheet
  const ws = XLSX.utils.json_to_sheet(tableData);

  // Ajuster approximativement la largeur des colonnes
  ws['!cols'] = [
    { wch: 5 }, // N°
    { wch: 15 }, // ID Borne
    { wch: 35 }, // Nom
    { wch: 20 }, // Village
    { wch: 12 }, // Lat
    { wch: 12 }, // Lon
    { wch: 15 }, // Telephone
    { wch: 30 }, // Equipes
    { wch: 15 }, // Region
    { wch: 20 }, // Grappe
    { wch: 15 }, // Statut
  ];

  // Créer un WorkBook et ajouter la feuille
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ménages');

  // Créer une deuxième feuille avec les KPI / Détails Equipes
  const kpiData = [
    { Paramètre: 'Grappe', Valeur: grappe.name },
    { Paramètre: 'Région', Valeur: grappe.region },
    { Paramètre: 'Total Ménages', Valeur: grappe.householdCount },
    { Paramètre: 'Terminés', Valeur: grappe.electrified },
    {
      Paramètre: 'Progression',
      Valeur: `${grappe.householdCount > 0 ? Math.round((grappe.electrified / grappe.householdCount) * 100) : 0}%`,
    },
    { Paramètre: '', Valeur: '' },
    { Paramètre: 'ÉQUIPES AFFECTÉES', Valeur: '' },
    ...(grappe.teams?.length > 0
      ? grappe.teams.map((t) => ({ Paramètre: t.type, Valeur: t.name }))
      : [{ Paramètre: 'Aucune équipe', Valeur: '-' }]),
  ];

  const wsMeta = XLSX.utils.json_to_sheet(kpiData);
  wsMeta['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Résumé Grappe');

  // Save
  const safeName = grappe.name.replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(wb, `Bordereau_Grappe_${safeName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
};
