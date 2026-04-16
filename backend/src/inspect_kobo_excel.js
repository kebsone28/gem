/* eslint-disable no-console, @typescript-eslint/no-unused-vars */
import xlsx from 'xlsx';

const EXCEL_PATH = 'C:/Mes-Sites-Web/GEM_SAAS/archive/Liste/Suivi_Électrification_menages_V2.xlsx';

function inspectExcel() {
    console.log(`--- 📊 Inspection du fichier Excel Kobo ---`);
    try {
        const workbook = xlsx.readFile(EXCEL_PATH);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        console.log(`Nombre total de lignes dans l'Excel : ${data.length}`);
        
        if (data.length > 0) {
            console.log('\n--- Colonnes détectées dans l\'Excel ---');
            console.log(Object.keys(data[0]));

            console.log('\n--- Échantillon des 5 premiers ménages ---');
            data.slice(0, 5).forEach((row, i) => {
                console.log(`Ligne ${i + 1} :`);
                console.log(`  > Numero ordre (Brut)  : [${row['Numero ordre']}] (Type: ${typeof row['Numero ordre']})`);
                console.log(`  > Prénom et Nom        : [${row['Prénom et Nom']}]`);
            });

            // Vérifier spécifiquement si un ménage se termine par .0 ou 0
            const suspicious = data.filter(r => String(r['Numero ordre']).endsWith('0') || String(r['Numero ordre']).includes('.0'));
            console.log(`\nNombre de numéros se terminant par 0 ou .0 : ${suspicious.length}`);
        }
    } catch (e) {
        console.error('Erreur lors de la lecture :', e.message);
    }
}

inspectExcel();
