import { queryOllama } from './src/modules/assistant/ollama.client.js';

async function testOllamaConnection() {
  try {
    console.log('🔍 Test de connexion Ollama sur le serveur distant...');
    console.log('📍 URL configurée:', 'https://proquelec.wanekoohost.com');

    const testPrompt = 'Réponds simplement "Ollama fonctionne" si tu reçois ce message.';
    const response = await queryOllama(testPrompt);

    console.log('✅ Connexion Ollama réussie!');
    console.log('📝 Réponse:', response);

    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion Ollama:', error.message);
    console.error('🔧 Vérifiez que Ollama est démarré sur le serveur avec le modèle qwen2.5-coder:7b');
    return false;
  }
}

testOllamaConnection();