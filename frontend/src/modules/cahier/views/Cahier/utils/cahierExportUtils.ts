import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun, BorderStyle, Header, Footer, ImageRun, SectionType, PageNumber, Table, TableRow, TableCell, WidthType, VerticalAlign, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { isContractHeading, isStrategyHeading } from './cahierUtils';
import type { OperationalStrategyTemplate } from '@/data/operationalStrategyTemplates';
import { fetchImageCached } from '../../../../../utils/word_engine/utils/imageLoader';

const COLORS = {
  primary: '1E3A5F',
  secondary: '2C5282',
  body: '2D3748',
  muted: '718096',
  tableHeader: 'E2E8F0',
  tableBorder: 'CBD5E0',
};

type DocLineType = 'heading' | 'article' | 'bullet' | 'signature' | 'intro' | 'paragraph' | 'subheading';

function classifyLine(line: string, index: number, totalLines: number): DocLineType {
  const t = line.trim();
  if (!t) return 'paragraph';

  // HEADINGS (contract headings or first line if short)
  if (isContractHeading(t) || isStrategyHeading(t)) return 'heading';
  if (index === 0 && t.length < 80) return 'heading';

  // SIGNATURES
  if (
    /^(Pour (Proquelec|le Prestataire|le Client|le Fournisseur|le Directeur|le Coordonnateur)|LE PRESTATAIRE|LE CLIENT|LE FOURNISSEUR|LE DIRECTEUR|LE COORDONNATEUR|Titre ou Fonction|Téléphone|Email|Fait à)/i.test(t)
  ) return 'signature';

  // ARTICLES
  if (/^Article\s+\d+/i.test(t)) return 'article';

  // SUBHEADINGS (numérotation simple 1., 2., etc.)
  if (/^\d+\.\s+[A-Z]/.test(t)) return 'subheading';

  // BULLETS EXPLICITES (marqueurs visuels)
  if (/^(-|•|\*)\s+/.test(t)) return 'bullet';

  // BULLETS IMPLICITES (se termine par ;)
  if (/;\s*$/.test(t)) return 'bullet';

  // INTRO (très limité - exclude articles)
  if (
    t.endsWith(':') &&
    t.length > 20 &&
    !/^Article\s+\d+/i.test(t) &&
    !isContractHeading(t)
  ) return 'intro';

  return 'paragraph';
}

// ── Table detection ──────────────────────────────────────────────────
const PIPE = /\|/;
const SIGNATURE_2COL_RE = /Représentant|Signature|LE PRESTATAIRE|PROQUELEC\s*\|/i;

function pipeCount(line: string): number {
  return (line.match(/\|/g) || []).length;
}

function isTableLine(line: string): boolean {
  if (!PIPE.test(line)) return false;
  const cnt = pipeCount(line);
  if (cnt < 2) return false;               // need ≥ 2 pipes = ≥ 3 columns
  if (SIGNATURE_2COL_RE.test(line)) return false;
  return true;
}

function looksLikeTableHeader(line: string): boolean {
  const cells = line.split('|').map(c => c.trim());
  return cells.some(c => /Matériel|Prestation|Travaux|Essai|Bordereau|Qté|Conforme|Observation|Source|Description/i.test(c));
}

function parsePipeRow(line: string): string[] {
  return line.split('|').map(c => c.trim());
}

function buildWordTable(rows: string[][]): Table {
  const colCount = rows[0].length;
  const totalWidth = 9000;
  const colWidth = Math.floor(totalWidth / colCount);

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidth),
    rows: rows.map((row, rowIdx) => {
      const isHeader = rowIdx === 0;
      return new TableRow({
        tableHeader: isHeader,
        children: row.map(cell => new TableCell({
          width: { size: colWidth, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          shading: isHeader
            ? { fill: COLORS.tableHeader, type: ShadingType.CLEAR, color: 'auto' }
            : undefined,
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
            left:   { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
            right:  { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
          },
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: cell,
                  bold: isHeader,
                  size: isHeader ? 20 : 19,
                  color: isHeader ? COLORS.primary : COLORS.body,
                }),
              ],
            }),
          ],
        })),
      });
    }),
  });
}

// Group consecutive table lines into blocks of rows
function groupTableLines(lines: string[]): (string[][])[] {
  const blocks: string[][][] = [];
  let current: string[][] | null = null;

  for (const line of lines) {
    if (isTableLine(line)) {
      const cells = parsePipeRow(line);
      if (!current) {
        current = [cells];
      } else {
        current.push(cells);
      }
    } else {
      if (current && current.length >= 2) {
        blocks.push(current);
      }
      current = null;
    }
  }
  if (current && current.length >= 2) blocks.push(current);
  return blocks;
}

function buildContractSection(lotName: string, lines: string[]) {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({ text: `PROQUELEC - ${lotName}`, bold: true, size: 34, color: COLORS.primary }),
    ],
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    border: { bottom: { color: COLORS.primary, size: 6, space: 1, style: BorderStyle.SINGLE } },
    children: [
      new TextRun({ text: '', size: 1 }),
    ],
  }));

  // ── Pre-scan: identify table blocks ────────────────────────────────
  const trimmedLines = lines.map(l => l.trim().replace(/^•[\s•]*/, '').trim());
  const tableGroups = groupTableLines(trimmedLines);
  const tableLineSet = new Set<string>();
  for (const group of tableGroups) {
    for (const row of group) {
      tableLineSet.add(row.join('|'));
    }
  }
  // Build a map: first-pipe-line → group, so we can detect the start
  const tableGroupMap = new Map<string, string[][]>();
  for (const group of tableGroups) {
    tableGroupMap.set(group[0].join('|'), group);
  }

  let i = 0;
  while (i < trimmedLines.length) {
    const trimmed = trimmedLines[i];
    if (!trimmed) { i++; continue; }

    // ── Check if this line is part of a table ──
    const key = trimmed.split('|').map(c => c.trim()).join('|');
    const group = tableGroupMap.get(key);
    if (group) {
      // Render the table
      children.push(buildWordTable(group));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      i += group.length;
      continue;
    }

    // ── Skip lines already consumed by a table group ──
    if (tableLineSet.has(key)) { i++; continue; }

    // ── Normal paragraph rendering ──
    const type = classifyLine(trimmed, i, trimmedLines.length);

    switch (type) {
      case 'heading':
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: i === 0 ? 0 : 80, after: i === 2 ? 200 : 80 },
          children: [
            new TextRun({ text: trimmed, bold: true, size: i === 0 ? 30 : 28, color: COLORS.primary }),
          ],
        }));
        break;

      case 'article':
        children.push(new Paragraph({
          spacing: { before: 360, after: 120 },
          border: { top: { color: COLORS.primary, size: 2, space: 1, style: BorderStyle.SINGLE } },
          children: [
            new TextRun({ text: trimmed, bold: true, size: 28, color: COLORS.primary }),
          ],
        }));
        break;

      case 'subheading':
        children.push(new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({ text: trimmed, bold: true, size: 26, color: COLORS.secondary }),
          ],
        }));
        break;

      case 'bullet':
        children.push(new Paragraph({
          bullet: { level: 0 },
          indent: { left: 720, hanging: 360 },
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: trimmed, size: 26, color: COLORS.body }),
          ],
        }));
        break;

      case 'intro':
        children.push(new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({ text: trimmed, bold: true, italics: true, size: 26, color: COLORS.body }),
          ],
        }));
        break;

      case 'signature':
        children.push(new Paragraph({
          spacing: { before: trimmed.startsWith('Pour') ? 200 : 60, after: 40 },
          children: [
            new TextRun({ text: trimmed, bold: /^(Pour|LE PRESTATAIRE)/i.test(trimmed), size: 26, color: COLORS.primary }),
          ],
        }));
        break;

      default:
        children.push(new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: trimmed, size: 26, color: COLORS.body }),
          ],
        }));
    }
    i++;
  }

  return {
    properties: {
      page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
    },
    children,
  };
}

const createContractHeader = (enteteBuffer: ArrayBuffer | null) => new Header({
  children: [
    ...(enteteBuffer ? [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new ImageRun({
            data: enteteBuffer,
            transformation: { width: 617, height: 90 },
            type: 'png',
          }),
        ],
      }),
    ] : []),
  ],
});

const createContractFooter = () => new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.muted } },
      children: [
        new TextRun({ text: 'Document confidentiel PROQUELEC — Page ', size: 18, color: COLORS.muted }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLORS.muted }),
        new TextRun({ text: ' sur ', size: 18, color: COLORS.muted }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLORS.muted }),
      ],
    }),
  ],
});

export async function exportContractToWord(
  lots: { lotName: string; content: string | string[] }[]
) {
  const enteteBuffer = await fetchImageCached('/entete.png');

  const doc = new Document({
    creator: 'GED OS',
    title: lots.length === 1 ? `Contrat ${lots[0].lotName}` : 'Contrats LOTS',
    sections: lots.map(({ lotName, content }) => {
      const lines = typeof content === 'string'
        ? content.split('\n').map(l => l.trim()).filter(Boolean)
        : content;
      const section = buildContractSection(lotName, lines);
      return {
        ...section,
        properties: {
          ...section.properties,
          type: SectionType.NEXT_PAGE,
        },
        headers: { default: createContractHeader(enteteBuffer) },
        footers: { default: createContractFooter() },
      };
    }),
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, lots.length === 1
    ? `Contrat_${lots[0].lotName.replace(/\s+/g, '_')}.docx`
    : 'Contrats_LOTS_A_B_C.docx');
}

export async function exportStrategyToWord(
  strategy: OperationalStrategyTemplate,
  customContent?: string
) {
  const enteteBuffer = await fetchImageCached('/entete.png');
  const lines = customContent 
    ? customContent.split('\n').map(l => l.trim()).filter(Boolean)
    : strategy.content;

  const doc = new Document({
    creator: 'GED OS',
    title: strategy.title,
    subject: 'Stratégie Opérationnelle',
    keywords: 'PROQUELEC, GED OS, stratégie, projet',
    sections: [
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        headers: { default: createContractHeader(enteteBuffer) },
        footers: { default: createContractFooter() },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'PROQUELEC', bold: true, size: 34, color: COLORS.primary }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [
              new TextRun({ text: strategy.title, bold: true, size: 26, color: COLORS.primary }),
            ],
          }),
          ...lines.map((line, index) => {
            const trimmed = line.trim();
            const isTitle = index === 0;
            const isHeading = isTitle
              || isStrategyHeading(trimmed)
              || /^\d+\./.test(trimmed)
              || /^[IVX]+\./.test(trimmed)
              || /^(Chapitre|Section|Annexe)/i.test(trimmed);
            return new Paragraph({
              heading: isTitle ? HeadingLevel.HEADING_1 : undefined,
              alignment: isTitle ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: isHeading ? 220 : 60, after: isHeading ? 120 : 80 },
              children: [
                new TextRun({
                  text: trimmed,
                  bold: isHeading,
                  size: isTitle ? 30 : isHeading ? 28 : 26,
                  color: isHeading ? COLORS.primary : COLORS.body,
                }),
              ],
            });
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'Strategie_operationnelle_projet_LSE.docx');
}
