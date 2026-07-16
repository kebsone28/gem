const fs = require('fs');
const path = require('path');

// Read the clean contract text
const lotA = fs.readFileSync(path.join(__dirname, 'docs/lotA.txt'), 'utf8').trim();
const lotB = fs.readFileSync(path.join(__dirname, 'docs/lotB.txt'), 'utf8').trim();
const lotC = fs.readFileSync(path.join(__dirname, 'docs/lotC.txt'), 'utf8').trim();

// Format contracts for template string (escape special characters)
function formatContract(text) {
  return text
    .replace(/`/g, '\\`')
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

const formattedLotA = formatContract(lotA);
const formattedLotB = formatContract(lotB);
const formattedLotC = formatContract(lotC);

// Create the basic structure of docxEngine.ts
const docxEngineContent = `/**
 * docxEngine.ts — Moteur de génération Docx
 * Porté depuis le fichier legacy Cartographie_Grappes_PROQUELEC_7_9.html
 * Utilise JSZip + OpenXML pour générer des .docx valides avec mise en forme riche
 */

import JSZip from 'jszip';

// ─── Constantes de couleur ───────────────────────────────────────────────────
const DOCX_NAVY = '1E3A5F';
const DOCX_GREY = '2D3748';
const DOCX_LIGHTBLUE = 'EAF1F8';

// ─── Xml Helpers ─────────────────────────────────────────────────────────────
export function xmlEscape(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Contrats complets (extraits du fichier HTML) ─────────────────────────────
const CONTRAT_LOT_A = \`${formattedLotA}\`;

const CONTRAT_LOT_B = \`${formattedLotB}\`;

const CONTRAT_LOT_C = \`${formattedLotC}\`;

// ─── Fonctions de génération des documents de dossier ───────────────────────────
// (These would need to be restored from backup or re-implemented)

// ─── Helpers de mise en forme ───────────────────────────────────────────────────
export function wText(text: string): string {
  return \`<w:p><w:r><w:t>\${xmlEscape(text)}</w:t></w:r></w:p>\`;
}

export function wHeading(text: string, level: number = 1): string {
  return \`<w:p><w:pPr><w:pStyle w:val="Heading\${level}"/></w:pPr><w:r><w:t>\${xmlEscape(text)}</w:t></w:r></w:p>\`;
}

export function wBold(text: string): string {
  return \`<w:r><w:rPr><w:b/></w:rPr><w:t>\${xmlEscape(text)}</w:t></w:r>\`;
}

// ─── Génération DOCX ───────────────────────────────────────────────────────────
export async function generateContratDocxRich(params: {
  lot: 'A' | 'B' | 'C';
  contratNumber: string;
  date: string;
  entreprise: string;
  region: string;
  grappe: string;
  nbMenages: number;
  montant: string;
}): Promise<Blob> {
  const contrat = params.lot === 'A' ? CONTRAT_LOT_A : params.lot === 'B' ? CONTRAT_LOT_B : CONTRAT_LOT_C;
  
  let content = contrat;
  // Replace placeholders
  content = content.replace(/\\[Nom de l'entreprise Prestataire\\]/g, params.entreprise);
  content = content.replace(/\\[Forme juridique et adresse du Prestataire\\]/g, params.entreprise);
  content = content.replace(/N°: Proq-AO11-2022-LotA-001/g, params.contratNumber);
  content = content.replace(/N°: Proq-AO11-2022-LotB-001/g, params.contratNumber);
  content = content.replace(/N°: Proq-AO11-2022-LotC-001/g, params.contratNumber);
  content = content.replace(/Kaffrine et Tambacounda/g, params.region);
  content = content.replace(/………………… FCFA/g, params.montant);
  
  const zip = new JSZip();
  
  // Basic DOCX structure
  zip.file('[Content_Types].xml', \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>\`);
  
  zip.file('_rels/.rels', \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>\`);
  
  zip.file('word/_rels/document.xml.rels', \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>\`);
  
  // Generate document body from content
  const bodyParts = content.split('\\\\n').map(line => {
    if (line.startsWith('Article') || line.match(/^\\d+\\./)) {
      return wHeading(line, 2);
    } else if (line.startsWith('Titre')) {
      return wHeading(line.replace('Titre ', ''), 1);
    } else {
      return wText(line);
    }
  });
  
  const bodyXml = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    \${bodyParts.join('')}
  </w:body>
</w:document>\`;
  
  zip.file('word/document.xml', bodyXml);
  
  // Basic styles
  zip.file('word/styles.xml', \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>\`);
  
  return zip.generateAsync({ type: 'blob', compression: 'Deflate', compressionOptions: { level: 6 } });
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
}): Promise<void> {
  const blob = await generateContratDocxRich(params);
  const filename = \`Contrat_Lot\${params.lot}_\${params.region}_\${params.grappe}_\${params.entreprise.replace(/\\s+/g, '_')}.docx\`;
  triggerDownload(blob, filename);
}
`;

fs.writeFileSync(path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts'), docxEngineContent, 'utf8');

console.log('Manually restored docxEngine.ts with basic structure and clean contracts');
