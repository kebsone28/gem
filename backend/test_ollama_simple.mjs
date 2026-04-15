import { config } from './src/core/config/config.js';

async function testOllamaEndpoint() {
  try {
    console.log('🔍 Test de l\'endpoint Ollama...');
    console.log('📍 URL configurée:', config.ai.ollamaBaseUrl);
    console.log('🤖 Modèle:', config.ai.ollamaModel);

    const endpoint = `${config.ai.ollamaBaseUrl}/api/generate`;
    console.log('🔗 Endpoint complet:', endpoint);

    const testPrompt = 'Réponds simplement "Ollama fonctionne" si tu reçois ce message.';
    const payload = {
      model: config.ai.ollamaModel,
      prompt: testPrompt,
      stream: false
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (process.env.OLLAMA_AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.OLLAMA_AUTH_TOKEN}`;
      console.log('🔐 Token d\'authentification utilisé');
    }

    console.log('📤 Envoi de la requête...');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    console.log('📥 Statut HTTP:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ Erreur HTTP:', errorBody);
      
      if (response.status === 401) {
        console.log('\n💡 Le serveur retourne un 401 (Unauthorized)');
        console.log('📝 Solutions:');
        console.log('   1. Vérifier que le serveur Ollama est en mode public');
        console.log('   2. Configurer OLLAMA_AUTH_TOKEN si authentification requise');
        console.log('   3. Vérifier les paramètres réseau/firewall');
      }
      return false;
    }

    const data = await response.json();
    console.log('✅ Connexion Ollama réussie!');
    console.log('📝 Réponse:', data?.response?.trim() || 'Aucune réponse');

    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    console.error('🔧 Vérifiez que Ollama est démarré sur le serveur avec le modèle qwen2.5-coder:7b');
    return false;
  }
}

testOllamaEndpoint();