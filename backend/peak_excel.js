
import path from 'path';
import { readFirstSheetJson } from './src/utils/safeExcel.js';

const filePath = 'c:/Mes-Sites-Web/GEM_SAAS/Liste/Liste-LSE.xlsx';

try {
    const data = await readFirstSheetJson(filePath, { header: 1 });

    console.log('--- Excel Peak (First 10 rows) ---');
    console.log(JSON.stringify(data.slice(0, 10), null, 2));
} catch (e) {
    console.error('Error reading Excel:', e.message);
}
