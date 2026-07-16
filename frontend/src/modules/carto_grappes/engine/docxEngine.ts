/**
 * docxEngine.ts — Moteur de génération Docx
 * Basé sur la technique du fichier Cartographie_Grappes_PROQUELEC_7_9.html
 * Utilise fflate + OpenXML pour générer des .docx valides avec mise en forme riche
 */

import * as fflate from 'fflate';
import type { FicheDef, FicheEntry } from '../types';
import { FICHE_DEFS } from '../constants';

// ─── Constantes de couleur ───────────────────────────────────────────────────
const DOCX_NAVY = '1E3A5F';
const DOCX_GREY = '2D3748';
const DOCX_LIGHTBLUE = 'EAF1F8';

// ─── Constantes DOCX ─────────────────────────────────────────────────────────
const DOCX_CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const DOCX_RELS_MAIN = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const DOCX_RELS_DOCUMENT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

// ─── Xml Helpers ─────────────────────────────────────────────────────────────
function xmlEscape(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Contrats complets (extraits du fichier HTML) ─────────────────────────────
import { CONTRAT_LOT_A } from './contracts/lotA';
import { CONTRAT_LOT_B } from './contracts/lotB';
import { CONTRAT_LOT_C } from './contracts/lotC';

// ─── Helpers de mise en forme DOCX ─────────────────────────────────────────────
function wPara(opts: { text?: string; bold?: boolean; italic?: boolean; size?: number; color?: string; align?: 'center' | 'right'; spacingBefore?: number; spacingAfter?: number; pageBreakBefore?: boolean; border?: boolean }): string {
  const o = opts || {};
  const sz = o.size || 21;
  const rpr = '<w:rPr>' +
    (o.bold ? '<w:b/>' : '') +
    (o.italic ? '<w:i/>' : '') +
    '<w:color w:val="' + (o.color || DOCX_GREY) + '"/>' +
    '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/>' +
    '</w:rPr>';
  const ppr = '<w:pPr>' +
    (o.pageBreakBefore ? '<w:pageBreakBefore/>' : '') +
    '<w:spacing w:before="' + (o.spacingBefore != null ? o.spacingBefore : 60) + '" w:after="' + (o.spacingAfter != null ? o.spacingAfter : 120) + '"/>' +
    (o.align ? '<w:jc w:val="' + o.align + '"/>' : '') +
    '</w:pPr>';
  const text = (o.text || '').split('\n');
  const runs = text.map((line, i) => {
    return '<w:r>' + rpr + '<w:t xml:space="preserve">' + xmlEscape(line) + '</w:t></w:r>' + (i < text.length - 1 ? '<w:br/>' : '');
  }).join('');
  return '<w:p>' + ppr + runs + '</w:p>';
}

function wBullet(text: string): string {
  // Utilise le style de liste natif Word (abstractNumId=1, numId=1) avec retrait correct
  const ppr = '<w:pPr>' +
    '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' +
    '<w:spacing w:before="40" w:after="80"/>' +
    '<w:ind w:left="720" w:hanging="360"/>' +
    '</w:pPr>';
  const rpr = '<w:rPr><w:sz w:val="21"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>';
  return '<w:p>' + ppr + '<w:r>' + rpr + '<w:t xml:space="preserve">' + xmlEscape(text) + '</w:t></w:r></w:p>';
}

function wBulletIntro(text: string, level: number): string {
  // Sous-intro dans une liste (ex: "Le kit principal :") — bullet gras avec retrait
  const indent = level === 2 ? 1440 : 720;
  const hanging = 360;
  const ppr = '<w:pPr>' +
    (level > 1 ? '<w:numPr><w:ilvl w:val="' + (level - 1) + '"/><w:numId w:val="1"/></w:numPr>' : '') +
    '<w:spacing w:before="60" w:after="40"/>' +
    '<w:ind w:left="' + indent + '" w:hanging="' + hanging + '"/>' +
    '</w:pPr>';
  const rpr = '<w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="' + DOCX_NAVY + '"/></w:rPr>';
  return '<w:p>' + ppr + '<w:r>' + rpr + '<w:t xml:space="preserve">' + xmlEscape(text) + '</w:t></w:r></w:p>';
}

function wCheckbox(text: string): string {
  return '<w:p><w:pPr><w:spacing w:before="30" w:after="60"/><w:ind w:start="200"/></w:pPr>' +
    '<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">☐  </w:t></w:r>' +
    '<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">' + xmlEscape(text) + '</w:t></w:r></w:p>';
}

function wHeading(text: string): string {
  return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="' + DOCX_NAVY + '" w:space="2"/></w:pBdr>' +
    '<w:spacing w:before="280" w:after="140"/></w:pPr>' +
    '<w:r><w:rPr><w:b/><w:color w:val="' + DOCX_NAVY + '"/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">' + xmlEscape(text) + '</w:t></w:r></w:p>';
}

function wTableBorders(): string {
  return '<w:tblBorders>' +
    '<w:top w:val="single" w:sz="4" w:color="B0BEC9"/>' +
    '<w:start w:val="single" w:sz="4" w:color="B0BEC9"/>' +
    '<w:bottom w:val="single" w:sz="4" w:color="B0BEC9"/>' +
    '<w:end w:val="single" w:sz="4" w:color="B0BEC9"/>' +
    '<w:insideH w:val="single" w:sz="4" w:color="B0BEC9"/>' +
    '<w:insideV w:val="single" w:sz="4" w:color="B0BEC9"/>' +
    '</w:tblBorders>';
}

function wCell(text: string, opts: { widthPct?: number; shaded?: boolean; fill?: string; label?: string; valueBold?: boolean; size?: number }): string {
  const o = opts || {};
  const widthPct = o.widthPct || 2500;
  const shd = o.shaded ? '<w:shd w:val="clear" w:fill="' + DOCX_LIGHTBLUE + '"/>' : (o.fill ? '<w:shd w:val="clear" w:fill="' + o.fill + '"/>' : '');
  const labelLine = o.label ? '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr><w:t xml:space="preserve">' + xmlEscape(o.label) + '</w:t></w:r></w:p>' : '';
  const valueColor = o.valueBold ? DOCX_NAVY : DOCX_GREY;
  const valueLine = '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:r><w:rPr>' + (o.valueBold ? '<w:b/>' : '') + '<w:sz w:val="' + (o.size || 21) + '"/><w:color w:val="' + valueColor + '"/></w:rPr><w:t xml:space="preserve">' + xmlEscape(text || ' ') + '</w:t></w:r></w:p>';
  return '<w:tc><w:tcPr><w:tcW w:w="' + widthPct + '" w:type="pct"/>' + shd + '</w:tcPr>' + labelLine + valueLine + '</w:tc>';
}

function wTable(rowsHtml: string[], gridCols: number[]): string {
  const grid = gridCols.map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + grid + '</w:tblGrid>' + rowsHtml.map(cells => '<w:tr>' + cells + '</w:tr>').join('') + '</w:tbl>';
}

// ─── Fonctions de traitement du contrat ─────────────────────────────────────────
function getContractTemplate(lot: 'A' | 'B' | 'C'): string {
  if (lot === 'A') return CONTRAT_LOT_A;
  if (lot === 'B') return CONTRAT_LOT_B;
  if (lot === 'C') return CONTRAT_LOT_C;
  return '';
}

function contratReplaceDyn(text: string, lot: 'A' | 'B' | 'C', region: string, grappe: string, entreprise: string, nbMenages: number, contratNumber?: string, prestataireData?: any): string {
  const today = new Date().toLocaleDateString('fr-FR');
  const entEntreprise = entreprise || '..............................';
  const entTel = prestataireData?.telephone || '.............................';
  const entEmail = prestataireData?.email || '.............................';
  const entAdresse = prestataireData?.adresse || '.............................';
  const entSociete = prestataireData?.societe || '.............................';
  const entRepresentantLegal = prestataireData?.representantLegal || '..............................';
  const entFonctionRepresentant = prestataireData?.fonctionRepresentant || '..............................';
  const entNrc = prestataireData?.nrc || '..............................';
  const entIfu = prestataireData?.ifu || '..............................';
  const entCompteBancaire = prestataireData?.compteBancaire || '..............................';
  const entFormeJuridique = prestataireData?.formeJuridique || '..............................';
  
  const suffix = '001';
  const numContrat = contratNumber || 'PROQ-AO11-2022-Lot' + lot + '-' + suffix;
  const regionLabel = region || 'Kaffrine et Tambacounda';
  const grappeLabel = grappe ? 'Grappe ' + grappe : '';
  const nLabel = nbMenages ? String(nbMenages) : '';
  
  const dynamicMap: Record<string, string> = {
    '[XX]': '30 jours calendaires',
    '[NUM_CONTRAT]': numContrat,
    'PROQ-AO11-2022-LotA-001': numContrat,
    'PROQ-AO11-2022-LotB-001': numContrat,
    'PROQ-AO11-2022-LotC-001': numContrat,
    '[DATE]': today,
    '[ENT_ENTREPRISE]': entEntreprise,
    '[ENT_TEL]': entTel,
    '[ENT_EMAIL]': entEmail,
    '[ENT_ADRESSE]': entAdresse,
    '[ENT_SOCIETE]': entSociete,
    '[ENT_REPRESENTANT_LEGAL]': entRepresentantLegal,
    '[ENT_FONCTION_REPRESENTANT]': entFonctionRepresentant,
    '[ENT_NRC]': entNrc,
    '[ENT_IFU]': entIfu,
    '[ENT_COMPTE_BANCAIRE]': entCompteBancaire,
    '[ENT_FORME_JURIDIQUE]': entFormeJuridique,
    '[REGION]': regionLabel,
    '[GRAPPE]': grappeLabel,
    '[N_MENAGES]': nLabel,
    'Fait à Dakar, le [DATE] , en trois (03) exemplaires originaux.': 'Fait à Dakar, le ' + today + ' , en trois (03) exemplaires originaux.',
    'moustapha.dieye@ PROQUELEC .sn': 'moustapha.dieye@proquelec.sn',
    'moustapha.dieye@PROQUELEC.sn': 'moustapha.dieye@proquelec.sn',
    '[Nom de l\'entreprise Prestataire]': entEntreprise,
    '[Forme juridique et adresse du Prestataire]': entAdresse
  };
  
  let result = text;
  Object.keys(dynamicMap).forEach(k => {
    result = result.split(k).join(dynamicMap[k]);
  });
  return result;
}

function contratTextToXmlWithPrestataire(lines: string[], body: string, startIndex: number, preambuleIndex: number, preambuleEndIndex: number, prestataireData?: any, grappesData?: any[], lot?: 'A' | 'B' | 'C'): string {
  let i = startIndex;
  let preambuleSectionProcessed = false;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Lignes vides
    if (line === '') {
      body += wPara({ text: '', spacingBefore: 0, spacingAfter: 0 });
      i++;
      continue;
    }
    
    const trimmed = line.replace(/\s+$/, '');
    
    // Article headers
    if (/^Article \d+/.test(line)) {
      body += wHeading(line);
      i++;
      continue;
    }
    
    // TITRE headers
    if (/^TITRE [IVX]+/.test(line)) {
      body += wHeading(line);
      i++;
      continue;
    }
    
    // List items ending with ;
    if (trimmed.endsWith(';')) {
      const itemText = trimmed.replace(/;\s*$/, '').replace(/^\s+/, '');
      body += wBullet(itemText);
      i++;
      continue;
    }
    
    // List items ending with . but prev line ended with ; (last item)
    if (trimmed.endsWith('.') && i > 0) {
      const prevLine = lines[i - 1] ? lines[i - 1].replace(/\s+$/, '') : '';
      if (prevLine.endsWith(';') || prevLine.endsWith(':')) {
        const itemText2 = trimmed.replace(/\.\s*$/, '').replace(/^\s+/, '');
        if (itemText2) {
          body += wBullet(itemText2);
          i++;
          continue;
        }
      }
    }
    
    // Checkbox items (☐/☑) - may contain multiple on one line
    if (line.indexOf('☐') !== -1 || line.indexOf('☑') !== -1) {
      const cbParts = line.split(/(?=[☐☑])/);
      cbParts.forEach(cb => {
        const trimmedCb = cb.replace(/^[☐☑]\s*/, '').replace(/^\s+/, '');
        if (trimmedCb) body += wCheckbox(trimmedCb);
      });
      i++;
      continue;
    }
    
    // Table detection (exclude lines with checkboxes)
    if (line.indexOf('|') !== -1 && line.indexOf('☐') === -1 && line.indexOf('☑') === -1) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].indexOf('☐') === -1 && lines[i].indexOf('☑') === -1) {
        tableRows.push(lines[i]);
        i++;
      }
      
      let nbCols = 0;
      tableRows.forEach(r => {
        const c = r.split('|').length;
        if (c > nbCols) nbCols = c;
      });
      
      if (nbCols < 2) nbCols = 2;
      
      const gridCols: number[] = [];
      const colW = Math.floor(9000 / nbCols);
      for (let gc = 0; gc < nbCols; gc++) gridCols.push(colW);
      
      const xmlRows = tableRows.map((r, ri) => {
        const cells = r.split('|');
        const gridCells = cells.map((cell, ci) => {
          const isHeader = ri === 0;
          const cellText = cell.trim();
          return '<w:tc><w:tcPr><w:tcW w:w="' + gridCols[ci] + '" w:type="dxa"/>' +
            (isHeader ? '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' : '') +
            '</w:tcPr>' +
            '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
            '<w:r><w:rPr>' +
            (isHeader ? '<w:b/>' : '') +
            '<w:color w:val="' + (isHeader ? 'FFFFFF' : DOCX_GREY) + '"/>' +
            '<w:sz w:val="' + (isHeader ? '18' : '17') + '"/>' +
            '</w:rPr>' +
            '<w:t xml:space="preserve">' + xmlEscape(cellText) + '</w:t></w:r></w:p></w:tc>';
        }).join('');
        return '<w:tr>' + gridCells + '</w:tr>';
      });
      
      const grid = gridCols.map(w => '<w:gridCol w:w="' + w + '"/>').join('');
      body += '<w:tbl><w:tblPr><w:tblW w:w="8860" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
        '<w:tblGrid>' + grid + '</w:tblGrid>' + xmlRows.join('') + '</w:tbl>';
      continue;
    }
    
    // Context intro line (ends with :)
    if (trimmed.endsWith(':') && !(/^Article \d+/.test(line)) && !(/^TITRE [IVX]+/.test(line))) {
      // Look up to 4 lines ahead to find a list item
      let looksLikeList = false;
      for (let la = 1; la <= 4; la++) {
        if (i + la >= lines.length) break;
        const laLine = lines[i + la].replace(/\s+$/, '');
        if (laLine === '') break;
        if (laLine.endsWith(';') || laLine.endsWith('.')) {
          looksLikeList = true;
          break;
        }
        if (laLine.endsWith(':')) continue;
        break;
      }
      
      if (looksLikeList) {
        // Check if previous non-empty line also ended with :
        let prevNonEmpty = '';
        let pb = i - 1;
        for (; pb >= 0; pb--) {
          const pl = lines[pb].replace(/\s+$/, '');
          if (pl !== '') {
            prevNonEmpty = pl;
            break;
          }
        }
        
        if (prevNonEmpty.endsWith(':')) {
          // Check depth
          let prevPrev = '';
          for (let pb2 = pb - 1; pb2 >= 0; pb2--) {
            const pl2 = lines[pb2].replace(/\s+$/, '');
            if (pl2 !== '') {
              prevPrev = pl2;
              break;
            }
          }
          const depth2 = prevPrev.endsWith(':') ? 3 : 2;
          body += wBulletIntro(line, depth2);
        } else {
          body += wPara({ text: line, bold: true, size: 21, color: DOCX_NAVY, spacingBefore: 100, spacingAfter: 40 });
        }
        i++;
        continue;
      }
    }
    
    // Subtitle (Préambule, etc.) - bold and centered
    if (/^[A-ZÉÈÊËÀÂÄÙÛÜÔÖÎÏÇ][a-zéèêëàâäùûüôöîïç\s]+$/.test(line) && line.length < 100 && !line.endsWith('.') && !line.endsWith(';') && !line.endsWith(':') && !(/^Article \d+/.test(line)) && !(/^TITRE [IVX]+/.test(line))) {
      body += wPara({ text: line, bold: true, size: 22, color: DOCX_NAVY, align: 'center', spacingBefore: 200, spacingAfter: 120 });
      i++;
      continue;
    }
    
    // Main contract title lines - bold and larger size
    if (/^CONTRAT DE PRESTATION DE SERVICES – LOT [ABC]$/.test(line)) {
      body += wPara({ text: line, bold: true, size: 32, color: DOCX_NAVY, align: 'center', spacingBefore: 200, spacingAfter: 120 });
      i++;
      continue;
    }
    
    if (/^N° : PROQ-AO11-2022-Lot[ABC]-\d{3}$/.test(line)) {
      body += wPara({ text: line, bold: true, size: 28, color: DOCX_GREY, align: 'center', spacingBefore: 120, spacingAfter: 120 });
      i++;
      continue;
    }
    
    // Lot descriptions for all three lots
    if (/^Livraison, Génie Civil, Pose des Potelets, Coffrets de Comptage et Installation Intérieure$/.test(line) ||
        /^Précâblage et Préparation des Kits de Distribution Intérieure$/.test(line) ||
        /^Tirage et Raccordement du Câble Préassemblé$/.test(line)) {
      body += wPara({ text: line, bold: true, size: 26, color: DOCX_NAVY, align: 'center', spacingBefore: 150, spacingAfter: 150 });
      i++;
      continue;
    }
    
    // Check if we're at the end of Préambule section and need to add grappes table
    if (preambuleEndIndex !== -1 && i === preambuleEndIndex && !preambuleSectionProcessed && grappesData && grappesData.length > 0 && lot) {
      body += wPara({ text: 'TABLEAU DES GRAPPES - ATTRIBUTION LOT ' + lot, bold: true, size: 22, color: DOCX_NAVY, align: 'center', spacingBefore: 300, spacingAfter: 150 });
      
      // Create table header
      const tableHeader = ['Grappe', 'Région', 'Nombre de Ménages', 'Statut'];
      const headerCells = tableHeader.map((h, ci) => {
        const widths = [1500, 2500, 2000, 2000];
        return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
          '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
          '</w:tcPr>' +
          '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
          '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="18"/></w:rPr>' +
          '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
      }).join('');
      
      // Create table rows
      const tableRows = grappesData.map((g: any) => {
        const values = [g.grappe, g.region, g.menages, g.statut];
        const widths = [1500, 2500, 2000, 2000];
        const cells = values.map((v, ci) => {
          return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
            '</w:tcPr>' +
            '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
            '<w:r><w:rPr><w:sz w:val="17"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
            '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
        }).join('');
        return '<w:tr>' + cells + '</w:tr>';
      });
      
      const grid = [1500, 2500, 2000, 2000].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
      body += '<w:tbl><w:tblPr><w:tblW w:w="8860" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
        '<w:tblGrid>' + grid + '</w:tblGrid>' +
        '<w:tr>' + headerCells + '</w:tr>' + tableRows.join('') + '</w:tbl>';
      
      preambuleSectionProcessed = true;
    }
    
    // Default: regular paragraph
    body += wPara({ text: line, spacingBefore: 40, spacingAfter: 80 });
    i++;
  }
  
  return body;
}

function buildContratXml(lot: 'A' | 'B' | 'C', region: string, grappe: string, entreprise: string, nbMenages: number, contratNumber?: string, prestataireData?: any, grappesData?: any[], includeAnnexes: boolean = true): string {
  const raw = getContractTemplate(lot);
  const text = contratReplaceDyn(raw, lot, region, grappe, entreprise, nbMenages, contratNumber, prestataireData);
  
  // Add enriched information table at the beginning
  let enrichedBody = '';
  
  // Get prestataire data
  const entRepresentant = prestataireData?.representantLegal || prestataireData?.societe || '—';
  const entTel = prestataireData?.telephone || '—';
  const entEmail = prestataireData?.email || '—';
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const numContrat = contratNumber || 'PROQ-AO11-2022-Lot' + lot + '-001';
  
  // Create enriched table
  enrichedBody += wPara({ text: '', spacingBefore: 0, spacingAfter: 0 });
  enrichedBody += wPara({ text: '', spacingBefore: 0, spacingAfter: 0 });
  
  const tableHeader = ['N° Contrat', 'Date', 'Région', 'Grappe'];
  const headerCells = tableHeader.map((h, ci) => {
    const widths = [2500, 2500, 2500, 2500];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="19"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const tableValues = [numContrat, today, region, grappe];
  const valueCells = tableValues.map((v, ci) => {
    const widths = [2500, 2500, 2500, 2500];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="19"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const grid = [2500, 2500, 2500, 2500].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  enrichedBody += '<w:tbl><w:tblPr><w:tblW w:w="8860" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + grid + '</w:tblGrid>' +
    '<w:tr>' + headerCells + '</w:tr>' +
    '<w:tr>' + valueCells + '</w:tr>' +
    '</w:tbl>';
  
  // Add PRESTATAIRE section
  enrichedBody += wPara({ text: 'PRESTATAIRE', bold: true, size: 22, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 80 });
  
  const prestataireHeader = ['Entreprise', 'Responsable', 'Téléphone', 'Email'];
  const prestataireHeaderCells = prestataireHeader.map((h, ci) => {
    const widths = [2500, 2500, 2500, 2500];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="19"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const prestataireValues = [entreprise, entRepresentant, entTel, entEmail];
  const prestataireValueCells = prestataireValues.map((v, ci) => {
    const widths = [2500, 2500, 2500, 2500];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + (ci === 0 ? 'F8FAFC' : 'clear') + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr>' +
      (ci === 0 ? '<w:b/>' : '') +
      '<w:sz w:val="19"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  enrichedBody += '<w:tbl><w:tblPr><w:tblW w:w="8860" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + grid + '</w:tblGrid>' +
    '<w:tr>' + prestataireHeaderCells + '</w:tr>' +
    '<w:tr>' + prestataireValueCells + '</w:tr>' +
    '</w:tbl>';
  
  // Add PORTÉE DU CONTRAT section
  enrichedBody += wPara({ text: 'PORTÉE DU CONTRAT', bold: true, size: 22, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 80 });
  enrichedBody += wPara({ text: `${nbMenages} ménages — ${region} — Grappe ${grappe}`, size: 22, spacingBefore: 60, spacingAfter: 120 });
  
  // Split text into lines
  const lines = text.split('\n');
  const body = '';
  const i = 0;
  
  // Find the Préambule line index and where it ends
  let preambuleIndex = -1;
  let preambuleEndIndex = -1;
  for (let p = 0; p < lines.length; p++) {
    if (lines[p].trim() === 'Préambule') {
      preambuleIndex = p;
    }
    // Find where Préambule section ends (next major section or Article)
    if (preambuleIndex !== -1 && preambuleEndIndex === -1) {
      if (/^Article \d+/.test(lines[p]) || /^TITRE [IVX]+/.test(lines[p])) {
        preambuleEndIndex = p;
        break;
      }
    }
  }
  
  // Process the document
  const processedBody = contratTextToXmlWithPrestataire(lines, body, i, preambuleIndex, preambuleEndIndex, prestataireData, grappesData, lot);
  
  // Add separator line before contract content
  enrichedBody += wPara({ text: '—', spacingBefore: 120, spacingAfter: 120 });
  
  let finalBody = enrichedBody + processedBody;
  
  // Add annexes page at the end if requested
  if (includeAnnexes) {
    finalBody += wPara({ text: '', spacingBefore: 300 }); // Page break
    finalBody += wPara({ text: 'ANNEXES', bold: true, size: 28, color: DOCX_NAVY, align: 'center', spacingAfter: 40 });
    finalBody += wPara({ text: 'Les fiches de suivi ci-dessous sont disponibles dans le dossier complet du prestataire.', size: 20, align: 'center', spacingAfter: 60 });
    
    // Get relevant fiches for this lot
    const relevantFiches = FICHE_DEFS.filter(f => f.lot === lot || f.lot === '');
    
    if (relevantFiches.length > 0) {
      const ficheHeader = ['Code', 'Titre', 'Niveau', 'Rempli par', 'Périodicité'];
      const ficheHeaderCells = ficheHeader.map((h, ci) => {
        const widths = [1500, 4000, 1500, 3000, 2500];
        return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
          '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
          '</w:tcPr>' +
          '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
          '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="19"/></w:rPr>' +
          '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
      }).join('');
      
      let ficheRows = '';
      relevantFiches.forEach(f => {
        const widths = [1500, 4000, 1500, 3000, 2500];
        const values = [f.id, f.title, f.level, f.fillBy, f.period];
        const rowCells = values.map((v, ci) => {
          return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
            '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
            '<w:r><w:rPr><w:sz w:val="19"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
            '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
        }).join('');
        ficheRows += '<w:tr>' + rowCells + '</w:tr>';
      });
      
      const grid = [1500, 4000, 1500, 3000, 2500].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
      finalBody += '<w:tbl><w:tblPr><w:tblW w:w="12500" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
        '<w:tblGrid>' + grid + '</w:tblGrid>' +
        '<w:tr>' + ficheHeaderCells + '</w:tr>' +
        ficheRows +
        '</w:tbl>';
      
      finalBody += wPara({ text: '', spacingAfter: 40 });
      finalBody += wPara({ text: 'Note : Les fiches de suivi détaillées sont incluses dans le dossier complet.', size: 18, italic: true, color: DOCX_GREY, spacingAfter: 40 });
    }
  }
  
  return finalBody;
}

// ─── Génération DOCX ───────────────────────────────────────────────────────────
export async function generateContratBlob(params: {
  lot: 'A' | 'B' | 'C';
  contratNumber: string;
  date: string;
  entreprise: string;
  region: string;
  grappe: string;
  nbMenages: number;
  montant: string;
  prestataireData?: any;
  grappesData?: any[];
  includeAnnexes?: boolean;
}): Promise<Blob> {
  try {
    const body = buildContratXml(params.lot, params.region, params.grappe, params.entreprise, params.nbMenages, params.contratNumber, params.prestataireData, params.grappesData, params.includeAnnexes !== false);
    console.log('Body length:', body.length);
    
    // Utiliser la fonction generateDocxBlob standard qui inclut header/footer
    const blob = await generateDocxBlob(body);
    console.log('Blob generated, size:', blob.size);
    return blob;
  } catch (error) {
    console.error('Error in generateContratBlob:', error);
    throw error;
  }
}

// ─── Déclenchement téléchargement ────────────────────────────────────────────
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Fonction pour créer un ZIP avec fflate ───────────────────────────────────
export function createZipWithFflate(files: Record<string, Uint8Array>): Uint8Array {
  return fflate.zipSync(files, { level: 6 });
}

// ─── Export des fonctions utilitaires DOCX ─────────────────────────────────────
export { wPara, wHeading, wBullet, wBulletIntro, wCheckbox, wTableBorders, wCell, wTable };

// ─── Fonctions utilitaires pour la génération DOCX ───────────────────────────
export async function generateDocxBlob(bodyXml: string): Promise<Blob> {
  const documentXml = buildDocumentXml(bodyXml);
  const headerXml = buildHeaderXml();
  const footerXml = buildFooterXml();
  
  // Numbering XML pour les puces
  const NUMBERING_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:abstractNum w:abstractNumId="1">' +
      '<w:lvl w:ilvl="0">' +
        '<w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
        '<w:lvlText w:val="-"/><w:lvlJc w:val="left"/>' +
        '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>' +
        '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr>' +
      '</w:lvl>' +
      '<w:lvl w:ilvl="1">' +
        '<w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
        '<w:lvlText w:val="-"/><w:lvlJc w:val="left"/>' +
        '<w:pPr><w:ind w:left="1080" w:hanging="360"/></w:pPr>' +
        '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr>' +
      '</w:lvl>' +
      '<w:lvl w:ilvl="2">' +
        '<w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
        '<w:lvlText w:val="-"/><w:lvlJc w:val="left"/>' +
        '<w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>' +
        '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:hint="default"/></w:rPr>' +
      '</w:lvl>' +
    '</w:abstractNum>' +
    '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>' +
    '</w:numbering>';
  
  const CONTENT_TYPES_WITH_NUMBERING = DOCX_CONTENT_TYPES.replace('</Types>', 
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/header.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');
  
  const RELS_WITH_NUMBERING = DOCX_RELS_DOCUMENT.replace('</Relationships>', 
    '<Relationship Id="rId999" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer.xml"/></Relationships>');
  
  // Création des fichiers avec fflate
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': fflate.strToU8(CONTENT_TYPES_WITH_NUMBERING),
    '_rels/.rels': fflate.strToU8(DOCX_RELS_MAIN),
    'word/document.xml': fflate.strToU8(documentXml),
    'word/_rels/document.xml.rels': fflate.strToU8(RELS_WITH_NUMBERING),
    'word/numbering.xml': fflate.strToU8(NUMBERING_XML),
    'word/header.xml': fflate.strToU8(headerXml),
    'word/footer.xml': fflate.strToU8(footerXml)
  };
  
  // Compression avec fflate
  const zipped = fflate.zipSync(files, { level: 6 });
  
  return new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function buildDocumentXml(bodyXml: string): string {
  const hasExistingSectPr = bodyXml.indexOf('<w:sectPr>') !== -1;
  const sectPr = hasExistingSectPr ? '' : '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/></w:sectPr>';
  
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<w:body>' + bodyXml + sectPr + '</w:body></w:document>';
}

function buildHeaderXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr>' +
    '<w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="' + DOCX_NAVY + '"/></w:rPr>' +
    '<w:t xml:space="preserve">CONTRAT DE PRESTATION DE SERVICES \u2013 PROQUELEC</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>' +
    '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
    '<w:t xml:space="preserve">Association pour la Promotion de la Qualit\u00e9 des Installations \u00c9lectriques Int\u00e9rieures</w:t></w:r></w:p>' +
    '</w:hdr>';
}

function buildFooterXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>' +
    '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
    '<w:t xml:space="preserve">Si\u00e8ge social : Immeuble Coumba Castel, 12 rue Saint-Michel, 4e \u00e9tage</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="20" w:after="20"/></w:pPr>' +
    '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
    '<w:t xml:space="preserve">BP : 32\u2009037 Dakar \u2013 T\u00e9l. : (+221) 33\u2009848 68 55 \u2013 NINEA 0191403 0B9</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="20" w:after="40"/></w:pPr>' +
    '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
    '<w:t xml:space="preserve">Site Web: www.proquelec.sn \u2013 Email: proquelec@proquelec.sn</w:t></w:r></w:p>' +
    '</w:ftr>';
}

// ─── Fonction principale de génération de contrat ─────────────────────────────
export async function generateContratDocxRich(params: {
  lot: 'A' | 'B' | 'C';
  contratNumber: string;
  date: string;
  entreprise: string;
  region: string;
  grappe: string;
  nbMenages: number;
  montant: string;
  societe?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  duree?: string;
  observations?: string;
  prestataireData?: any;
  grappesData?: any[];
}): Promise<Blob> {
  // Extract grappes data if available or build from params
  let grappesData = params.grappesData;
  if (!grappesData && params.grappe && params.region) {
    grappesData = [{
      grappe: params.grappe,
      region: params.region,
      menages: params.nbMenages,
      statut: 'En cours'
    }];
  }
  
  // Build prestataire data if available
  const prestataireData = params.prestataireData || {
    entreprise: params.entreprise,
    societe: params.societe || '',
    telephone: params.telephone || '',
    email: params.email || '',
    adresse: params.adresse || ''
  };
  
  const blob = await generateContratBlob({
    lot: params.lot,
    contratNumber: params.contratNumber,
    date: params.date,
    entreprise: params.entreprise,
    region: params.region,
    grappe: params.grappe,
    nbMenages: params.nbMenages,
    montant: params.montant,
    prestataireData,
    grappesData
  });
  
  return blob;
}

// ─── Fiche de suivi DOCX ─────────────────────────────────────────────────────
// Reproduction fidèle de exportFicheWord() du fichier HTML
function buildFicheBodyXml(fiche: FicheDef, entry: FicheEntry, idx: number): string {
  const d = entry.data || {};
  let body = '';

  body += wPara({ text: 'PROQUELEC', bold: true, size: 28, color: DOCX_NAVY, align: 'center', spacingAfter: 40 });
  body += wPara({ text: 'FICHE DE SUIVI \u2014 ' + fiche.id, bold: true, size: 24, color: DOCX_NAVY, align: 'center', spacingAfter: 20 });
  body += wPara({ text: fiche.title + (fiche.lot ? ' (' + fiche.lot + ')' : ''), size: 22, color: DOCX_GREY, align: 'center', spacingAfter: 60 });
  body += wPara({ text: 'Rempli par : ' + fiche.fillBy, bold: true, size: 20, color: DOCX_NAVY, spacingAfter: 20 });
  body += wPara({ text: fiche.purpose, italic: true, size: 18, color: DOCX_GREY, spacingAfter: 20 });
  body += wPara({ text: 'Fr\u00e9quence : ' + fiche.period, size: 18, color: DOCX_GREY, spacingAfter: 120 });

  const rows: string[][] = [];
  rows.push([
    wCell('Champ', { shaded: true, valueBold: true, widthPct: 3500 }),
    wCell('Valeur', { shaded: true, valueBold: true, widthPct: 6500 })
  ]);
  for (const fld of fiche.fields) {
    let val = d[fld.key] != null ? String(d[fld.key]) : '\u2014';
    if (fld.type === 'number' && d[fld.key] != null && d[fld.key] !== '') {
      val = Number(d[fld.key]).toLocaleString('fr-FR');
    }
    rows.push([
      wCell(fld.label, { widthPct: 3500, valueBold: true }),
      wCell(val, { widthPct: 6500 })
    ]);
  }
  if (entry.createdAt) {
    rows.push([
      wCell('Date de saisie', { widthPct: 3500, valueBold: true }),
      wCell(entry.createdAt, { widthPct: 6500 })
    ]);
  }
  if (entry.author) {
    rows.push([
      wCell('Saisi par', { widthPct: 3500, valueBold: true }),
      wCell(entry.author, { widthPct: 6500 })
    ]);
  }
  body += wTable(rows, [3500, 6500]);

  const obs = d.observations || d.observation || d.actionCorrective;
  if (obs) {
    body += wPara({ text: '', spacingBefore: 80 });
    body += wHeading('Observations');
    body += wPara({ text: String(obs), size: 20 });
  }

  body += wPara({ text: '', spacingBefore: 200 });
  body += wPara({ text: 'Signature : ________________________', size: 20, spacingBefore: 200 });
  body += wPara({ text: 'Date : ________________________', size: 20, spacingBefore: 60 });

  return body;
}

// En-tête DOCX pour fiches (même structure que le HTML)
function buildFicheHeaderXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr>' +
    '<w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="' + DOCX_NAVY + '"/></w:rPr>' +
    '<w:t xml:space="preserve">PROQUELEC \u2013 Direction de la Cartographie</w:t></w:r></w:p>' +
    '</w:hdr>';
}

// Pied de page DOCX pour fiches
function buildFicheFooterXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>' +
    '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
    '<w:t xml:space="preserve">PROQUELEC \u2013 Direction de la Cartographie</w:t></w:r></w:p>' +
    '</w:ftr>';
}

// Assemblage du document XML avec sectPr (A4, marges, refs header/footer)
function buildFicheDocumentXml(bodyXml: string): string {
  const sectPr = '<w:sectPr>' +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
    '<w:headerReference w:type="default" r:id="rIdHeader"/>' +
    '<w:footerReference w:type="default" r:id="rIdFooter"/>' +
    '</w:sectPr>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<w:body>' + bodyXml + sectPr + '</w:body></w:document>';
}

// Packaging DOCX complet pour fiches (avec header, footer, numbering)
async function generateFicheDocxBlob(bodyXml: string): Promise<Blob> {
  const documentXml = buildFicheDocumentXml(bodyXml);
  const headerXml = buildFicheHeaderXml();
  const footerXml = buildFicheFooterXml();

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

  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '</w:styles>';

  // Création des fichiers avec fflate
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': fflate.strToU8(CONTENT_TYPES),
    '_rels/.rels': fflate.strToU8(RELS_MAIN),
    'word/document.xml': fflate.strToU8(documentXml),
    'word/_rels/document.xml.rels': fflate.strToU8(RELS_DOC),
    'word/numbering.xml': fflate.strToU8(NUMBERING_XML),
    'word/header.xml': fflate.strToU8(headerXml),
    'word/footer.xml': fflate.strToU8(footerXml),
    'word/styles.xml': fflate.strToU8(STYLES_XML)
  };
  
  // Compression avec fflate
  const zipped = fflate.zipSync(files, { level: 6 });
  
  return new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ─── Export principal fiche de suivi ──────────────────────────────────────────
export async function generateFicheDocx(fiche: FicheDef, entry: FicheEntry, idx: number): Promise<void> {
  const bodyXml = buildFicheBodyXml(fiche, entry, idx);
  const blob = await generateFicheDocxBlob(bodyXml);
  const safeRef = (entry.data?.activite as string) || (entry.data?.region as string) || 'modele';
  triggerDownload(blob, `${fiche.id}_${safeRef}_${idx + 1}.docx`);
}

// ─── Modèle Lettre de Mission (version HTML originale) ─────────────────────────
function buildLettreMissionOriginalXml(
  lot: 'A' | 'B' | 'C',
  region: string,
  grappe: number,
  prestataireData: any,
  nbMenages: number
): string {
  const ent = prestataireData;
  const isLotA = lot === 'A';
  
  let body = '';
  
  body += wPara({ text: 'LETTRE DE MISSION', bold: true, size: 36, color: DOCX_NAVY, align: 'center', spacingAfter: 60 });
  const subtitle = isLotA
    ? 'LOT A – PRÉ-CÂBLAGE INDUSTRIEL DES KITS DE DISTRIBUTION INTÉRIEURE'
    : 'LOT ' + lot + ' – ' + (region || 'Kaffrine + Tambacounda').toUpperCase() + (grappe ? ', GRAPPE ' + grappe : '') + ' — ' + (ent.entreprise || '').toUpperCase();
  body += wPara({ text: subtitle, bold: true, size: 22, color: DOCX_GREY, align: 'center', spacingAfter: 200 });
  
  body += wPara({ text: 'Dakar, le …/…/2026', align: 'right' });
  body += wPara({ text: '' });
  body += wPara({ text: 'Réf. : LM-LOT ' + lot + (grappe ? '-G' + grappe : '') + '-' + (ent.entreprise || '').replace(/\s+/g, '').toUpperCase(), bold: true });
  body += wPara({ text: isLotA
    ? 'Objet : Lettre de mission – Pré-câblage industriel des kits de distribution intérieure'
    : 'Objet : Lettre de mission – Mission Lot ' + lot + (grappe ? ', Grappe ' + grappe : '') + ' – ' + (region || 'Kaffrine + Tambacounda') });
  body += wPara({ text: '' });
  body += wPara({ text: 'À l\'attention de : ' + (ent.entreprise || '') });
  body += wPara({ text: 'Téléphone : ' + (ent.telephone || '—') });
  if (ent.email) body += wPara({ text: 'Email : ' + ent.email });
  if (ent.adresse) body += wPara({ text: 'Adresse : ' + ent.adresse });
  body += wPara({ text: '' });
  body += wPara({ text: 'Madame, Monsieur,' });
  body += wPara({ text: "Dans le cadre du contrat de prestation de services Lot " + lot + " signé entre PROQUELEC et votre entreprise, nous vous notifions par la présente lettre de mission les conditions précises d'exécution de votre prestation, comme suit :" });
  
  body += wPara({ text: '1. Zone d\'exécution attribuée', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  
  // Tableau zone d'exécution
  const zoneHeader = ['Région(s)', 'Grappe', 'Nombre de ménages attribués', 'Nom et prénom', 'Entreprise'];
  const zoneHeaderCells = zoneHeader.map((h, ci) => {
    const widths = [2000, 2000, 2800, 2800, 2800];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const zoneValues = [region || (isLotA ? 'Toutes (préparation globale)' : String(grappe)), String(nbMenages), ent.entreprise || '', ent.societe || ''];
  const zoneRowCells = zoneValues.map((v, ci) => {
    const widths = [2000, 2000, 2800, 2800, 2800];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const zoneGrid = [2000, 2000, 2800, 2800, 2800].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  body += '<w:tbl><w:tblPr><w:tblW w:w="12400" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + zoneGrid + '</w:tblGrid>' +
    '<w:tr>' + zoneHeaderCells + '</w:tr>' +
    '<w:tr>' + zoneRowCells + '</w:tr>' +
    '</w:tbl>';
  
  body += wPara({ text: 'La liste nominative complète des ' + nbMenages + ' ménages affectés figure en annexe du présent dossier (page suivante).', italic: true, spacingBefore: 120 });
  
  body += wPara({ text: '2. Volume et planning', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  
  // Tableau planning
  const planningHeader = ['Date de début de la mission', 'Date de fin prévisionnelle'];
  const planningHeaderCells = planningHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const planningRowCells = planningHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">_____________</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const planningGrid = [5400, 5400].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  body += '<w:tbl><w:tblPr><w:tblW w:w="10800" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + planningGrid + '</w:tblGrid>' +
    '<w:tr>' + planningHeaderCells + '</w:tr>' +
    '<w:tr>' + planningRowCells + '</w:tr>' +
    '</w:tbl>';
  
  body += wPara({ text: '3. Rappel des opérations à réaliser (Article 2 du contrat)', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  
  if (isLotA) {
    body += wPara({ text: '• Montage : fixation sur rail DIN du disjoncteur de branchement, de l\'interrupteur différentiel (30mA), des disjoncteurs C10/C20 et du plastron.', spacingAfter: 20 });
    body += wPara({ text: '• Câblage de puissance, serrage au couple, test de continuité, marquage de conformité.', spacingAfter: 20 });
    body += wPara({ text: '• Préparation et renseignement du bordereau pour chaque kit, déroulage des câbles armés par lot de 500m ou 1000m.', spacingAfter: 20 });
    body += wPara({ text: '• Mise à disposition, pour transmission au Lot C, du matériel de branchement reçu de PROQUELEC.', spacingAfter: 20 });
    body += wPara({ text: "L'ensemble du matériel nécessaire est fourni par PROQUELEC/LSE. La présente mission est rémunérée exclusivement en main-d'œuvre.", spacingBefore: 120 });
  } else if (lot === 'B') {
    body += wPara({ text: '• Prise en charge logistique : enlèvement des kits validés au magasin tampon, transport et remise sur site du ménage ciblé.', spacingAfter: 20 });
    body += wPara({ text: '• Génie civil et mur support : fouilles, tranchées, percements, reprises de murs, scellements, rebouchages, finitions.', spacingAfter: 20 });
    body += wPara({ text: '• Pose du potelet : scellement, alignement, stabilité mécanique.', spacingAfter: 20 });
    body += wPara({ text: '• Pose du coffret de comptage en limite de propriété ou au point validé par PROQUELEC.', spacingAfter: 20 });
    body += wPara({ text: '• Installation intérieure complète (4 phases techniques).', spacingAfter: 20 });
    body += wPara({ text: '• Mise en œuvre du dispositif de mise à la terre conforme à la norme NS 01001.', spacingAfter: 20 });
    body += wPara({ text: "Le potelet, le coffret de comptage et le matériel d'installation intérieure sont fournis par PROQUELEC/LSE. La présente mission est rémunérée exclusivement en main-d'œuvre.", spacingBefore: 120 });
  } else {
    body += wPara({ text: '• Enlèvement et transport du câble préassemblé 2x16mm² depuis le magasin tampon ou le point désigné par PROQUELEC.', spacingAfter: 20 });
    body += wPara({ text: '• Reconnaissance réseau : vérification du point de raccordement et des contraintes de sécurité.', spacingAfter: 20 });
    body += wPara({ text: '• Réception du support Lot B : vérification visuelle du mur support, du potelet et du coffret de comptage avant intervention.', spacingAfter: 20 });
    body += wPara({ text: '• Tirage du câble préassemblé depuis le réseau jusqu\'à l\'entrée du coffret de comptage posé par le Lot B.', spacingAfter: 20 });
    body += wPara({ text: '• Pose des protections mécaniques sur le parcours exposé du câble.', spacingAfter: 20 });
    body += wPara({ text: '• Raccordement au coffret et raccordement extérieur, avec contrôles de sécurité avant mise sous tension.', spacingAfter: 20 });
    body += wPara({ text: "Le câble préassemblé, les connecteurs CPB1/CT70 et la pince d'ancrage 25 sont fournis par PROQUELEC/LSE. La présente mission est rémunérée exclusivement en main-d'œuvre.", spacingBefore: 120 });
  }
  
  body += wPara({ text: '4. Documents à fournir avant démarrage', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  body += wPara({ text: '• Copie de la carte d\'agrément ou des références professionnelles disponibles.', spacingAfter: 20 });
  body += wPara({ text: '• Copies des CNI et CV du personnel certifiées conformes.', spacingAfter: 20 });
  body += wPara({ text: '• Liste d\'identification du personnel précisant la mission, le nom, prénom, fonction et N° CNI.', spacingAfter: 20 });
  body += wPara({ text: '• Liste du matériel, outillage, véhicules et moyens de sécurité mobilisés.', spacingAfter: 20 });
  
  body += wPara({ text: '5. Rappel des engagements contractuels', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  body += wPara({ text: '• Renseigner quotidiennement les formulaires prévus pour observations et statut d\'avancement.', spacingAfter: 20 });
  body += wPara({ text: '• Informer PROQUELEC par écrit de tout événement empêchant la bonne réalisation de la prestation.', spacingAfter: 20 });
  body += wPara({ text: '• Tout défaut constaté et imputable au Prestataire entraînera une reprise à sa charge.', spacingAfter: 20 });
  
  body += wPara({ text: "La présente lettre de mission complète et précise les dispositions du contrat de prestation de services signé entre les parties.", spacingBefore: 200 });
  body += wPara({ text: 'Nous vous prions de bien vouloir nous retourner un exemplaire signé de la présente.' });
  body += wPara({ text: '' });
  body += wPara({ text: 'Veuillez agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.' });
  body += wPara({ text: '', spacingBefore: 400 });
  
  // Tableau signatures
  const sigHeader = ['Pour PROQUELEC', 'Pour le Prestataire (Lot ' + lot + ')'];
  const sigHeaderCells = sigHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const sigValues = ['Moustapha DIEYE, Directeur Général', ent.entreprise || ''];
  const sigRowCells = sigValues.map((v, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const sigGrid = [5400, 5400].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  body += '<w:tbl><w:tblPr><w:tblW w:w="10800" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + sigGrid + '</w:tblGrid>' +
    '<w:tr>' + sigHeaderCells + '</w:tr>' +
    '<w:tr>' + sigRowCells + '</w:tr>' +
    '</w:tbl>';
  
  body += wPara({ text: '', spacingBefore: 400 }); // Page break simulation
  
  return body;
}

// ─── Modèle Ordre de Service (version HTML originale) ───────────────────────────
function buildOrdreDeServiceOriginalXml(
  lot: 'A' | 'B' | 'C',
  region: string,
  grappe: number,
  prestataireData: any,
  nbMenages: number
): string {
  const ent = prestataireData;
  const isLotA = lot === 'A';
  
  let body = '';
  body += wPara({ text: 'ORDRE DE SERVICE', bold: true, size: 36, color: DOCX_NAVY, align: 'center', spacingAfter: 60 });
  const subtitle = isLotA
    ? 'LOT A – PRÉ-CÂBLAGE INDUSTRIEL DES KITS DE DISTRIBUTION INTÉRIEURE'
    : 'LOT ' + lot + ' – ' + (region || 'Kaffrine + Tambacounda').toUpperCase() + (grappe ? ', GRAPPE ' + grappe : '') + ' — ' + (ent.entreprise || '').toUpperCase();
  body += wPara({ text: subtitle, bold: true, size: 22, color: DOCX_GREY, align: 'center', spacingAfter: 200 });
  
  body += wPara({ text: 'Dakar, le …/…/2026', align: 'right' });
  body += wPara({ text: '' });
  body += wPara({ text: 'Réf. : OS-LOT ' + lot + (grappe ? '-G' + grappe : '') + '-' + (ent.entreprise || '').replace(/\s+/g, '').toUpperCase(), bold: true });
  body += wPara({ text: isLotA
    ? 'Objet : Ordre de service – Démarrage de la mission de pré-câblage industriel des kits de distribution intérieure'
    : 'Objet : Ordre de service – Mission Lot ' + lot + (grappe ? ', Grappe ' + grappe : '') + ' – ' + (region || 'Kaffrine + Tambacounda') });
  body += wPara({ text: '' });
  body += wPara({ text: 'À l\'attention de : ' + (ent.entreprise || '') });
  body += wPara({ text: '' });
  body += wPara({ text: 'Madame, Monsieur,' });
  body += wPara({ text: "En référence à la lettre de mission réf. LM-LOT " + lot + (grappe ? '-G' + grappe : '') + '-' + (ent.entreprise || '').replace(/\s+/g, '').toUpperCase() + " et au contrat de prestation de services Lot " + lot + " signé entre PROQUELEC et votre entreprise, nous vous notifions par le présent ordre de service les instructions suivantes :" });
  body += wPara({ text: '' });
  
  body += wPara({ text: '1. Nature de l\'instruction', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  
  // Tableau nature instruction
  const natureHeader = ['Type d\'ordre de service', 'Date de prise d\'effet'];
  const natureHeaderCells = natureHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const natureRowCells = natureHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">_____________</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const natureGrid = [5400, 5400].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  body += '<w:tbl><w:tblPr><w:tblW w:w="10800" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + natureGrid + '</w:tblGrid>' +
    '<w:tr>' + natureHeaderCells + '</w:tr>' +
    '<w:tr>' + natureRowCells + '</w:tr>' +
    '</w:tbl>';
  
  body += wPara({ text: 'Précisez ci-dessous la nature de cet ordre de service :', spacingBefore: 80 });
  body += wPara({ text: '☐  Autorisation de démarrage des prestations', spacingAfter: 20 });
  body += wPara({ text: '☐  Suspension des travaux', spacingAfter: 20 });
  body += wPara({ text: '☐  Reprise des travaux', spacingAfter: 20 });
  body += wPara({ text: '☐  Modification du planning d\'exécution', spacingAfter: 20 });
  body += wPara({ text: '☐  Précision des modalités d\'exécution', spacingAfter: 20 });
  body += wPara({ text: '☐  Demande de prestations complémentaires', spacingAfter: 20 });
  body += wPara({ text: '☐  Instruction technique ou administrative', spacingAfter: 20 });
  
  body += wPara({ text: '2. Détail de l\'instruction', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  
  // Tableau détail instruction
  const detailHeader = ['Zone concernée', 'Volume estimé'];
  const detailHeaderCells = detailHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const detailValues = [isLotA ? 'Ensemble du territoire (Kaffrine + Tambacounda)' : (region || '') + (grappe ? ', Grappe ' + grappe : ''), String(nbMenages) + ' ménages'];
  const detailRowCells = detailValues.map((v, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const detailGrid = [5400, 5400].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  body += '<w:tbl><w:tblPr><w:tblW w:w="10800" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + detailGrid + '</w:tblGrid>' +
    '<w:tr>' + detailHeaderCells + '</w:tr>' +
    '<w:tr>' + detailRowCells + '</w:tr>' +
    '</w:tbl>';
  
  body += wPara({ text: 'Description de l\'instruction / motif :', spacingBefore: 120, bold: true });
  body += wPara({ text: '…………………………………………………………………………………………………………………………………………………………………………………………', spacingAfter: 20 });
  body += wPara({ text: '…………………………………………………………………………………………………………………………………………………………………………………………', spacingAfter: 20 });
  body += wPara({ text: '…………………………………………………………………………………………………………………………………………………………………………………………', spacingAfter: 20 });
  
  body += wPara({ text: '3. Planning', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  
  // Tableau planning
  const planningHeader = ['Date de début (ou date de prise d\'effet)', 'Date de fin prévisionnelle (si applicable)'];
  const planningHeaderCells = planningHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const planningRowCells = planningHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">_____________</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const planningGrid = [5400, 5400].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  body += '<w:tbl><w:tblPr><w:tblW w:w="10800" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + planningGrid + '</w:tblGrid>' +
    '<w:tr>' + planningHeaderCells + '</w:tr>' +
    '<w:tr>' + planningRowCells + '</w:tr>' +
    '</w:tbl>';
  
  body += wPara({ text: '4. Engagements du Prestataire', bold: true, size: 24, color: DOCX_NAVY, spacingBefore: 200, spacingAfter: 20 });
  body += wPara({ text: '• Accuser réception du présent ordre de service dans les 24 heures.', spacingAfter: 20 });
  body += wPara({ text: '• Se conformer immédiatement aux instructions données.', spacingAfter: 20 });
  body += wPara({ text: '• Informer PROQUELEC par écrit de tout événement susceptible d\'en empêcher l\'exécution.', spacingAfter: 20 });
  body += wPara({ text: '• Renseigner les formulaires de suivi conformément aux procédures en vigueur.', spacingAfter: 20 });
  
  body += wPara({ text: "Le présent ordre de service s'insère dans le cadre du contrat de prestation de services signé entre les parties et en constitue une instruction exécutoire.", spacingBefore: 200 });
  body += wPara({ text: 'Nous vous prions d\'en accuser réception par retour signé.' });
  body += wPara({ text: '', spacingBefore: 400 });
  
  // Tableau signatures
  const sigHeader = ['Pour PROQUELEC', 'Pour le Prestataire – Accusé de réception (Lot ' + lot + ')'];
  const sigHeaderCells = sigHeader.map((h, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const sigValues = ['Moustapha DIEYE, Directeur Général', ent.entreprise || ''];
  const sigRowCells = sigValues.map((v, ci) => {
    const widths = [5400, 5400];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  const sigGrid = [5400, 5400].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  body += '<w:tbl><w:tblPr><w:tblW w:w="10800" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + sigGrid + '</w:tblGrid>' +
    '<w:tr>' + sigHeaderCells + '</w:tr>' +
    '<w:tr>' + sigRowCells + '</w:tr>' +
    '</w:tbl>';
  
  body += wPara({ text: '', spacingBefore: 400 }); // Page break simulation
  
  return body;
}

// ─── Liste Ménages avec GPS ───────────────────────────────────────────────────
function buildListeMenagesGpsXml(
  lot: 'A' | 'B' | 'C',
  region: string,
  grappe: number,
  menagesData: any[],
  gpsData: any
): string {
  let body = '';
  
  body += wPara({ text: 'LISTE DES MÉNAGES AVEC COORDONNÉES GPS', bold: true, size: 28, color: DOCX_NAVY, align: 'center', spacingAfter: 40 });
  body += wPara({ text: `Lot ${lot} - ${region} - Grappe ${grappe}`, size: 22, color: DOCX_GREY, align: 'center', spacingAfter: 40 });
  body += wPara({ text: `Total: ${menagesData.length} ménages`, bold: true, size: 20, spacingAfter: 40 });
  body += wPara({ text: `Date d'extraction: ${new Date().toLocaleDateString('fr-FR')}`, size: 18, italic: true, color: DOCX_GREY, spacingAfter: 60 });
  
  // Tableau avec GPS
  const tableHeader = ['Ordre', 'Nom', 'Village', 'Contact', 'Latitude', 'Longitude'];
  const headerCells = tableHeader.map((h, ci) => {
    const widths = [1200, 3000, 2500, 2000, 2000, 2000];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="18"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  let valueRows = '';
  menagesData.forEach((m, idx) => {
    const widths = [1200, 3000, 2500, 2000, 2000, 2000];
    // Try to get GPS from village data or menage data
    const lat = m.gpsLat || (gpsData?.[m.village]?.lat) || '—';
    const lon = m.gpsLon || (gpsData?.[m.village]?.lon) || '—';
    const values = [idx + 1, m.nom || m.ordre, m.village || '', m.tel || m.contact || '', lat, lon];
    const rowCells = values.map((v, ci) => {
      return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
        '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
        '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
        '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
    }).join('');
    valueRows += '<w:tr>' + rowCells + '</w:tr>';
  });
  
  const grid = [1200, 3000, 2500, 2000, 2000, 2000].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  body += '<w:tbl><w:tblPr><w:tblW w:w="12700" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + grid + '</w:tblGrid>' +
    '<w:tr>' + headerCells + '</w:tr>' +
    valueRows +
    '</w:tbl>';
  
  body += wPara({ text: '', spacingAfter: 40 });
  body += wPara({ text: 'Note : Les coordonnées GPS sont à titre indicatif. Vérifiez sur le terrain avant intervention.', size: 16, italic: true, color: DOCX_GREY, spacingAfter: 40 });
  
  return body;
}

// ─── Génération dossier complet (contrat + liste ménages + fiches de suivi) ─────────
export async function generateDossierCompletDocx(
  lot: 'A' | 'B' | 'C',
  region: string,
  grappe: number,
  menagesData: any[],
  prestataireData: any
): Promise<Blob> {
  const fflate = await import('fflate');
  
  const files: Record<string, Uint8Array> = {};
  
  // Générer le contrat (sans annexes pour éviter duplication)
  const contratBlob = await generateContratBlob({
    lot,
    contratNumber: `PROQUELEC-LOT${lot}-${region}-${grappe}-${new Date().getFullYear()}`,
    date: new Date().toISOString().split('T')[0],
    entreprise: prestataireData.entreprise,
    region,
    grappe: String(grappe),
    nbMenages: menagesData.length,
    montant: '',
    prestataireData,
    grappesData: [{ region, grappe: String(grappe), nbMenages: menagesData.length }],
    includeAnnexes: true
  });
  const contratBuffer = await contratBlob.arrayBuffer();
  files['01_Contrat.docx'] = new Uint8Array(contratBuffer);
  
  // Générer la liste des ménages
  let listeBody = '';
  listeBody += wPara({ text: 'LISTE DES MÉNAGES', bold: true, size: 28, color: DOCX_NAVY, align: 'center', spacingAfter: 40 });
  listeBody += wPara({ text: `Lot ${lot} - ${region} - Grappe ${grappe}`, size: 22, color: DOCX_GREY, align: 'center', spacingAfter: 40 });
  listeBody += wPara({ text: `Total: ${menagesData.length} ménages`, bold: true, size: 20, spacingAfter: 40 });
  
  // Tableau des ménages
  const tableHeader = ['Ordre', 'Nom', 'Village', 'Contact'];
  const headerCells = tableHeader.map((h, ci) => {
    const widths = [1500, 4000, 3000, 3000];
    return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:fill="' + DOCX_NAVY + '"/>' +
      '</w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="19"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEscape(h) + '</w:t></w:r></w:p></w:tc>';
  }).join('');
  
  let valueRows = '';
  menagesData.forEach((m, idx) => {
    const widths = [1500, 4000, 3000, 3000];
    const values = [idx + 1, m.nom || m.ordre, m.village || '', m.tel || m.contact || ''];
    const rowCells = values.map((v, ci) => {
      return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/></w:tcPr>' +
        '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>' +
        '<w:r><w:rPr><w:sz w:val="19"/><w:color w:val="' + DOCX_GREY + '"/></w:rPr>' +
        '<w:t xml:space="preserve">' + xmlEscape(String(v)) + '</w:t></w:r></w:p></w:tc>';
    }).join('');
    valueRows += '<w:tr>' + rowCells + '</w:tr>';
  });
  
  const grid = [1500, 4000, 3000, 3000].map(w => '<w:gridCol w:w="' + w + '"/>').join('');
  listeBody += '<w:tbl><w:tblPr><w:tblW w:w="11500" w:type="dxa"/>' + wTableBorders() + '</w:tblPr>' +
    '<w:tblGrid>' + grid + '</w:tblGrid>' +
    '<w:tr>' + headerCells + '</w:tr>' +
    valueRows +
    '</w:tbl>';
  
  const listeBlob = await generateDocxBlob(listeBody);
  const listeBuffer = await listeBlob.arrayBuffer();
  files['02_Liste_Menages.docx'] = new Uint8Array(listeBuffer);
  
  // Générer les fiches de suivi vides pour ce lot
  const relevantFiches = FICHE_DEFS.filter(f => f.lot === lot || f.lot === '');
  
  for (const fiche of relevantFiches) {
    // Créer une entrée vide avec les données de base
    const emptyEntry: FicheEntry = {
      id: `${fiche.id}_${region}_${grappe}_0`,
      ficheId: fiche.id,
      data: {
        region,
        grappe: String(grappe),
        date: new Date().toISOString().split('T')[0],
        prestataire: prestataireData.entreprise,
        ...(lot === 'A' ? { equipe: 'Équipe A' } : {}),
        ...(lot === 'B' ? { equipe: 'Équipe B' } : {}),
        ...(lot === 'C' ? { equipe: 'Équipe C' } : {}),
      }
    };
    
    const ficheBody = buildFicheBodyXml(fiche, emptyEntry, 0);
    const ficheBlob = await generateDocxBlob(ficheBody);
    const ficheBuffer = await ficheBlob.arrayBuffer();
    files[`03_Fiches_Suivi/${fiche.id}_${fiche.title.replace(/\s+/g, '_')}.docx`] = new Uint8Array(ficheBuffer);
  }
  
  // Créer le ZIP
  const zipped = fflate.zipSync(files, { level: 6 });
  
  return new Blob([zipped], { type: 'application/zip' });
}

// ─── Export Lettre de Mission (version originale HTML) ─────────────────────────
export async function generateLettreMission(
  lot: 'A' | 'B' | 'C',
  region: string,
  grappe: number,
  prestataireData: any,
  nbMenages: number
): Promise<Blob> {
  const body = buildLettreMissionOriginalXml(lot, region, grappe, prestataireData, nbMenages);
  return await generateDocxBlob(body);
}

// ─── Export Ordre de Service (version originale HTML) ─────────────────────────
export async function generateOrdreDeService(
  lot: 'A' | 'B' | 'C',
  region: string,
  grappe: number,
  prestataireData: any,
  nbMenages: number
): Promise<Blob> {
  const body = buildOrdreDeServiceOriginalXml(lot, region, grappe, prestataireData, nbMenages);
  return await generateDocxBlob(body);
}

// ─── Export Liste Ménages avec GPS ─────────────────────────────────────────────
export async function generateListeMenagesGps(
  lot: 'A' | 'B' | 'C',
  region: string,
  grappe: number,
  menagesData: any[],
  gpsData: any
): Promise<Blob> {
  const body = buildListeMenagesGpsXml(lot, region, grappe, menagesData, gpsData);
  return await generateDocxBlob(body);
}

// ─── Dossier Complet Admin (incluant documents internes) ───────────────────────
export async function generateDossierAdminDocx(
  lot: 'A' | 'B' | 'C',
  region: string,
  grappe: number,
  menagesData: any[],
  prestataireData: any,
  gpsData: any
): Promise<Blob> {
  const fflate = await import('fflate');
  
  const files: Record<string, Uint8Array> = {};
  
  // Dossier Complet standard
  const dossierBlob = await generateDossierCompletDocx(lot, region, grappe, menagesData, prestataireData);
  const dossierBuffer = await dossierBlob.arrayBuffer();
  
  // Extraire le ZIP pour ajouter les documents admin
  const dossierZipped = new Uint8Array(await dossierBlob.arrayBuffer());
  
  // Lettre de mission
  const lettreBlob = await generateLettreMission(lot, region, grappe, prestataireData, menagesData.length);
  const lettreBuffer = await lettreBlob.arrayBuffer();
  files['00_Admin/Lettre_Mission.docx'] = new Uint8Array(lettreBuffer);
  
  // Ordre de service
  const ordreBlob = await generateOrdreDeService(lot, region, grappe, prestataireData, menagesData.length);
  const ordreBuffer = await ordreBlob.arrayBuffer();
  files['00_Admin/Ordre_Service.docx'] = new Uint8Array(ordreBuffer);
  
  // Liste ménages avec GPS
  const listeGpsBlob = await generateListeMenagesGps(lot, region, grappe, menagesData, gpsData);
  const listeGpsBuffer = await listeGpsBlob.arrayBuffer();
  files['00_Admin/Liste_Menages_GPS.docx'] = new Uint8Array(listeGpsBuffer);
  
  // Fiches internes (niveau 3 - qualité, réception, facturation)
  const internalFiches = FICHE_DEFS.filter(f => f.level === 3);
  
  for (const fiche of internalFiches) {
    const emptyEntry: FicheEntry = {
      id: `${fiche.id}_ADMIN_${region}_${grappe}_0`,
      ficheId: fiche.id,
      data: {
        region,
        grappe: String(grappe),
        date: new Date().toISOString().split('T')[0],
        prestataire: prestataireData.entreprise,
        controleur: 'PROQUELEC',
        ...(lot === 'A' ? { equipe: 'Équipe A' } : {}),
        ...(lot === 'B' ? { equipe: 'Équipe B' } : {}),
        ...(lot === 'C' ? { equipe: 'Équipe C' } : {}),
      }
    };
    
    const ficheBody = buildFicheBodyXml(fiche, emptyEntry, 0);
    const ficheBlob = await generateDocxBlob(ficheBody);
    const ficheBuffer = await ficheBlob.arrayBuffer();
    files['00_Admin/Fiches_Internes/' + fiche.id + '_' + fiche.title.replace(/\s+/g, '_') + '.docx'] = new Uint8Array(ficheBuffer);
  }
  
  // Fusionner avec le dossier standard
  // Note: fflate.zipSync ne supporte pas directement la fusion, on recrée le dossier complet
  // Générer le contrat
  const contratBlob = await generateContratBlob({
    lot,
    contratNumber: `PROQUELEC-LOT${lot}-${region}-${grappe}-${new Date().getFullYear()}`,
    date: new Date().toISOString().split('T')[0],
    entreprise: prestataireData.entreprise,
    region,
    grappe: String(grappe),
    nbMenages: menagesData.length,
    montant: '',
    prestataireData,
    grappesData: [{ region, grappe: String(grappe), nbMenages: menagesData.length }],
    includeAnnexes: true
  });
  files['01_Contrat.docx'] = new Uint8Array(await contratBlob.arrayBuffer());
  
  // Liste ménages standard
  const listeBody = buildListeMenagesGpsXml(lot, region, grappe, menagesData, gpsData);
  const listeBlob = await generateDocxBlob(listeBody);
  files['02_Liste_Menages.docx'] = new Uint8Array(await listeBlob.arrayBuffer());
  
  // Fiches de suivi standard
  const relevantFiches = FICHE_DEFS.filter(f => f.lot === lot || f.lot === '');
  for (const fiche of relevantFiches) {
    const emptyEntry: FicheEntry = {
      id: `${fiche.id}_${region}_${grappe}_0`,
      ficheId: fiche.id,
      data: {
        region,
        grappe: String(grappe),
        date: new Date().toISOString().split('T')[0],
        prestataire: prestataireData.entreprise,
        ...(lot === 'A' ? { equipe: 'Équipe A' } : {}),
        ...(lot === 'B' ? { equipe: 'Équipe B' } : {}),
        ...(lot === 'C' ? { equipe: 'Équipe C' } : {}),
      }
    };
    
    const ficheBody = buildFicheBodyXml(fiche, emptyEntry, 0);
    const ficheBlob = await generateDocxBlob(ficheBody);
    files['03_Fiches_Suivi/' + fiche.id + '_' + fiche.title.replace(/\s+/g, '_') + '.docx'] = new Uint8Array(await ficheBlob.arrayBuffer());
  }
  
  const zipped = fflate.zipSync(files, { level: 6 });
  
  return new Blob([zipped], { type: 'application/zip' });
}
