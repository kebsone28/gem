import { fetchKoboSubmissions } from './src/services/kobo.service.js';

async function checkKoboIdFormat() {
    try {
        console.log('=== Vérification du Format des IDs Kobo ===\n');
        
        const submissions = await fetchKoboSubmissions();
        
        if (submissions.length === 0) {
            console.log('❌ Aucune soumission Kobo trouvée');
            return;
        }

        console.log(`Trouvé ${submissions.length} soumission(s) Kobo\n`);

        // Vérifier les formats d'IDs
        const idFormats = new Set();
        const sampleIds = [];

        for (let i = 0; i < Math.min(3, submissions.length); i++) {
            const sub = submissions[i];
            const id = sub['_id'];
            const typeOf = typeof id;
            const format = `${typeOf} (${String(id).length} chars)`;
            
            idFormats.add(format);
            sampleIds.push({
                _id: id,
                type: typeOf,
                length: String(id).length,
                value: String(id)
            });

            console.log(`Sample ${i + 1}:`);
            console.log(`  _id: ${id}`);
            console.log(`  Type: ${typeOf}`);
            console.log(`  Length: ${String(id).length}`);
            console.log(`  Value: "${String(id).substring(0, 50)}${String(id).length > 50 ? '...' : ''}"`);
            console.log(`  Numeric? ${!isNaN(id) ? 'OUI' : 'NON'}`);
            console.log(`  UUID format? ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id)) ? 'OUI' : 'NON'}\n`);
        }

        console.log(`=== Formats Identifiés ===`);
        idFormats.forEach(fmt => console.log(`- ${fmt}`));

        // Vérifier autres champs utiles
        console.log(`\n=== Autres Champs de Soumission ===`);
        const firstSub = submissions[0];
        const keys = Object.keys(firstSub).filter(k => !k.startsWith('_') || k === '_id' || k === '_submission_time');
        console.log('Clés principales:', keys.slice(0, 10).join(', '));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkKoboIdFormat();
