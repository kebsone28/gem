 
// src/utils/exportWord/sections/generalSection.ts
import {
  Paragraph,
  PageBreak,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  TextRun,
} from 'docx';
import { COLORS, createText } from '../utils/styles';

export const createGeneralSection = (clauses: string[]): Paragraph[] => {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [
        createText('ANNEXE 0 : DISPOSITIONS GÉNÉRALES DU MARCHÉ', {
          bold: true,
          size: 28,
          color: COLORS.SECONDARY,
        }),
      ],
      spacing: { before: 400, after: 400 },
    }),
    new Paragraph({ text: '', spacing: { after: 200 } }),
  ];

  clauses.forEach((clause) => {
    const [title, content] = clause.includes(':') ? clause.split(':', 2) : ['', clause];
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title ? `${title.trim()} : ` : '',
            bold: true,
            color: COLORS.SECONDARY,
            size: 20,
          }),
          new TextRun({
            text: content.trim(),
            size: 20,
          }),
        ],
        border: {
          left: { color: COLORS.SECONDARY, size: 12, space: 10, style: BorderStyle.SINGLE },
        },
        indent: { left: 400 },
        spacing: { before: 200, after: 200, line: 360 },
      })
    );
  });

  children.push(new Paragraph({ children: [new PageBreak()] }));
  return children;
};
