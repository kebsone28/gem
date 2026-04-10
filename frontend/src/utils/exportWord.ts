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
    PageBreak,
    ShadingType,
    VerticalAlign,
    Header,
    Footer,
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
    finances: string[];
    legal?: string[];
    startDate: string;
    endDate: string;
    responsible: string;
    contact: string;
    imagePath?: string;
    pricing?: {
        dailyRate: number;
        personnelCount: number;
        durationDays: number;
        penalties: string;
        currency: string;
    };
}

// Design Tokens (PROQUELEC Brand)
const COLORS = {
    PRIMARY: "2563eb",   // Blue 600
    SECONDARY: "1e1b4b", // Indigo 950
    ACCENT: "f97316",    // Orange 500
    SUCCESS: "059669",   // Emerald 600
    DANGER: "dc2626",    // Red 600
    SLATE: "475569",     // Slate 600
    BORDER: "cbd5e1",    // Slate 300
    WHITE: "FFFFFF",
    BG_LIGHT: "F8FAFC"
};

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

const createSectionHeader = (text: string, color: string) => {
    return new Paragraph({
        shading: {
            fill: color,
            type: ShadingType.SOLID,
            color: "auto",
        },
        padding: { top: 120, bottom: 120, left: 120 },
        children: [
            new TextRun({
                text: text.toUpperCase(),
                bold: true,
                size: 24,
                color: COLORS.WHITE,
                font: "Calibri",
            })
        ],
        spacing: { before: 400, after: 200 },
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.BORDER, space: 1 }
        }
    });
};

const createFrontPage = (title: string, subtitle?: string) => {
    return [
        new Paragraph({ text: "", spacing: { before: 2000 } }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: "REPUBLIQUE DU SENEGAL",
                    bold: true,
                    size: 28,
                    color: COLORS.SECONDARY,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: "Un Peuple - Un But - Une Foi",
                    italics: true,
                    size: 20,
                    color: COLORS.SLATE,
                })
            ]
        }),
        new Paragraph({ text: "", spacing: { before: 1000 } }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: "CAHIER DES CHARGES OPÉRATIONNEL",
                    bold: true,
                    size: 48,
                    color: COLORS.PRIMARY,
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: "PROJET D'ÉLECTRIFICATION RURALE & CONTRATS DE PERFORMANCE",
                    size: 24,
                    color: COLORS.SECONDARY,
                })
            ]
        }),
        new Paragraph({ text: "", spacing: { before: 1500 } }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: title.toUpperCase(),
                    bold: true,
                    size: 72,
                    color: COLORS.ACCENT,
                })
            ],
            border: {
                top: { style: BorderStyle.SINGLE, size: 12, color: COLORS.ACCENT, space: 10 },
                bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.ACCENT, space: 10 },
            },
            spacing: { before: 400, after: 400 }
        }),
        new Paragraph({ text: "", spacing: { before: 3000 } }),
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
                                        new TextRun({ text: "Généré par : ", bold: true }),
                                        new TextRun({ text: "Système GEM-SAAS PROQUELEC" })
                                    ]
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "Date d'émission : ", bold: true }),
                                        new TextRun({ text: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) })
                                    ]
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [
                                        new TextRun({ text: "RÉFÉRENCE MARCHÉ : ", bold: true }),
                                        new TextRun({ text: `PRQ-2026-${Math.random().toString(36).substring(7).toUpperCase()}` })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        }),
        new Paragraph({ children: [new PageBreak()] })
    ];
};

const createRoleSection = async (data: ExportData) => {
    const { role, introduction, missions, materials, hse, subcontracting, finances, legal, responsible, imagePath, startDate, endDate, contact, pricing } = data;
    
    const children: any[] = [];

    // Title Section
    children.push(
        new Paragraph({
            text: `BORDEREAU DÉTAILLÉ DU LOT : ${role.toUpperCase()}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            spacing: { before: 400, after: 400 },
        })
    );

    // Metadata Table
    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            shading: { fill: COLORS.BG_LIGHT },
                            children: [new Paragraph({ children: [new TextRun({ text: "RESPONSABLE", bold: true, size: 18 })] })],
                            width: { size: 25, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [new Paragraph({ text: responsible || "Non assigné", size: 18 })],
                            width: { size: 25, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            shading: { fill: COLORS.BG_LIGHT },
                            children: [new Paragraph({ children: [new TextRun({ text: "PÉRIODE", bold: true, size: 18 })] })],
                            width: { size: 25, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [new Paragraph({ text: `${startDate} au ${endDate}`, size: 18 })],
                            width: { size: 25, type: WidthType.PERCENTAGE }
                        })
                    ]
                })
            ],
            spacing: { after: 400 }
        })
    );

    // Image if available
    if (imagePath) {
        const buffer = await fetchImageAsArrayBuffer(imagePath);
        if (buffer) {
            children.push(
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new ImageRun({
                            data: buffer,
                            transformation: { width: 500, height: 350 },
                        } as any),
                    ],
                    spacing: { after: 400, before: 200 }
                })
            );
        }
    }

    // Introduction
    children.push(createSectionHeader("1. Objet du Contrat et Obligations de Résultat", COLORS.SECONDARY));
    children.push(
        new Paragraph({
            children: [
                new TextRun({ text: introduction, color: COLORS.SECONDARY, italics: true }),
            ],
            spacing: { after: 300, before: 100 },
            indent: { left: 240 }
        })
    );

    // Missions
    children.push(createSectionHeader("2. Descriptif des Missions Techniques", COLORS.PRIMARY));
    missions.forEach(m => {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: m, color: COLORS.SECONDARY })],
                bullet: { level: 0 },
                spacing: { before: 80, after: 80 },
                indent: { left: 480 }
            })
        );
    });

    // Material
    children.push(createSectionHeader("3. Matériel et Moyens Logistiques", COLORS.ACCENT));
    const materialRows = materials.map(m => new TableRow({
        children: [
            new TableCell({
                children: [new Paragraph({ text: `• ${m}`, spacing: { before: 40, after: 40 } })],
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                }
            })
        ]
    }));
    children.push(new Table({
        rows: materialRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
        }
    }));

    // HSE
    children.push(createSectionHeader("4. Sécurité, Santé et Environnement (HSE)", COLORS.SUCCESS));
    hse.forEach(h => {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: h, color: COLORS.SUCCESS, bold: true })],
                bullet: { level: 0 },
                spacing: { after: 60 },
                indent: { left: 480 }
            })
        );
    });

    // Subcontracting
    children.push(createSectionHeader("5. Dispositions de Sous-traitance", COLORS.SLATE));
    subcontracting.forEach(c => {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: c, color: COLORS.SLATE })],
                bullet: { level: 0 },
                spacing: { after: 60 },
                indent: { left: 480 }
            })
        );
    });

    // Finances
    children.push(createSectionHeader("6. Dispositions Financières et Garanties", COLORS.ACCENT));
    finances.forEach(f => {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: f, bold: true })],
                bullet: { level: 0 },
                spacing: { after: 60 },
                indent: { left: 480 }
            })
        );
    });

    // Legal
    if (legal && legal.length > 0) {
        children.push(createSectionHeader("7. Cadre Juridique et Responsabilité", COLORS.DANGER));
        legal.forEach(l => {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: l, color: COLORS.DANGER, size: 20 })],
                    bullet: { level: 0 },
                    spacing: { after: 60 },
                    indent: { left: 480 }
                })
            );
        });
    }

    // Pricing Table
    if (pricing) {
        children.push(createSectionHeader("8. Bordereau de Prix Unitaire (BPU)", COLORS.PRIMARY));
        
        const headerRow = new TableRow({
            children: [
                "Désignation", "Qté", "Durée (j)", "P.U (FCFA)", "TOTAL (FCFA)"
            ].map(h => new TableCell({
                shading: { fill: COLORS.BG_LIGHT },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, color: COLORS.SECONDARY })] })]
            }))
        });

        const totalValue = pricing.dailyRate * pricing.personnelCount * pricing.durationDays;
        
        const dataRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ text: role })] }),
                new TableCell({ alignment: AlignmentType.CENTER, children: [new Paragraph({ text: pricing.personnelCount.toString(), alignment: AlignmentType.CENTER })] }),
                new TableCell({ alignment: AlignmentType.CENTER, children: [new Paragraph({ text: pricing.durationDays.toString(), alignment: AlignmentType.CENTER })] }),
                new TableCell({ alignment: AlignmentType.CENTER, children: [new Paragraph({ text: pricing.dailyRate.toLocaleString(), alignment: AlignmentType.CENTER })] }),
                new TableCell({ 
                    shading: { fill: COLORS.PRIMARY, type: ShadingType.SOLID, color: "auto" },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: totalValue.toLocaleString(), bold: true, color: COLORS.WHITE })] })] 
                }),
            ]
        });

        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, dataRow]
        }));

        children.push(
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({ text: "MONTANT TOTAL DU LOT : ", bold: true, size: 28 }),
                    new TextRun({ text: `${totalValue.toLocaleString()} ${pricing.currency}`, bold: true, size: 32, color: COLORS.PRIMARY })
                ],
                spacing: { before: 300, after: 400 }
            })
        );
    }

    // Execution Table (Drafting terms)
    children.push(
        new Paragraph({ text: "", spacing: { before: 800 } }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    height: { value: 2000, rule: "atLeast" },
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({ 
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: "VISA DIRECTION GENERALE PROQUELEC", bold: true, size: 20 })]
                                }),
                                new Paragraph({ text: "", spacing: { before: 1000 } }),
                                new Paragraph({ alignment: AlignmentType.CENTER, text: "Cachet et Signature" })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ 
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: `VISA TITULAIRE (${role.toUpperCase()})`, bold: true, size: 20 })]
                                }),
                                new Paragraph({ text: "", spacing: { before: 1000 } }),
                                new Paragraph({ alignment: AlignmentType.CENTER, text: "Cachet et Signature" })
                            ]
                        })
                    ]
                })
            ]
        })
    );

    return children;
};

export const exportCahiersToWord = async (tasks: ExportData[], isMultiple: boolean, generalClauses?: string[]) => {
    const allSections: any[] = [];
    
    // 1. Front Page
    const mainTitle = isMultiple ? "Cahiers des Charges Complets" : tasks[0].role;
    allSections.push({
        children: createFrontPage(mainTitle)
    });

    // 2. Dispositions Générales
    if (generalClauses && generalClauses.length > 0) {
        const generalChildren: any[] = [
            new Paragraph({
                text: "ANNEXE 0 : DISPOSITIONS GÉNÉRALES DU MARCHÉ",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 400 },
            })
        ];
        
        generalClauses.forEach(clause => {
            generalChildren.push(
                new Paragraph({
                    text: clause,
                    border: {
                        bottom: { color: COLORS.BORDER, space: 1, style: BorderStyle.SINGLE, size: 1 },
                    },
                    spacing: { before: 150, after: 150 },
                })
            );
        });
        
        generalChildren.push(new Paragraph({ children: [new PageBreak()] }));
        
        allSections.push({
            children: generalChildren
        });
    }

    // 3. Trade Specific Sections
    for (const task of tasks) {
        const children = await createRoleSection(task);
        if (tasks.indexOf(task) < tasks.length - 1) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
        }
        
        allSections.push({
            properties: {
                page: {
                    margin: {
                        top: 1000,
                        right: 1000,
                        bottom: 1000,
                        left: 1000,
                    },
                },
            },
            children
        });
    }

    const doc = new Document({
        creator: "GEM-SAAS PROQUELEC",
        title: isMultiple ? "Cahiers des Charges Complets" : `Cahier des Charges ${tasks[0].role}`,
        sections: allSections,
    });

    const blob = await Packer.toBlob(doc);
    const fileName = isMultiple ? "BORDEREAU_CONTRACTUEL_COMPLET_PROQUELEC.docx" : `BORDEREAU_${tasks[0].role.replace(/\s+/g, '_')}_PRQ.docx`;
    saveAs(blob, fileName);
};
