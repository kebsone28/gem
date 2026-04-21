/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/missionOrderWordGenerator.ts
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  ImageRun,
  WidthType,
  Footer,
  PageNumber,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  PageBreak,
} from 'docx';
import type { MissionOrderData } from '../pages/mission/core/missionTypes';
import QRCode from 'qrcode';
import logger from '../utils/logger';

// PROQUELEC Design System
const COLORS = {
  PRIMARY: '2563eb', // Blue 600
  SECONDARY: '1e1b4b', // Indigo 950
  ACCENT: 'f97316', // Orange 500
  SUCCESS: '059669', // Emerald 600
  DANGER: 'dc2626', // Red 600
  SLATE: '475569', // Slate 600
  BORDER: 'cbd5e1', // Slate 300
  WHITE: 'FFFFFF',
  BG_LIGHT: 'F8FAFC',
};

const formatCurrency = (n: number): string => {
  return n.toLocaleString('fr-FR') + ' FCFA';
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _fetchImageAsArrayBuffer = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const response = await fetch(url);
    if (response.ok) return await response.arrayBuffer();
  } catch {
    logger.error(`Could not load image from ${url}`);
  }
  return null;
};

const createSectionHeader = (text: string, color: string) => {
  return new Paragraph({
    shading: {
      fill: color,
      type: ShadingType.SOLID,
      color: 'auto',
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22,
        color: COLORS.WHITE,
      }),
    ],
    spacing: { before: 300, after: 150 },
    indent: { left: 144 },
  });
};

const createFrontPage = (orderNumber: string, purpose: string) => {
  return [
    new Paragraph({ text: '', spacing: { before: 2000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'RÉPUBLIQUE DU SÉNÉGAL',
          bold: true,
          size: 28,
          color: COLORS.SECONDARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Un Peuple - Un But - Une Foi',
          italics: true,
          size: 20,
          color: COLORS.SLATE,
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { before: 1000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'ORDRE DE MISSION OFFICIEL',
          bold: true,
          size: 48,
          color: COLORS.PRIMARY,
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { before: 1500 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `N° ${orderNumber}`,
          bold: true,
          size: 72,
          color: COLORS.ACCENT,
        }),
      ],
      border: {
        top: { style: BorderStyle.SINGLE, size: 12, color: COLORS.ACCENT, space: 10 },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.ACCENT, space: 10 },
      },
      spacing: { before: 400, after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: purpose.toUpperCase(),
          bold: true,
          size: 28,
          color: COLORS.SECONDARY,
        }),
      ],
      spacing: { before: 500 },
    }),
    new Paragraph({ text: '', spacing: { before: 3000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Généré numériquement par GEM-SAAS PROQUELEC',
          size: 16,
          italics: true,
          color: COLORS.SLATE,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
};

export const generateMissionOrderWord = async (data: MissionOrderData) => {
  const validationUrl = `${window.location.origin}/verify/mission/${data.orderNumber || data.id}`;

  let qrData: ArrayBuffer | null = null;
  try {
    const qrDataUrl = await QRCode.toDataURL(validationUrl, { margin: 1, width: 200 });
    const base64Data = qrDataUrl.split(',')[1];
    qrData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;
  } catch (err) {
    logger.error('QR Code generation failed for Word', err);
  }

  const sections: any[] = [];

  // 1. Front Page
  sections.push({
    children: createFrontPage(data.orderNumber, data.purpose),
  });

  // 2. Main Mission Order Page
  const mainChildren: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        qrData
          ? new ImageRun({ data: qrData, transformation: { width: 70, height: 70 } } as any)
          : new TextRun(''),
      ],
    }),
    new Paragraph({
      text: "DÉCISION D'ORDRE DE MISSION",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 300 },
    }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: COLORS.BG_LIGHT },
              children: [
                new Paragraph({ children: [new TextRun({ text: 'RÉFERENCE', bold: true })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: data.orderNumber, bold: true, color: COLORS.PRIMARY }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { fill: COLORS.BG_LIGHT },
              children: [
                new Paragraph({ children: [new TextRun({ text: 'DATE ÉMISSION', bold: true })] }),
              ],
            }),
            new TableCell({ children: [new Paragraph({ text: data.date })] }),
          ],
        }),
      ],
    }),

    createSectionHeader('I. PERSONNEL AUTORISÉ', COLORS.SECONDARY),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: COLORS.SECONDARY },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Noms & Prénoms', color: COLORS.WHITE, bold: true }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              shading: { fill: COLORS.SECONDARY },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Fonction', color: COLORS.WHITE, bold: true })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              shading: { fill: COLORS.SECONDARY },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Unité', color: COLORS.WHITE, bold: true })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
        ...data.members.map(
          (m) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: m.name })],
                  margins: { left: 100, top: 100, bottom: 100 },
                }),
                new TableCell({
                  children: [new Paragraph({ text: m.role })],
                  margins: { left: 100, top: 100, bottom: 100 },
                }),
                new TableCell({
                  children: [new Paragraph({ text: m.unit, alignment: AlignmentType.CENTER })],
                }),
              ],
            })
        ),
      ],
    }),

    createSectionHeader('II. ITINÉRAIRE ET LOGISTIQUE', COLORS.PRIMARY),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        ['DESTINATION / RÉGION', data.region],
        ['DÉPART PRÉVU', data.startDate],
        ['RETOUR PRÉVU', data.endDate],
        ['ITINÉRAIRE ALLER', data.itineraryAller],
        ['ITINÉRAIRE RETOUR', data.itineraryRetour],
        ['MOYEN DE TRANSPORT', data.transport],
      ].map(
        (row) =>
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.BG_LIGHT },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: row[0], bold: true, size: 18 })],
                  }),
                ],
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ text: row[1] })],
                width: { size: 70, type: WidthType.PERCENTAGE },
                margins: { left: 100 },
              }),
            ],
          })
      ),
    }),

    createSectionHeader('III. SIGNATURES OFFICIELLES', COLORS.SLATE),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          height: { value: 1500, rule: 'atLeast' },
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'LE DIRECTEUR GÉNÉRAL', bold: true })],
                }),
                new Paragraph({ text: '', spacing: { before: 800 } }),
                ...(data.signatureImage
                  ? (() => {
                      try {
                        return [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new ImageRun({
                                data: Uint8Array.from(
                                  atob(data.signatureImage.split(',')[1]),
                                  (c) => c.charCodeAt(0)
                                ),
                                transformation: { width: 120, height: 60 },
                              } as any),
                            ],
                          }),
                        ];
                      } catch {
                        return [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            text: '(Signature Électronique)',
                          }),
                        ];
                      }
                    })()
                  : data.isCertified
                    ? [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: 'PROQUELEC - DIRECTION GÉNÉRALE',
                              size: 16,
                              color: COLORS.DANGER,
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: 'VU ET APPROUVÉ',
                              size: 20,
                              bold: true,
                              color: COLORS.DANGER,
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: 'Signature numérique certifiée',
                              size: 14,
                              italics: true,
                              color: COLORS.DANGER,
                            }),
                          ],
                        }),
                      ]
                    : [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          text: '(Signature Électronique)',
                        }),
                      ]),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'VISA POUR CERTIFICATION', bold: true })],
                }),
                new Paragraph({ text: '', spacing: { before: 1000 } }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: 'Gendarmerie / Autorité Locale', italics: true, size: 16 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  sections.push({
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Ordre de Mission Certifié PROQUELEC - Page ',
                size: 16,
                color: COLORS.SLATE,
              }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
              new TextRun({ text: ' / ', size: 16 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 }),
            ],
          }),
        ],
      }),
    },
    children: mainChildren as (Paragraph | Table | PageBreak)[],
  });

  // 3. Financial Breakdown Page
  const financeChildren: (Paragraph | Table)[] = [
    new Paragraph({ text: '', pageBreakBefore: true }),
    createSectionHeader('DÉCOMPTE DES FRAIS DE MISSION ESTIMATIFS', COLORS.ACCENT),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: COLORS.ACCENT },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Bénéficiaire', color: COLORS.WHITE, bold: true }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              shading: { fill: COLORS.ACCENT },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Indemnité / J', color: COLORS.WHITE, bold: true }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              shading: { fill: COLORS.ACCENT },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Jours', color: COLORS.WHITE, bold: true })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              shading: { fill: COLORS.ACCENT },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Total', color: COLORS.WHITE, bold: true })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
        ...data.members.map(
          (m) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: m.name })],
                  margins: { left: 100 },
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      text: formatCurrency(m.dailyIndemnity),
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                  margins: { right: 100 },
                }),
                new TableCell({
                  children: [
                    new Paragraph({ text: m.days.toString(), alignment: AlignmentType.CENTER }),
                  ],
                }),
                new TableCell({
                  shading: { fill: COLORS.BG_LIGHT },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: formatCurrency(m.dailyIndemnity * m.days),
                          bold: true,
                        }),
                      ],
                      alignment: AlignmentType.RIGHT,
                    }),
                  ],
                  margins: { right: 100 },
                }),
              ],
            })
        ),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'MONTANT TOTAL DES INDEMNITÉS : ', bold: true, size: 24 }),
        new TextRun({
          text: formatCurrency(data.members.reduce((s, m) => s + m.dailyIndemnity * m.days, 0)),
          bold: true,
          size: 28,
          color: COLORS.ACCENT,
        }),
      ],
      spacing: { before: 400 },
    }),
  ];
  sections[sections.length - 1].children.push(...financeChildren);

  const doc = new Document({
    creator: 'GEM-SAAS PROQUELEC',
    title: `Ordre de Mission ${data.orderNumber}`,
    sections: sections,
  });

  return await Packer.toBlob(doc);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generateMissionReportWord = async (data: any): Promise<Blob | null> => {
  try {
    const sections: any[] = [];

    if (data.reportingMode === 'narrative' && data.narrativeReport) {
      // ==========================================
      // MODE NARRATIF (Rapport Global Premium)
      // ==========================================
      const narrativeChildren: any[] = [];
      const lines = data.narrativeReport.split('\n');

      // 1. Extraction et génération du Sommaire
      const headings: { text: string; level: number }[] = [];
      lines.forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
          const level = (trimmed.match(/#/g) || []).length;
          const text = trimmed.replace(/#/g, '').replace(/\*\*/g, '').trim();
          headings.push({ text, level });
        }
      });

      if (headings.length > 0) {
        narrativeChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'SOMMAIRE', bold: true, size: 28, color: COLORS.SECONDARY }),
            ],
            spacing: { before: 200, after: 200 },
          })
        );

        headings.forEach((heading) => {
          if (heading.level > 1 && heading.level <= 3) {
            narrativeChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ 
                    text: heading.text, 
                    size: 20, 
                    bold: heading.level === 2 
                  }),
                ],
                indent: { left: heading.level === 3 ? 720 : 360 },
                spacing: { after: 100 },
              })
            );
          }
        });
        
        // Ligne de séparation sous le sommaire
        narrativeChildren.push(
          new Paragraph({
            text: '',
            border: { bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 12 } },
            spacing: { after: 400 },
          })
        );
      }

      // 2. Rendu du contenu narratif global (sans saut de page artificiel)
      lines.forEach((line: string) => {
        const trimmed = line.trim();
        
        const parseInlineBold = (text: string, defaultSize: number = 20): TextRun[] => {
          const parts = text.split('**');
          const results: TextRun[] = [];
          parts.forEach((part, index) => {
            if (part !== '') {
              results.push(new TextRun({
                text: part,
                size: defaultSize,
                bold: index % 2 === 1
              }));
            }
          });
          return results;
        };

        if (trimmed.startsWith('#')) {
          const level = (trimmed.match(/#/g) || []).length;
          const cleanText = trimmed.replace(/#/g, '').trim();
          narrativeChildren.push(
            new Paragraph({
              children: parseInlineBold(cleanText, level === 1 ? 28 : level === 2 ? 24 : 20),
              spacing: { before: 300, after: 150 },
            })
          );
        } else if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
          const cleanText = trimmed.substring(1).trim();
          narrativeChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: '• ', size: 20 }),
                ...parseInlineBold(cleanText, 20)
              ],
              spacing: { before: 50, after: 50 },
              indent: { left: 400 },
            })
          );
        } else if (trimmed) {
          narrativeChildren.push(
            new Paragraph({
              children: parseInlineBold(trimmed, 20),
              spacing: { before: 100, after: 100 },
            })
          );
        }
      });

      // 3. Observations Générales (à la suite)
      if (data.reportObservations) {
        narrativeChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'OBSERVATIONS GÉNÉRALES ET RECOMMANDATIONS', bold: true, size: 24, color: COLORS.PRIMARY }),
            ],
            spacing: { before: 400, after: 200 },
          })
        );
        narrativeChildren.push(
          new Paragraph({
            text: data.reportObservations || '',
            spacing: { after: 200 },
          })
        );
      }

      sections.push({
        properties: {},
        children: narrativeChildren,
      });

    } else {
      // ==========================================
      // MODE CLASSIC DAILY (Page de garde + Tableau)
      // ==========================================
      
      // Page de garde
      sections.push({
        properties: {},
        children: [
          new Paragraph({ text: '', spacing: { before: 2000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'RÉPUBLIQUE DU SÉNÉGAL',
                bold: true,
                size: 24,
                color: COLORS.SECONDARY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Un Peuple - Un But - Une Foi',
                italics: true,
                size: 18,
                color: COLORS.SLATE,
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 1000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'PROQUELEC',
                bold: true,
                size: 32,
                color: COLORS.PRIMARY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Plateforme d'Électrification de Masse",
                size: 18,
                color: COLORS.SLATE,
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 2000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'RAPPORT POST-MISSION',
                bold: true,
                size: 28,
                color: COLORS.DANGER,
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 500 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: data.orderNumber || 'N/A',
                bold: true,
                size: 24,
                color: COLORS.PRIMARY,
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 1000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: data.region || 'Région non définie',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Du ${data.startDate || '?'} au ${data.endDate || '?'}`,
                size: 18,
                color: COLORS.SLATE,
              }),
            ],
          }),
        ],
      });

      // Section Observations
      sections.push({
        properties: {},
        children: [
          createSectionHeader('I. OBSERVATIONS GÉNÉRALES', COLORS.PRIMARY),
          new Paragraph({
            children: [
              new TextRun({
                text: data.reportObservations || 'Aucune observation enregistrée.',
                size: 20,
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
        ],
      });

      // Section Rapports journaliers avec photos et détails terrain
      if (data.reportDays && data.reportDays.length > 0) {
        const reportDaysChildren: any[] = [
          createSectionHeader('II. RAPPORTS JOURNALIERS', COLORS.SUCCESS),
        ];

        for (let idx = 0; idx < data.reportDays.length; idx++) {
          const day = data.reportDays[idx];

          // Titre du jour avec statut
          reportDaysChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `JOUR ${idx + 1} : ${day.title || 'Étape ' + (idx + 1)}`,
                  bold: true,
                  size: 24,
                  color: COLORS.SUCCESS,
                }),
              ],
              spacing: { before: 400, after: 150 },
            })
          );

          // Détail de l'étape (provenant du planning)
          if (day.detail) {
            reportDaysChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Activité prévue : ',
                    bold: true,
                    size: 18,
                  }),
                  new TextRun({
                    text: day.detail,
                    size: 18,
                  }),
                ],
                spacing: { after: 150 },
              })
            );
          }

          // Statut de complétion
          reportDaysChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Statut : ',
                  bold: true,
                  size: 18,
                }),
                new TextRun({
                  text: day.isCompleted ? 'TERMINÉ ✓' : 'En cours',
                  color: day.isCompleted ? COLORS.SUCCESS : COLORS.ACCENT,
                  size: 18,
                }),
              ],
              spacing: { after: 150 },
            })
          );

          // Observations terrain
          if (day.observation) {
            reportDaysChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Observations terrain : ',
                  bold: true,
                  size: 18,
                }),
                new TextRun({
                  text: day.observation,
                  size: 18,
                }),
              ],
              spacing: { after: 150 },
            })
          );
        }

        // Notes complémentaires
        if (day.notes) {
          reportDaysChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Notes complémentaires : ',
                  bold: true,
                  size: 18,
                }),
                new TextRun({
                  text: day.notes,
                  size: 18,
                }),
              ],
              spacing: { after: 150 },
            })
          );
        }

        // Photos avec commentaires
        if (day.photos && day.photos.length > 0) {
          reportDaysChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Documentation visuelle (${day.photos.length} photo(s)) :`,
                  bold: true,
                  size: 18,
                  color: COLORS.PRIMARY,
                }),
              ],
              spacing: { before: 200, after: 100 },
            })
          );

          // Pour chaque photo, ajouter l'image et le commentaire
          for (const photo of day.photos) {
            // 📸 Ajout de l'image si elle existe (Base64 ou URL via fetch)
            try {
              let imageData: ArrayBuffer | null = null;
              
              if (photo.data?.startsWith('data:')) {
                const base64Data = photo.data.includes(',') ? photo.data.split(',')[1] : photo.data;
                imageData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;
              } else if (photo.url) {
                imageData = await _fetchImageAsArrayBuffer(photo.url);
              }

              if (imageData) {
                reportDaysChildren.push(
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: imageData,
                        transformation: { width: 450, height: 300 }, // Taille optimisée pour Word
                      } as any),
                    ],
                    spacing: { before: 100, after: 100 },
                  })
                );
              }
            } catch (err) {
              logger.error('Erreur insertion image Word:', err);
            }

            if (photo.comment) {
              reportDaysChildren.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Commentaire : ',
                      bold: true,
                      size: 16,
                      color: COLORS.SLATE,
                    }),
                    new TextRun({
                      text: photo.comment,
                      size: 16,
                      italics: true,
                    }),
                  ],
                  spacing: { after: 200 },
                })
              );
            }
          }
        }

        // Séparateur entre les jours
        reportDaysChildren.push(
          new Paragraph({
            text: '',
            spacing: { before: 200, after: 200 },
          })
        );
      }

      sections.push({
        properties: {},
        children: reportDaysChildren,
      });
    }

    } // Clôture du bloc "else" (Mode Classic Daily)

    // Section Équipe
    if (data.members && data.members.length > 0) {
      const teamChildren: any[] = [
        createSectionHeader('III. ÉQUIPE DE MISSION', COLORS.ACCENT),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.ACCENT },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'Nom', color: COLORS.WHITE, bold: true })],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                }),
                new TableCell({
                  shading: { fill: COLORS.ACCENT },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'Rôle', color: COLORS.WHITE, bold: true })],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                }),
                new TableCell({
                  shading: { fill: COLORS.ACCENT },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'Jours', color: COLORS.WHITE, bold: true })],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                }),
              ],
            }),
            ...data.members.map(
              (m: any) =>
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: m.name || 'N/A' })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: m.role || 'N/A' })],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: (m.days || 0).toString(),
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                    }),
                  ],
                })
            ),
          ],
        }),
      ];

      sections.push({
        properties: {},
        children: teamChildren,
      });
    }

    // Section Signature
    sections.push({
      properties: {},
      children: [
        createSectionHeader('IV. VALIDATION', COLORS.SLATE),
        new Paragraph({ text: '', spacing: { before: 500 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Rapport généré le ',
              size: 18,
            }),
            new TextRun({
              text: new Date().toLocaleDateString('fr-FR'),
              bold: true,
              size: 18,
            }),
          ],
        }),
        new Paragraph({ text: '', spacing: { before: 1000 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Signature du Responsable de Mission',
              italics: true,
              size: 20,
            }),
          ],
        }),
      ],
    });

    const doc = new Document({
      creator: 'GEM-SAAS PROQUELEC',
      title: `Rapport Post-Mission ${data.orderNumber}`,
      sections: sections,
    });

    return await Packer.toBlob(doc);
  } catch (error) {
    logger.error('Erreur génération rapport Word:', error);
    return null;
  }
};
