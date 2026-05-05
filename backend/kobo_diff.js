import fs from 'fs';

// 1. Lire le Kobo JSON
const data = JSON.parse(fs.readFileSync('kobo_form.json', 'utf8'));
const koboFields = data.content?.survey?.map(f => f.name).filter(Boolean) || [];

// 2. Extraire les champs de internalKoboFormDefinition.ts
const tsContent = fs.readFileSync('../frontend/src/components/terrain/internalKoboFormDefinition.ts', 'utf8');

// Regex pour extraire les "name: '...'"
const gemFields = [];
const nameRegex = /name:\s*'([^']+)'/g;
let match;
while ((match = nameRegex.exec(tsContent)) !== null) {
  gemFields.push(match[1]);
}

const missingInGem = koboFields.filter(f => !gemFields.includes(f));
const extraInGem = gemFields.filter(f => !koboFields.includes(f) && f !== 'roles');

console.log('--- CHAMPS MANQUANTS DANS GEM ---');
const missingDetailed = data.content?.survey?.filter(f => missingInGem.includes(f.name)).map(f => `${f.type} | ${f.name} | ${f.label?.[0] || f.label}`);
console.log(missingDetailed.join('\n'));

console.log('\n--- CHAMPS EXTRA DANS GEM ---');
console.log(extraInGem.join('\n'));

