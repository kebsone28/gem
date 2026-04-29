
import { readFirstSheetJson } from './src/utils/safeExcel.js';

const filePath = 'c:/Mes-Sites-Web/GEM_SAAS/Liste/Liste-LSE.xlsx';

try {
    const data = await readFirstSheetJson(filePath);

    console.log('--- Column Names ---');
    if (data.length > 0) {
        console.log(Object.keys(data[0]));
        console.log('--- Sample Row ---');
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log('No data found');
    }
} catch (e) {
    console.error('Error reading Excel:', e.message);
}
