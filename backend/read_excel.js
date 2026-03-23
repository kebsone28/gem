import XLSX from 'xlsx';

const filePath = 'C:\\Mes-Sites-Web\\GEM_SAAS\\archive\\Liste\\formulaire-kobo.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log('--- ALL FIELD NAMES ---');
    const names = data.map(r => r.name).filter(Boolean);
    console.log(JSON.stringify(names));
    
    // Detailed search
    const details = data.map(r => ({ name: r.name, label: r['label::Français (fr)'] })).filter(r => r.name);
    console.log('--- FIELD DETAILS ---');
    console.log(JSON.stringify(details));

} catch (e) {
    console.error('Error reading Excel:', e.message);
}
