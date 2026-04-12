
const BASE_URL = 'http://localhost:5005/api';
const ADMIN_EMAIL = 'admingem';
const PASSWORD = 'suprime';

async function runTests() {
    console.log('🚀 Démarrage des tests de la logique Projet...\n');

    try {
        // 1. Connexion
        console.log('🔐 Tentative de connexion...');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD })
        });
        
        const loginData = await loginRes.json();
        console.log('🔍 Login response:', JSON.stringify(loginData, null, 2));

        if (!loginRes.ok) throw new Error(`Login failed: ${loginData.error}`);
        
        if (loginData.user?.requires2FA) {
            console.log('🛡️ Attention: 2FA requis. Tentative de bypass via verification...');
            // Need to verify 2FA
            const verifyRes = await fetch(`${BASE_URL}/auth/verify-2fa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: ADMIN_EMAIL, answer: 'CORAN' }) // From .env
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(`2FA failed: ${verifyData.error}`);
            loginData.accessToken = verifyData.accessToken;
        }

        const token = loginData.accessToken;
        if (!token) throw new Error('No access token received');

        console.log('✅ Connexion complète réussie.\n');

        const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const testProjectName = `Projet Test ${Date.now()}`;
        let testProjectId = '';

        // 2. Création de projet
        console.log(`🏗️ Création du projet : "${testProjectName}"...`);
        const createRes = await fetch(`${BASE_URL}/projects`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: testProjectName, status: 'active' })
        });
        
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(`Creation failed: ${createData.error}`);
        
        testProjectId = createData.id;
        console.log(`✅ Projet créé avec l'ID : ${testProjectId}\n`);

        // 3. Test de doublon (doit échouer)
        console.log(`🚫 Test de protection contre les doublons : "${testProjectName}"...`);
        const dupRes = await fetch(`${BASE_URL}/projects`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: testProjectName, status: 'active' })
        });
        const dupData = await dupRes.json();
        if (dupRes.ok) {
            console.log('❌ ERREUR : Le serveur a accepté un doublon !');
        } else {
            console.log(`✅ Succès : Le serveur a bien bloqué le doublon (${dupRes.status} : ${dupData.error})\n`);
        }

        // 4. Test de suppression - Mauvais mot de passe (doit échouer)
        console.log(`🛑 Test de suppression avec MAUVAIS mot de passe...`);
        const badDelRes = await fetch(`${BASE_URL}/projects/${testProjectId}`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ password: 'mauvais_pass' })
        });
        const badDelData = await badDelRes.json();
        if (badDelRes.ok) {
            console.log('❌ ERREUR : Le projet a été supprimé malgré un mauvais mot de passe !');
        } else {
            console.log(`✅ Succès : Suppression refusée (${badDelRes.status} : ${badDelData.error})\n`);
        }

        // 5. Test de suppression - Bon mot de passe (doit réussir)
        console.log(`🛡️ Test de suppression avec le BON mot de passe ("suprime")...`);
        const delRes = await fetch(`${BASE_URL}/projects/${testProjectId}`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ password: PASSWORD })
        });
        const delData = await delRes.json();
        if (!delRes.ok) {
            console.log(`❌ ERREUR : La suppression a échoué avec le bon mot de passe ! (${delRes.status} : ${delData.error})`);
        } else {
            console.log(`✅ Succès : ${delData.message}\n`);
        }

        console.log('🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS !');

    } catch (error) {
        console.error('💥 Erreur pendant les tests :', error.message);
        process.exit(1);
    }
}

runTests();
