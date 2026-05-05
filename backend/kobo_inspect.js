import fs from 'fs';

const data = JSON.parse(fs.readFileSync('kobo_form.json', 'utf8'));

const survey = data.content?.survey || [];
const choices = data.content?.choices || [];

console.log('--- SURVEY FIELDS ---');
const fields = survey.map(f => `${f.type} | ${f.name} | ${f.label?.[0] || f.label}`);
console.log(fields.join('\n'));

console.log('\n--- SETTINGS ---');
console.log(JSON.stringify(data.settings, null, 2));

console.log(`\nTotal questions: ${survey.length}, Total choices options: ${choices.length}`);
