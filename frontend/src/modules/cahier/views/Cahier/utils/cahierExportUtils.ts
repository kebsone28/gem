import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun, BorderStyle, Header, Footer, ImageRun, SectionType } from 'docx';
import { saveAs } from 'file-saver';
import { isContractHeading, isStrategyHeading } from './cahierUtils';
import type { OperationalStrategyTemplate } from '@/data/operationalStrategyTemplates';
import { fetchImageCached } from '../../../../../utils/word_engine/utils/imageLoader';

const COLORS = {
  primary: '1E3A5F',
  secondary: '2C5282',
  body: '2D3748',
  muted: '718096',
};

function isBulletItem(line: string): boolean {
  const t = line.trim();
  if (t.length < 10 || t.length > 250) return false;
  if (isContractHeading(t)) return false;
  if (/^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ\s\d-]+$/.test(t) && t.length > 5) return false;
  if (/^(Entre les|Il a été|Pour Proquelec|Pour le Prestataire|Fait à|LE PRESTATAIRE|PROQUELEC)/i.test(t)) return false;
  return (
    /^[A-Z][a-zéèêëàâäùûüôöîïç]{2,} : /.test(t) ||
    /^(Montage|Câblage|Serrage|Test|Marquage|Préparation|Déroulement|Copie|Copies|Liste|Attestation|Assurer|Respecter|Renseigner|Informer|Vérifier|Maintenir|Payer|Porter|Fournir|Les kits|Accessoires|Appareillage|Rouleau|Câble|Kit|Coffret|Objectif|Équipe|Lieu d'exécution)/i.test(t)
  );
}

function isIntroLine(line: string): boolean {
  const t = line.trim();
  return t.endsWith(':') && t.length > 12 && !isContractHeading(t) && t !== t.toUpperCase();
}

function isSignatureLine(line: string): boolean {
  const t = line.trim();
  return /^(Pour (Proquelec|le Prestataire|le Client|le Fournisseur|le Directeur|le Coordonnateur)|Titre ou Fonction|Téléphone|Email|Fait à|LE PRESTATAIRE|LE CLIENT|LE FOURNISSEUR|LE DIRECTEUR|LE COORDONNATEUR)/i.test(t);
}

function buildParagraph(text: string, options: {
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacingBefore?: number;
  spacingAfter?: number;
  indentLeft?: number;
  isBullet?: boolean;
}) {
  const { bold, italic, size, color, alignment, spacingBefore, spacingAfter, indentLeft, isBullet } = options;
  const children: import('docx').TextRun[] = [];

  children.push(new TextRun({ text, bold, italic, size: size || 26, color: color || COLORS.body }));

  return new Paragraph({
    alignment,
    bullet: isBullet ? { level: 0 } : undefined,
    spacing: { before: spacingBefore || 60, after: spacingAfter || 60 },
    indent: indentLeft ? { left: indentLeft, hanging: isBullet ? 360 : undefined } : undefined,
    children,
  });
}

function buildContractSection(lotName: string, lines: string[]) {
  const children: import('docx').Paragraph[] = [];

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

  for (let i = 0; i < lines.length; i++) {
    let trimmed = lines[i].trim();
    if (!trimmed) continue;
    trimmed = trimmed.replace(/^•[\s•]*/, '').trim();

    const isTitle = i <= 2;
    const isArticleHeading = /^Article\s+\d+/i.test(trimmed);
    const isSubHeading = /^\d+\.\d/.test(trimmed);
    const isAllCaps = /^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ\s\d-]+$/.test(trimmed) && trimmed.length > 5;
    const isBullet = isBulletItem(trimmed);
    const isIntro = isIntroLine(trimmed);
    const isSignature = isSignatureLine(trimmed);

    if (isTitle) {
      children.push(buildParagraph(trimmed, {
        bold: true,
        size: i === 0 ? 30 : 28,
        color: COLORS.primary,
        alignment: AlignmentType.CENTER,
        spacingBefore: i === 0 ? 0 : 80,
        spacingAfter: i === 2 ? 200 : 80,
      }));
    } else if (isArticleHeading) {
      children.push(new Paragraph({
        spacing: { before: 360, after: 120 },
        border: { top: { color: COLORS.primary, size: 2, space: 1, style: BorderStyle.SINGLE } },
        children: [
          new TextRun({ text: trimmed, bold: true, size: 28, color: COLORS.primary }),
        ],
      }));
    } else if (isSubHeading) {
      children.push(buildParagraph(trimmed, {
        bold: true,
        size: 26,
        color: COLORS.secondary,
        spacingBefore: 200,
        spacingAfter: 80,
      }));
    } else if (isAllCaps) {
      children.push(buildParagraph(trimmed, {
        bold: true,
        size: 26,
        color: COLORS.secondary,
        spacingBefore: 240,
        spacingAfter: 100,
      }));
    } else if (isBullet) {
      children.push(buildParagraph(trimmed, {
        size: 26,
        color: COLORS.body,
        spacingBefore: 40,
        spacingAfter: 40,
        indentLeft: 720,
        isBullet: true,
      }));
    } else if (isIntro) {
      children.push(buildParagraph(trimmed, {
        bold: true,
        italic: true,
        size: 26,
        color: COLORS.body,
        spacingBefore: 160,
        spacingAfter: 80,
      }));
    } else if (isSignature) {
      children.push(buildParagraph(trimmed, {
        bold: /^(Pour|LE PRESTATAIRE)/i.test(trimmed),
        size: 26,
        color: COLORS.primary,
        spacingBefore: trimmed.startsWith('Pour') ? 200 : 60,
        spacingAfter: 40,
      }));
    } else {
      children.push(buildParagraph(trimmed, {
        size: 26,
        color: COLORS.body,
        spacingBefore: 60,
        spacingAfter: 60,
      }));
    }
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
        new TextRun({ children: ['PAGE_NUMBER'], field: 'PAGE_NUMBER', size: 18, color: COLORS.muted }),
        new TextRun({ text: ' sur ', size: 18, color: COLORS.muted }),
        new TextRun({ children: ['NUMPAGES'], field: 'NUMPAGES', size: 18, color: COLORS.muted }),
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
