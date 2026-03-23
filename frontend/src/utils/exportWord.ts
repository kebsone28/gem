// src/utils/exportWord.ts

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
    image?: string; // Base64 image
}

import logger from './logger';

const getBase64Image = async (imgUrl: string): Promise<string | null> => {
    try {
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        logger.warn('Could not load image for export', e);
        return null;
    }
};

const generateRoleHTML = (data: ExportData) => {
    const { role, introduction, missions, materials, hse, subcontracting, startDate, endDate, responsible, image } = data;
    return `
        <div style="background: #0f172a; padding: 25px; border-bottom: 6px solid #f59e0b;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td>
                        <div style="text-align: left; font-size: 8pt; color: #94a3b8; font-weight: bold; letter-spacing: 2px;">DOCUMENT TECHNIQUE OFFICIEL - PROQUELEC SA</div>
                        <h1 style="color: #ffffff; font-size: 24pt; margin: 10px 0 0 0; text-transform: uppercase; font-weight: 900;">Cahier des Charges</h1>
                        <div style="color: #f59e0b; font-size: 16pt; font-weight: bold; margin-bottom: 5px;">MÉTIER : ${role.toUpperCase()}</div>
                    </td>
                    <td style="text-align: right; vertical-align: top;">
                        <div style="font-size: 9pt; color: #94a3b8;">Réf: CDC-${role.toUpperCase()}-2026</div>
                    </td>
                </tr>
            </table>
        </div>

        <table style="width: 100%; margin-top: 30px; border-collapse: collapse; table-layout: fixed;">
            <tr>
                <!-- Colonne Gauche: IMAGE Réduite (165pt / ~5.8cm) -->
                <td style="width: 165pt; vertical-align: top; padding-right: 25px;">
                    <div style="border: 1px solid #e2e8f0; padding: 10px; background: #ffffff; border-radius: 10px;">
                        ${image ?
            `<img src="${image}" width="100%" height="auto" style="display: block; border-radius: 6px;" alt="Technical illustration"/>` :
            '<div style="height: 200px; background: #f1f5f9; text-align: center; line-height: 200px; color: #94a3b8; border-radius: 6px;">N/A</div>'
        }
                        <div style="margin-top: 10px; padding: 10px; background: #0f172a; color: #ffffff; border-radius: 6px;">
                            <div style="font-size: 7pt; font-weight: bold; color: #f59e0b; text-transform: uppercase;">Référentiel</div>
                            <div style="font-size: 9pt; font-weight: bold; line-height: 1.1;">${role}</div>
                        </div>
                    </div>

                    <div style="margin-top: 25px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc;">
                        <h3 style="color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; font-size: 11pt; margin-top: 0;">Logistique</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                            <tr><td style="padding: 4px 0; color: #64748b; font-weight: bold;">Signataire</td></tr>
                            <tr><td style="padding-bottom: 8px; font-weight: 700; color: #1e293b;">${responsible || 'Non Assigné'}</td></tr>
                            <tr><td style="padding: 4px 0; color: #64748b; font-weight: bold;">Période</td></tr>
                            <tr><td style="color: #1e293b;">${startDate} - ${endDate}</td></tr>
                        </table>
                    </div>
                </td>

                <!-- Colonne Droite: CONTENU ÉLARGI -->
                <td style="vertical-align: top;">
                    <h2 style="color: #0c4a6e; font-size: 16pt; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #0c4a6e; padding-bottom: 5px;">1. Spécifications & Missions</h2>
                    <div style="padding: 15px; background: #f0f9ff; border-left: 5px solid #0ea5e9; font-style: italic; font-size: 11pt; line-height: 1.6; color: #0c4a6e; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
                        ${introduction}
                    </div>

                    <h3 style="color: #0ea5e9; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">DÉTAILS DES PHASES TECHNIQUES</h3>
                    <ul style="margin: 0; padding-left: 20px; font-size: 11pt; color: #1e293b;">
                        ${missions.map(m => `<li style="margin-bottom: 12px; line-height: 1.4;">${m}</li>`).join('')}
                    </ul>

                    <h3 style="color: #d97706; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 35px; border-top: 1px solid #fed7aa; padding-top: 15px; margin-bottom: 15px;">MATÉRIEL & LOGISTIQUE</h3>
                    <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 15px; border-radius: 12px; color: #92400e; font-size: 10pt;">
                        ${materials.map(m => `• ${m}`).join('<br/>')}
                    </div>

                    <h3 style="color: #dc2626; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 35px; border-top: 1px solid #fecaca; padding-top: 15px; margin-bottom: 15px;">SÉCURITÉ & HSE</h3>
                    <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 20px; border-radius: 12px; margin-bottom: 30px;">
                        <ul style="margin: 0; padding-left: 20px; font-size: 10pt; color: #991b1b;">
                            ${hse.map(m => `<li style="margin-bottom: 6px;">${m}</li>`).join('')}
                        </ul>
                    </div>

                    ${subcontracting && subcontracting.length > 0 ? `
                        <h3 style="color: #7c3aed; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 35px; border-top: 1px solid #ddd6fe; padding-top: 15px; margin-bottom: 15px;">CLAUSES DE SOUS-TRAITANCE</h3>
                        <div style="background: #f5f3ff; border: 1px solid #ede9fe; padding: 20px; border-radius: 12px;">
                            <ul style="margin: 0; padding-left: 20px; font-size: 10pt; color: #5b21b6;">
                                ${subcontracting.map(c => `<li style="margin-bottom: 6px;">${c}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </td>
            </tr>
        </table>

        <!-- Pied de page / Signature -->
        <div style="margin-top: 50px;">
            <table style="width: 100%; border-collapse: separate; border-spacing: 15pt 0;">
                <tr>
                    <td style="width: 50%; padding: 40px 20px; border: 2px dashed #94a3b8; border-radius: 15px; text-align: center;">
                        <div style="font-size: 11pt; font-weight: bold; color: #475569; margin-bottom: 50px;">VISA DIRECTION TECHNIQUE</div>
                        <div style="font-size: 8pt; color: #94a3b8;">Fait à Dakar, le ________________</div>
                    </td>
                    <td style="width: 50%; padding: 40px 20px; border: 2px dashed #94a3b8; border-radius: 15px; text-align: center;">
                        <div style="font-size: 11pt; font-weight: bold; color: #475569; margin-bottom: 50px;">VISA PRESTATAIRE (${role.toUpperCase()})</div>
                        <div style="font-size: 8pt; color: #94a3b8;">Signature et Empreinte</div>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

export const exportCahiersToWord = async (dataList: any[], isMultiple: boolean = false) => {
    const logoBase64 = await getBase64Image('/logo-proquelec.png');
    const logoHtml = logoBase64 ? `<div style="text-align: center; margin-bottom: 30px;"><img src="${logoBase64}" height="75" alt="Proquelec"/></div>` : '';

    const processedDataList = await Promise.all(dataList.map(async (data) => {
        if (data.imagePath) {
            const imgBase64 = await getBase64Image(data.imagePath);
            return { ...data, image: imgBase64 };
        }
        return data;
    }));

    const contentHtml = processedDataList.map((data, index) => {
        const pageBreak = index > 0 ? '<br clear="all" style="mso-special-character:line-break; page-break-before:always" />' : '';
        return pageBreak + generateRoleHTML(data);
    }).join('\n');

    const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset='utf-8'>
        <style>
            @page { 
                size: A4; 
                margin: 1.5cm 1.5cm 1.5cm 1.5cm; 
                mso-page-orientation: portrait;
                mso-header-margin: 35.4pt;
                mso-footer-margin: 35.4pt;
            }
            body { font-family: 'Calibri', 'Segoe UI', sans-serif; color: #1e293b; line-height: 1.4; font-size: 11pt; }
        </style>
    </head>
    <body style="tab-interval: 35.4pt;">
        ${logoHtml}
        ${contentHtml}
        <div style="margin-top: 50px; border-top: 1px solid #cbd5e1; padding-top: 15px; font-size: 8pt; color: #94a3b8; text-align: center;">
            Document généré par GEM-SAAS - Proquelec Raccordement Senelec (Audit 2026)
        </div>
    </body>
    </html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    if (isMultiple) {
        link.download = `CDC_COMPLET_PROJET_RACCORDEMENT.doc`;
    } else {
        link.download = `CDC_${dataList[0].role.replace(/\s+/g, '_')}.doc`;
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
