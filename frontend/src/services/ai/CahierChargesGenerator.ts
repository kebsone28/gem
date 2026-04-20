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
import type { MissionOrderData } from '../../pages/mission/core/missionTypes';

/**
 * SERVICE : CahierChargesGenerator (V.1.0 PREMIUM) 🛡️✍️🏛️
 * Générateur de contrats et cahiers des charges sécurisés pour PROQUELEC.
 * Intègre les clauses "Équilibre" (Cautions Assurance & Audit IA).
 */
export const cahierChargesGenerator = {
  async generateContract(data: MissionOrderData) {
    const qrResponse = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://gem.proquelec.com/contract/${data.orderNumber}`)}`
    );
    const qrData = qrResponse.ok ? await qrResponse.arrayBuffer() : null;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // HEADER CONTRAT
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                qrData
                  ? new ImageRun({
                      data: qrData,
                      transformation: { width: 50, height: 50 },
                      type: 'png',
                    } as any)
                  : new TextRun({ text: '[SÉCURISÉ]' }),
              ],
            }),
            new Paragraph({
              text: "CAHIER DES CHARGES & CONTRAT D'EXÉCUTION",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: `RÉFÉRENCE MISSION : ${data.orderNumber}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // ARTICLE 1 : OBJET
            new Paragraph({
              text: 'ARTICLE 1 : OBJET DU CONTRAT',
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Le présent contrat définit les conditions d'exécution de la mission de : ",
                  size: 20,
                }),
                new TextRun({ text: data.purpose, bold: true, size: 20 }),
                new TextRun({
                  text: ` qui se déroulera à ${data.region} du ${data.startDate} au ${data.endDate}.`,
                  size: 20,
                }),
              ],
              spacing: { after: 300 },
            }),

            // ARTICLE 2 : SYSTÈME DE GARANTIES (ÉQUILIBRE)
            new Paragraph({
              text: 'ARTICLE 2 : GARANTIES ET CAUTIONS (MODE ÉQUILIBRE)',
              heading: HeadingLevel.HEADING_2,
            }),

            new Paragraph({
              text: "2.1 CAUTION D'AVANCE DE DÉMARRAGE",
              heading: HeadingLevel.HEADING_3,
            }),
            new Paragraph({
              text: "Une avance forfaitaire de 30% du montant total pourra être versée. Pour faciliter la trésorerie de l'entrepreneur, PROQUELEC accepte une Caution d'Assurance issue d'une compagnie agréée (type SONAM/ASKIA) en lieu et place d'une caution bancaire.",
              spacing: { after: 200 },
            }),

            new Paragraph({
              text: '2.2 RETENUE DE GARANTIE ET SUBSTITUTION',
              heading: HeadingLevel.HEADING_3,
            }),
            new Paragraph({
              text: "Une retenue de 10% sera opérée sur chaque décompte. Toutefois, l'entrepreneur peut se faire libérer cette retenue immédiatement contre remise d'une Caution de Retenue de Garantie (Assurance), permettant ainsi une liquidité totale durant le chantier.",
              spacing: { after: 200 },
            }),

            // ARTICLE 3 : AUDIT ET QUALITÉ IA
            new Paragraph({
              text: 'ARTICLE 3 : CONTRÔLE QUALITÉ PAR VISION IA',
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: "L'entrepreneur accepte la procédure d'audit 'MissionSage Vision'. Chaque étape cruciale de l'installation (câblage, raccordement, pose compteur) devra faire l'objet d'un cliché transmis via l'interface GEM-MINT pour analyse instantanée par l'Intelligence Artificielle de PROQUELEC.",
              spacing: { after: 300 },
            }),

            // ARTICLE 4 : NORMES TECHNIQUES
            new Paragraph({
              text: 'ARTICLE 4 : RÉFÉRENTIELS TECHNIQUES',
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: "Les travaux doivent être strictement conformes à la norme NS 01-001 et aux prescriptions techniques de la Senelec. Toute anomalie détectée par l'IA ou les superviseurs devra être corrigée sous 48h.",
              spacing: { after: 600 },
            }),

            // SIGNATURES
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "L'ENTREPRENEUR (Bon pour accord)",
                          bold: true,
                          alignment: AlignmentType.CENTER,
                        } as any),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: 'LA DIRECTION GÉNÉRALE',
                          bold: true,
                          alignment: AlignmentType.CENTER,
                        } as any),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: '\n\n\n', spacing: { before: 800 } })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: '\n\n\n', spacing: { before: 800 } })],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({
              text: '\nDocument certifié par le système GEM-MINT de PROQUELEC',
              alignment: AlignmentType.CENTER,
              italics: true,
              spacing: { before: 600 },
            } as any),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `CONTRAT_CAHIER_CHARGES_${data.orderNumber.replace('/', '_')}.docx`);
  },
};
