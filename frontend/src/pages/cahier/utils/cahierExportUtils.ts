import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { isContractHeading, isStrategyHeading } from './cahierUtils';
import type { OperationalStrategyTemplate } from '../../../data/operationalStrategyTemplates';

export async function exportContractToWord(
  lotName: string,
  content: string | string[]
) {
  const lines = typeof content === 'string' 
    ? content.split('\n').map(l => l.trim()).filter(Boolean)
    : content;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({ text: 'PROQUELEC', bold: true, size: 28, color: '0f172a' }),
            ],
          }),
          ...lines.map((line, index) => {
            const isTitle = index <= 2;
            const isHeading = isTitle || isContractHeading(line);
            return new Paragraph({
              heading: isTitle ? HeadingLevel.HEADING_1 : undefined,
              alignment: isTitle ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: isHeading ? 220 : 60, after: isHeading ? 120 : 80 },
              children: [
                new TextRun({
                  text: line,
                  bold: isHeading,
                  size: isTitle ? 24 : isHeading ? 22 : 20,
                  color: isHeading ? '0f172a' : '334155',
                }),
              ],
            });
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Contrat_${lotName.replace(/\s+/g, '_')}.docx`);
}

export async function exportStrategyToWord(
  strategy: OperationalStrategyTemplate,
  customContent?: string
) {
  const lines = customContent 
    ? customContent.split('\n').map(l => l.trim()).filter(Boolean)
    : strategy.content;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'PROQUELEC', bold: true, size: 28, color: '0f172a' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [
              new TextRun({ text: strategy.title, bold: true, size: 26, color: '0f172a' }),
            ],
          }),
          ...lines.map((line, index) => {
            const isTitle = index === 0;
            const isHeading = isTitle || isStrategyHeading(line);
            return new Paragraph({
              heading: isTitle ? HeadingLevel.HEADING_1 : undefined,
              alignment: isTitle ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: isHeading ? 220 : 60, after: isHeading ? 120 : 80 },
              children: [
                new TextRun({
                  text: line,
                  bold: isHeading,
                  size: isTitle ? 24 : isHeading ? 22 : 20,
                  color: isHeading ? '0f172a' : '334155',
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
