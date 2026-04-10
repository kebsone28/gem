
const https = require('https');
const fs = require('fs');

const TOKEN = '2e3a09a8bff3fbb3a2510dbcba84486582897f3f';
const FORM_ID = 'aEYZwPujJiFBTNb6mxMGCB';
const url = `https://kf.kobotoolbox.org/api/v2/assets/${FORM_ID}/?format=json`;

const options = {
    headers: { 'Authorization': `Token ${TOKEN}` }
};

https.get(url, options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const data = JSON.parse(rawData);
            const survey = data.content.survey;
            const choices = data.content.choices;

            const sections = [
                { name: 'LIVREUR', pattern: 'note_Livreur' },
                { name: 'MAÇON', pattern: 'etape_macon' },
                { name: 'RÉSEAU', pattern: 'etape_reseau' },
                { name: 'INTÉRIEUR', pattern: 'etape_interieur' },
                { name: 'CONTRÔLEUR', pattern: 'etape_controleur' }
            ];

            let result = {};
            survey.forEach(q => {
                const path = q.$xpath || '';
                sections.forEach(s => {
                    if (path.includes(s.pattern)) {
                        if (!result[s.name]) result[s.name] = [];
                        if (q.label && q.label[0]) {
                            let item = { label: q.label[0], type: q.type };
                            if (q.select_from_list_name) {
                                item.choices = choices
                                    .filter(c => c.list_name === q.select_from_list_name)
                                    .map(c => c.label[0]);
                            }
                            result[s.name].push(item);
                        }
                    }
                });
            });

            console.log(JSON.stringify(result, null, 2));
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error fetching data:', e.message);
});
