// src/utils/exportWord.ts

export interface ExportData {
    role: string;
    missions: string[];
    materials: string[];
    hse: string[];
    startDate: string;
    endDate: string;
    responsible: string;
    contact: string;
}

export const exportCahierToWord = (data: ExportData) => {
    const { role, missions, materials, hse, startDate, endDate, responsible, contact } = data;

    const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset='utf-8'>
        <style>
            @page { size: A4; margin: 2.5cm; }
            body { font-family: 'Calibri', 'Arial', sans-serif; color: #334155; line-height: 1.5; font-size: 11pt; }
            .header-box { border-bottom: 3px solid #4f46e5; margin-bottom: 25px; padding-bottom: 15px; }
            h1 { color: #4f46e5; font-size: 24pt; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .subtitle { color: #64748b; font-size: 10pt; font-weight: bold; margin-top: 5px; }
            h2 { color: #3730a3; border-left: 5px solid #3730a3; padding-left: 12px; margin-top: 25px; margin-bottom: 10px; font-size: 14pt; background: #f8fafc; padding-top: 5px; padding-bottom: 5px; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .meta-table td { border: 1px solid #e2e8f0; padding: 8px; font-size: 9pt; }
            .label { font-weight: bold; color: #475569; width: 25%; background: #f1f5f9; }
            ul { margin-top: 5px; margin-bottom: 10px; }
            li { margin-bottom: 4px; }
            .alert-box { background: #fff7ed; border: 1px solid #ffedd5; color: #9a3412; padding: 15px; border-radius: 6px; margin: 15px 0; font-size: 10pt; }
            .signature-section { margin-top: 50px; }
            .signature-box { border: 1px solid #cbd5e1; padding: 20px; width: 45%; display: inline-block; vertical-align: top; height: 150px; text-align: left; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; color: #94a3b8; text-align: center; }
        </style>
    </head>
    <body>
        <div class="header-box">
            <div style="text-align: right; font-size: 8pt; color: #94a3b8;">Document Réf: LSE-CDC-${role.toUpperCase()}-2026</div>
            <h1>Cahier des Charges Opérationnel</h1>
            <div class="subtitle">Missions : Équipe ${role}</div>
        </div>

        <table class="meta-table">
            <tr><td class="label">Période du projet</td><td>Du ${startDate || '--'} au ${endDate || '--'}</td><td class="label">Responsable Terrain</td><td>${responsible || 'À définir'}</td></tr>
            <tr><td class="label">Lieu(x) d'intervention</td><td>Toute la zone</td><td class="label">Contact / Mobile</td><td>${contact || 'À définir'}</td></tr>
        </table>

        <h2>1. Contexte du Projet</h2>
        <p>Dans le cadre du programme d'électrification massive, nous mandaton l'équipe <strong>${role}</strong> pour l'exécution des travaux techniques sur les zones définies ci-après. Ce document cadre les obligations de résultat, de qualité et de sécurité.</p>

        <h2>2. Sécurité & HSE (Crucial)</h2>
        <div class="alert-box">
            <strong>Attention :</strong> La sécurité est une condition de maintien du contrat. 
            <ul>${hse.map(m => `<li>⚠️ ${m}</li>`).join('')}</ul>
        </div>

        <h2>3. Tâches & Missions Techniques</h2>
        <ul>${missions.map(m => `<li>✅ ${m}</li>`).join('')}</ul>

        <h2>4. Matériel & Outillage</h2>
        <p>Liste minimum requise par équipe :</p>
        <ul>${materials.map(m => `<li>🛠️ ${m}</li>`).join('')}</ul>

        <h2>5. Reporting & Données</h2>
        <p>Chaque intervention doit faire l'objet d'une remontée digitale via <strong>KoboCollect</strong>. Une zone non renseignée est considérée comme non effectuée.</p>

        <div class="signature-section">
            <div class="signature-box" style="margin-right: 5%;">
                <strong>Direction</strong><br><br>
                <div style="font-size: 8pt; margin-top: 50px;">Date et signature :</div>
            </div>
            <div class="signature-box">
                <strong>PRESTATAIRE / RESPONSABLE</strong><br>
                ${responsible || ''}<br>
                <div style="font-size: 8pt; margin-top: 50px;">Date et signature :</div>
            </div>
        </div>

        <div class="footer">
            Document généré automatiquement par GEM SaaS
        </div>
    </body>
    </html>`;

    // Create the Blob with ms-word mime type
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CDC_${role.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
