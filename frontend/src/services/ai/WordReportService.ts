/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import type { MissionStats } from '../missionStatsService';
import type { Household } from '../../utils/types';
import type { DGInsight } from './DecisionEngine';

/**
 * SERVICE : WordReportService (V.1.0) 🛡️📝🏛️
 * Générateur de rapports officiels Word pour PROQUELEC.
 */
export const wordReportService = {
  /**
   * Génère et télécharge le rapport stratégique
   */
  async generateStrategicReport(
    stats: MissionStats | null,
    insights: DGInsight[],
    households: Household[]
  ) {
    // Fetch dynamic QR Code for report validation
    const qrResponse = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`https://gem.proquelec.com/report/strategic-${Date.now()}`)}`
    );
    const qrData = qrResponse.ok ? await qrResponse.arrayBuffer() : null;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                qrData
                  ? new ImageRun({
                      data: qrData,
                      transformation: { width: 40, height: 40 },
                      type: 'png',
                    } as any)
                  : new TextRun({ text: '[CERTIFIÉ]' }),
              ],
            }),
            new Paragraph({
              text: 'RAPPORT STRATÉGIQUE PROQUELEC',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Généré par GEM-MINT IA le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
                  italics: true,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),

            new Paragraph({ text: '', spacing: { before: 400 } }), // Spacer

            new Paragraph({
              text: '1. RÉSUMÉ OPÉRATIONNEL',
              heading: HeadingLevel.HEADING_2,
            }),

            new Paragraph({
              children: [
                new TextRun({ text: 'Missions totales : ', bold: true }),
                new TextRun(`${stats?.totalMissions || 0}`),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Missions certifiées : ', bold: true }),
                new TextRun(`${stats?.totalCertified || 0}`),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Budget Indemnités (FCFA) : ', bold: true }),
                new TextRun(
                  `${new Intl.NumberFormat('fr-FR').format(stats?.totalIndemnities || 0)}`
                ),
              ],
            }),

            new Paragraph({ text: '', spacing: { before: 400 } }),

            new Paragraph({
              text: '2. ANALYSES ET DÉCISIONS STRATÉGIQUES',
              heading: HeadingLevel.HEADING_2,
            }),

            // Tableau des Insights
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: 'Priorité', bold: true })],
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: 'Analyse / Recommandation', bold: true })],
                        }),
                      ],
                    }),
                  ],
                }),
                ...insights.map(
                  (insight) =>
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [new Paragraph({ text: insight.priority.toUpperCase() })],
                        }),
                        new TableCell({
                          children: [new Paragraph({ text: insight.message })],
                        }),
                      ],
                    })
                ),
              ],
            }),

            new Paragraph({ text: '', spacing: { before: 400 } }),

            new Paragraph({
              text: '3. ÉTAT DU TERRAIN (LOGISTIQUE & MÉNAGES)',
              heading: HeadingLevel.HEADING_2,
            }),

            new Paragraph({
              text: `Nombre de ménages suivis : ${households.length}`,
            }),

            new Paragraph({
              text: 'Audit de conformité : Le bastion maintient une vigilance constante sur les sections de câbles et le raccordement en limite de propriété (Norme NS 01-001).',
            }),

            new Paragraph({ text: '', spacing: { before: 800 } }),

            new Paragraph({
              text: '--------------------------------------------------',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'SCEAU DE LA DIRECTION GÉNÉRALE PROQUELEC',
                  bold: true,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `RAPPORT_STRATEGIQUE_PROQUELEC_${new Date().toISOString().split('T')[0]}.docx`);
  },
};
