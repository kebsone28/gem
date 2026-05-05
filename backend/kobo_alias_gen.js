import fs from 'fs';

const mapped = JSON.parse(fs.readFileSync('kobo_fields_mapped.json', 'utf8'));

let aliasCode = 'const INTERNAL_KOBO_FIELD_ALIASES: Record<string, string[]> = {\n';

// Pour chaque champ dans GEM, s'il correspond à un originalName dans kobo, on ajoute son fullName en alias
// On veut aussi conserver les alias existants
const existingAliases = {
  Longueur_Cable_2_5mm_Int_rieure: ['Longueur_c\u00e2ble_2_5mm_Int_rieure'],
  Longueur_Cable_1_5mm_Int_rieure: ['Longueur_c\u00e2ble_1_5mm_Int_rieure'],
  Longueur_Tranch_e_Cable_arm_4mm: ['Longueur_Tranch_e_c\u00e2ble_arm_4mm'],
  Presence_de_Mur: ['New_Question'],
  Je_confirme_le_marqu_coffrets_lectriques: ['Je_confirme_le_marqu_s_coffret_lectrique']
};

const processed = new Set();

for (const field of mapped) {
  if (field.originalName && field.fullName !== field.originalName) {
    if (!processed.has(field.originalName)) {
       const existing = existingAliases[field.originalName] || [];
       if (!existing.includes(field.fullName)) {
         existing.push(field.fullName);
       }
       existingAliases[field.originalName] = existing;
       processed.add(field.originalName);
    }
  }
}

for (const [key, aliases] of Object.entries(existingAliases)) {
  aliasCode += `  ${key}: ${JSON.stringify(aliases)},\n`;
}

aliasCode += '};\n';
fs.writeFileSync('kobo_alias_generated.txt', aliasCode);
console.log('Aliases generated');
