import XLSX from 'xlsx';

const filePath = 'C:/Mes-Sites-Web/GEM_SAAS/archive/Liste/aEYZwPujJiFBTNb6mxMGCB.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const choicesSheet = workbook.Sheets['choices'];
    if (choicesSheet) {
        const choicesData = XLSX.utils.sheet_to_json(choicesSheet);
        console.log('\n--- VALUES FOR etat_installation ---');
        choicesData.forEach(row => {
            if (row.list_name === 'etat_installation') {
                console.log(`- ${row.name} (${row.label})`);
            }
        });

        console.log('\n--- VALUES FOR roles ---');
        choicesData.forEach(row => {
            if (row.list_name === 'roles') {
                console.log(`- ${row.name} (${row.label})`);
            }
        });
    }
} catch (err) {
    console.error('Error reading XLSX:', err);
}
