// Template-based Word generation matching CDC_COMPLET_PROJET_RACCORDEMENT format
import { Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, ImageRun } from 'docx';
import { createText, createSectionHeader, parseMarkdownText } from '../utils/styles';
import { fetchImageCached } from '../utils/imageLoader';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING, MARGINS } from '../theme/spacing';
import { BORDERS } from '../theme/borders';
import { ICONS } from '../theme/icons';
import { createCard, createTwoColumns } from '../components';
import { createQualityGrid } from '../components/QualityGrid';
import type { QualityGridOptions } from '../components/QualityGrid';

export interface TemplateSectionOptions {
  role: string;
  reference: string;
  referentiel: string;
  logistique: string;
  signataire: string;
  periode: string;
  specifications: string;
  phases: Array<{
    title: string;
    description: string;
    steps?: string[];
    checklist?: string[];
    qualityPoints?: string[];
    safetyPoints?: string[];
  }>;
  material: string[];
  hse: string[];
  technicalImages?: Array<{
    url: string;
    label: string;
    notes?: Array<{ title: string; lines: string[] }>;
    legend?: string[];
  }>;
  lot?: string;
  missions?: string[];
  subcontracting?: string[];
  finances?: string[];
  legal?: string[];
  koboGuide?: Array<{
    title: string;
    intro?: string;
    checks: string[];
    blockers?: string[];
    completion?: string[];
  }>;
  pricing?: {
    dailyRate: number;
    personnelCount: number;
    durationDays: number;
    penalties: string;
    currency: string;
  };
  qualityGrid?: {
    items: Array<{
      criteria: string;
      weight: number;
      target: string;
      method: string;
      penalty: string;
    }>;
    totalWeight: number;
    passingScore: number;
  };
}

/**
 * Creates a Word section matching the CDC_COMPLET_PROJET_RACCORDEMENT template format
 * with a focus exclusively on technical and step-by-step aspects.
 */
export const createTemplateSection = async (options: TemplateSectionOptions) => {
  const {
    role,
    reference,
    referentiel,
    logistique,
    signataire,
    periode,
    specifications,
    phases,
    material,
    hse,
    technicalImages,
    lot,
    missions,
    koboGuide,
    qualityGrid,
  } = options;

  const children: any[] = [];

  // 1. Unified Header Table matching CDC template exactly
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: BORDERS.LIGHT,
      rows: [
        // Row 1: Main header - DOCUMENT TECHNIQUE OFFICIEL
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              shading: { fill: COLORS.PRIMARY.replace('#', '') },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: SPACING.SMALL, after: SPACING.TINY },
                  children: [
                    new TextRun({
                      text: 'DOCUMENT TECHNIQUE OFFICIEL - PROQUELEC SA',
                      bold: true,
                      size: FONT_SIZES.NORMAL,
                      color: 'FFFFFF',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: SPACING.TINY, after: SPACING.TINY },
                  children: [
                    new TextRun({
                      text: 'Cahier des Charges',
                      bold: true,
                      size: FONT_SIZES.H2,
                      color: 'FFFFFF',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: SPACING.TINY, after: SPACING.SMALL },
                  children: [
                    new TextRun({
                      text: `MÉTIER : ${role.toUpperCase()}`,
                      bold: true,
                      size: FONT_SIZES.NORMAL,
                      color: 'FFFFFF',
                    }),
                    new TextRun({
                      text: `    |    Réf: ${reference}`,
                      size: FONT_SIZES.SMALL,
                      color: 'E0E0E0',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        // Row 2: Referentiel | Logistique
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: COLORS.BG_HEADER.replace('#', '') },
              children: [
                new Paragraph({
                  spacing: { before: SPACING.TINY, after: SPACING.TINY },
                  children: [
                    createText('Référentiel  ', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.PRIMARY }),
                    createText(referentiel, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: COLORS.BG_HEADER.replace('#', '') },
              children: [
                new Paragraph({
                  spacing: { before: SPACING.TINY, after: SPACING.TINY },
                  children: [
                    createText('Logistique  ', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.PRIMARY }),
                    createText(logistique, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                  ],
                }),
              ],
            }),
          ],
        }),
        // Row 3: Signataire | Période
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: SPACING.TINY, after: SPACING.TINY },
                  children: [
                    createText('Signataire  ', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.PRIMARY }),
                    createText(signataire, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: SPACING.TINY, after: SPACING.TINY },
                  children: [
                    createText('Période  ', { bold: true, size: FONT_SIZES.SMALL, color: COLORS.PRIMARY }),
                    createText(periode, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ spacing: { after: SPACING.MEDIUM } }));

  // Section 1 - Spécifications & Missions
  children.push(createSectionHeader('1. Spécifications & Missions', COLORS.PRIMARY));

  children.push(
    new Paragraph({
      spacing: { before: SPACING.SMALL, after: SPACING.MEDIUM },
      children: [
        createText(specifications, { size: FONT_SIZES.NORMAL, color: COLORS.SLATE }),
      ],
    })
  );

  // Missions listed as bullets directly after the specs paragraph
  if (missions && missions.length > 0) {
    missions.forEach((mission) => {
      const parts = mission.split(' : ');
      const prefix = parts[0];
      const text = parts.slice(1).join(' : ');
      
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 },
          children: text
            ? [
                new TextRun({ text: `${prefix} : `, bold: true, color: COLORS.SECONDARY, size: FONT_SIZES.NORMAL }),
                new TextRun({ text, size: FONT_SIZES.NORMAL }),
              ]
            : [
                new TextRun({ text: mission, size: FONT_SIZES.NORMAL }),
              ],
        })
      );
    });
  }

  // DÉTAILS DES PHASES TECHNIQUES (matches .dotx template label)
  if (phases && phases.length > 0) {
    children.push(createSectionHeader('DÉTAILS DES PHASES TECHNIQUES', COLORS.PRIMARY));

    phases.forEach((phase) => {
      children.push(
        new Paragraph({
          spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL },
          children: [
            new TextRun({
              text: `${ICONS.STAR || '★'} ${phase.title}`,
              bold: true,
              size: FONT_SIZES.NORMAL,
              color: COLORS.PRIMARY,
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
          children: [
            createText(phase.description, { size: FONT_SIZES.NORMAL, color: COLORS.GRAY, italics: true }),
          ],
        })
      );

      // LEFT CARD: Étapes d'exécution
      const leftContent: any[] = [];
      if (phase.steps && phase.steps.length > 0) {
        phase.steps.forEach((step, idx) => {
          leftContent.push(
            new Paragraph({
              spacing: { before: 50, after: 50 },
              children: [
                createText(`  ${idx + 1}. ${step}`, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
              ],
            })
          );
        });
      } else {
        leftContent.push(new Paragraph({ children: [createText('Aucune étape définie', { size: FONT_SIZES.SMALL, color: COLORS.GRAY })] }));
      }

      const leftCard = createCard({
        title: "Étapes d'exécution",
        icon: 'DOCUMENT',
        content: leftContent,
        backgroundColor: '#F0F9FF', // Light blue
        borderColor: '#E0F2FE',
        titleColor: COLORS.PRIMARY,
      }) as any;

      // RIGHT CARD: Contrôles & Exigences
      const rightContent: any[] = [];
      if (phase.checklist && phase.checklist.length > 0) {
        rightContent.push(
          new Paragraph({
            spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
            children: [
              new TextRun({
                text: 'Checklist de contrôle :',
                bold: true,
                size: FONT_SIZES.SMALL,
                color: COLORS.SUCCESS,
              }),
            ],
          })
        );
        phase.checklist.forEach((item) => {
          rightContent.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                createText(`  ${ICONS.CHECK || '✔'} ${item}`, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
              ],
            })
          );
        });
      }

      if (phase.qualityPoints && phase.qualityPoints.length > 0) {
        rightContent.push(
          new Paragraph({
            spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
            children: [
              new TextRun({
                text: 'Points de qualité :',
                bold: true,
                size: FONT_SIZES.SMALL,
                color: COLORS.SECONDARY,
              }),
            ],
          })
        );
        phase.qualityPoints.forEach((point) => {
          rightContent.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                createText(`  ${ICONS.STAR || '★'} ${point}`, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
              ],
            })
          );
        });
      }

      if (phase.safetyPoints && phase.safetyPoints.length > 0) {
        rightContent.push(
          new Paragraph({
            spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
            children: [
              new TextRun({
                text: 'Points de sécurité :',
                bold: true,
                size: FONT_SIZES.SMALL,
                color: COLORS.DANGER,
              }),
            ],
          })
        );
        phase.safetyPoints.forEach((point) => {
          rightContent.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                createText(`  ${ICONS.SHIELD || '⚠'} ${point}`, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
              ],
            })
          );
        });
      }

      const rightCard = createCard({
        title: "Contrôles & Exigences",
        icon: 'CHECK',
        content: rightContent,
        backgroundColor: '#F0FDF4', // Light green
        borderColor: '#DCFCE7',
        titleColor: COLORS.SUCCESS,
      });

      // Combine in two columns
      children.push(createTwoColumns(leftCard, rightCard));
      
      // Add some space after the two columns
      children.push(new Paragraph({ spacing: { after: SPACING.MEDIUM } }));
    });
  }

  // Guide de Saisie Kobo & Contrôles GED OS
  if (koboGuide && koboGuide.length > 0) {
    children.push(createSectionHeader('4. Guide de Saisie Kobo & Contrôles GED OS', COLORS.PRIMARY));

    koboGuide.forEach((block) => {
      children.push(
        new Paragraph({
          spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL },
          children: [
            new TextRun({
              text: `${block.title.toUpperCase()}`,
              bold: true,
              size: FONT_SIZES.NORMAL,
              color: COLORS.PRIMARY,
            }),
          ],
        })
      );

      if (block.intro) {
        children.push(
          new Paragraph({
            spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
            children: [
              createText(block.intro, { size: FONT_SIZES.SMALL, color: COLORS.GRAY, italics: true }),
            ],
          })
        );
      }

      // TWO COLUMNS for KOBO Guide
      // LEFT CARD: Points de contrôle à renseigner
      const koboLeftContent: any[] = [];
      if (block.checks && block.checks.length > 0) {
        block.checks.forEach((item) => {
          koboLeftContent.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                createText(`✔ ${item}`, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
              ],
            })
          );
        });
      } else {
        koboLeftContent.push(new Paragraph({ children: [createText('-', { size: FONT_SIZES.SMALL })] }));
      }
      
      const koboLeftCard = createCard({
        title: "À renseigner",
        icon: 'DOCUMENT',
        content: koboLeftContent,
        backgroundColor: '#F8FAFC', // Slate 50
        borderColor: '#E2E8F0',
        titleColor: COLORS.SLATE,
      }) as any;

      // RIGHT CARD: Bloquants & Validation
      const koboRightContent: any[] = [];
      if (block.blockers && block.blockers.length > 0) {
        koboRightContent.push(
          new Paragraph({
            spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
            children: [
              new TextRun({
                text: 'Non-conformités bloquantes :',
                bold: true,
                size: FONT_SIZES.SMALL,
                color: COLORS.DANGER,
              }),
            ],
          })
        );
        block.blockers.forEach((item) => {
          koboRightContent.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                createText(`✘ ${item}`, { size: FONT_SIZES.SMALL, color: COLORS.DANGER }),
              ],
            })
          );
        });
      }

      if (block.completion && block.completion.length > 0) {
        koboRightContent.push(
          new Paragraph({
            spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
            children: [
              new TextRun({
                text: 'Validation finale :',
                bold: true,
                size: FONT_SIZES.SMALL,
                color: COLORS.PRIMARY,
              }),
            ],
          })
        );
        block.completion.forEach((item) => {
          koboRightContent.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                createText(`ℹ ${item}`, { size: FONT_SIZES.SMALL, color: COLORS.SLATE, italics: true }),
              ],
            })
          );
        });
      }
      
      const koboRightCard = createCard({
        title: "Règles",
        icon: 'SHIELD',
        content: koboRightContent,
        backgroundColor: '#FEF2F2', // Light red
        borderColor: '#FECACA',
        titleColor: COLORS.DANGER,
      });

      // Combine Kobo guide in two columns
      children.push(createTwoColumns(koboLeftCard, koboRightCard));
      children.push(new Paragraph({ spacing: { after: SPACING.MEDIUM } }));
    });
  }

  // 8. Technical Images & Illustrations
  if (technicalImages && technicalImages.length > 0) {
    children.push(createSectionHeader('5. Illustrations Techniques', COLORS.PRIMARY));

    for (const img of technicalImages) {
      children.push(
        new Paragraph({
          spacing: { before: SPACING.MEDIUM, after: SPACING.SMALL },
          children: [
            new TextRun({
              text: img.label,
              bold: true,
              size: FONT_SIZES.NORMAL,
              color: COLORS.SLATE,
            }),
          ],
        })
      );

      // Load and insert image
      const buffer = await fetchImageCached(img.url);
      if (buffer) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 300 },
            children: [
              new ImageRun({
                data: buffer,
                transformation: { width: 450, height: 350 },
                type: 'png',
              } as any),
            ],
          })
        );
      }

      // Render notes and legend in Two Columns if possible
      const notesContent: any[] = [];
      if (img.notes && img.notes.length > 0) {
        img.notes.forEach((noteBlock) => {
          notesContent.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: noteBlock.title.toUpperCase(),
                  bold: true,
                  size: FONT_SIZES.SMALL,
                  color: COLORS.SECONDARY,
                }),
              ],
              spacing: { before: 100, after: 50 },
            })
          );
          noteBlock.lines.forEach((line) => {
            notesContent.push(
              new Paragraph({
                children: [
                  createText(`• ${line}`, { size: FONT_SIZES.SMALL, color: COLORS.GRAY }),
                ],
                spacing: { after: 40 },
                indent: { left: 240 },
              })
            );
          });
        });
      }

      const legendContent: any[] = [];
      if (img.legend && img.legend.length > 0) {
        img.legend.forEach((legendItem) => {
          legendContent.push(
            new Paragraph({
              children: [
                createText(`• ${legendItem}`, { size: FONT_SIZES.SMALL, color: COLORS.GRAY }),
              ],
              spacing: { after: 40 },
              indent: { left: 240 },
            })
          );
        });
      }

      if (notesContent.length > 0 || legendContent.length > 0) {
        const leftNotesCard = createCard({
          title: "Détails Techniques",
          content: notesContent.length > 0 ? notesContent : [new Paragraph({ children: [createText('-')] })],
          backgroundColor: '#F8FAFC',
          borderColor: '#E2E8F0',
          titleColor: COLORS.SLATE,
        });
        
        const rightLegendCard = createCard({
          title: "Légende",
          content: legendContent.length > 0 ? legendContent : [new Paragraph({ children: [createText('-')] })],
          backgroundColor: '#F8FAFC',
          borderColor: '#E2E8F0',
          titleColor: COLORS.SLATE,
        });
        
        children.push(createTwoColumns(leftNotesCard, rightLegendCard));
        children.push(new Paragraph({ spacing: { after: SPACING.MEDIUM } }));
      }
    }
  }

  // MATÉRIEL & LOGISTIQUE + SÉCURITÉ & HSE — match .dotx order exactly
  if ((material && material.length > 0) || (hse && hse.length > 0)) {
    children.push(createSectionHeader('MATÉRIEL & LOGISTIQUE', COLORS.WARNING));
    
    const matContent: any[] = [];
    if (material && material.length > 0) {
      material.forEach((item) => {
        matContent.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
            children: parseMarkdownText(item, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
          })
        );
      });
    } else {
      matContent.push(new Paragraph({ children: [createText('Aucun matériel spécifié', { size: FONT_SIZES.SMALL })] }));
    }

    children.push(...matContent);
    children.push(new Paragraph({ spacing: { after: SPACING.MEDIUM } }));

    children.push(createSectionHeader('SÉCURITÉ & HSE', COLORS.DANGER));
    
    const hseContent: any[] = [];
    if (hse && hse.length > 0) {
      hse.forEach((item) => {
        hseContent.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
            children: parseMarkdownText(item, { size: FONT_SIZES.SMALL, color: COLORS.SLATE }),
          })
        );
      });
    } else {
      hseContent.push(new Paragraph({ children: [createText('Aucune règle HSE spécifiée', { size: FONT_SIZES.SMALL })] }));
    }

    children.push(...hseContent);
    children.push(new Paragraph({ spacing: { after: SPACING.MEDIUM } }));
  }

  // Quality Grid with Penalties
  if (qualityGrid && qualityGrid.items && qualityGrid.items.length > 0) {
    children.push(createSectionHeader('7. Grille de Contrôle Qualité & Pénalités', COLORS.PRIMARY));
    
    const qualityGridElements = createQualityGrid({
      title: 'Grille de Contrôle Qualité',
      subtitle: 'Critères d\'évaluation et pénalités associées',
      items: qualityGrid.items,
      totalWeight: qualityGrid.totalWeight,
      passingScore: qualityGrid.passingScore,
    });
    
    children.push(...qualityGridElements);
  }

  // 10. Signatures
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: BORDERS.NONE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: BORDERS.NONE,
              children: [
                new Paragraph({
                  spacing: { before: SPACING.XL, after: SPACING.SMALL },
                  children: [
                    createText('VISA DIRECTION TECHNIQUE', { bold: true, size: FONT_SIZES.NORMAL, color: COLORS.PRIMARY }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
                  children: [
                    createText('Fait à Dakar, le ________________', { size: FONT_SIZES.NORMAL, color: COLORS.GRAY }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: BORDERS.NONE,
              children: [
                new Paragraph({
                  spacing: { before: SPACING.XL, after: SPACING.SMALL },
                  children: [
                    createText(`VISA PRESTATAIRE (${role.toUpperCase()})`, { bold: true, size: FONT_SIZES.NORMAL, color: COLORS.PRIMARY }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
                  children: [
                    createText('Signature et Empreinte', { size: FONT_SIZES.NORMAL, color: COLORS.GRAY }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  return children;
};
