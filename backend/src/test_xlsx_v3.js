import XLSX from 'xlsx';

const filePath = 'C:/Mes-Sites-Web/GEM_SAAS/archive/Liste/aEYZwPujJiFBTNb6mxMGCB.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const choicesSheet = workbook.Sheets['choices'];
    if (choicesSheet) {
        const choicesData = XLSX.utils.sheet_to_json(choicesSheet);
        const listNames = new Set();
        choicesData.forEach(row => {
            if (row.list_name) listNames.add(row.list_name);
        });
        
        console.log('--- ALL CHOICE LISTS ---');
        listNames.forEach(ln => console.log(ln));
        
        console.log('\n--- VALUES FOR rr4dg37 (ETAT_DE_L_INSTALLATION) ---');
        choicesData.forEach(row => {
            if (row.list_name === 'rr4dg37') {
                console.log(`- ${row.name} (${row.label})`);
            }
        });
    }
} catch (err) {
    console.error('Error reading XLSX:', err);
}
