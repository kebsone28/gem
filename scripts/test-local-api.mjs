// Utilisation du fetch natif de Node 18+

async function testApi() {
    console.log('📡 TEST DE L\'API LOCALE (ADMIN MODULES)...');
    try {
        const response = await fetch('http://localhost:8888/api/admin/modules/config', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ ERREUR DE CONNEXION :', error.message);
        console.log('👉 Le backend local (8888) est-il bien lancé ?');
    }
}

testApi();
