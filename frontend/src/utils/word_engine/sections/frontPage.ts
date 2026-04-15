// src/utils/exportWord/sections/frontPage.ts
import {
  Paragraph,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
} from 'docx';
import { COLORS, createText } from '../utils/styles';

export const createFrontPage = (title: string) => {
  return [
    new Paragraph({ text: '', spacing: { before: 2000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [createText('PROQUELEC', { bold: true, size: 28, color: COLORS.SECONDARY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        createText('Promotion de la Qualité des installations électriques intérieures', {
          italics: true,
          size: 20,
          color: COLORS.SLATE,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        createText('__________________________________________________________________', {
          color: COLORS.BORDER,
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { before: 1000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        createText('CAHIER DES CHARGES OPÉRATIONNEL', {
          bold: true,
          size: 48,
          color: COLORS.PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        createText("PROJET D'ÉLECTRIFICATION RURALE & CONTRATS DE PERFORMANCE", {
          size: 24,
          color: COLORS.SECONDARY,
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { before: 1500 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [createText(title.toUpperCase(), { bold: true, size: 72, color: COLORS.PRIMARY })],
      border: {
        top: { style: BorderStyle.DOUBLE, size: 18, color: COLORS.PRIMARY, space: 15 },
        bottom: { style: BorderStyle.DOUBLE, size: 18, color: COLORS.PRIMARY, space: 15 },
      },
      spacing: { before: 600, after: 600 },
    }),
    new Paragraph({ text: '', spacing: { before: 3000 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    createText('Généré par : ', { bold: true }),
                    createText('Système GEM-PROQUELEC'),
                  ],
                }),
                new Paragraph({
                  children: [
                    createText('Date : ', { bold: true }),
                    createText(new Date().toLocaleDateString('fr-FR')),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [createText('VERSION : 1.0.0', { bold: true, color: COLORS.SUCCESS })],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [createText('DOCUMENT CONTRACTUEL', { color: COLORS.SLATE, size: 14 })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
};
