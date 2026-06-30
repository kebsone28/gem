/* eslint-disable @typescript-eslint/no-explicit-any */
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
  HeadingLevel,
} from 'docx';
import { createText, createSectionHeader, noBorder } from '../utils/styles';
import { fetchImageCached } from '../utils/imageLoader';
import { COLORS } from '../theme/colors';
import { FONT_SIZES } from '../theme/typography';
import { SPACING, INDENTS, MARGINS } from '../theme/spacing';
import { BORDERS } from '../theme/borders';
import { ICONS } from '../theme/icons';
import { createCard, createTwoColumns, createGallery, createChecklist, createHero, createKPIRow } from '../components';
import { createTemplateSection } from './templateBasedSection';
import type { TemplateSectionOptions } from './templateBasedSection';

// Section-specific colors
const SECTION_COLORS = {
  technical: COLORS.TECHNICAL,
  quality: COLORS.QUALITY,
  safety: COLORS.SAFETY,
  finance: COLORS.FINANCE,
  legal: COLORS.LEGAL,
};

const ROLE_TO_LOT_MAPPING: Record<string, string> = {
  'Préparateur': 'LOT A - Pré-câblage',
  'Livreur': 'LOT A - Logistique Transport',
  'Électricien': 'LOT B - Installation Intérieure',
  'Maçonnerie': 'LOT B - Génie Civil',
  'Logistique': 'LOT B - Logistique',
  'Réseau Extérieur': 'LOT C - Réseau',
  'Audit & Contrôle Qualité (PROQUELEC)': 'Contrôle & Validation',
  'Contrôle & Validation': 'Contrôle & Validation',
};

interface RoleSectionData {
  role: string;
  name: string;
  dailyIndemnity: number;
  transport: number;
  days: number;
  signatureImage?: string;
  isCertified?: boolean;
  introduction?: string;
  missions?: string[];
  materials?: string[];
  hse?: string[];
  subcontracting?: string[];
  finances?: string[];
  legal?: string[];
  responsible?: string;
  imagePath?: string;
  technicalImages?: Array<{
    url: string;
    label: string;
    notes?: Array<{ title: string; lines: string[] }>;
    legend?: string[];
  }>;
  koboGuide?: Array<{
    title: string;
    intro?: string;
    checks: string[];
    blockers?: string[];
    completion?: string[];
  }>;
  executionGuide?: Array<{
    title: string;
    description: string;
    steps: string[];
    checklist: string[];
    qualityPoints: string[];
    safetyPoints: string[];
  }>;
  qualityChecklist?: Array<{
    item: string;
    category: 'quality' | 'safety' | 'technical';
  }>;
  startDate?: string;
  endDate?: string;
  pricing?: { dailyRate: number; personnelCount: number; durationDays: number; currency: string; penalties: string; };
}

export const createRoleSection = async (data: RoleSectionData, qrBuffer?: ArrayBuffer | null, useTemplateFormat: boolean = true) => {
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
    koboGuide,
    executionGuide,
    qualityChecklist,
    startDate,
    endDate,
    pricing,
  } = data;

  const children: any[] = [];

  // Use template-based format matching CDC_COMPLET_PROJET_RACCORDEMENT format
  if (useTemplateFormat) {
    // Convert execution guide to phases with full details
    const phases = executionGuide?.map(step => ({
      title: step.title,
      description: step.description,
      steps: step.steps,
      checklist: step.checklist,
      qualityPoints: step.qualityPoints,
      safetyPoints: step.safetyPoints,
    })) || [];

    const templateOptions: TemplateSectionOptions = {
      role,
      reference: `CDC-${role.toUpperCase().replace(/\s/g, '-')}-2026`,
      referentiel: role,
      logistique: 'Logistique',
      signataire: responsible || 'Non Assigné',
      periode: `${startDate || 'N/A'} - ${endDate || 'N/A'}`,
      specifications: introduction || '',
      phases,
      material: materials || [],
      hse: hse || [],
      technicalImages: technicalImages || [],
      lot: ROLE_TO_LOT_MAPPING[role] || 'LOT Spécifique',
      missions: missions || [],
      subcontracting: subcontracting || [],
      finances: finances || [],
      legal: legal || [],
      koboGuide: koboGuide || [],
      pricing: pricing,
      qualityGrid: qualityChecklist ? {
        items: qualityChecklist.map(item => ({
          criteria: item.item,
          weight: 10,
          target: 'Conformité totale',
          method: 'Inspection visuelle',
          penalty: 'Retenue de 5% sur paiement',
        })),
        totalWeight: qualityChecklist.length * 10,
        passingScore: 80,
      } : undefined,
    };

    const templateElements = await createTemplateSection(templateOptions);
    children.push(...templateElements);
    return children;
  }

  // Original premium design (kept as fallback)
  const heroImageBuffer = imagePath ? await fetchImageCached(imagePath) : undefined;
  const heroElements = createHero({
    title: `BORDEREAU DÉTAILLÉ DU LOT : ${role.toUpperCase()}`,
    subtitle: introduction,
    lot: role,
    role: role,
    responsible: responsible || 'Non assigné',
    period: `${startDate} au ${endDate}`,
    version: 'v1.0',
    imageBuffer: heroImageBuffer && heroImageBuffer !== null ? heroImageBuffer : undefined,
  });
  children.push(...heroElements);

  // 2. KPI Row
  const kpiRow = createKPIRow([
    {
      label: 'Missions',
      value: (missions?.length || 0).toString(),
      icon: 'WORKER',
      color: COLORS.PRIMARY,
    },
    {
      label: 'Durée',
      value: `${startDate && endDate ? `${Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} jours` : '-'}`,
      icon: 'CALENDAR',
      color: COLORS.ACCENT,
    },
    {
      label: 'Matériels',
      value: (materials?.length || 0).toString(),
      icon: 'TOOL',
      color: COLORS.SUCCESS,
    },
    {
      label: 'HSE',
      value: (hse?.length || 0).toString(),
      icon: 'SHIELD',
      color: COLORS.DANGER,
    },
  ]);
  children.push(kpiRow);

  // 3. Remove duplicate hero image (now included in Hero component)
  // if (imagePath) { ... }

  // 3. Technical Gallery
  if (technicalImages && technicalImages.length > 0) {
    const galleryImages = technicalImages.filter((img) => !img.notes || img.notes.length === 0);
    const annotatedImages = technicalImages.filter((img) => img.notes && img.notes.length > 0);

    if (galleryImages.length > 0) {
      children.push(createSectionHeader('Standards & Schémas Techniques', COLORS.SUCCESS));
      const galleryTable = await createGallery({
        images: galleryImages.map(img => ({
          url: img.url,
          label: img.label,
        })),
        columns: 2,
        width: 100,
      });
      children.push(galleryTable);
    }

    for (const img of annotatedImages) {
      children.push(createSectionHeader(img.label, COLORS.SUCCESS));
      const buffer = await fetchImageCached(img.url);
      if (buffer) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 300 },
            children: [
              new ImageRun({
                data: buffer,
                transformation: { width: 400, height: 300 },
                type: 'png',
              } as any),
            ],
          })
        );
      }

      img.notes?.forEach((noteBlock) => {
        children.push(
          new Paragraph({
            children: [
              createText(noteBlock.title.toUpperCase(), {
                bold: true,
                size: 22,
                color: COLORS.SECONDARY,
              }),
            ],
            spacing: { before: 200, after: 120 },
          })
        );

        noteBlock.lines.forEach((line) => {
          children.push(
            new Paragraph({
              children: [createText(`• ${line}`, { size: 20 })],
              spacing: { before: 80, after: 80 },
              indent: { left: 280 },
            })
          );
        });
      });

      if (img.legend && img.legend.length > 0) {
        children.push(
          new Paragraph({
            children: [createText('LÉGENDE NORMALISÉE', { bold: true, size: 22, color: COLORS.SUCCESS })],
            spacing: { before: 240, after: 120 },
          })
        );

        img.legend.forEach((legendItem) => {
          children.push(
            new Paragraph({
              children: [createText(`• ${legendItem}`, { size: 20 })],
              spacing: { before: 40, after: 40 },
              indent: { left: 280 },
            })
          );
        });
      }
    }
  }

  // 4. Content Sections
  const addListSection = (title: string, items: string[], color: string, icon?: keyof typeof ICONS) => {
    if (!items || items.length === 0) return;
    children.push(createSectionHeader(title, color));
    
    const cardContent = items.map((item) =>
      new Paragraph({
        children: [
          new TextRun({
            text: `• ${item}`,
            size: FONT_SIZES.NORMAL,
            color: COLORS.SLATE,
          }),
        ],
        spacing: { before: SPACING.SMALL, after: SPACING.SMALL },
        indent: { left: INDENTS.LIST },
      })
    );
    
    children.push(
      createCard({
        icon,
        content: cardContent,
        backgroundColor: COLORS.BG_CARD,
        borderColor: COLORS.BORDER_LIGHT,
      })
    );
  };

  const addKoboGuideSection = (
    title: string,
    guideBlocks: Array<{
      title: string;
      intro?: string;
      checks: string[];
      blockers?: string[];
      completion?: string[];
    }>,
    color: string
  ) => {
    if (!guideBlocks || guideBlocks.length === 0) return;
    children.push(createSectionHeader(title, color));

    guideBlocks.forEach((block) => {
      children.push(
        new Paragraph({
          children: [createText(block.title.toUpperCase(), { bold: true, size: 20, color })],
          spacing: { before: 160, after: 80 },
        })
      );

      if (block.intro) {
        children.push(
          new Paragraph({
            children: [createText(block.intro, { size: 18, italics: true })],
            spacing: { before: 40, after: 100 },
          })
        );
      }

      children.push(
        new Paragraph({
          children: [createText('POINTS À RENSEIGNER', { bold: true, size: 18, color: COLORS.PRIMARY })],
          spacing: { before: 40, after: 40 },
        })
      );
      block.checks.forEach((item) => {
        children.push(
          new Paragraph({
            children: [createText(`• ${item}`, { size: 18 })],
            spacing: { before: 20, after: 20 },
            indent: { left: 240 },
          })
        );
      });

      if (block.blockers && block.blockers.length > 0) {
        children.push(
          new Paragraph({
            children: [
              createText('NON-CONFORMITÉS BLOQUANTES', {
                bold: true,
                size: 18,
                color: COLORS.DANGER,
              }),
            ],
            spacing: { before: 80, after: 40 },
          })
        );
        block.blockers.forEach((item) => {
          children.push(
            new Paragraph({
              children: [createText(`• ${item}`, { size: 18 })],
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
            })
          );
        });
      }

      if (block.completion && block.completion.length > 0) {
        children.push(
          new Paragraph({
            children: [
              createText('CONDITION DE VALIDATION', {
                bold: true,
                size: 18,
                color: COLORS.SUCCESS,
              }),
            ],
            spacing: { before: 80, after: 40 },
          })
        );
        block.completion.forEach((item) => {
          children.push(
            new Paragraph({
              children: [createText(`• ${item}`, { size: 18 })],
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
            })
          );
        });
      }
    });
  };

  const addExecutionGuideSection = (
    title: string,
    guideBlocks: Array<{
      title: string;
      description: string;
      steps: string[];
      checklist: string[];
      qualityPoints: string[];
      safetyPoints: string[];
    }>,
    color: string
  ) => {
    if (!guideBlocks || guideBlocks.length === 0) return;
    children.push(createSectionHeader(title, color));

    // Create 2-column layout
    for (let i = 0; i < guideBlocks.length; i += 2) {
      const blocks = [guideBlocks[i], guideBlocks[i + 1]].filter(Boolean);
      
      if (blocks.length === 1) {
        // Single block - full width
        const block = blocks[0];
        children.push(
          new Paragraph({
            children: [createText(block.title.toUpperCase(), { bold: true, size: 22, color })],
            spacing: { before: 160, after: 80 },
          })
        );

        children.push(
          new Paragraph({
            children: [createText(block.description, { size: 18, italics: true })],
            spacing: { before: 40, after: 100 },
          })
        );

        children.push(
          new Paragraph({
            children: [createText('ÉTAPES D\'EXÉCUTION', { bold: true, size: 18, color: COLORS.PRIMARY })],
            spacing: { before: 40, after: 40 },
          })
        );
        block.steps.forEach((step, idx) => {
          children.push(
            new Paragraph({
              children: [createText(`${idx + 1}. ${step}`, { size: 18 })],
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
            })
          );
        });

        children.push(
          new Paragraph({
            children: [createText('CHECKLIST DE CONTRÔLE', { bold: true, size: 18, color: COLORS.SUCCESS })],
            spacing: { before: 80, after: 40 },
          })
        );
        block.checklist.forEach((item) => {
          children.push(
            new Paragraph({
              children: [createText(`• ${item}`, { size: 18 })],
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
            })
          );
        });

        children.push(
          new Paragraph({
            children: [createText('POINTS DE QUALITÉ', { bold: true, size: 18, color: COLORS.ACCENT })],
            spacing: { before: 80, after: 40 },
          })
        );
        block.qualityPoints.forEach((item) => {
          children.push(
            new Paragraph({
              children: [createText(`• ${item}`, { size: 18 })],
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
            })
          );
        });

        children.push(
          new Paragraph({
            children: [createText('POINTS DE SÉCURITÉ', { bold: true, size: 18, color: COLORS.DANGER })],
            spacing: { before: 80, after: 40 },
          })
        );
        block.safetyPoints.forEach((item) => {
          children.push(
            new Paragraph({
              children: [createText(`• ${item}`, { size: 18 })],
              spacing: { before: 20, after: 20 },
              indent: { left: 240 },
            })
          );
        });
      } else {
        // Two blocks - true 2-column layout (single table with two cells)
        const tableRows: TableRow[] = [];
        
        tableRows.push(
          new TableRow({
            children: blocks.map((block) => 
              new TableCell({
                shading: { fill: SECTION_COLORS.technical },
                borders: BORDERS.CARD,
                children: [
                  new Paragraph({
                    children: [createText(block.title.toUpperCase(), { bold: true, size: 22, color })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 100 },
                  }),
                  new Paragraph({
                    children: [createText(block.description, { size: 18, italics: true, color: '666666' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 120 },
                  }),
                  new Paragraph({
                    children: [createText('ÉTAPES D\'EXÉCUTION', { bold: true, size: 18, color: COLORS.PRIMARY })],
                    spacing: { before: 80, after: 40 },
                  }),
                  ...block.steps.map((step, idx) =>
                    new Paragraph({
                      children: [createText(`${idx + 1}. ${step}`, { size: 18 })],
                      spacing: { before: 20, after: 20 },
                      indent: { left: 200 },
                    })
                  ),
                  new Paragraph({
                    children: [createText('CHECKLIST', { bold: true, size: 18, color: COLORS.SUCCESS })],
                    spacing: { before: 100, after: 40 },
                  }),
                  ...block.checklist.map((item) =>
                    new Paragraph({
                      children: [createText(`• ${item}`, { size: 18 })],
                      spacing: { before: 20, after: 20 },
                      indent: { left: 200 },
                    })
                  ),
                  new Paragraph({
                    children: [createText('QUALITÉ', { bold: true, size: 18, color: COLORS.ACCENT })],
                    spacing: { before: 100, after: 40 },
                  }),
                  ...block.qualityPoints.map((item) =>
                    new Paragraph({
                      children: [createText(`• ${item}`, { size: 18 })],
                      spacing: { before: 20, after: 20 },
                      indent: { left: 200 },
                    })
                  ),
                  new Paragraph({
                    children: [createText('SÉCURITÉ', { bold: true, size: 18, color: COLORS.DANGER })],
                    spacing: { before: 100, after: 40 },
                  }),
                  ...block.safetyPoints.map((item) =>
                    new Paragraph({
                      children: [createText(`• ${item}`, { size: 18 })],
                      spacing: { before: 20, after: 20 },
                      indent: { left: 200 },
                    })
                  ),
                ],
                margins: MARGINS.CARD,
              })
            ),
          })
        );

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorder,
            rows: tableRows,
          })
        );
      }
    }
  };

  children.push(createSectionHeader('1. Objet et Obligations', COLORS.SECONDARY));
  children.push(
    new Paragraph({
      children: [createText(introduction || '', { italics: true })],
      spacing: { before: 100, after: 200 },
    })
  );

  // Page break before missions section
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));

  addListSection('2. Missions et Tâches', missions || [], COLORS.PRIMARY, 'WORKER');
  
  // Page break before execution guide
  if (executionGuide && executionGuide.length > 0) {
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }
  
  addKoboGuideSection('Guide Kobo Terrain', koboGuide || [], COLORS.SUCCESS);
  addExecutionGuideSection('Guide d\'Exécution Step-by-Step', executionGuide || [], COLORS.ACCENT);
  
  // Page break before materials
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  
  addListSection('3. Matériels et Logistique', materials || [], COLORS.ACCENT, 'TOOL');
  addListSection('4. Hygiène, Sécurité et Environnement (HSE)', hse || [], COLORS.DANGER, 'SAFETY');
  addListSection('5. Sous-traitance', subcontracting || [], COLORS.SLATE, 'TEAM');
  addListSection('6. Finances et Paiements', finances || [], COLORS.SUCCESS, 'MONEY');
  addListSection('7. Juridique', legal || [], COLORS.SECONDARY);

  // Page break before pricing
  if (pricing) {
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }

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

  // 6. Quality Checklist - Custom per trade
  if (qualityChecklist && qualityChecklist.length > 0) {
    children.push(createSectionHeader('Checklist de Contrôle Qualité', COLORS.SLATE));
    
    // Group by category
    const qualityItems = qualityChecklist.filter(i => i.category === 'quality');
    const safetyItems = qualityChecklist.filter(i => i.category === 'safety');
    const technicalItems = qualityChecklist.filter(i => i.category === 'technical');

    if (technicalItems.length > 0) {
      children.push(
        createChecklist({
          title: 'Contrôles Techniques',
          icon: 'TOOL',
          items: technicalItems.map(item => ({ text: item.item })),
          backgroundColor: COLORS.TECHNICAL,
          titleColor: COLORS.PRIMARY,
        })
      );
    }

    if (qualityItems.length > 0) {
      children.push(
        createChecklist({
          title: 'Contrôles Qualité',
          icon: 'QUALITY',
          items: qualityItems.map(item => ({ text: item.item })),
          backgroundColor: COLORS.QUALITY,
          titleColor: COLORS.SUCCESS,
        })
      );
    }

    if (safetyItems.length > 0) {
      children.push(
        createChecklist({
          title: 'Contrôles Sécurité',
          icon: 'SAFETY',
          items: safetyItems.map(item => ({ text: item.item })),
          backgroundColor: COLORS.SAFETY,
          titleColor: COLORS.DANGER,
        })
      );
    }
  }

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
