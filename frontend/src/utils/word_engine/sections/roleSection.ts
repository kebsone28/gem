// src/utils/word_engine/sections/roleSection.ts
import {
  Paragraph,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  TextRun,
  ShadingType,
  VerticalAlign,
  BorderStyle,
  HeadingLevel,
} from 'docx';
import { COLORS, createText, createSectionHeader, noBorder } from '../utils/styles';
import { fetchImageCached } from '../utils/imageLoader';

export const createRoleSection = async (data: any, qrBuffer?: ArrayBuffer | null) => {
  const {
    role,
    introduction,
    missions,
    materials,
    hse,
    subcontracting,
    finances,
    legal,
    responsible,
    imagePath,
    technicalImages,
    startDate,
    endDate,
    pricing,
  } = data;

  const children: any[] = [];

  // 1. Metadata Header Table
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [
        createText(`BORDEREAU DÉTAILLÉ DU LOT : ${role.toUpperCase()}`, {
          bold: true,
          size: 32,
          color: COLORS.SECONDARY,
        }),
      ],
      spacing: { after: 300, before: 400 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: COLORS.BG_LIGHT },
              children: [
                new Paragraph({ children: [createText('RESPONSABLE', { bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [createText(responsible || 'Non assigné', { size: 18 })],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: COLORS.BG_LIGHT },
              children: [
                new Paragraph({ children: [createText('PÉRIODE', { bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [createText(`${startDate} au ${endDate}`, { size: 18 })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { before: 200, after: 200 } })
  );

  // 2. Main Hero Image
  if (imagePath) {
    const buffer = await fetchImageCached(imagePath);
    if (buffer) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: buffer,
              transformation: { width: 450, height: 300 },
            } as any),
          ],
          spacing: { after: 400, before: 200 },
        })
      );
    }
  }

  // 3. Technical Gallery
  if (technicalImages && technicalImages.length > 0) {
    children.push(createSectionHeader('Standards & Schémas Techniques', COLORS.SUCCESS));
    const imageBuffers = await Promise.all(
      technicalImages.map((img: any) => fetchImageCached(img.url))
    );
    const rows: TableRow[] = [];
    for (let i = 0; i < technicalImages.length; i += 2) {
      const cells: TableCell[] = [];
      [i, i + 1].forEach((idx) => {
        const img = technicalImages[idx];
        const buf = imageBuffers[idx];
        if (img) {
          cells.push(
            new TableCell({
              borders: noBorder,
              children: [
                ...(buf
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new ImageRun({
                            data: buf,
                            transformation: { width: 230, height: 160 },
                          } as any),
                        ],
                      }),
                    ]
                  : []),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    createText(img.label.toUpperCase(), {
                      bold: true,
                      size: 14,
                      color: COLORS.SUCCESS,
                    }),
                  ],
                  spacing: { before: 100, after: 200 },
                }),
              ],
            })
          );
        } else {
          cells.push(new TableCell({ children: [], borders: noBorder }));
        }
      });
      rows.push(new TableRow({ children: cells }));
    }
    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorder, rows })
    );
  }

  // 4. Content Sections
  const addListSection = (title: string, items: string[], color: string) => {
    if (!items || items.length === 0) return;
    children.push(createSectionHeader(title, color));
    items.forEach((item) => {
      children.push(
        new Paragraph({
          children: [createText(`• ${item}`, { size: 20 })],
          spacing: { before: 100 },
          indent: { left: 240 },
        })
      );
    });
  };

  children.push(createSectionHeader('1. Objet et Obligations', COLORS.SECONDARY));
  children.push(
    new Paragraph({
      children: [createText(introduction, { italics: true })],
      spacing: { before: 100, after: 200 },
    })
  );

  addListSection('2. Missions et Tâches', missions, COLORS.PRIMARY);
  addListSection('3. Matériels et Logistique', materials, COLORS.ACCENT);
  addListSection('4. Hygiène, Sécurité et Environnement (HSE)', hse, COLORS.DANGER);
  addListSection('5. Sous-traitance', subcontracting, COLORS.SLATE);
  addListSection('6. Finances et Paiements', finances, COLORS.SUCCESS);
  addListSection('7. Juridique', legal, COLORS.SECONDARY);

  // 5. Pricing Table
  if (pricing) {
    children.push(createSectionHeader('8. Bordereau de Prix Unitaire', COLORS.PRIMARY));
    const safeRate = Number(pricing.dailyRate) || 0;
    const safeCount = Number(pricing.personnelCount) || 0;
    const safeDuration = Number(pricing.durationDays) || 0;

    const totalHT = safeRate * safeCount * safeDuration;
    const tva = totalHT * 0.18;
    const totalTTC = totalHT + tva;

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: ['Désignation', 'Qté', 'Durée', 'P.U', 'TOTAL HT'].map(
              (h) =>
                new TableCell({
                  shading: { fill: COLORS.BG_LIGHT },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [createText(h, { bold: true, color: COLORS.SECONDARY })],
                    }),
                  ],
                })
            ),
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [createText(role)] })] }),
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [createText(pricing.personnelCount.toString())],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [createText(pricing.durationDays.toString())],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [createText(pricing.dailyRate.toLocaleString())],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: COLORS.PRIMARY },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      createText(totalHT.toLocaleString(), { bold: true, color: COLORS.WHITE }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          createText('TOTAL HT : ', { bold: true }),
          createText(`${totalHT.toLocaleString()} ${pricing.currency}`, { color: COLORS.SLATE }),
          new TextRun({ text: '\n' }),
          createText('TVA (18%) : ', { bold: true }),
          createText(`${tva.toLocaleString()} ${pricing.currency}`, { color: COLORS.SLATE }),
          new TextRun({ text: '\n' }),
          createText('MONTANT GLOBAL TTC : ', { bold: true, size: 28 }),
          createText(`${totalTTC.toLocaleString()} ${pricing.currency}`, {
            bold: true,
            size: 32,
            color: COLORS.PRIMARY,
          }),
        ],
        spacing: { before: 300, after: 400 },
      })
    );
  }

  // 6. Quality Checklist
  children.push(createSectionHeader('Vérification Terrain', COLORS.SLATE));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ['RÉFÉRENCE', 'STATUT', 'OBSERVATIONS'].map(
            (h) =>
              new TableCell({
                shading: { fill: COLORS.BG_LIGHT },
                children: [new Paragraph({ children: [createText(h, { bold: true })] })],
              })
          ),
        }),
        ...[
          'Conformité dosages',
          'Verticalité supports',
          'Protection câbles',
          'Nettoyage site',
        ].map(
          (item) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [createText(item)] })] }),
                new TableCell({
                  children: [
                    new Paragraph({ children: [createText('[ ] OK [ ] NOK', { size: 16 })] }),
                  ],
                }),
                new TableCell({
                  children: [new Paragraph({ children: [createText('________________')] })],
                }),
              ],
            })
        ),
      ],
    })
  );

  // 7. QR Code for Site Traceability (Moved from Front Page)
  if (qrBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [
          new ImageRun({
            data: qrBuffer,
            transformation: { width: 100, height: 100 },
          } as any),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          createText('SCANNEZ POUR VÉRIFIER LA CONFORMITÉ NUMÉRIQUE DU LOT', {
            size: 12,
            color: COLORS.SLATE,
            bold: true,
          }),
        ],
      })
    );
  }

  return children;
};
