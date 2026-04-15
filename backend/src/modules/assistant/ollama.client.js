import { config } from '../../core/config/config.js';
import logger from '../../utils/logger.js';

export async function queryOllama(prompt) {
  const endpoint = `${config.ai.ollamaBaseUrl}/api/generate`;
  const payload = {
    model: config.ai.ollamaModel || 'qwen2.5-coder:7b',
    prompt,
    stream: false
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  if (process.env.OLLAMA_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.OLLAMA_AUTH_TOKEN}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const errorMessage = `Ollama error ${response.status}: ${errorBody}`;
    logger.error(errorMessage, { endpoint, payload });
    
    if (response.status === 401) {
      logger.error('Ollama: Authentication required. Set OLLAMA_AUTH_TOKEN environment variable if needed.');
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data?.response?.trim() || '';
}
