import dotenv from 'dotenv';
dotenv.config();

const KOBO_API_URL = process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org';
const KOBO_TOKEN = process.env.KOBO_TOKEN;
const KOBO_FORM_ID = process.env.KOBO_FORM_ID;

async function testKobo() {
    try {
        console.log(`--- KOBO API TEST ---`);
        console.log(`URL: ${KOBO_API_URL}`);
        console.log(`Form ID: ${KOBO_FORM_ID}`);
        
        let url = `${KOBO_API_URL}/api/v2/assets/${KOBO_FORM_ID}/data/?format=json&limit=5000`;
        
        const response = await fetch(url, {
            headers: {
                Authorization: `Token ${KOBO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Kobo API error ${response.status}: ${text}`);
        }

        const data = await response.json();
        const results = data.results || [];
        console.log(`Total submissions in Kobo: ${results.length}`);
        
        if (results.length > 0) {
            console.log('Sample submission (first few fields):');
            const sample = results[0];
            const keys = Object.keys(sample).slice(0, 10);
            const preview = {};
            keys.forEach(k => preview[k] = sample[k]);
            console.log(JSON.stringify(preview, null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

testKobo();
