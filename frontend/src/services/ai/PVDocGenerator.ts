import { 
  Document, Paragraph, TextRun, Table, TableRow, TableCell, 
  WidthType, BorderStyle, AlignmentType, HeadingLevel, ImageRun, Packer 
} from "docx";
import { saveAs } from "file-saver";
import QRCode from "qrcode";
import { PV_TEMPLATES, PVAIEngine } from "./PVAIEngine";
import type { PVType } from "./PVAIEngine";

export const PVDocGenerator = {
  generateIndividualDoc: async (submission: any, type: PVType, signatures: { prestataire?: string | null, boss?: string | null }) => {
    const tmpl = PV_TEMPLATES[type];
    const aiContent = PVAIEngine.generateContent(submission, type);

    // QR Code
    const qrDataUrl = await QRCode.toDataURL(aiContent.referenceContractuelle, { margin: 1, scale: 4, color: { dark: '#1e293b' } });
    const qrBytes = new Uint8Array(window.atob(qrDataUrl.split(',')[1]).split('').map(c => c.charCodeAt(0)));

    // Signatures
    let sigPrestataire = null;
    if (signatures.prestataire) {
      const b = new Uint8Array(window.atob(signatures.prestataire.split(',')[1]).split('').map(c => c.charCodeAt(0)));
      sigPrestataire = new ImageRun({ data: b, transformation: { width: 180, height: 60 } });
    }

    let sigBoss = null;
    if (signatures.boss) {
      const b = new Uint8Array(window.atob(signatures.boss.split(',')[1]).split('').map(c => c.charCodeAt(0)));
      sigBoss = new ImageRun({ data: b, transformation: { width: 180, height: 60 } });
    }

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: "Segoe UI", size: 22, color: "1e293b" } },
          heading1: {
            run: { font: "Segoe UI", size: 32, bold: true, color: "0f172a" },
            paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 300 } },
          },
          heading2: {
            run: { font: "Segoe UI", size: 24, bold: true, color: "0284c7" },
            paragraph: { spacing: { before: 400, after: 150 } },
          }
        }
      },
      sections: [{
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, insideVertical: { style: BorderStyle.NIL }, insideHorizontal: { style: BorderStyle.NIL } },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 75, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: tmpl.title.toUpperCase(), heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT })]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: qrBytes, transformation: { width: 60, height: 60 } })] }),
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Authenticité Vérifiée", size: 12, italic: true, color: "64748b" })] })
                    ]
                  })
                ]
              })
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, insideHorizontal: { style: BorderStyle.NIL }, insideVertical: { style: BorderStyle.NIL } },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "RÉFÉRENCE : ", bold: true, color: "64748b" }), new TextRun({ text: aiContent.referenceContractuelle, bold: true })] }),
                      new Paragraph({ children: [new TextRun({ text: "MÉNAGE : ", bold: true, color: "64748b" }), new TextRun({ text: `${submission.name || 'Inconnu'} (Lot ${submission.numeroordre || 'N/A'})` })] })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "DATE D'ÉDITION : ", bold: true, color: "64748b" }), new TextRun(new Date().toLocaleDateString('fr-FR'))] }),
                      new Paragraph({ children: [new TextRun({ text: "STATUT : ", bold: true, color: "10b981" }), new TextRun({ text: "VALIDÉ", bold: true, color: "10b981" })] })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "1. CONSTATS TECHNIQUES", heading: HeadingLevel.HEADING_2 }),
          ...(aiContent.description.split('\n').map(line => new Paragraph({ text: line, alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } }))),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "2. POINTS DE CONTRÔLE VÉRIFIÉS", heading: HeadingLevel.HEADING_2 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ children: [new TextRun({ text: "POINT DE VÉRIFICATION", color: "ffffff", bold: true })] })], margins: { left: 100 } }),
                  new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "STATUT", color: "ffffff", bold: true })] })] }),
                  new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CONFORMITÉ", color: "ffffff", bold: true })] })] }),
                ]
              }),
              ...(aiContent.checklist?.map(c => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: c.point })], margins: { left: 100 } }),
                  new TableCell({ children: [new Paragraph({ text: c.status, alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: c.conforme ? "CONFORME" : "NON CONFORME", alignment: AlignmentType.CENTER })] }),
                ]
              })) || [])
            ]
          }),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "3. MATÉRIEL ASSOCIÉ & MESURES", heading: HeadingLevel.HEADING_2 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ children: [new TextRun({ text: "DÉSIGNATION", color: "ffffff", bold: true })] })], margins: { left: 100 } }),
                  new TableCell({ shading: { fill: "334155" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "QUANTITÉ", color: "ffffff", bold: true })] })] }),
                ]
              }),
              ...(aiContent.materials?.map(m => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: m.item })], margins: { left: 100 } }),
                  new TableCell({ children: [new Paragraph({ text: `${m.quantity} ${m.unit}`, alignment: AlignmentType.CENTER })] }),
                ]
              })) || [])
            ]
          }),

          new Paragraph({ text: "" }),
          new Paragraph({ text: "4. RECOMMANDATIONS", heading: HeadingLevel.HEADING_2 }),
          ...(aiContent.recommendations?.map(r => new Paragraph({ text: `• ${r}` })) || []),

          new Paragraph({ text: "", spacing: { before: 800 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL }, insideVertical: { style: BorderStyle.NIL } },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "VISA DIRECTION", bold: true, alignment: AlignmentType.CENTER }), ...(sigBoss ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [sigBoss] })] : [])] }),
                  new TableCell({ children: [new Paragraph({ text: "VISA PRESTATAIRE", bold: true, alignment: AlignmentType.CENTER }), ...(sigPrestataire ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [sigPrestataire] })] : [])] })
                ]
              })
            ]
          })
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `PV_${type}_${submission.numeroordre || submission.id}.docx`);
  }
};
