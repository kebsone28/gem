import React, { useState, useEffect } from 'react';

interface AIModel {
  name: string;
  provider: string;
  free?: boolean;
}

const DeepSeekExample: React.FC = () => {
  const [prompt, setPrompt] = useState('Explain quantum entanglement in simple terms');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('gpt-5.4-nano');
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [modelInfo, setModelInfo] = useState('');

  // Load available models dynamically
  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).puter) {
        const puter = (window as any).puter;
        const models = await puter.ai.listModels();
        setAvailableModels(models);
        setModelInfo(`✅ ${models.length} modèles disponibles`);
        console.log('Available models:', models);
      }
    } catch (error) {
      setModelInfo('⚠️ Impossible de charger la liste dynamique');
      console.error('Error loading models:', error);
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setResponse('');
    
    try {
      // Check if puter is available (loaded via CDN)
      if (typeof window !== 'undefined' && (window as any).puter) {
        const puter = (window as any).puter;
        
        const chatResponse = await puter.ai.chat(prompt, {
          model: model
        });
        
        setResponse(chatResponse.message?.content || JSON.stringify(chatResponse));
      } else {
        // Fallback for demonstration - show how it would be imported
        setResponse('Puter.js not loaded. Please add the CDN script to your HTML:\n<script src="https://js.puter.com/v2/"></script>');
      }
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">🤖 Puter.js AI Models Integration</h2>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">Select Model:</label>
          <button
            onClick={loadModels}
            className="text-xs bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
          >
            🔄 Actualiser
          </button>
        </div>
        {modelInfo && <p className="text-xs text-gray-600 mb-2">{modelInfo}</p>}
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <optgroup label="🆓 GRATUIT (Utilisateur final)">
            <option value="gpt-5.4-nano">gpt-5.4-nano (Léger, ultra-rapide)</option>
            <option value="gpt-oss">gpt-oss (Open-source)</option>
            <option value="gpt-oss-120B">gpt-oss-120B (Large open-source)</option>
            <option value="qwen3.5-9b">qwen3.5-9b (Alibaba, multilingue)</option>
          </optgroup>
          <optgroup label="💳 PAYANT (Micro-crédits)">
            <optgroup label="  OpenAI">
              <option value="gpt-5.4">gpt-5.4 (Haute performance)</option>
              <option value="gpt-5.4-mini">gpt-5.4-mini</option>
              <option value="gpt-5.3-codex">gpt-5.3-codex (Code spécialisé)</option>
            </optgroup>
            <optgroup label="  Anthropic">
              <option value="claude-sonnet-4.6">claude-sonnet-4.6 (Équilibré)</option>
              <option value="claude-opus-4.7">claude-opus-4.7 (Puissant)</option>
            </optgroup>
            <optgroup label="  Google">
              <option value="gemini-3.1-flash">gemini-3.1-flash (Rapide)</option>
              <option value="gemini-3-pro">gemini-3-pro (Pro)</option>
            </optgroup>
            <optgroup label="  DeepSeek">
              <option value="deepseek-v3">deepseek-v3 (Dernière version)</option>
              <option value="deepseek-r1">deepseek-r1 (Raisonnement complexe)</option>
            </optgroup>
            <optgroup label="  Spécialisés">
              <option value="glm-5.1">glm-5.1 (Z.ai - Raisonnement avancé)</option>
              <option value="mimo-v2-pro">mimo-v2-pro (Xiaomi)</option>
              <option value="ring-2.6-1t">ring-2.6-1t (InclusionAI)</option>
              <option value="nemotron-3-super">nemotron-3-super (NVIDIA)</option>
            </optgroup>
          </optgroup>
        </select>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Prompt:</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full p-2 border rounded"
          placeholder="Enter your prompt here..."
        />
      </div>
      
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate Response'}
      </button>
      
      {response && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">Response:</h3>
          <p className="whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </div>
  );
};

export default DeepSeekExample;