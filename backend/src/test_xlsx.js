import XLSX from 'xlsx';

const filePath = 'C:/Mes-Sites-Web/GEM_SAAS/archive/Liste/aEYZwPujJiFBTNb6mxMGCB.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const surveySheet = workbook.Sheets['survey'];
    const data = XLSX.utils.sheet_to_json(surveySheet);
    
    console.log('--- SURVEY FIELDS ---');
    data.forEach(row => {
        if (row.type && row.name) {
            console.log(`[${row.type}] ${row.name} : ${row.label || ''}`);
        }
    });
} catch (err) {
    console.error('Error reading XLSX:', err);
}
