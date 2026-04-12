import dotenv from 'dotenv';
dotenv.config();

const KOBO_API_URL = 'https://kf.kobotoolbox.org';
const KOBO_TOKEN = process.env.KOBO_TOKEN;
const KOBO_FORM_ID = process.env.KOBO_FORM_ID;

async function checkKobo() {
    console.log(`Checking Form: ${KOBO_FORM_ID}`);
    const url = `${KOBO_API_URL}/api/v2/assets/${KOBO_FORM_ID}/data/?format=json&limit=100`;
    
    const response = await fetch(url, {
        headers: {
            Authorization: `Token ${KOBO_TOKEN}`
        }
    });
    
    if (!response.ok) {
        console.error('Kobo Error:', response.status);
        console.log(await response.text());
        return;
    }
    
    const data = await response.json();
    console.log(`Count in Kobo: ${data.count}`);
    console.log(`Results returned in this page: ${data.results?.length}`);
    if (data.results?.length > 0) {
        console.log('Sample Row keys:', Object.keys(data.results[0]));
        console.log('Sample Row Numero_ordre:', data.results[0].Numero_ordre);
    }
}

checkKobo();
