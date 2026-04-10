const TOKEN = '2e3a09a8bff3fbb3a2510dbcba84486582897f3f';
const FORM_ID = 'aEYZwPujJiFBTNb6mxMGCB';
const url = `https://kf.kobotoolbox.org/api/v2/assets/${FORM_ID}/data/?format=json&limit=10`;

async function fetchSample() {
    const response = await fetch(url, {
        headers: {
            'Authorization': `Token ${TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    console.log(JSON.stringify(data.results[0], null, 2));
}

fetchSample().catch(console.error);
