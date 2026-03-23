// src/utils/exportWord.ts
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
    BorderStyle,
    AlignmentType, 
    ImageRun,
} from "docx";
import { saveAs } from "file-saver";
import logger from './logger';

export interface ExportData {
    role: string;
    introduction: string;
    missions: string[];
    materials: string[];
    hse: string[];
    subcontracting: string[];
    startDate: string;
    endDate: string;
    responsible: string;
    contact: string;
    imagePath?: string;
}

const fetchImageAsArrayBuffer = async (url: string): Promise<ArrayBuffer | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.arrayBuffer();
    } catch (e) {
        logger.warn(`Could not load image: ${url}`, e);
        return null;
    }
};

const createRoleSection = async (data: ExportData) => {
    const { role, introduction, missions, materials, hse, subcontracting, responsible, imagePath, startDate, endDate, contact } = data;
    
    const children: any[] = [];

    // Header stylized
    children.push(
        new Paragraph({
            text: `CAHIER DES CHARGES : ${role.toUpperCase()}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
        })
    );

    // Image if available
    if (imagePath) {
        const buffer = await fetchImageAsArrayBuffer(imagePath);
        if (buffer) {
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new ImageRun({
                            data: buffer,
                            transformation: { width: 300, height: 220 },
                        } as any),
                    ],
                    spacing: { after: 300 }
                })
            );
        }
    }

    // Introduction
    children.push(
        new Paragraph({
            children: [
                new TextRun({ text: "1. INTRODUCTION", bold: true, size: 28, color: "0f172a" }),
            ],
            spacing: { before: 200, after: 100 },
        }),
        new Paragraph({
            children: [
                new TextRun({ text: introduction, italics: true, color: "334155" }),
            ],
            spacing: { after: 300 },
        })
    );

    // Missions (Bleu)
    if (missions.length) {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: "2. MISSIONS TECHNIQUES", bold: true, size: 26, color: "1d4ed8" })],
                spacing: { before: 200, after: 100 },
            })
        );
        missions.forEach(m => {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: m, color: "1e3a8a" })],
                    bullet: { level: 0 },
                    spacing: { after: 80 }
                })
            );
        });
    }

    // Matériel (Tableau simple)
    if (materials.length) {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: "3. MATÉRIEL & LOGISTIQUE", bold: true, size: 26, color: "ea580c" })],
                spacing: { before: 300, after: 150 },
            })
        );
        
        const rows = materials.map(m => new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ text: m })],
                    width: { size: 100, type: WidthType.PERCENTAGE }
                })
            ]
        }));

        children.push(new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        }));
    }

    // HSE (Vert)
    if (hse.length) {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: "4. SÉCURITÉ & HSE", bold: true, size: 26, color: "16a34a" })],
                spacing: { before: 300, after: 150 },
            })
        );
        
        hse.forEach(h => {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: `• ${h}`, color: "14532d", bold: true })],
                    spacing: { after: 100 },
                    indent: { left: 400 }
                })
            );
        });
    }

    // Sous-traitance (Ambre)
    if (subcontracting.length) {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: "5. CLAUSES DE SOUS-TRAITANCE (LSE COMPLIANCE)", bold: true, size: 26, color: "b45309" })],
                spacing: { before: 300, after: 150 },
            })
        );
        
        subcontracting.forEach(c => {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: `• ${c}`, color: "78350f" })],
                    spacing: { after: 80 },
                    indent: { left: 400 }
                })
            );
        });
    }

    // Infos complémentaires
    children.push(
        new Paragraph({
            children: [new TextRun({ text: "6. DÉTAILS D'EXÉCUTION", bold: true, size: 26, color: "475569" })],
            spacing: { before: 400, after: 150 },
        }),
        new Paragraph({ text: `Période prévue : du ${startDate} au ${endDate}` }),
        new Paragraph({ text: `Responsable assigné : ${responsible || "N/A"}` }),
        new Paragraph({ text: `Contact direct : ${contact || "N/A"}` })
    );

    // Signatures (Tableau sans bordures complexes)
    children.push(
        new Paragraph({ text: "", spacing: { before: 600 } }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({ 
                                    children: [new TextRun({ text: "VISA DIRECTION PROQUELEC", bold: true })],
                                    alignment: AlignmentType.CENTER 
                                }),
                                new Paragraph({ text: "", spacing: { before: 800 } }),
                                new Paragraph({ 
                                    children: [new TextRun({ text: `Fait le ${new Date().toLocaleDateString()}`, size: 18 })],
                                    alignment: AlignmentType.CENTER 
                                })
                            ],
                            borders: {
                                top: { style: BorderStyle.SINGLE, size: 1 },
                                bottom: { style: BorderStyle.SINGLE, size: 1 },
                                left: { style: BorderStyle.SINGLE, size: 1 },
                                right: { style: BorderStyle.SINGLE, size: 1 },
                            }
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ 
                                    children: [new TextRun({ text: `VISA PRESTATAIRE (${role.toUpperCase()})`, bold: true })],
                                    alignment: AlignmentType.CENTER 
                                }),
                                new Paragraph({ text: "", spacing: { before: 800 } }),
                                new Paragraph({ 
                                    children: [new TextRun({ text: "Signature et Cachet", size: 18 })],
                                    alignment: AlignmentType.CENTER 
                                })
                            ],
                            borders: {
                                top: { style: BorderStyle.SINGLE, size: 1 },
                                bottom: { style: BorderStyle.SINGLE, size: 1 },
                                left: { style: BorderStyle.SINGLE, size: 1 },
                                right: { style: BorderStyle.SINGLE, size: 1 },
                            }
                        })
                    ]
                })
            ]
        })
    );

    return children;
};

export const exportCahiersToWord = async (dataList: ExportData[], isMultiple: boolean = false) => {
    const sections: any[] = [];
    
    for (const data of dataList) {
        const roleChildren = await createRoleSection(data);
        
        sections.push({
            properties: {
                page: {
                    margin: {
                        top: 720,
                        right: 720,
                        bottom: 720,
                        left: 720,
                    },
                },
            },
            children: roleChildren,
        });
    }

    const doc = new Document({
        title: isMultiple ? "Cahier des Charges Complet" : `Cahier des Charges ${dataList[0].role}`,
        description: "Généré par GEM-SAAS",
        sections: sections
    });

    const blob = await Packer.toBlob(doc);
    const fileName = isMultiple ? "CDC_COMPLET_PROJET_RACCORDEMENT.docx" : `CDC_${dataList[0].role.replace(/\s+/g, '_')}.docx`;
    saveAs(blob, fileName);
};
