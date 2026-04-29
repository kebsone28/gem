import { readFirstSheetJson } from './src/utils/safeExcel.js';

const filePath = 'C:\\Mes-Sites-Web\\GEM_SAAS\\archive\\Liste\\formulaire-kobo.xlsx';

try {
    const data = await readFirstSheetJson(filePath);
    
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
