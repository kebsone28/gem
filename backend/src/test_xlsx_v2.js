import XLSX from 'xlsx';

const filePath = 'C:/Mes-Sites-Web/GEM_SAAS/archive/Liste/aEYZwPujJiFBTNb6mxMGCB.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const surveySheet = workbook.Sheets['survey'];
    const surveyData = XLSX.utils.sheet_to_json(surveySheet);
    
    console.log('--- SURVEY NAMES ---');
    surveyData.forEach(row => {
        if (row.name) console.log(row.name);
    });

    const choicesSheet = workbook.Sheets['choices'];
    if (choicesSheet) {
        const choicesData = XLSX.utils.sheet_to_json(choicesSheet);
        console.log('\n--- CHOICE VALUES (statut_installation) ---');
        choicesData.forEach(row => {
            if (row.list_name === 'statut_installation' || row.list_name?.includes('statut')) {
                console.log(`${row.list_name}: ${row.name} (${row.label || ''})`);
            }
        });
    }
} catch (err) {
    console.error('Error reading XLSX:', err);
}
