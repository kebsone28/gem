
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('kobo_form.json', 'utf8'));

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
                let item = { name: q.name, label: q.label[0], type: q.type };
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
